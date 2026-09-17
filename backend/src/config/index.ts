import { z } from 'zod'

const Config = z.object({
  DATABASE_URL: z.string().min(1),
  MONGO_URL: z.string().default('mongodb://mongo:27017'),
  MONGO_DB: z.string().default('campus_brut'),
  MQTT_URL: z.string().default('mqtt://mosquitto:1883'),
  MQTT_USERNAME: z.string().default('backend'),
  MQTT_PASSWORD: z.string().min(1),
  MQTT_CLIENT_ID: z.string().default('campus-backend'),
  // QoS de nos abonnements. En 1 le broker garde les messages publiés pendant
  // une coupure du backend et les livre à la reconnexion, en 0 il ne garde
  // rien. Réglable parce que le scénario QoS de J3 compare les deux. Écrit
  // comme un choix entre deux valeurs et non comme un nombre, pour que le type
  // obtenu soit celui qu'attend la bibliothèque MQTT.
  MQTT_QOS: z
    .enum(['0', '1'])
    .default('1')
    .transform((v) => (v === '0' ? 0 : 1)),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
  // Nom porté par le champ `service` de chaque trace. Le job de rejeu tourne
  // dans le même conteneur que l'API, il le change pour ne pas être confondu
  // avec elle dans les logs centralisés.
  SERVICE_NAME: z.string().default('backend'),
  STALE_AFTER_SECONDS: z.coerce.number().default(30),
  // Avance maximale tolérée sur la date d'observation d'une mesure. Couvre
  // l'écart d'horloge entre le capteur et nous, sans laisser une mesure datée
  // de l'avenir geler l'état courant.
  FUTURE_TOLERANCE_SECONDS: z.coerce.number().default(10),
  CO2_ALERT_ON_PPM: z.coerce.number().default(1000),
  CO2_ALERT_OFF_PPM: z.coerce.number().default(800),
  // Période du job de consolidation. Doit rester très en dessous du seuil de
  // fraîcheur, sinon une mesure serait déjà ancienne en arrivant sur l'écran.
  CONSOLIDATION_INTERVAL_MS: z.coerce.number().default(5000),
  // Nombre de messages bruts traités par passage. Borne la durée d'un passage
  // pour qu'il ne monopolise pas le pool de connexions.
  CONSOLIDATION_BATCH: z.coerce.number().default(2000),
  // Le brut est gardé aussi longtemps que le consolidé : il sert à rejouer le
  // calcul sur la période qu'on affiche, pas au-delà.
  RAW_RETENTION_DAYS: z.coerce.number().default(7),
  // Largeur d'une tranche d'agrégat, en minutes.
  AGGREGATE_BUCKET_MINUTES: z.coerce.number().default(5),
})

const parsed = Config.safeParse(process.env)

if (!parsed.success) {
  // Le logger principal depend de la configuration et ne peut donc pas etre
  // importe ici. Cette erreur de demarrage respecte tout de meme le meme
  // contrat : une ligne JSON sur stdout, jamais du texte libre sur stderr.
  process.stdout.write(
    `${JSON.stringify({
      level: 50,
      time: new Date().toISOString(),
      service: 'backend',
      environment: process.env.NODE_ENV ?? 'development',
      error: z.treeifyError(parsed.error),
      msg: 'configuration invalide',
    })}\n`,
  )
  process.exit(1)
}

export const config = parsed.data
