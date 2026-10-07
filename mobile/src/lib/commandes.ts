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
  const retard = commande.late ? ' après le délai' : ''

  if (commande.status === 'executed') return `Commande confirmée${retard}`
  if (commande.status === 'rejected') {
    const motif = commande.reason === null || commande.reason === '' ? '' : `, ${commande.reason}`
    return `Refusée par l'objet${retard}${motif}`
  }
  if (commande.status === 'unknown') return 'Sans réponse, résultat inconnu'
  if (ecouleMs > plafondMs) return 'Sans confirmation, résultat inconnu'
  return 'En attente de confirmation'
}

/** Le temps de lire la confirmation. Ensuite l'état réel affiché suffit. */
export const DUREE_CONFIRMATION_MS = 4_000

export type TonStatut = 'attente' | 'info' | 'echec'

export interface LigneStatut {
  texte: string
  ton: TonStatut
}

/** L'unique ligne affichée sous le bouton de ventilation, ou rien. */
export function ligneStatut({
  enLigne,
  envoiEnCours,
  erreurEnvoi,
  commande,
  ecouleMs,
  depuisReponseMs,
}: {
  enLigne: boolean
  envoiEnCours: boolean
  /** Message déjà formulé de l'envoi échoué. */
  erreurEnvoi: string | null
  commande: SuiviCommande | undefined
  /** Depuis l'envoi de la commande suivie. */
  ecouleMs: number
  /** Depuis la dernière réponse du suivi. */
  depuisReponseMs: number
}): LigneStatut | null {
  if (envoiEnCours) return { texte: 'En attente de confirmation', ton: 'attente' }
  if (!enLigne) return { texte: 'Hors ligne, commande impossible', ton: 'info' }
  if (erreurEnvoi !== null) return { texte: erreurEnvoi, ton: 'echec' }
  if (commande === undefined) return null

  const texte = libelleSuivi(commande, ecouleMs)
  if (suiviEnCours(commande.status, ecouleMs)) return { texte, ton: 'attente' }
  if (commande.status === 'executed') {
    return depuisReponseMs > DUREE_CONFIRMATION_MS ? null : { texte, ton: 'info' }
  }
  return { texte, ton: 'echec' }
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
  if (code === 'DEVICE_OFFLINE') return "Objet hors ligne, rien n'a été envoyé"
  if (code === 'DEVICE_NOT_FOUND') return "Objet inconnu du serveur, rien n'a été envoyé"
  if (code === 'DEVICE_NOT_AUTHORIZED') return "Objet non autorisé, rien n'a été envoyé"
  if (code === 'COMMAND_ID_CONFLICT') return "Conflit d'identifiant, réessayez"
  // « a pu partir » : réessayer est sans risque, le même identifiant sera renvoyé.
  if (statutHttp === null) return 'Serveur injoignable, la commande a pu partir'
  if (statutHttp >= 500) return 'Erreur du serveur, la commande a pu partir'
  if (statutHttp < 400) return 'Réponse illisible, la commande a pu partir'
  return `Refusée par le serveur (${statutHttp})`
}
