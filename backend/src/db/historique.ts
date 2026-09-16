import { db } from './index.ts'

/**
 * Lecture de l'historique d'un objet.
 *
 * Toutes les lectures sont bornées et suivent un index : la lecture d'historique
 * partage le pool de connexions avec le job de consolidation, et une requête qui
 * parcourt toute la table retarderait l'écriture des mesures.
 */

export type Resolution = 'raw' | '5m'

export interface Point {
  at: string
  temperature: number
  co2: number
  samples: number | null
  temperature_min: number | null
  temperature_max: number | null
  co2_min: number | null
  co2_max: number | null
}

export interface Criteres {
  from: Date
  to: Date
  limit: number
  resolution: Resolution
}

export async function objetExiste(deviceId: string): Promise<boolean> {
  const ligne = await db
    .selectFrom('devices')
    .select('id')
    .where('id', '=', deviceId)
    .executeTakeFirst()
  return ligne !== undefined
}

/**
 * Les points les plus récents de la période sont sélectionnés, puis remis dans
 * l'ordre chronologique. Prendre les plus anciens laisserait l'écran sur une
 * période qui ne bouge plus dès que la limite est atteinte.
 */
export async function lireHistorique(
  deviceId: string,
  criteres: Criteres,
): Promise<Point[]> {
  if (criteres.resolution === '5m') {
    const lignes = await db
      .selectFrom('telemetry_bucket')
      .select([
        'bucket_start',
        'samples',
        'temperature_avg',
        'temperature_min',
        'temperature_max',
        'co2_avg',
        'co2_min',
        'co2_max',
      ])
      .where('device_id', '=', deviceId)
      .where('bucket_start', '>=', criteres.from)
      .where('bucket_start', '<=', criteres.to)
      .orderBy('bucket_start', 'desc')
      .limit(criteres.limit)
      .execute()

    return lignes
      .map((l) => ({
        at: l.bucket_start.toISOString(),
        temperature: l.temperature_avg,
        co2: l.co2_avg,
        samples: l.samples,
        temperature_min: l.temperature_min,
        temperature_max: l.temperature_max,
        co2_min: l.co2_min,
        co2_max: l.co2_max,
      }))
      .reverse()
  }

  const lignes = await db
    .selectFrom('telemetry')
    .select(['recorded_at', 'temperature_c', 'co2_ppm'])
    .where('device_id', '=', deviceId)
    .where('recorded_at', '>=', criteres.from)
    .where('recorded_at', '<=', criteres.to)
    .orderBy('recorded_at', 'desc')
    .limit(criteres.limit)
    .execute()

  return lignes
    .map((l) => ({
      at: l.recorded_at.toISOString(),
      temperature: l.temperature_c,
      co2: l.co2_ppm,
      samples: null,
      temperature_min: null,
      temperature_max: null,
      co2_min: null,
      co2_max: null,
    }))
    .reverse()
}
