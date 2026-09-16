import { useEffect, useState } from 'react'

/**
 * Une horloge qui provoque un nouveau rendu.
 *
 * « Il y a 12 s » ne dépend pas des données reçues mais du temps qui passe.
 * Sans cette horloge, l'ancienneté affichée se fige entre deux réponses, et
 * elle se fige définitivement quand il n'y a plus de réponse du tout, c'est à
 * dire exactement au moment où elle compte : hors ligne, l'écran continuerait
 * d'afficher « il y a 11 s » pendant dix minutes.
 */
export function useMaintenant(periodeMs = 1000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now())

  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(Date.now()), periodeMs)
    return () => clearInterval(minuteur)
  }, [periodeMs])

  return maintenant
}
