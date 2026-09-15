/**
 * Affiche une date comme « il y a 12 s », pour que l'ancienneté d'une mesure se
 * lise d'un coup d'oeil.
 *
 * Ce calcul ne sert qu'à l'affichage. C'est le backend qui décide si une mesure
 * est ancienne, avec son horloge et le seuil déclaré dans docs/architecture.md.
 */
export function depuis(iso: string | null): string {
  if (iso === null) return 'jamais'
  const secondes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secondes < 60) return `il y a ${secondes} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  return `il y a ${Math.round(minutes / 60)} h`
}
