import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { z } from 'zod'
import { sql } from 'kysely'
import { config } from '../config/index.ts'
import { logger } from '../logger.ts'
import { mongoRepond } from '../db/mongo.ts'
import { brokerConnecte } from '../mqtt/index.ts'
import { db } from '../db/index.ts'
import { estAncienne } from '../domain/fraicheur.ts'
import { lireHistorique, objetExiste } from '../db/historique.ts'

const Mesure = z.object({
  device_id: z.string(),
  room_id: z.string(),
  temperature: z.object({ value: z.number(), unit: z.string() }).nullable(),
  co2: z.object({ value: z.number(), unit: z.string() }).nullable(),
  recorded_at: z.string().nullable(),
  is_stale: z.boolean(),
  availability: z.string().nullable(),
  ventilation: z.boolean().nullable(),
})
type Mesure = z.infer<typeof Mesure>

/** Forme d'erreur unique de l'API : le mobile s'appuie sur code, jamais sur message. */
const Erreur = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

/**
 * Une lecture d'historique est toujours bornée. La limite maximale est celle
 * déclarée dans docs/architecture.md, avant les tests de recette.
 */
const POINTS_MAX = 500
const FENETRE_PAR_DEFAUT_MS = 24 * 3600 * 1000

const RequeteHistorique = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  resolution: z.enum(['raw', '5m']).default('raw'),
  limit: z.coerce.number().int().min(1).max(POINTS_MAX).default(POINTS_MAX),
})

const Point = z.object({
  at: z.string(),
  temperature: z.number(),
  co2: z.number(),
  samples: z.number().nullable(),
  temperature_min: z.number().nullable(),
  temperature_max: z.number().nullable(),
  co2_min: z.number().nullable(),
  co2_max: z.number().nullable(),
})

const Historique = z.object({
  device_id: z.string(),
  resolution: z.enum(['raw', '5m']),
  from: z.string(),
  to: z.string(),
  limit: z.number(),
  truncated: z.boolean(),
  points: z.array(Point),
})

const Salle = z.object({
  id: z.string(),
  label: z.string(),
  devices: z.array(Mesure),
})
type Salle = z.infer<typeof Salle>

export function creerServeur() {
  const app = Fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  /**
   * L'état réel de la chaîne, et pas seulement celui de la base.
   *
   * Avant, un seul `select 1` sur PostgreSQL décidait de tout : l'API
   * répondait `ok` alors que le broker était tombé, ou que MongoDB était mort
   * et que chaque message reçu était perdu. C'est le cas le plus trompeur,
   * parce que l'exploitant voit un service vert pendant que plus rien n'entre.
   *
   * Trois états, et deux usages distincts. `ok` : tout fonctionne. `degraded` :
   * l'API sait encore répondre avec ce qu'elle a en base, mais l'ingestion est
   * cassée. `down` : PostgreSQL ne répond pas, il n'y a plus rien à servir.
   *
   * Le code HTTP sépare ces deux usages. Un orchestrateur regarde le code : 200
   * tant que le processus peut servir, 503 quand il ne peut plus, et redémarrer
   * ne réparerait pas un broker absent. Un exploitant lit le corps, qui dit quel
   * composant est en cause.
   */
  const SanteComposants = z.object({
    postgres: z.boolean(),
    mongo: z.boolean(),
    broker: z.boolean(),
  })
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({ status: z.string(), db: z.boolean(), composants: SanteComposants }),
          503: z.object({ status: z.string(), db: z.boolean(), composants: SanteComposants }),
        },
      },
    },
    async (_requete, reponse) => {
      let postgres = true
      try {
        await sql`select 1`.execute(db)
      } catch {
        postgres = false
      }
      const composants = {
        postgres,
        mongo: await mongoRepond(),
        broker: brokerConnecte(),
      }

      // L'ingestion a besoin des trois : le broker apporte les messages, Mongo
      // les conserve, PostgreSQL reçoit le résultat consolidé.
      const tout = composants.postgres && composants.mongo && composants.broker
      const status = !postgres ? 'down' : tout ? 'ok' : 'degraded'

      // `db` est conservé pour ne pas casser les appelants écrits en J1.
      return reponse.code(postgres ? 200 : 503).send({ status, db: postgres, composants })
    },
  )

  app.get(
    '/rooms',
    { schema: { response: { 200: z.object({ rooms: z.array(Salle) }) } } },
    async () => {
      const lignes = await db
        .selectFrom('devices')
        .innerJoin('rooms', 'rooms.id', 'devices.room_id')
        .leftJoin('device_state', 'device_state.device_id', 'devices.id')
        .select([
          'devices.id as device_id',
          'rooms.id as room_id',
          'rooms.label as room_label',
          'device_state.recorded_at',
          'device_state.temperature_c',
          'device_state.co2_ppm',
          'device_state.availability',
          'device_state.ventilation',
        ])
        .orderBy('rooms.id')
        .orderBy('devices.id')
        .execute()

      const maintenant = new Date()
      const parSalle = new Map<string, Salle>()

      for (const l of lignes) {
        const salle = parSalle.get(l.room_id) ?? {
          id: l.room_id,
          label: l.room_label,
          devices: [],
        }
        salle.devices.push({
          device_id: l.device_id,
          room_id: l.room_id,
          temperature:
            l.temperature_c === null ? null : { value: l.temperature_c, unit: '°C' },
          co2: l.co2_ppm === null ? null : { value: l.co2_ppm, unit: 'ppm' },
          recorded_at: l.recorded_at?.toISOString() ?? null,
          is_stale: estAncienne(l.recorded_at, maintenant, config.STALE_AFTER_SECONDS),
          availability: l.availability,
          ventilation: l.ventilation,
        })
        parSalle.set(l.room_id, salle)
      }

      return { rooms: [...parSalle.values()] }
    },
  )

  app.get(
    '/devices/:id/telemetry',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        querystring: RequeteHistorique,
        response: { 200: Historique, 404: Erreur },
      },
    },
    async (requete, reponse) => {
      const { id } = requete.params
      const { from, to, resolution, limit } = requete.query

      if (!(await objetExiste(id))) {
        return reponse
          .code(404)
          .send({ error: { code: 'DEVICE_NOT_FOUND', message: 'Objet inconnu' } })
      }

      const fin = to === undefined ? new Date() : new Date(to)
      const debut =
        from === undefined ? new Date(fin.getTime() - FENETRE_PAR_DEFAUT_MS) : new Date(from)

      const points = await lireHistorique(id, { from: debut, to: fin, limit, resolution })

      return {
        device_id: id,
        resolution,
        from: debut.toISOString(),
        to: fin.toISOString(),
        limit,
        // Dit au mobile que la période contient plus de points que la limite,
        // pour qu'il n'affiche pas une portion comme si c'était le tout.
        truncated: points.length === limit,
        points,
      }
    },
  )

  return app
}
