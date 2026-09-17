import { MongoClient, type Collection, type Db } from 'mongodb'
import { config } from '../config/index.ts'
import { logger } from '../logger.ts'

/**
 * Zone brute. Le consommateur MQTT écrit ici le message tel qu'il arrive, sans
 * le valider et sans rien en calculer. Le job de consolidation le relit ensuite
 * et écrit le résultat dans PostgreSQL.
 *
 * L'intérêt n'est pas la panne du backend : si le backend est éteint, personne
 * n'écrit, ni ici ni ailleurs. Ce qui protège de ça c'est la session persistante
 * du broker. La zone brute protège d'autre chose : d'une erreur dans notre
 * propre traitement. Le message reste tel qu'il est arrivé, donc on peut
 * corriger le calcul et le rejouer.
 */

/** Ce que le job sait faire d'un message, déduit du seul topic. */
export type Genre = 'telemetry' | 'state' | 'availability' | 'inconnu'

/** `en_attente` inclut les messages différés : l'objet n'existe pas encore. */
export type Statut = 'en_attente' | 'traite' | 'rejete' | 'abandonne'

export interface MessageBrut {
  topic: string
  /** Extrait du topic, pas du corps : c'est du routage, pas une règle métier. */
  device_id: string | null
  genre: Genre
  /**
   * L'identifiant de corrélation, créé à la réception. Il est écrit ici parce
   * que la réception et le traitement sont séparés de quelques secondes et se
   * passent dans deux endroits du code : sans lui, rien ne relierait la trace
   * de l'arrivée du message à celle de son traitement.
   */
  event_id: string
  /** Le message décodé. Absent quand ce n'était pas du JSON. */
  payload?: unknown
  /** Le texte original, gardé seulement quand on n'a pas su le décoder. */
  texte?: string
  received_at: Date
  statut: Statut
  essais: number
  processed_at?: Date
  /** Pourquoi le message a été rejeté ou abandonné. */
  motif?: string
}

let client: MongoClient | null = null
let base: Db | null = null

export async function connecterMongo(): Promise<Db> {
  if (base !== null) return base

  client = new MongoClient(config.MONGO_URL, {
    // Le consommateur MQTT reçoit les messages un par un : on veut savoir vite
    // que l'écriture a échoué plutôt que de faire grossir une file en mémoire.
    serverSelectionTimeoutMS: 5000,
  })
  await client.connect()
  base = client.db(config.MONGO_DB)

  const col = base.collection<MessageBrut>('messages')

  // Le job lit les messages non traités dans leur ordre d'arrivée.
  await col.createIndex({ statut: 1, received_at: 1 }, { name: 'a_consolider' })

  // Rétention automatique, tenue par MongoDB et non par un script à nous.
  await col.createIndex(
    { received_at: 1 },
    { name: 'retention', expireAfterSeconds: config.RAW_RETENTION_DAYS * 86_400 },
  )

  // Le parcours d'une mesure se cherche par son identifiant de corrélation.
  await col.createIndex({ event_id: 1 }, { name: 'correlation' })

  logger.info(
    { url: config.MONGO_URL, base: config.MONGO_DB },
    'connecté à la base brute',
  )
  return base
}

export function messagesBruts(): Collection<MessageBrut> {
  if (base === null) throw new Error('base brute non connectée')
  return base.collection<MessageBrut>('messages')
}

export async function fermerMongo(): Promise<void> {
  await client?.close()
  client = null
  base = null
}
