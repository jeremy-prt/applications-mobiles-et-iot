import { ObjectId } from 'mongodb'
import { config } from '../config/index.ts'
import { logger, tracer, alerter } from '../logger.ts'
import { messagesBruts, type MessageBrut, type Statut } from '../db/mongo.ts'
import { Telemetrie, Etat, Disponibilite } from '../schemas/mqtt.ts'
import {
  enregistrerMesure,
  enregistrerEtat,
  enregistrerDisponibilite,
  etatsCourants,
  bootIdConnu,
} from '../db/mesures.ts'
import { recalculerTranches, purgerTranchesAnciennes } from '../db/agregats.ts'
import { tranchesTouchees } from '../domain/agregats.ts'
import { detecterBascules, vientDeLaSessionAnnoncee } from '../domain/surveillance.ts'
import { estDansLAvenir } from '../domain/fraicheur.ts'

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
    const motif = 'objet jamais apparu en base'
    await marquer(doc._id, 'abandonne', motif)
    alerter(
      {
        eventType: 'message_abandonne',
        eventId: doc.event_id,
        deviceId: doc.device_id,
        topic: doc.topic,
        status: 'abandonne',
        reason: 'objet_inconnu',
        essais,
      },
      'message abandonné',
    )
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
    // Le premier champ fautif suffit à expliquer le rejet et tient sur une
    // ligne de log, là où les `issues` complètes de Zod sont illisibles.
    const premier = parsed.error.issues[0]
    const motif = premier === undefined
      ? 'mesure non conforme au contrat'
      : `${premier.path.join('.')} : ${premier.message}`
    await marquer(doc._id, 'rejete', motif)
    alerter(
      {
        eventType: 'mesure_rejetee',
        eventId: doc.event_id,
        deviceId: doc.device_id,
        topic: doc.topic,
        status: 'rejete',
        reason: 'schema_invalide',
        champ: motif,
        issues: parsed.error.issues,
      },
      'mesure rejetée',
    )
    compteurs.rejetes += 1
    return
  }

  // Le contrat demande de vérifier que l'objet du topic et celui du message
  // sont le même. C'est ce contrôle qui refuse qu'un client publie une mesure
  // en se faisant passer pour un autre capteur.
  if (doc.device_id !== null && doc.device_id !== parsed.data.device_id) {
    const motif = 'identifiant du topic et du message différents'
    await marquer(doc._id, 'rejete', motif)
    alerter(
      {
        eventType: 'mesure_rejetee',
        eventId: doc.event_id,
        deviceId: doc.device_id,
        topic: doc.topic,
        status: 'rejete',
        reason: 'identite_incoherente',
        deviceIdRevendique: parsed.data.device_id,
      },
      'mesure rejetée, identifiant du topic et du message différents',
    )
    compteurs.rejetes += 1
    return
  }

  // Une mesure datée de l'avenir passerait devant l'état courant et l'y
  // bloquerait, tout en restant sous le seuil de fraîcheur. Ce contrôle est ici
  // et non dans le schéma, parce qu'il dépend de l'heure qu'il est.
  const observedAt = new Date(parsed.data.observed_at)
  if (estDansLAvenir(observedAt, new Date(), config.FUTURE_TOLERANCE_SECONDS)) {
    const motif = 'date d observation dans l avenir'
    await marquer(doc._id, 'rejete', motif)
    alerter(
      {
        eventType: 'mesure_rejetee',
        eventId: doc.event_id,
        deviceId: parsed.data.device_id,
        topic: doc.topic,
        status: 'rejete',
        reason: 'date_dans_l_avenir',
        observedAt: parsed.data.observed_at,
        toleranceSecondes: config.FUTURE_TOLERANCE_SECONDS,
      },
      'mesure rejetée, datée de l avenir',
    )
    compteurs.rejetes += 1
    return
  }

  // Le message vient-il de la session que l'objet a annoncée ? On trace sans
  // rejeter : le kit ne permet pas d'authentifier un objet, et un capteur qui
  // redémarre change de boot_id, donc un rejet perdrait des mesures vraies.
  const session = vientDeLaSessionAnnoncee(
    parsed.data.message_id,
    await bootIdConnu(parsed.data.device_id),
  )
  if (session === false) {
    alerter(
      {
        eventType: 'session_inattendue',
        eventId: doc.event_id,
        deviceId: parsed.data.device_id,
        topic: doc.topic,
        status: 'accepte',
        reason: 'session_inattendue',
        messageId: parsed.data.message_id,
      },
      'mesure acceptée mais hors session annoncée',
    )
  }

  const res = await enregistrerMesure(parsed.data)
  await marquer(doc._id, 'traite', res.doublon ? 'doublon écarté' : undefined)

  if (res.doublon) {
    alerter(
      {
        eventType: 'doublon_ecarte',
        eventId: doc.event_id,
        deviceId: parsed.data.device_id,
        topic: doc.topic,
        status: 'rejete',
        reason: 'doublon',
        messageId: parsed.data.message_id,
      },
      'doublon écarté',
    )
    compteurs.doublons += 1
    return
  }

  tracer(
    {
      eventType: 'mesure_enregistree',
      eventId: doc.event_id,
      deviceId: parsed.data.device_id,
      topic: doc.topic,
      // Dire si la mesure a pris l'état courant ou seulement rejoint
      // l'historique évite de croiser deux lignes pour le savoir.
      status: res.etatCourantMisAJour ? 'etat_courant_mis_a_jour' : 'historique_seulement',
      ...(res.etatCourantMisAJour ? {} : { reason: 'plus_ancienne_que_l_etat_courant' as const }),
      messageId: parsed.data.message_id,
      observedAt: parsed.data.observed_at,
      receivedAt: doc.received_at.toISOString(),
      // L'écart entre l'observation et la réception rend visible une mesure
      // rejouée en retard sans avoir à comparer deux lignes.
      retardMs: doc.received_at.getTime() - new Date(parsed.data.observed_at).getTime(),
    },
    'mesure enregistrée',
  )
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
    const motif = 'état non conforme au contrat'
    await marquer(doc._id, 'rejete', motif)
    alerter(
      {
        eventType: 'mesure_rejetee',
        eventId: doc.event_id,
        deviceId: doc.device_id,
        topic: doc.topic,
        status: 'rejete',
        reason: 'schema_invalide',
        issues: parsed.error.issues,
      },
      'état rejeté',
    )
    compteurs.rejetes += 1
    return
  }
  if (await enregistrerEtat(parsed.data)) {
    await marquer(doc._id, 'traite')
    tracer(
      {
        eventType: 'etat_applique',
        eventId: doc.event_id,
        deviceId: parsed.data.device_id,
        topic: doc.topic,
        status: 'accepte',
        ventilation: parsed.data.ventilation,
      },
      'état appliqué',
    )
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
    const motif = 'disponibilité non conforme au contrat'
    await marquer(doc._id, 'rejete', motif)
    alerter(
      {
        eventType: 'mesure_rejetee',
        eventId: doc.event_id,
        deviceId: doc.device_id,
        topic: doc.topic,
        status: 'rejete',
        reason: 'schema_invalide',
        issues: parsed.error.issues,
      },
      'disponibilité rejetée',
    )
    compteurs.rejetes += 1
    return
  }
  // La date de réception vient de la zone brute, pas de maintenant : le job
  // peut traiter un message reçu il y a plusieurs secondes, ou rejoué.
  if (await enregistrerDisponibilite(parsed.data, doc.received_at)) {
    await marquer(doc._id, 'traite')
    tracer(
      {
        eventType: 'disponibilite_appliquee',
        eventId: doc.event_id,
        deviceId: parsed.data.device_id,
        topic: doc.topic,
        status: 'accepte',
        disponibilite: parsed.data.status,
        causeAnnoncee: parsed.data.reason,
      },
      'disponibilité appliquée',
    )
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
      const motif = 'message illisible, JSON invalide'
      await marquer(doc._id, 'rejete', motif)
      alerter(
        {
          eventType: 'mesure_rejetee',
          eventId: doc.event_id,
          deviceId: doc.device_id,
          topic: doc.topic,
          status: 'rejete',
          reason: 'json_illisible',
        },
        'message illisible',
      )
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
      const motif = 'topic hors contrat'
      await marquer(doc._id, 'rejete', motif)
      alerter(
        {
          eventType: 'mesure_rejetee',
          eventId: doc.event_id,
          deviceId: doc.device_id,
          topic: doc.topic,
          status: 'rejete',
          reason: 'topic_hors_contrat',
        },
        'topic hors contrat',
      )
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
/**
 * Ce que la surveillance sait du dernier état de chaque objet, entre deux
 * passages. En mémoire : après un redémarrage, le premier passage réapprend
 * l'état de chacun sans rien annoncer.
 */
const fraicheurConnue = new Map<string, boolean>()

/** Signale les objets dont les mesures viennent de vieillir, ou de repartir. */
async function surveillerFraicheur(): Promise<void> {
  const changements = detecterBascules(
    await etatsCourants(),
    fraicheurConnue,
    new Date(),
    config.STALE_AFTER_SECONDS,
  )

  for (const c of changements) {
    const ancienne = c.bascule === 'devenue_ancienne'
    const evenement = {
      eventType: 'mesure_ancienne' as const,
      deviceId: c.deviceId,
      status: ancienne ? ('perdu' as const) : ('retabli' as const),
      bascule: c.bascule,
      ageSecondes: c.ageSecondes,
      seuilSecondes: config.STALE_AFTER_SECONDS,
      derniereMesure: c.recordedAt?.toISOString() ?? null,
    }
    if (ancienne) {
      alerter({ ...evenement, reason: 'aucune_mesure_depuis_le_seuil' }, 'donnée devenue ancienne')
    } else {
      tracer(evenement, 'donnée redevenue fraîche')
    }
  }
}

export function demarrerConsolidation(): () => void {
  let arrete = false
  let minuteur: NodeJS.Timeout | null = null

  const tour = async (): Promise<void> => {
    try {
      const compteurs = await consolider()
      if (compteurs.traites > 0 || compteurs.rejetes > 0 || compteurs.doublons > 0) {
        // Ces compteurs sont la preuve observable de l'ingestion : ils doivent
        // rester visibles avec le niveau info utilisé par défaut, notamment
        // pendant les scénarios de doublon et de message invalide.
        tracer({ eventType: 'consolidation_passage', ...compteurs }, 'consolidation')
      }
      await surveillerFraicheur()
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
