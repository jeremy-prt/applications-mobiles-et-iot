/**
 * Affiche une date comme « il y a 12 s », pour que l'ancienneté d'une mesure se
 * lise d'un coup d'oeil.
 *
 * Ce calcul ne sert qu'à l'affichage. C'est le backend qui décide si une mesure
 * est ancienne, avec son horloge et le seuil déclaré dans docs/architecture.md.
 *
 * `maintenant` est passé plutôt que lu ici : sans ça, la fonction n'est pas
 * testable, et l'appelant ne voit pas qu'il lui faut une horloge pour que
 * l'affichage bouge.
 */
export function depuis(iso: string | null, maintenant: number = Date.now()): string {
  if (iso === null) return 'jamais'
  const secondes = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 1000))
  if (secondes < 60) return `il y a ${secondes} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  return `il y a ${Math.round(minutes / 60)} h`
}

/**
 * Date et heure lisibles, pour dater les données affichées hors ligne.
 * « il y a 3 h » ne suffit pas quand l'application a été rouverte le lendemain.
 */
export function dateEtHeure(valeur: number | string | null): string {
  if (valeur === null) return 'jamais'
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return 'jamais'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
