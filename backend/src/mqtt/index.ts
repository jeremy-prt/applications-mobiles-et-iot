import mqtt, { type IClientOptions } from 'mqtt'
import { config } from '../config/index.ts'
import { logger } from '../logger.ts'
import { Telemetrie, Etat, Disponibilite } from '../schemas/mqtt.ts'
import {
  enregistrerMesure,
  enregistrerEtat,
  enregistrerDisponibilite,
} from '../db/mesures.ts'

const TOPICS = {
  telemetry: 'campus/v1/devices/+/telemetry',
  state: 'campus/v1/devices/+/state',
  availability: 'campus/v1/devices/+/availability',
} as const

/**
 * Les topics state et availability sont retained : le broker nous les livre dès
 * l'abonnement, donc avant la première mesure, à un moment où l'objet n'existe
 * pas encore dans notre base. On les garde de côté et on les applique dès que
 * l'objet apparaît. Sans ça, la ventilation et la disponibilité resteraient
 * vides jusqu'au prochain changement d'état.
 */
const enAttente = new Map<string, { etat?: Etat; disponibilite?: Disponibilite }>()

async function appliquerEnAttente(deviceId: string): Promise<void> {
  const attente = enAttente.get(deviceId)
  if (attente === undefined) return
  enAttente.delete(deviceId)
  if (attente.etat !== undefined) await enregistrerEtat(attente.etat)
  if (attente.disponibilite !== undefined) {
    await enregistrerDisponibilite(attente.disponibilite)
  }
}

/** Extrait l'identifiant de l'objet du topic, pour le comparer au message. */
function deviceIdDuTopic(topic: string): string | null {
  const parts = topic.split('/')
  return parts.length === 5 ? (parts[3] ?? null) : null
}

async function traiter(topic: string, payload: Buffer): Promise<void> {
  let brut: unknown
  try {
    brut = JSON.parse(payload.toString('utf8'))
  } catch {
    logger.warn({ topic }, 'message MQTT illisible, JSON invalide')
    return
  }

  const attendu = deviceIdDuTopic(topic)

  if (topic.endsWith('/telemetry')) {
    const parsed = Telemetrie.safeParse(brut)
    if (!parsed.success) {
      logger.warn({ topic, issues: parsed.error.issues }, 'mesure rejetée')
      return
    }
    // Le contrat demande de vérifier que l'objet du topic et celui du message
    // sont le même.
    if (attendu !== null && attendu !== parsed.data.device_id) {
      logger.warn(
        { topic, device_id: parsed.data.device_id },
        'mesure rejetée, identifiant du topic et du message différents',
      )
      return
    }
    const res = await enregistrerMesure(parsed.data)
    await appliquerEnAttente(parsed.data.device_id)
    logger.debug(
      {
        device_id: parsed.data.device_id,
        message_id: parsed.data.message_id,
        doublon: res.doublon,
        etat_mis_a_jour: res.etatCourantMisAJour,
      },
      res.doublon ? 'doublon écarté' : 'mesure enregistrée',
    )
    return
  }

  if (topic.endsWith('/state')) {
    const parsed = Etat.safeParse(brut)
    if (!parsed.success) {
      logger.warn({ topic, issues: parsed.error.issues }, 'état rejeté')
      return
    }
    const applique = await enregistrerEtat(parsed.data)
    if (!applique) {
      const attente = enAttente.get(parsed.data.device_id) ?? {}
      attente.etat = parsed.data
      enAttente.set(parsed.data.device_id, attente)
    }
    return
  }

  if (topic.endsWith('/availability')) {
    const parsed = Disponibilite.safeParse(brut)
    if (!parsed.success) {
      logger.warn({ topic, issues: parsed.error.issues }, 'disponibilité rejetée')
      return
    }
    const applique = await enregistrerDisponibilite(parsed.data)
    if (!applique) {
      const attente = enAttente.get(parsed.data.device_id) ?? {}
      attente.disponibilite = parsed.data
      enAttente.set(parsed.data.device_id, attente)
    }
  }
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
    traiter(topic, payload).catch((err) =>
      logger.error({ err, topic }, 'échec du traitement du message'),
    )
  })

  return client
}
