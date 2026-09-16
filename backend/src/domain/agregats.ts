/**
 * Les mesures brutes arrivent toutes les 2 secondes. Les afficher une par une
 * sur un écran de téléphone n'a pas d'intérêt et oblige à lire beaucoup de
 * lignes. Le job les regroupe par tranches de largeur fixe, et l'application lit
 * un résultat déjà calculé.
 */

/**
 * Début de la tranche qui contient cette date. Les tranches sont alignées sur
 * l'heure ronde : avec 5 minutes, ce sont 10:00, 10:05, 10:10, et ainsi de
 * suite. Deux backends qui calculent la même tranche trouvent donc la même
 * borne, ce qui rend le recalcul rejouable.
 */
export function debutDeTranche(date: Date, largeurMinutes: number): Date {
  if (largeurMinutes <= 0) throw new RangeError('largeur de tranche invalide')
  const largeurMs = largeurMinutes * 60_000
  return new Date(Math.floor(date.getTime() / largeurMs) * largeurMs)
}

/** Les tranches distinctes touchées par un lot de mesures, sans doublon. */
export function tranchesTouchees(
  dates: readonly Date[],
  largeurMinutes: number,
): Date[] {
  const vues = new Map<number, Date>()
  for (const date of dates) {
    const debut = debutDeTranche(date, largeurMinutes)
    vues.set(debut.getTime(), debut)
  }
  return [...vues.values()].sort((a, b) => a.getTime() - b.getTime())
}
