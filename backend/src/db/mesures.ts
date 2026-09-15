import { db } from './index.ts'
import { remplaceEtatCourant } from '../domain/fraicheur.ts'
import type { Telemetrie, Etat, Disponibilite } from '../schemas/mqtt.ts'

/**
 * Enregistre un objet et sa salle la première fois qu'on le voit.
 * Le room_id du message est une indication de départ : une fois l'objet
 * connu, c'est notre registre qui fait foi, pas le message.
 */
async function assurerObjet(deviceId: string, roomId: string): Promise<void> {
  await db
    .insertInto('rooms')
    .values({ id: roomId, label: roomId })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()

  await db
    .insertInto('devices')
    .values({ id: deviceId, room_id: roomId })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()

  await db
    .insertInto('device_state')
    .values({
      device_id: deviceId,
      recorded_at: null,
      received_at: null,
      temperature_c: null,
      co2_ppm: null,
      ventilation: null,
      availability: null,
      availability_at: null,
    })
    .onConflict((oc) => oc.column('device_id').doNothing())
    .execute()
}

export interface ResultatIngestion {
  doublon: boolean
  etatCourantMisAJour: boolean
}

export async function enregistrerMesure(message: Telemetrie): Promise<ResultatIngestion> {
  await assurerObjet(message.device_id, message.room_id)

  const recordedAt = new Date(message.observed_at)

  // La contrainte d'unicité écarte le doublon. On ne teste pas son existence
  // avant d'insérer : ce serait une course entre deux consommateurs.
  const insere = await db
    .insertInto('telemetry')
    .values({
      device_id: message.device_id,
      message_id: message.message_id,
      recorded_at: recordedAt,
      temperature_c: message.temperature.value,
      co2_ppm: message.co2.value,
    })
    .onConflict((oc) =>
      oc.columns(['device_id', 'message_id', 'recorded_at']).doNothing(),
    )
    .returning('message_id')
    .executeTakeFirst()

  if (insere === undefined) {
    return { doublon: true, etatCourantMisAJour: false }
  }

  const etat = await db
    .selectFrom('device_state')
    .select('recorded_at')
    .where('device_id', '=', message.device_id)
    .executeTakeFirst()

  if (!remplaceEtatCourant(etat?.recorded_at ?? null, recordedAt)) {
    return { doublon: false, etatCourantMisAJour: false }
  }

  await db
    .updateTable('device_state')
    .set({
      recorded_at: recordedAt,
      received_at: new Date(),
      temperature_c: message.temperature.value,
      co2_ppm: message.co2.value,
    })
    .where('device_id', '=', message.device_id)
    .execute()

  return { doublon: false, etatCourantMisAJour: true }
}

/** L'état de la ventilation vient du topic state, jamais des mesures. */
export async function enregistrerEtat(message: Etat): Promise<boolean> {
  const res = await db
    .updateTable('device_state')
    .set({ ventilation: message.ventilation })
    .where('device_id', '=', message.device_id)
    .executeTakeFirst()
  return res.numUpdatedRows > 0n
}

/**
 * La disponibilité dit si l'objet est joignable. C'est une information
 * différente de la fraîcheur : un objet peut être en ligne et ne plus mesurer.
 */
export async function enregistrerDisponibilite(message: Disponibilite): Promise<boolean> {
  const res = await db
    .updateTable('device_state')
    .set({
      availability: message.status,
      availability_at: new Date(message.reported_at),
    })
    .where('device_id', '=', message.device_id)
    .executeTakeFirst()
  return res.numUpdatedRows > 0n
}
