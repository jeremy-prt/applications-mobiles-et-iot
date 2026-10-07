/**
 * Le cycle de vie d'une commande. Nos statuts ne sont pas ceux du kit, voir
 * docs/api.md : il n'y a pas de `failed`, car sans réponse on ne sait jamais si
 * l'action a eu lieu.
 */
export type StatutCommande = 'pending' | 'executed' | 'rejected' | 'unknown'

export interface Demande {
  device_id: string
  enabled: boolean
}

/**
 * Le `command_id` est la clé d'idempotence choisie par le mobile. Le même
 * identifiant avec le même contenu est un renvoi, avec un autre contenu c'est
 * une erreur du client, qu'on refuse plutôt que d'exécuter l'une des deux.
 */
export function comparerDemande(existante: Demande, nouvelle: Demande): 'renvoi' | 'conflit' {
  return existante.device_id === nouvelle.device_id && existante.enabled === nouvelle.enabled
    ? 'renvoi'
    : 'conflit'
}

export function dateExpiration(maintenant: Date, expirationSecondes: number): Date {
  return new Date(maintenant.getTime() + expirationSecondes * 1000)
}

/** Une commande demandée avant cette date et toujours sans réponse est abandonnée. */
export function limiteSansReponse(maintenant: Date, attenteSecondes: number): Date {
  return new Date(maintenant.getTime() - attenteSecondes * 1000)
}

export type Decision =
  | { effet: 'appliquer'; status: 'executed' | 'rejected'; late: boolean }
  | { effet: 'doublon' }

/**
 * Ce que change un résultat reçu de l'objet.
 *
 * Le retard se juge à la réception du résultat et pas au statut seul : le job
 * passe toutes les 5 secondes, donc un résultat reçu après l'attente maximale
 * peut trouver la commande encore `pending`.
 */
export function deciderResultat(
  statutActuel: StatutCommande,
  statutRecu: 'executed' | 'rejected',
  demandeeA: Date,
  recuA: Date,
  attenteSecondes: number,
): Decision {
  // Déjà définitive : un doublon QoS 1 ou un rejeu ne doit rien changer.
  if (statutActuel === 'executed' || statutActuel === 'rejected') return { effet: 'doublon' }
  const late =
    statutActuel === 'unknown' ||
    recuA.getTime() > demandeeA.getTime() + attenteSecondes * 1000
  return { effet: 'appliquer', status: statutRecu, late }
}
