/**
 * Une mesure est ancienne quand son heure d'observation dépasse le seuil déclaré
 * dans docs/architecture.md. Le calcul est fait ici, côté backend, et exposé
 * dans l'API : le téléphone a sa propre horloge, qui peut différer.
 */
export function estAncienne(
  recordedAt: Date | null,
  maintenant: Date,
  seuilSecondes: number,
): boolean {
  if (recordedAt === null) return true
  return maintenant.getTime() - recordedAt.getTime() > seuilSecondes * 1000
}

/**
 * Une mesure ne remplace l'état courant que si elle est plus récente que lui.
 * Le kit rejoue volontairement des mesures datées d'une minute avant : elles
 * doivent entrer dans l'historique sans faire reculer ce qui est affiché.
 */
export function remplaceEtatCourant(
  recordedAtCourant: Date | null,
  recordedAtNouveau: Date,
): boolean {
  if (recordedAtCourant === null) return true
  return recordedAtNouveau.getTime() > recordedAtCourant.getTime()
}

/**
 * Une mesure datée dans l'avenir est refusée au delà d'une tolérance.
 *
 * Elle est plus dangereuse qu'une mesure trop vieille : comme elle est plus
 * récente que tout le reste, elle prend la place de l'état courant et empêche
 * ensuite toute vraie mesure de la remplacer, tout en restant sous le seuil de
 * fraîcheur. L'écran affiche donc une valeur fausse, présentée comme fraîche,
 * jusqu'à ce que l'heure la rattrape.
 *
 * La tolérance couvre l'écart d'horloge entre le capteur et nous, mesuré à
 * 3 secondes en J2 entre le Mac et le conteneur.
 */
export function estDansLAvenir(
  observedAt: Date,
  maintenant: Date,
  toleranceSecondes: number,
): boolean {
  return observedAt.getTime() - maintenant.getTime() > toleranceSecondes * 1000
}
