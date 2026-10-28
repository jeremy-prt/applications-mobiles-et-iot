import { useEffect } from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'
import type { Alerte } from '@/api/schemas'
import { conditionDeRetour, libelleEpisode } from '@/lib/alertes'
import { dateEtHeure, depuis } from '@/lib/dates'

/**
 * L'alerte en cours d'un capteur. Couleurs d'erreur du thème, dont le contraste
 * avec leur fond est garanti par Material 3 en clair comme en sombre, et un
 * texte qui dit la même chose : la couleur seule ne suffit pas.
 */
export function BlocAlerte({ alerte, maintenant }: { alerte: Alerte; maintenant: number }) {
  const theme = useTheme()
  const titre = 'Alerte CO2 en cours'

  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(titre)
  }, [alerte.id])

  return (
    <View
      style={[styles.bloc, { backgroundColor: theme.colors.errorContainer }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text variant="titleMedium" style={{ color: theme.colors.onErrorContainer }}>
        {titre}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
        Ouverte {depuis(alerte.opened_at, maintenant)} à {Math.round(alerte.opening_value)} ppm.{' '}
        {conditionDeRetour(alerte)}
      </Text>
    </View>
  )
}

/** Les dernières alertes du capteur, pour voir le retour à la normale. */
export function HistoriqueAlertes({
  alertes,
  chargement,
  echec,
  onReessayer,
}: {
  alertes: Alerte[]
  chargement: boolean
  echec: boolean
  onReessayer: () => void
}) {
  const theme = useTheme()
  const legende = chargement
    ? 'Chargement des alertes'
    : echec
      ? alertes.length === 0
        ? 'Alertes indisponibles'
        : 'Alertes non actualisées'
      : alertes.length === 0
        ? `Aucune alerte, le CO2 n'a pas atteint le seuil`
        : null

  return (
    <View style={styles.historique}>
      <View style={styles.entete}>
        <Text variant="titleMedium">Alertes récentes</Text>
        {echec ? (
          <Button compact mode="text" onPress={onReessayer} accessibilityLabel="Recharger les alertes">
            Réessayer
          </Button>
        ) : null}
      </View>
      {legende === null ? null : (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {legende}
        </Text>
      )}
      {alertes.map((alerte) => (
        <Text key={alerte.id} variant="bodyMedium">
          {libelleEpisode(alerte, dateEtHeure)}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bloc: { borderRadius: 12, padding: 16, gap: 4 },
  historique: { gap: 8 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
})
