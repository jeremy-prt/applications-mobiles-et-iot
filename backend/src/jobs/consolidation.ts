import { ObjectId } from 'mongodb'
import { config } from '../config/index.ts'
import { logger } from '../logger.ts'
import { messagesBruts, type MessageBrut, type Statut } from '../db/mongo.ts'
import { Telemetrie, Etat, Disponibilite } from '../schemas/mqtt.ts'
import {
  enregistrerMesure,
  enregistrerEtat,
  enregistrerDisponibilite,
} from '../db/mesures.ts'
import { recalculerTranches, purgerTranchesAnciennes } from '../db/agregats.ts'
import { tranchesTouchees } from '../domain/agregats.ts'

/**
 * Le job de consolidation. Il relit la zone brute dans l'ordre d'arrivée,
 * applique les règles métier et écrit le résultat dans PostgreSQL.
 *
 * Toute la validation est ici, et plus dans le consommateur MQTT : la zone brute
 * doit accepter les messages invalides, c'est ce qui fait que rien n'est perdu
 * à l'ingestion et qu'on peut expliquer après coup ce qu'un capteur avait envoyé.
 */

/**
 * Les topics state et availability sont retained : le broker les livre dès
 * l'abonnement, donc avant la première mesure, à un moment où l'objet n'existe
 * pas encore en base. Le message reste alors en attente dans la zone brute et
 * repasse au tour suivant. Au-delà de cette limite on arrête d'essayer, sinon un
 * message orphelin serait relu jusqu'à sa suppression par la rétention.
 */
const ESSAIS_MAX = 60

interface Compteurs {
  traites: number
  doublons: number
  rejetes: number
  differes: number
  abandonnes: number
}

async function marquer(
  id: ObjectId,
  statut: Statut,
  motif?: string,
): Promise<void> {
  await messagesBruts().updateOne(
    { _id: id },
    { $set: { statut, processed_at: new Date(), ...(motif === undefined ? {} : { motif }) } },
  )
}

async function differer(doc: MessageBrut & { _id: ObjectId }): Promise<boolean> {
  const essais = doc.essais + 1
  if (essais >= ESSAIS_MAX) {
    await marquer(doc._id, 'abandonne', 'objet jamais apparu en base')
    return false
  }
  await messagesBruts().updateOne({ _id: doc._id }, { $set: { essais } })
  return true
}

async function traiterTelemetrie(
  doc: MessageBrut & { _id: ObjectId },
  compteurs: Compteurs,
  tranchesParObjet: Map<string, Date[]>,
): Promise<void> {
  const parsed = Telemetrie.safeParse(doc.payload)
  if (!parsed.success) {
    await marquer(doc._id, 'rejete', 'mesure non conforme au contrat')
    logger.warn({ topic: doc.topic, issues: parsed.error.issues }, 'mesure rejetée')
    compteurs.rejetes += 1
    return
  }

  // Le contrat demande de vérifier que l'objet du topic et celui du message
  // sont le même.
  if (doc.device_id !== null && doc.device_id !== parsed.data.device_id) {
    await marquer(doc._id, 'rejete', 'identifiant du topic et du message différents')
    logger.warn(
      { topic: doc.topic, device_id: parsed.data.device_id },
      'mesure rejetée, identifiant du topic et du message différents',
    )
    compteurs.rejetes += 1
    return
  }

  const res = await enregistrerMesure(parsed.data)
  await marquer(doc._id, 'traite', res.doublon ? 'doublon écarté' : undefined)

  if (res.doublon) {
    compteurs.doublons += 1
    return
  }

  compteurs.traites += 1
  const dates = tranchesParObjet.get(parsed.data.device_id) ?? []
  dates.push(new Date(parsed.data.observed_at))
  tranchesParObjet.set(parsed.data.device_id, dates)
}

async function traiterEtat(
  doc: MessageBrut & { _id: ObjectId },
  compteurs: Compteurs,
): Promise<void> {
  const parsed = Etat.safeParse(doc.payload)
  if (!parsed.success) {
    await marquer(doc._id, 'rejete', 'état non conforme au contrat')
    compteurs.rejetes += 1
    return
  }
  if (await enregistrerEtat(parsed.data)) {
    await marquer(doc._id, 'traite')
    compteurs.traites += 1
    return
  }
  if (await differer(doc)) compteurs.differes += 1
  else compteurs.abandonnes += 1
}

