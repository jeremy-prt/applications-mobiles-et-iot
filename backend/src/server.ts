import { config } from './config/index.ts'
import { logger } from './logger.ts'
import { creerServeur } from './http/server.ts'
import { demarrerMqtt } from './mqtt/index.ts'
import { db } from './db/index.ts'

// Une promesse rejetée non gérée arrête le process depuis Node 15. On la trace
// avant de sortir, sinon le redémarrage du conteneur masque la cause.
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'promesse rejetée non gérée')
  process.exit(1)
})

const client = await demarrerMqtt()
const app = creerServeur()

// 0.0.0.0 et pas localhost : le téléphone appelle l'API depuis le réseau local.
await app.listen({ port: config.PORT, host: '0.0.0.0' })
logger.info({ port: config.PORT }, 'API démarrée')

async function arreter(signal: string) {
  logger.info({ signal }, 'arrêt demandé')
  await app.close()
  await client.endAsync()
  await db.destroy()
  process.exit(0)
}

process.on('SIGTERM', () => void arreter('SIGTERM'))
process.on('SIGINT', () => void arreter('SIGINT'))
