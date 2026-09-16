import { connecterMongo, messagesBruts, fermerMongo } from '../db/mongo.ts'
import { consolider } from './consolidation.ts'
import { db } from '../db/index.ts'
import { logger } from '../logger.ts'

/**
 * Rejoue la consolidation sur une période.
 *
 * C'est la raison d'être de la zone brute : si notre calcul était faux, on ne
 * touche pas aux messages reçus, on corrige le code et on relance ce script. Les
 * messages sont remis en attente et le job les relit.
 *
 * Utilisation : npm run rejouer -- 60      (les 60 dernières minutes)
 */

const minutes = Number(process.argv[2] ?? 60)

if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error('Usage : npm run rejouer -- <minutes>')
  process.exit(1)
}

const depuis = new Date(Date.now() - minutes * 60_000)

await connecterMongo()

const remis = await messagesBruts().updateMany(
  { received_at: { $gte: depuis } },
  { $set: { statut: 'en_attente', essais: 0 }, $unset: { processed_at: '', motif: '' } },
)

logger.info(
  { depuis: depuis.toISOString(), messages: remis.modifiedCount },
  'messages remis en attente',
)

// Les tranches d'agrégat sont recalculées à partir de telemetry, et l'insertion
// des mesures écarte les doublons : rejouer ne duplique donc rien.
let total = 0
for (;;) {
  const compteurs = await consolider()
  const traites = compteurs.traites + compteurs.doublons + compteurs.rejetes
  if (traites === 0) break
  total += traites
  logger.info(compteurs, 'passage de consolidation')
}

logger.info({ total }, 'rejeu terminé')

await fermerMongo()
await db.destroy()
