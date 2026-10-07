import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { z } from 'zod'
import { sql } from 'kysely'
import { config } from '../config/index.ts'
import { logger, tracer, alerter, echouer, type Motif } from '../logger.ts'
import { mongoRepond } from '../db/mongo.ts'
import { brokerConnecte, publierCommande } from '../mqtt/index.ts'
import { db } from '../db/index.ts'
import { estAncienne } from '../domain/fraicheur.ts'
import { comparerDemande, dateExpiration } from '../domain/commandes.ts'
import { lireHistorique, objetExiste } from '../db/historique.ts'
import {
  creerCommande,
  lireCommande,
  lireObjetCommandable,
  marquerPubliee,
  type Commande,
} from '../db/commandes.ts'
import { CommandId } from '../schemas/mqtt.ts'

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

const DemandeCommande = z.object({
  command_id: CommandId,
  enabled: z.boolean(),
})

const CommandeReponse = z.object({
  command_id: z.string(),
  device_id: z.string(),
  action: z.string(),
  enabled: z.boolean(),
  status: z.enum(['pending', 'executed', 'rejected', 'unknown']),
  reason: z.string().nullable(),
  requested_at: z.string(),
  published_at: z.string().nullable(),
  expires_at: z.string(),
  result_at: z.string().nullable(),
  late: z.boolean(),
})

function versReponse(c: Commande): z.infer<typeof CommandeReponse> {
  return {
    command_id: c.command_id,
    device_id: c.device_id,
    action: c.action,
    enabled: c.enabled,
    status: c.status,
    reason: c.reason,
    requested_at: c.requested_at.toISOString(),
    published_at: c.published_at?.toISOString() ?? null,
    expires_at: c.expires_at.toISOString(),
    result_at: c.result_at?.toISOString() ?? null,
    late: c.late,
  }
}

/**
 * Le temps qu'on laisse au broker pour accuser réception avant de répondre au
 * mobile. Au-delà la réponse part sans `published_at`, la publication continue
 * et l'attente maximale de la commande la couvre.
 */
