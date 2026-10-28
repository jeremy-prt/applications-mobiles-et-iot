import { useQuery } from '@tanstack/react-query'
import { appeler } from '@/api/client'
import { ReponseAlertes } from '@/api/schemas'

/** Les dernières alertes d'un capteur suffisent à montrer un retour à la normale. */
const ALERTES_AFFICHEES = 5

/**
 * L'alerte en cours arrive déjà avec `/rooms`. Cette requête ne sert qu'à
 * l'historique, sur le détail d'un capteur : une alerte fermée disparaît de
 * `/rooms`, et sans elle l'écran ne pourrait pas dire qu'elle s'est terminée.
 */
export function useAlertesObjet(deviceId: string) {
  return useQuery({
    queryKey: ['alertes', deviceId],
    queryFn: () =>
      appeler(
        `/alerts?device_id=${encodeURIComponent(deviceId)}&limit=${ALERTES_AFFICHEES}`,
        ReponseAlertes,
      ),
    // Au rythme de /rooms, pour que l'historique ne contredise pas l'alerte affichée.
    refetchInterval: 15_000,
    staleTime: 15_000,
  })
}
