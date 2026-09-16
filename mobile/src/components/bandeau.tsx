import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { dateEtHeure, depuis } from '@/lib/dates'
import { etatDonnees, messageEtatDonnees } from '@/lib/fraicheur'

/**
 * Bandeau d'ancienneté des données affichées.
 *
 * Il parle du lien entre le téléphone et le serveur, jamais du capteur. Un
 * capteur silencieux se signale à côté de sa valeur, avec la puce « Donnée
 * ancienne ». Sans cette séparation, l'application accuserait le réseau du
 * téléphone alors que c'est l'objet qui s'est tu, ce que R04 interdit.
 */
export function BandeauDonnees({
  enLigne,
  enPause,
  enEchec,
  misAJourA,
  maintenant,
}: {
  /** Le téléphone a du réseau. */
  enLigne: boolean
  /** La requête n'est pas partie. Ce n'est pas une erreur, d'où ce champ à part. */
  enPause: boolean
  /** Le dernier appel est parti et a échoué. */
  enEchec: boolean
  /** Date de la dernière réponse réussie, donnée par TanStack Query. */
  misAJourA: number
  /** Horloge qui redessine l'écran, sinon l'ancienneté affichée se fige. */
  maintenant: number
}) {
  const theme = useTheme()

  // Sans réponse réussie, il n'y a rien à dater : c'est l'écran plein qui parle.
  if (misAJourA === 0) return null

  const message = messageEtatDonnees(
    etatDonnees(enLigne, enPause, enEchec, maintenant - misAJourA),
  )
  if (message === null) return null

  return (
    <View style={[styles.bandeau, { backgroundColor: theme.colors.secondaryContainer }]}>
      <Text variant="labelLarge" style={{ color: theme.colors.onSecondaryContainer }}>
        {message}
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
        Reçues le {dateEtHeure(misAJourA)}, {depuis(new Date(misAJourA).toISOString(), maintenant)}.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bandeau: { paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
})
