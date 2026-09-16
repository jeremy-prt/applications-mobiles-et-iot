import { sql } from 'kysely'
import { db } from './index.ts'
import { config } from '../config/index.ts'

/**
 * Recalcule les tranches touchées à partir de telemetry, au lieu de les
 * incrémenter. C'est plus de travail, mais le résultat ne dépend pas de l'ordre
 * d'arrivée : une mesure en retard corrige sa tranche, et rejouer le job donne
 * exactement le même résultat.
 */
export async function recalculerTranches(
  deviceId: string,
  debuts: readonly Date[],
): Promise<void> {
  if (debuts.length === 0) return

  const largeur = config.AGGREGATE_BUCKET_MINUTES
  const intervalle = sql<string>`make_interval(mins => ${largeur})`

  for (const debut of debuts) {
    // La lecture est bornée à une tranche et suit l'index telemetry_par_objet.
    await sql`
      insert into telemetry_bucket (
        device_id, bucket_start, bucket_minutes, samples,
        temperature_avg, temperature_min, temperature_max,
        co2_avg, co2_min, co2_max, computed_at
      )
      select
        ${deviceId}, ${debut}, ${largeur}, count(*),
        avg(temperature_c), min(temperature_c), max(temperature_c),
        avg(co2_ppm), min(co2_ppm), max(co2_ppm), now()
      from telemetry
      where device_id = ${deviceId}
        and recorded_at >= ${debut}
        and recorded_at < ${debut}::timestamptz + ${intervalle}
      having count(*) > 0
      on conflict (device_id, bucket_start, bucket_minutes) do update set
        samples = excluded.samples,
        temperature_avg = excluded.temperature_avg,
        temperature_min = excluded.temperature_min,
        temperature_max = excluded.temperature_max,
        co2_avg = excluded.co2_avg,
        co2_min = excluded.co2_min,
        co2_max = excluded.co2_max,
        computed_at = excluded.computed_at
    `.execute(db)
  }
}

/**
 * Les mesures sont supprimées au bout de 7 jours par la politique de rétention
 * de TimescaleDB. Une tranche plus vieille que ça ne pourrait plus être
 * recalculée, donc on la supprime aussi pour que les deux restent d'accord.
 */
export async function purgerTranchesAnciennes(): Promise<number> {
  const limite = new Date(Date.now() - config.RAW_RETENTION_DAYS * 86_400_000)
  const res = await db
    .deleteFrom('telemetry_bucket')
    .where('bucket_start', '<', limite)
    .executeTakeFirst()
  return Number(res.numDeletedRows)
}
