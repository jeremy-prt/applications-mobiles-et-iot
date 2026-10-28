/**
 * Les libellés d'une alerte CO2, sans réseau ni React pour être testables.
 *
 * C'est le backend qui décide de l'activation et du retour à la normale, avec
 * ses deux seuils. Le téléphone ne compare jamais une valeur à un seuil : il
 * aurait un avis différent du serveur entre 800 et 1000 ppm.
 */

export interface AlerteAffichee {
  status: 'active' | 'resolved'
  threshold_off: number
  opened_at: string
  peak_value: number
  closed_at: string | null
  closing_value: number | null
}

/** Le nombre de salles dont au moins un capteur a une alerte active. */
export function sallesEnAlerte(salles: { devices: { alert: { status: string } | null }[] }[]): number {
  return salles.filter((salle) => salle.devices.some((objet) => objet.alert?.status === 'active')).length
}

export function resumeSallesEnAlerte(nombre: number): string | null {
  if (nombre === 0) return null
  return nombre === 1 ? '1 salle en alerte CO2' : `${nombre} salles en alerte CO2`
}

/** Ce qui fait revenir à la normale, pour que l'alerte ne paraisse pas bloquée. */
export function conditionDeRetour(alerte: AlerteAffichee): string {
  return `Pic à ${Math.round(alerte.peak_value)} ppm. Retour à la normale sous ${alerte.threshold_off} ppm.`
}

/**
 * Une ligne de l'historique des alertes d'un capteur. Le format des dates est
 * passé par l'écran, pour garder ce fichier sans dépendance.
 */
export function libelleEpisode(alerte: AlerteAffichee, date: (iso: string) => string): string {
  const pic = `pic ${Math.round(alerte.peak_value)} ppm`
  if (alerte.status === 'active' || alerte.closed_at === null) {
    return `En cours depuis le ${date(alerte.opened_at)}, ${pic}`
  }
  const retour = alerte.closing_value === null ? '' : `, revenue à ${Math.round(alerte.closing_value)} ppm`
  return `Du ${date(alerte.opened_at)} au ${date(alerte.closed_at)}, ${pic}${retour}`
}