async function traiterDisponibilite(
  doc: MessageBrut & { _id: ObjectId },
  compteurs: Compteurs,
): Promise<void> {
  const parsed = Disponibilite.safeParse(doc.payload)
  if (!parsed.success) {
    await marquer(doc._id, 'rejete', 'disponibilité non conforme au contrat')
    compteurs.rejetes += 1
    return
  }
  // La date de réception vient de la zone brute, pas de maintenant : le job
  // peut traiter un message reçu il y a plusieurs secondes, ou rejoué.
  if (await enregistrerDisponibilite(parsed.data, doc.received_at)) {
    await marquer(doc._id, 'traite')
    compteurs.traites += 1
    return
  }
  if (await differer(doc)) compteurs.differes += 1
  else compteurs.abandonnes += 1
}

/** Un passage du job. Exporté pour pouvoir le déclencher à la main. */
export async function consolider(): Promise<Compteurs> {
  const compteurs: Compteurs = {
    traites: 0,
    doublons: 0,
    rejetes: 0,
    differes: 0,
    abandonnes: 0,
  }

  const docs = await messagesBruts()
    .find({ statut: 'en_attente' })
    .sort({ received_at: 1 })
    .limit(config.CONSOLIDATION_BATCH)
    .toArray()

  if (docs.length === 0) return compteurs

  // Les tranches ne sont recalculées qu'une fois par passage, pas à chaque
  // mesure : un lot de 150 mesures touche une ou deux tranches.
  const tranchesParObjet = new Map<string, Date[]>()

  for (const doc of docs) {
    // Ordre d'arrivée respecté : un état publié après une mesure doit être
    // appliqué après elle.
    if (doc.payload === undefined) {
      await marquer(doc._id, 'rejete', 'message illisible, JSON invalide')
      compteurs.rejetes += 1
      continue
    }

    if (doc.genre === 'telemetry') {
      await traiterTelemetrie(doc, compteurs, tranchesParObjet)
    } else if (doc.genre === 'state') {
      await traiterEtat(doc, compteurs)
    } else if (doc.genre === 'availability') {
      await traiterDisponibilite(doc, compteurs)
    } else {
      await marquer(doc._id, 'rejete', 'topic hors contrat')
      compteurs.rejetes += 1
    }
  }

  for (const [deviceId, dates] of tranchesParObjet) {
    await recalculerTranches(
      deviceId,
      tranchesTouchees(dates, config.AGGREGATE_BUCKET_MINUTES),
    )
  }

  return compteurs
}

/**
 * Lance le job en boucle. Les passages ne se chevauchent pas : le suivant est
 * programmé quand le précédent est fini, sinon un passage lent en lancerait un
 * second sur les mêmes messages.
 */
export function demarrerConsolidation(): () => void {
  let arrete = false
  let minuteur: NodeJS.Timeout | null = null

  const tour = async (): Promise<void> => {
    try {
      const compteurs = await consolider()
      if (compteurs.traites > 0 || compteurs.rejetes > 0 || compteurs.doublons > 0) {
        // Ces compteurs sont la preuve observable de l'ingestion : ils doivent
        // rester visibles avec le niveau info utilise par defaut, notamment
        // pendant les scenarios de doublon et de message invalide.
        logger.info(compteurs, 'consolidation')
      }
      await purgerTranchesAnciennes()
    } catch (err) {
      // Une erreur ne doit pas arrêter la boucle : les messages restent en
      // attente dans la zone brute et repassent au tour suivant.
      logger.error({ err }, 'échec d un passage de consolidation')
    }
    if (!arrete) minuteur = setTimeout(() => void tour(), config.CONSOLIDATION_INTERVAL_MS)
  }

  void tour()
  logger.info({ periode_ms: config.CONSOLIDATION_INTERVAL_MS }, 'consolidation démarrée')

  return () => {
    arrete = true
    if (minuteur !== null) clearTimeout(minuteur)
  }
}
