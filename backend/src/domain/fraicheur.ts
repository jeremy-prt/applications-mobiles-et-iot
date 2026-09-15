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
