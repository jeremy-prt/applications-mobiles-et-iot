import mqtt, { type IClientOptions } from 'mqtt'
import { config } from '../config/index.ts'
import { logger } from '../logger.ts'
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

/** Extrait l'identifiant de correlation sans faire confiance au reste du corps. */
function eventIdDuPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const eventId = Reflect.get(payload, 'message_id')
  return typeof eventId === 'string' ? eventId : undefined
}

/**
 * Écrit le message tel qu'il arrive. Rien n'est validé ni calculé ici : c'est
 * le rôle du job de consolidation. Un message illisible est gardé sous forme de
 * texte plutôt que jeté, sinon on ne pourrait pas expliquer après coup ce que
 * le capteur avait envoyé.
 */
async function ecrireBrut(topic: string, payload: Buffer): Promise<void> {
  const texte = payload.toString('utf8')

  const document: MessageBrut = {
    topic,
    device_id: deviceIdDuTopic(topic),
    genre: genreDuTopic(topic),
    received_at: new Date(),
    statut: 'en_attente',
    essais: 0,
  }

  try {
    document.payload = JSON.parse(texte)
  } catch {
    document.texte = texte
  }

  await messagesBruts().insertOne(document)

  logger.info(
    {
      eventType: 'mqtt.message.received',
      deviceId: document.device_id ?? undefined,
      eventId: eventIdDuPayload(document.payload),
      topic,
      status: 'stored_raw',
    },
    'message MQTT stocké dans la zone brute',
  )
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
  logger.info({ url: config.MQTT_URL }, 'connecté au broker')

  client.on('error', (err) => logger.error({ err }, 'erreur MQTT'))
  client.on('reconnect', () => logger.warn('reconnexion au broker'))
  client.on('offline', () => logger.warn('broker injoignable'))

  const grants = await client.subscribeAsync({
    [TOPICS.telemetry]: { qos: 1 },
    [TOPICS.state]: { qos: 1 },
    [TOPICS.availability]: { qos: 1 },
  })

  for (const grant of grants) {
    // Un abonnement refusé ne lève pas d'erreur, il renvoie un QoS de 128.
    if (grant.qos === 128) {
      throw new Error(`abonnement refusé par le broker : ${grant.topic}`)
    }
    logger.info({ topic: grant.topic, qos: grant.qos }, 'abonné')
  }

  // Une exception non attrapée ici tuerait le process, et donc l'API avec.
  client.on('message', (topic, payload) => {
    ecrireBrut(topic, payload).catch((err) =>
      logger.error({ err, topic }, 'échec de l écriture du message brut'),
    )
  })

  return client
}
