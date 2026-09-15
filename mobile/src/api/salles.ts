import { useQuery } from '@tanstack/react-query'
import { appeler } from './client'
import { ReponseSalles } from './schemas'

export function useSalles() {
  return useQuery({
    queryKey: ['salles'],
    queryFn: () => appeler('/rooms', ReponseSalles),
    // Les capteurs publient toutes les 2 secondes. Rafraîchir plus souvent que
    // toutes les 15 secondes afficherait des variations d'un point de CO2 sans
    // intérêt et consommerait la batterie. 15 secondes reste bien en dessous du
    // seuil de fraîcheur de 30 secondes appliqué par le backend.
    refetchInterval: 15_000,
    staleTime: 15_000,
  })
}
