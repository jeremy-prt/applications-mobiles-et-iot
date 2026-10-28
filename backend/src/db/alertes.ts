import { sql, type Selectable } from 'kysely'
import { db } from './index.ts'
import type { AlertsTable } from './types.ts'

export type Alerte = Selectable<AlertsTable>
export type StatutAlerte = Alerte['status']

export async function alerteActive(deviceId: string): Promise<Alerte | undefined> {
  return db
    .selectFrom('alerts')
    .selectAll()
    .where('device_id', '=', deviceId)
    .where('kind', '=', 'co2_high')
    .where('status', '=', 'active')
    .executeTakeFirst()
}

/**
 * Ouvre une alerte, ou ne fait rien si l'objet en a déjà une active. La salle
 * vient du registre, pas du message.
 */
export async function ouvrirAlerte(alerte: {
  device_id: string
  threshold_on: number
  threshold_off: number
  valeur: number
  mesureeA: Date
}): Promise<Alerte | undefined> {
  return db
    .insertInto('alerts')
    .values((eb) => ({
      device_id: alerte.device_id,
      room_id: eb.selectFrom('devices').select('room_id').where('id', '=', alerte.device_id),
      kind: 'co2_high',
      threshold_on: alerte.threshold_on,
      threshold_off: alerte.threshold_off,
      opened_at: alerte.mesureeA,
      opening_value: alerte.valeur,
      peak_value: alerte.valeur,
      last_value: alerte.valeur,
      last_measure_at: alerte.mesureeA,
    }))
    .onConflict((oc) => oc.columns(['device_id', 'kind']).where('status', '=', 'active').doNothing())
    .returningAll()
    .executeTakeFirst()
}

/** Une mesure de plus au-dessus du seuil : la même ligne est mise à jour. */
export async function prolongerAlerte(id: number, valeur: number, mesureeA: Date): Promise<void> {
  await db
    .updateTable('alerts')
    .set({
      peak_value: sql<number>`greatest(peak_value, ${valeur})`,
      last_value: valeur,
      last_measure_at: mesureeA,
      measures: sql<number>`measures + 1`,
    })
    .where('id', '=', id)
    .where('status', '=', 'active')
    .execute()
}

export async function fermerAlerte(id: number, valeur: number, mesureeA: Date): Promise<boolean> {
  const res = await db
    .updateTable('alerts')
    .set({ status: 'resolved', closed_at: mesureeA, closing_value: valeur, last_value: valeur, last_measure_at: mesureeA })
    .where('id', '=', id)
    .where('status', '=', 'active')
    .executeTakeFirst()
  return res.numUpdatedRows > 0n
}

/** Lecture bornée, des plus récentes aux plus anciennes. */
export async function lireAlertes(criteres: {
  status: StatutAlerte | 'all'
  deviceId?: string
  limit: number
}): Promise<Alerte[]> {
  let requete = db.selectFrom('alerts').selectAll()
  if (criteres.status !== 'all') requete = requete.where('status', '=', criteres.status)
  if (criteres.deviceId !== undefined) requete = requete.where('device_id', '=', criteres.deviceId)
  return requete.orderBy('opened_at', 'desc').orderBy('id', 'desc').limit(criteres.limit).execute()
}
