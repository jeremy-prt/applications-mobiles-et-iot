import { useSyncExternalStore } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { AppState, type AppStateStatus, Platform } from 'react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'

/**
 * TanStack Query a été écrit pour le navigateur : il surveille l'évènement
 * `online` de `window` et le retour d'onglet. Sur un téléphone, ces deux
 * évènements n'existent pas. Sans ce fichier, l'application ne sait donc ni
 * qu'elle a retrouvé le réseau, ni qu'elle revient de l'arrière-plan.
 *
 * C'est la limite déclarée en J1, levée ici.
 */

/**
 * Branche la détection du réseau.
 *
 * On ne regarde que `isConnected`, pas `isInternetReachable` : le backend est
 * sur le réseau local, donc un Wi-Fi sans accès à Internet nous convient très
 * bien. Utiliser `isInternetReachable` déclarerait l'application hors ligne
 * alors que le serveur répond.
 *
 * Sur le web, on ne remplace rien : le navigateur a déjà les évènements
 * `online` et `offline`, que TanStack Query écoute d'origine. NetInfo y répond
 * en sondant une adresse, ce qui déclare l'application hors ligne dès que ce
 * sondage échoue, même quand le serveur répond.
 *
 * Il n'y a rien à débrancher : TanStack Query ne garde qu'un seul écouteur et
 * remplace le précédent, et celui-ci vit aussi longtemps que l'application.
 */
export function brancherReseau(): void {
  if (Platform.OS === 'web') return

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((etat) => {
      setOnline(etat.isConnected === true)
    }),
  )
}

/**
 * Branche le retour au premier plan.
 *
 * `active` est le seul état où l'écran est visible et utilisable. `inactive`
 * existe sur iOS pendant une transition, par exemple quand on ouvre le centre
 * de contrôle : ce n'est pas un retour au premier plan.
 */
export function brancherPremierPlan(): () => void {
  // Sur le web, c'est le retour d'onglet géré d'origine par TanStack Query.
  if (Platform.OS === 'web') return () => undefined

  const abonnement = AppState.addEventListener('change', (etat: AppStateStatus) => {
    focusManager.setFocused(etat === 'active')
  })
  return () => abonnement.remove()
}

/**
 * L'état réseau tel que TanStack Query le voit, pour l'afficher.
 *
 * On lit la même source que celle qui pilote les requêtes, sinon le bandeau
 * pourrait annoncer « hors ligne » pendant que l'application interroge le
 * serveur, ou l'inverse.
 */
export function useEnLigne(): boolean {
  return useSyncExternalStore(
    (rafraichir) => onlineManager.subscribe(rafraichir),
    () => onlineManager.isOnline(),
    () => true,
  )
}
