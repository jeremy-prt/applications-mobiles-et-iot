import { queryOptions, useQuery } from '@tanstack/react-query'
import { appeler } from '@/api/client'
import { ReponseSalles, type Objet, type Salle } from '@/api/schemas'

/**
 * Les trois écrans lisent la même réponse de `/rooms`, sous une seule clé de
 * cache. Une requête par écran obligerait à rafraîchir trois fois la même
 * donnée, et deux écrans pourraient afficher des valeurs différentes du même
 * capteur. Le détail d'une salle et celui d'un objet sont donc dérivés de cette
 * requête avec `select`, pas rechargés.
 *
 * Quand le backend exposera `/devices/:id/telemetry`, l'historique deviendra
 * une requête à part : c'est une autre donnée, avec sa propre pagination.
 */
export function requeteSalles() {
  return queryOptions({
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

export function useSalles() {
  return useQuery(requeteSalles())
}

/** Une salle, ou `null` si elle n'est pas, ou plus, dans la réponse. */
export function useSalle(id: string) {
  return useQuery({
    ...requeteSalles(),
    select: (reponse): Salle | null => reponse.rooms.find((salle) => salle.id === id) ?? null,
  })
}

/** Un objet et la salle qui le contient, ou `null` s'il est introuvable. */
export function useObjet(id: string) {
  return useQuery({
    ...requeteSalles(),
    select: (reponse): { objet: Objet; salle: Salle } | null => {
      for (const salle of reponse.rooms) {
        const objet = salle.devices.find((candidat) => candidat.device_id === id)
        if (objet !== undefined) return { objet, salle }
      }
      return null
    },
  })
}
