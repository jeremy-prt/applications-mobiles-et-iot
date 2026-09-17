import { config } from './config/index.ts'
import { logger, tracer } from './logger.ts'
import { creerServeur } from './http/server.ts'
import { demarrerMqtt } from './mqtt/index.ts'
import { demarrerConsolidation } from './jobs/consolidation.ts'
import { connecterMongo, fermerMongo } from './db/mongo.ts'
import { db } from './db/index.ts'

// Une promesse rejetée non gérée arrête le process depuis Node 15. On la trace
// avant de sortir, sinon le redémarrage du conteneur masque la cause.
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'promesse rejetée non gérée')
  process.exit(1)
})

// La base brute d'abord : le consommateur MQTT écrit dedans dès le premier
// message reçu, y compris les messages retained livrés à l'abonnement.
await connecterMongo()

const client = await demarrerMqtt()
const arreterConsolidation = demarrerConsolidation()
const app = creerServeur()

// 0.0.0.0 et pas localhost : le téléphone appelle l'API depuis le réseau local.
await app.listen({ port: config.PORT, host: '0.0.0.0' })
tracer({ eventType: 'api_demarree', port: config.PORT }, 'API démarrée')

async function arreter(signal: string) {
  tracer({ eventType: 'arret_demande', signal }, 'arrêt demandé')
  arreterConsolidation()
  await app.close()
  await client.endAsync()
  await fermerMongo()
  await db.destroy()
  process.exit(0)
}

process.on('SIGTERM', () => void arreter('SIGTERM'))
process.on('SIGINT', () => void arreter('SIGINT'))
