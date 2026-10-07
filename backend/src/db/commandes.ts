import type { Selectable } from 'kysely'
import { db } from './index.ts'
import type { CommandsTable } from './types.ts'
import type { StatutCommande } from '../domain/commandes.ts'

export type Commande = Selectable<CommandsTable>

/** Ce qu'il faut savoir d'un objet pour accepter de lui envoyer une commande. */
export async function lireObjetCommandable(
  deviceId: string,
): Promise<{ autorise: boolean; availability: string | null } | undefined> {
  return db
    .selectFrom('devices')
    .leftJoin('device_state', 'device_state.device_id', 'devices.id')
    .select(['devices.autorise', 'device_state.availability'])
    .where('devices.id', '=', deviceId)
    .executeTakeFirst()
}

export async function lireCommande(commandId: string): Promise<Commande | undefined> {
  return db
    .selectFrom('commands')
    .selectAll()
    .where('command_id', '=', commandId)
    .executeTakeFirst()
}

/**
 * Insère la commande, ou ne fait rien si le `command_id` existe déjà. Deux
 * renvois simultanés passent tous deux la lecture préalable : c'est la clé
 * primaire qui tranche, pas le code.
 */
export async function creerCommande(commande: {
  command_id: string
  device_id: string
  enabled: boolean
  requested_at: Date
  expires_at: Date
}): Promise<Commande | undefined> {
  return db
    .insertInto('commands')
    .values(commande)
    .onConflict((oc) => oc.column('command_id').doNothing())
    .returningAll()
    .executeTakeFirst()
}

export async function marquerPubliee(commandId: string, publieeA: Date): Promise<void> {
  await db
    .updateTable('commands')
    .set({ published_at: publieeA })
    .where('command_id', '=', commandId)
    .execute()
}

/**
 * Applique un résultat. La condition sur le statut protège d'un second
 * résultat appliqué entre la lecture et l'écriture : une commande définitive
 * ne change plus.
 */
export async function appliquerResultat(
  commandId: string,
  resultat: { status: 'executed' | 'rejected'; reason: string | null; result_at: Date; late: boolean },
): Promise<boolean> {
  const res = await db
    .updateTable('commands')
    .set(resultat)
    .where('command_id', '=', commandId)
    .where('status', 'in', ['pending', 'unknown'] satisfies StatutCommande[])
    .executeTakeFirst()
  return res.numUpdatedRows > 0n
}

/** Passe à `unknown` les commandes encore sans réponse demandées avant la limite. */
export async function abandonnerSansReponse(
  limite: Date,
): Promise<{ command_id: string; device_id: string; requested_at: Date; published_at: Date | null }[]> {
  return db
    .updateTable('commands')
    .set({ status: 'unknown' })
    .where('status', '=', 'pending')
    .where('requested_at', '<', limite)
    .returning(['command_id', 'device_id', 'requested_at', 'published_at'])
    .execute()
}
