/**
 * Le suivi d'une commande de ventilation, sans réseau ni React pour être testable.
 *
 * L'écran ne dit jamais « activé » sur la foi d'une commande envoyée : l'état réel
 * vient de l'objet, et le libellé d'une commande dit seulement où en est la demande.
 */

export const STATUTS_COMMANDE = ['pending', 'executed', 'rejected', 'unknown'] as const
export type StatutCommande = (typeof STATUTS_COMMANDE)[number]

export const INTERVALLE_SUIVI_MS = 2_000

/**
 * Le backend tranche `unknown` à 15 s, mais au rythme de son job de 5 s, donc jusqu'à
 * 20 s. Au-delà de 30 s, c'est le suivi lui-même qui ne répond plus.
 */
export const PLAFOND_SUIVI_MS = 30_000

export function estDefinitif(statut: StatutCommande): boolean {
  return statut !== 'pending'
}

/** Faut-il encore interroger le serveur, et garder les boutons bloqués ? */
export function suiviEnCours(
  statut: StatutCommande,
  ecouleMs: number,
  plafondMs: number = PLAFOND_SUIVI_MS,
): boolean {
  return !estDefinitif(statut) && ecouleMs <= plafondMs
}

export interface SuiviCommande {
  status: StatutCommande
  reason: string | null
  published_at: string | null
  late: boolean
}

export function libelleSuivi(
  commande: SuiviCommande,
  ecouleMs: number,
  plafondMs: number = PLAFOND_SUIVI_MS,
): string {
  const retard = commande.late ? ', réponse arrivée après le délai' : ''

  if (commande.status === 'executed') return `Confirmée par l'objet${retard}`
  if (commande.status === 'rejected') {
    const motif = commande.reason === null || commande.reason === '' ? '' : `, ${commande.reason}`
    return `Refusée par l'objet${motif}${retard}`
  }
  if (commande.status === 'unknown') return 'Sans réponse, résultat inconnu'

  if (ecouleMs > plafondMs) return 'Toujours sans confirmation, résultat inconnu'
  if (commande.published_at === null) return 'Acceptée par le serveur'
  return "Envoyée, en attente de l'objet"
}

export function libelleIntention(enabled: boolean): string {
  return enabled ? "Demande d'activation" : "Demande d'arrêt"
}

const ID_COMMANDE = /^[A-Za-z0-9_-]{1,80}$/

export function estIdCommandeValide(id: string): boolean {
  return ID_COMMANDE.test(id)
}

/** Une intention dont l'envoi a échoué sans qu'on sache si le serveur l'a reçue. */
export interface EnvoiIncertain {
  enabled: boolean
  commandId: string
}

/**
 * Réessayer la même intention renvoie le même identifiant : si le premier envoi était
 * arrivé, le serveur le reconnaît et ne republie rien. Toute autre intention en tire un
 * nouveau.
 */
export function idPourIntention(
  enabled: boolean,
  precedent: EnvoiIncertain | null,
  genererUuid: () => string,
): string {
  if (precedent !== null && precedent.enabled === enabled) return precedent.commandId
  return `cmd-${genererUuid()}`
}

/**
 * Sans réponse, sur une erreur 5xx ou une réponse illisible, la commande a pu être
 * enregistrée. Seul un refus 4xx dit qu'elle ne l'a pas été.
 */
export function envoiPeutEtreArrive(statutHttp: number | null): boolean {
  return statutHttp === null || statutHttp < 400 || statutHttp >= 500
}

export function messageErreurEnvoi(code: string | null, statutHttp: number | null): string {
  if (code === 'DEVICE_OFFLINE') return "L'objet est hors ligne, la commande n'a pas été envoyée"
  if (code === 'DEVICE_NOT_FOUND') return "Objet inconnu du serveur, la commande n'a pas été envoyée"
  if (code === 'DEVICE_NOT_AUTHORIZED') {
    return "Objet non autorisé par le serveur, la commande n'a pas été envoyée"
  }
  if (code === 'COMMAND_ID_CONFLICT') {
    return "Identifiant de commande déjà pris, rien n'a été envoyé. Un nouvel essai en tirera un autre"
  }
  const reessai = 'Réessayer renvoie la même demande sans la doubler'
  if (statutHttp === null) return `Serveur injoignable, la commande a pu partir. ${reessai}`
  if (statutHttp >= 500) return `Erreur du serveur, la commande a pu partir. ${reessai}`
  if (statutHttp < 400) return `Réponse du serveur illisible, la commande a pu partir. ${reessai}`
  return `Le serveur a refusé la demande (${statutHttp}), la commande n'a pas été envoyée`
}
