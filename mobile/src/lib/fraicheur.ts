/**
 * Une valeur affichée décrit-elle encore la salle ? C'est la première question
 * de J2, et elle ne se règle pas avec le seul champ `is_stale`.
 *
 * `is_stale` est calculé par le backend au moment où il répond. Tant que la
 * réponse est récente, c'est la bonne information : le backend compare l'heure
 * du capteur à la sienne, et non à celle du téléphone, qui peut différer. Mais
 * dès que la réponse vient du cache, ce champ est figé : une réponse vieille de
 * dix minutes continuerait d'annoncer « donnée récente ».
 *
 * On ne recalcule pas la fraîcheur sur le téléphone pour autant, parce qu'on
 * retomberait sur l'écart entre les deux horloges. On dit ce qu'on sait : la
 * mesure était ancienne, elle était récente, ou on ne peut plus l'affirmer.
 */

export type Fraicheur = 'recente' | 'ancienne' | 'inconnue'

/** Le seuil déclaré dans docs/architecture.md, le même que celui du backend. */
export const SEUIL_FRAICHEUR_MS = 30_000

export function fraicheurAffichee(
  /** Le champ `is_stale` de la réponse. */
  ancienneSelonServeur: boolean,
  /** Âge de la réponse elle-même, mesuré sur le téléphone. */
  ageReponseMs: number,
  seuilMs: number = SEUIL_FRAICHEUR_MS,
): Fraicheur {
  // Ancienne au moment de la réponse : le temps qui passe ne la rajeunit pas.
  if (ancienneSelonServeur) return 'ancienne'
  // La réponse a vieilli autant que le seuil : on ne sait plus rien du capteur
  // depuis. Affirmer que la mesure est récente serait un mensonge.
  if (ageReponseMs > seuilMs) return 'inconnue'
  return 'recente'
}

export function libelleFraicheur(fraicheur: Fraicheur): string {
  if (fraicheur === 'ancienne') return 'Donnée ancienne'
  if (fraicheur === 'inconnue') return 'Fraîcheur inconnue, données du cache'
  return 'Donnée récente'
}

/**
 * Dans quel rapport l'écran est-il avec le serveur ?
 *
 * Trois situations différentes se ressemblent à l'écran et ne doivent pas être
 * confondues, c'est la deuxième question de J2. Le téléphone n'a pas de réseau.
 * Le téléphone en a mais le serveur ne répond pas. Tout va bien mais la dernière
 * réponse commence à dater.
 *
 * Aucune ne parle du capteur : un capteur silencieux se signale à côté de sa
 * valeur, pas ici.
 */
export type EtatDonnees = 'a-jour' | 'hors-ligne' | 'serveur-injoignable' | 'cache'

export function etatDonnees(
  /** Le téléphone a du réseau. */
  enLigne: boolean,
  /**
   * La requête n'est même pas partie. TanStack Query met en pause au lieu
   * d'échouer quand il se croit hors ligne, donc cet état n'est pas une erreur
   * et ne se voit pas dans `isError`.
   */
  enPause: boolean,
  /** Le dernier appel est parti et a échoué. */
  enEchec: boolean,
  /** Âge de la dernière réponse réussie. */
  ageReponseMs: number,
  seuilMs: number = SEUIL_FRAICHEUR_MS,
): EtatDonnees {
  if (!enLigne) return 'hors-ligne'
  if (enPause || enEchec) return 'serveur-injoignable'
  if (ageReponseMs > seuilMs) return 'cache'
  return 'a-jour'
}

export function messageEtatDonnees(etat: EtatDonnees): string | null {
  if (etat === 'a-jour') return null
  if (etat === 'hors-ligne') {
    return 'Téléphone hors ligne. Données conservées, elles ne décrivent plus la salle en direct.'
  }
  if (etat === 'serveur-injoignable') {
    return 'Serveur injoignable. Données conservées, elles ne décrivent plus la salle en direct.'
  }
  return 'Données du cache, la dernière réponse commence à dater.'
}
