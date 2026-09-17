import mqtt, { type IClientOptions } from 'mqtt'
import { config } from '../config/index.ts'
import { tracer, alerter, echouer, nouvelEventId } from '../logger.ts'
import { messagesBruts, type Genre, type MessageBrut } from '../db/mongo.ts'

const TOPICS = {
  telemetry: 'campus/v1/devices/+/telemetry',
  state: 'campus/v1/devices/+/state',
  availability: 'campus/v1/devices/+/availability',
} as const

/** Extrait l'identifiant de l'objet du topic. Le corps du message n'est pas lu ici. */
function deviceIdDuTopic(topic: string): string | null {
  const parts = topic.split('/')
  return parts.length === 5 ? (parts[3] ?? null) : null
}

function genreDuTopic(topic: string): Genre {
  if (topic.endsWith('/telemetry')) return 'telemetry'
  if (topic.endsWith('/state')) return 'state'
  if (topic.endsWith('/availability')) return 'availability'
  return 'inconnu'
}

/**
 * Écrit le message tel qu'il arrive. Rien n'est validé ni calculé ici : c'est
 * le rôle du job de consolidation. Un message illisible est gardé sous forme de
 * texte plutôt que jeté, sinon on ne pourrait pas expliquer après coup ce que
 * le capteur avait envoyé.
 */
async function ecrireBrut(topic: string, payload: Buffer): Promise<void> {
  const texte = payload.toString('utf8')
  const deviceId = deviceIdDuTopic(topic)
  const genre = genreDuTopic(topic)
  const eventId = nouvelEventId()

  const document: MessageBrut = {
    topic,
    device_id: deviceId,
    genre,
    event_id: eventId,
    received_at: new Date(),
    statut: 'en_attente',
    essais: 0,
  }

  let lisible = true
  try {
    document.payload = JSON.parse(texte)
  } catch {
    document.texte = texte
    lisible = false
  }

  await messagesBruts().insertOne(document)

  // Première trace du parcours. Elle est écrite après l'insertion, pour ne pas
  // annoncer une réception qui n'a pas été conservée.
  tracer(
    { eventType: 'message_recu', eventId, deviceId, topic, genre, octets: payload.byteLength, json: lisible },
    'message reçu',
  )
}

/**
 * Le client courant, gardé pour que la route de santé sache si le lien au
 * broker tient. Sans ça, `/health` répondait `ok` alors que plus aucune mesure
 * n'entrait, ce qui est le cas le plus trompeur pour un exploitant.
 */
let clientCourant: mqtt.MqttClient | null = null

export function brokerConnecte(): boolean {
  return clientCourant?.connected === true
}

export async function demarrerMqtt() {
  const options: IClientOptions = {
    clientId: config.MQTT_CLIENT_ID,
    // Session conservée par le broker : les messages QoS 1 publiés pendant une
    // coupure de notre backend sont livrés à la reconnexion. Impose un
    // identifiant client stable.
    clean: false,
    username: config.MQTT_USERNAME,
    password: config.MQTT_PASSWORD,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    resubscribe: true,
  }

  const client = await mqtt.connectAsync(config.MQTT_URL, options)
  clientCourant = client

  // Le handler est posé ici, avant le moindre `await`, et pas après l'abonnement.
  // Sur une session persistante, le broker envoie sa file dès la connexion
  // acceptée : les messages retenus pendant notre absence arrivent donc avant
  // que `subscribeAsync` ait répondu. Un handler posé plus loin les laisse
  // tomber en silence, ce qui vidait la quasi totalité de la reprise.
  // Une exception non attrapée ici tuerait le process, et donc l'API avec.
  client.on('message', (topic, payload) => {
    ecrireBrut(topic, payload).catch((err) =>
      echouer(
        {
          eventType: 'message_recu',
          topic,
          deviceId: deviceIdDuTopic(topic),
          status: 'perdu',
          reason: 'erreur_technique',
          erreur: String(err),
        },
        'échec de l écriture du message brut',
      ),
    )
  })
  tracer(
    { eventType: 'broker_connecte', status: 'retabli', url: config.MQTT_URL, clean: options.clean, qos: config.MQTT_QOS },
    'connecté au broker',
  )

  client.on('error', (err) =>
    echouer({ eventType: 'broker_erreur', reason: 'erreur_technique', erreur: String(err) }, 'erreur MQTT'),
  )
  client.on('reconnect', () => alerter({ eventType: 'broker_reconnexion' }, 'reconnexion au broker'))
  client.on('offline', () => alerter({ eventType: 'broker_perdu', status: 'perdu' }, 'broker injoignable'))

  // Le QoS de l'abonnement est réglable : le scénario QoS de J3 compare la même
  // coupure en 0 et en 1, et c'est ce niveau qui décide si le broker garde ou
  // non les messages publiés pendant notre absence.
  const qos = config.MQTT_QOS
  const grants = await client.subscribeAsync({
    [TOPICS.telemetry]: { qos },
    [TOPICS.state]: { qos },
    [TOPICS.availability]: { qos },
  })

  for (const grant of grants) {
    // Un abonnement refusé ne lève pas d'erreur, il renvoie un QoS de 128.
    if (grant.qos === 128) {
      throw new Error(`abonnement refusé par le broker : ${grant.topic}`)
    }
    tracer({ eventType: 'abonnement', topic: grant.topic, qos: grant.qos }, 'abonné')
  }


  return client
}
