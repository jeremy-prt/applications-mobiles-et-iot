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
    // Le boot_id est gardé pour vérifier ensuite que les mesures viennent bien
    // de la session que l'objet annonce, voir domain/surveillance.ts.
    .set({ ventilation: message.ventilation, boot_id: message.boot_id })
    .where('device_id', '=', message.device_id)
    .executeTakeFirst()
  return res.numUpdatedRows > 0n
}

/**
 * La disponibilité dit si l'objet est joignable. C'est une information
 * différente de la fraîcheur : un objet peut être en ligne et ne plus mesurer.
 *
 * `recuA` sert quand le message n'a pas de date : c'est le testament publié par
 * le broker à la place de l'objet, qui ne peut pas savoir quand il est tombé.
 */
export async function enregistrerDisponibilite(
  message: Disponibilite,
  recuA: Date,
): Promise<boolean> {
  const res = await db
    .updateTable('device_state')
    .set({
      availability: message.status,
      availability_at:
        message.reported_at === undefined ? recuA : new Date(message.reported_at),
    })
    .where('device_id', '=', message.device_id)
    .executeTakeFirst()
  return res.numUpdatedRows > 0n
}

/**
 * La date de la dernière mesure de chaque objet. Sert à la surveillance de
 * fraîcheur, qui doit voir tous les objets d'un coup pour repérer ceux qui se
 * sont tus. Trois lignes ici, autant que d'objets : pas de borne nécessaire.
 */
export async function etatsCourants(): Promise<
  { deviceId: string; recordedAt: Date | null }[]
> {
  const lignes = await db
    .selectFrom('device_state')
    .select(['device_id', 'recorded_at'])
    .execute()

  return lignes.map((l) => ({ deviceId: l.device_id, recordedAt: l.recorded_at }))
}

/** L'identifiant de démarrage annoncé par un objet, s'il en a déjà annoncé un. */
export async function bootIdConnu(deviceId: string): Promise<string | null> {
  const ligne = await db
    .selectFrom('device_state')
    .select('boot_id')
    .where('device_id', '=', deviceId)
    .executeTakeFirst()
  return ligne?.boot_id ?? null
}
