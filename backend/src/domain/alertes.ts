/**
 * La règle d'alerte CO2, avec hystérésis. Elle s'active au seuil de
 * déclenchement et ne revient à la normale que sous le seuil de retour, plus
 * bas : une valeur qui oscille autour d'un seuil unique ouvrirait et fermerait
 * une alerte à chaque mesure. Seuils dans docs/architecture.md.
 */

export interface Seuils {
  declenchement: number
  retour: number
}

export type DecisionAlerte = 'ouvrir' | 'prolonger' | 'fermer' | 'rien'

export function deciderAlerte(active: boolean, co2: number, seuils: Seuils): DecisionAlerte {
  if (!active) return co2 >= seuils.declenchement ? 'ouvrir' : 'rien'
  // Entre les deux seuils, une alerte active le reste.
  return co2 < seuils.retour ? 'fermer' : 'prolonger'
}

/** Des seuils inversés ou égaux supprimeraient l'hystérésis. */
export function seuilsValides(seuils: Seuils): boolean {
  return seuils.retour < seuils.declenchement
}