const ATTENTE_ACCUSE_MS = 2000

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

  // Sans ça, une requête invalide recevait la forme d'erreur de Fastify et pas
  // celle de docs/api.md, sur laquelle le mobile s'appuie.
  app.setErrorHandler((err: { statusCode?: number; message: string; validation?: unknown }, requete, reponse) => {
    const code = err.statusCode ?? 500
    if (code >= 500) {
      requete.log.error({ err }, 'erreur interne')
      return reponse.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne' } })
    }
    if (requete.routeOptions.url === '/devices/:id/commands') {
      const params = requete.params as { id?: string }
      const corps = requete.body as { command_id?: unknown } | undefined
      alerter(
        {
          eventType: 'commande_refusee',
          deviceId: params.id ?? null,
          commandId: typeof corps?.command_id === 'string' ? corps.command_id : null,
          status: 'rejete',
          reason: 'requete_invalide',
          detail: err.message,
        },
        'commande refusée, requête invalide',
      )
    }
    return reponse.code(code).send({ error: { code: 'INVALID_REQUEST', message: err.message } })
  })

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

  app.post(
    '/devices/:id/commands',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: DemandeCommande,
        response: { 200: CommandeReponse, 202: CommandeReponse, 403: Erreur, 404: Erreur, 409: Erreur },
      },
    },
    async (requete, reponse) => {
      const deviceId = requete.params.id
      const { command_id: commandId, enabled } = requete.body

      const refuser = (http: 403 | 404 | 409, code: string, message: string, reason: Motif) => {
        alerter({ eventType: 'commande_refusee', commandId, deviceId, status: 'rejete', reason, codeHttp: http }, 'commande refusée')
        return reponse.code(http).send({ error: { code, message } })
      }
      const renvoi = (existante: Commande) => {
        if (comparerDemande(existante, { device_id: deviceId, enabled }) === 'conflit') {
          return refuser(409, 'COMMAND_ID_CONFLICT', 'Identifiant de commande déjà utilisé avec un autre contenu', 'command_id_en_conflit')
        }
        // Pas de nouvelle publication : l'objet exécuterait deux fois.
        tracer(
          { eventType: 'commande_doublon', commandId, deviceId, status: 'ignore', reason: 'doublon', origine: 'api', statutConserve: existante.status },
          'commande déjà reçue, pas de nouvelle publication',
        )
        return reponse.code(200).send(versReponse(existante))
      }

      // Le renvoi est reconnu avant de regarder l'objet : une commande déjà
      // acceptée reste lisible même si l'objet est passé hors ligne depuis.
      const existante = await lireCommande(commandId)
      if (existante !== undefined) return renvoi(existante)

      const objet = await lireObjetCommandable(deviceId)
      if (objet === undefined) return refuser(404, 'DEVICE_NOT_FOUND', 'Objet inconnu', 'objet_inconnu')
      if (!objet.autorise) return refuser(403, 'DEVICE_NOT_AUTHORIZED', 'Objet non autorisé', 'objet_non_autorise')
      // Le kit ne garde pas les commandes d'un objet absent : elle serait perdue.
      if (objet.availability === 'offline') return refuser(409, 'DEVICE_OFFLINE', 'Objet hors ligne', 'objet_hors_ligne')

      const maintenant = new Date()
      const creee = await creerCommande({
        command_id: commandId,
        device_id: deviceId,
        enabled,
        requested_at: maintenant,
        expires_at: dateExpiration(maintenant, config.COMMAND_EXPIRES_SECONDS),
      })
      if (creee === undefined) {
        // Un renvoi simultané a inséré la même clé entre notre lecture et notre écriture.
        const gagnante = await lireCommande(commandId)
        if (gagnante !== undefined) return renvoi(gagnante)
        throw new Error('commande introuvable après un conflit d insertion')
      }
      tracer(
        { eventType: 'commande_acceptee', commandId, deviceId, status: 'accepte', enabled, expiresAt: creee.expires_at.toISOString() },
        'commande acceptée',
      )

      let publieeA: Date | null = null
      const publication = publierCommande(deviceId, {
        schema_version: 1,
        command_id: commandId,
        action: 'set_ventilation',
        enabled,
        expires_at: creee.expires_at.toISOString(),
      })
        .then(async () => {
          const accuseA = new Date()
          await marquerPubliee(commandId, accuseA)
          publieeA = accuseA
          tracer(
            {
              eventType: 'commande_publiee',
              commandId,
              deviceId,
              topic: `campus/v1/devices/${deviceId}/commands`,
              status: 'accepte',
              delaiAccuseMs: accuseA.getTime() - maintenant.getTime(),
            },
            'commande publiée, accusée par le broker',
          )
        })
        .catch((err: unknown) =>
          echouer(
            { eventType: 'commande_non_publiee', commandId, deviceId, status: 'perdu', reason: 'publication_echouee', erreur: String(err) },
            'échec de la publication de la commande',
          ),
        )
      let minuteur: NodeJS.Timeout | undefined
      await Promise.race([
        publication,
        new Promise((resoudre) => {
          minuteur = setTimeout(resoudre, ATTENTE_ACCUSE_MS)
        }),
      ])
      clearTimeout(minuteur)

      // Pas de relecture en base : sous charge, le pool de 10 connexions est
      // partagé avec la consolidation, chaque requête épargnée compte.
      return reponse.code(202).send(versReponse({ ...creee, published_at: publieeA }))
    },
  )

  app.get(
    '/commands/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: { 200: CommandeReponse, 404: Erreur },
      },
    },
    async (requete, reponse) => {
      const commande = await lireCommande(requete.params.id)
      if (commande === undefined) {
        return reponse
          .code(404)
          .send({ error: { code: 'COMMAND_NOT_FOUND', message: 'Commande inconnue' } })
      }
      return versReponse(commande)
    },
  )

  return app
}
