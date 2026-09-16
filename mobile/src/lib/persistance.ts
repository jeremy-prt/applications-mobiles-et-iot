import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'

/**
 * Cache hors ligne. Sans persistance, le cache de TanStack Query vit en mémoire
 * et disparaît quand l'application est fermée : au redémarrage sans réseau,
 * l'écran serait vide. Le sujet demande que les dernières données restent
 * consultables.
 */

/** Durée pendant laquelle un cache écrit sur disque reste utilisable. */
export const DUREE_CACHE_MS = 24 * 3600 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // Doit être au moins aussi long que la durée de conservation sur disque.
      // Plus court, le cache serait jeté de la mémoire avant d'être relu, et la
      // persistance ne servirait à rien.
      gcTime: DUREE_CACHE_MS,
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'campus-connecte-cache',
  // Les données arrivent toutes les 15 secondes : écrire à chaque fois
  // solliciterait le disque pour rien.
  throttleTime: 5000,
})

/**
 * Les données affichées hors ligne doivent être datées. Au-delà de cette durée
 * on jette le cache plutôt que de montrer des valeurs qui ne décrivent plus
 * rien.
 */
export const OPTIONS_PERSISTANCE = {
  persister,
  maxAge: DUREE_CACHE_MS,
  dehydrateOptions: {
    /**
     * Par défaut, seules les requêtes en succès sont écrites sur le disque. Une
     * requête qui a des données mais dont le dernier appel a échoué est alors
     * effacée du cache, au moment précis où on en a besoin : il suffit d'ouvrir
     * l'application une fois sans réseau pour perdre tout ce qui était gardé.
     *
     * On garde donc tout ce qui a des données, quel que soit l'état du dernier
     * appel. C'est la condition du jalon « les dernières données restent
     * consultables hors ligne ».
     */
    shouldDehydrateQuery: (requete: { state: { data: unknown } }) =>
      requete.state.data !== undefined,
  },
} as const
