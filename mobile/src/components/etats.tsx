import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper'

/**
 * Les écrans qui chargent des données affichent tous les mêmes états, décrits
 * dans docs/architecture.md. Les regrouper ici évite qu'un écran en oublie un
 * ou le formule autrement.
 *
 * L'état « donnée ancienne » n'est pas ici : il s'affiche à côté de la valeur,
 * pas à la place. Une mesure ancienne reste une mesure.
 */
function PleinEcran({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={[styles.centre, { backgroundColor: theme.colors.background }]}>{children}</View>
  )
}

export function EtatChargement({ message }: { message: string }) {
  return (
    <PleinEcran>
      <ActivityIndicator size="large" />
      <Text variant="bodyMedium" style={styles.texteCentre}>
        {message}
      </Text>
    </PleinEcran>
  )
}

export function EtatErreur({
  message,
  detail,
  onReessayer,
}: {
  message: string
  detail?: string
  onReessayer?: () => void
}) {
  return (
    <PleinEcran>
      <Text variant="titleMedium" style={styles.texteCentre}>
        {message}
      </Text>
      {detail === undefined ? null : (
        <Text variant="bodySmall" style={styles.texteCentre}>
          {detail}
        </Text>
      )}
      {onReessayer === undefined ? null : (
        <Button mode="contained" onPress={onReessayer} style={styles.bouton}>
          Réessayer
        </Button>
      )}
    </PleinEcran>
  )
}

/** Vide n'est pas une erreur : l'appel a réussi, il n'y a rien à montrer. */
export function EtatVide({ titre, detail }: { titre: string; detail: string }) {
  return (
    <PleinEcran>
      <Text variant="titleMedium" style={styles.texteCentre}>
        {titre}
      </Text>
      <Text variant="bodySmall" style={styles.texteCentre}>
        {detail}
      </Text>
    </PleinEcran>
  )
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  texteCentre: { textAlign: 'center' },
  bouton: { marginTop: 8 },
})
