import { pino } from 'pino'
import { config } from './config/index.ts'

export const logger = pino({ level: config.LOG_LEVEL })
