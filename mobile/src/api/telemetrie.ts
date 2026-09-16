import { queryOptions, useQuery } from '@tanstack/react-query'
import { appeler } from '@/api/client'
import { ReponseHistorique } from '@/api/schemas'

/**
 * L'historique est une requête à part, sous sa propre clé de cache : c'est une
 * autre donnée que le dernier état, elle change moins souvent et elle est bornée.
 *
 * L'application lit les tranches déjà calculées par le job de consolidation, et
 * jamais les mesures brutes : six heures d'historique brut font environ
 * 10 000 lignes, contre 72 tranches.
 */
const TRANCHES = 72 // 72 tranches de 5 minutes, soit six heures.

export function requeteHistorique(deviceId: string) {
  return queryOptions({
    queryKey: ['historique', deviceId],
    queryFn: () =>
      appeler(
        `/devices/${deviceId}/telemetry?resolution=5m&limit=${TRANCHES}`,
        ReponseHistorique,
      ),
    // Une tranche de 5 minutes ne bouge pas toutes les 15 secondes. La recharger
    // au rythme du dernier état ferait travailler la base pour rien.
    refetchInterval: 60_000,
    staleTime: 60_000,
  })
}

export function useHistorique(deviceId: string) {
  return useQuery(requeteHistorique(deviceId))
}
