import { z } from 'zod'

const Config = z.object({
  DATABASE_URL: z.string().min(1),
  MQTT_URL: z.string().default('mqtt://mosquitto:1883'),
  MQTT_USERNAME: z.string().default('backend'),
  MQTT_PASSWORD: z.string().min(1),
  MQTT_CLIENT_ID: z.string().default('campus-backend'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
  STALE_AFTER_SECONDS: z.coerce.number().default(30),
  CO2_ALERT_ON_PPM: z.coerce.number().default(1000),
  CO2_ALERT_OFF_PPM: z.coerce.number().default(800),
})

const parsed = Config.safeParse(process.env)

if (!parsed.success) {
  console.error('Configuration invalide :', z.treeifyError(parsed.error))
  process.exit(1)
}

export const config = parsed.data
