import { pino } from 'pino'
import { config } from './config/index.ts'

/**
 * Journal applicatif unique du backend.
 *
 * Pino ecrit une ligne JSON par evenement sur stdout par defaut. Les champs de
 * base rendent la source identifiable meme hors de Docker, tandis que l'heure
 * ISO est directement lisible dans Loki et dans une preuve exportee.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service: 'backend',
    environment: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
