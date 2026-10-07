import { useEffect } from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper'
import type { LigneStatut } from '@/lib/commandes'

/** L'état réel vient du topic `state` de l'objet, jamais d'une commande envoyée. */
function libelleEtatReel(valeur: boolean | null): string {
  if (valeur === null) return 'Inconnu'
  return valeur ? 'En marche' : 'À l’arrêt'
}

export function PanneauVentilation({
  etatReel,
  bloque,
  statut,
  onCommander,
}: {
  etatReel: boolean | null
  bloque: boolean
  statut: LigneStatut | null
  onCommander: (enabled: boolean) => void
}) {
  const theme = useTheme()
  const activer = etatReel !== true
  const texte = statut?.texte ?? null

  // accessibilityLiveRegion n'existe que sur Android.
  useEffect(() => {
    if (Platform.OS === 'ios' && texte !== null) AccessibilityInfo.announceForAccessibility(texte)
  }, [texte])

  return (
    <View style={styles.panneau}>
      <View style={styles.ligne}>
        <Text variant="titleMedium">Ventilation</Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {libelleEtatReel(etatReel)}
        </Text>
      </View>

      <Button
        mode="contained"
        disabled={bloque}
        onPress={() => onCommander(activer)}
        accessibilityLabel={activer ? 'Activer la ventilation' : 'Arrêter la ventilation'}
      >
        {activer ? 'Activer' : 'Arrêter'}
      </Button>

      <View style={styles.statut} accessibilityLiveRegion="polite">
        {statut === null ? null : (
          <>
            {statut.ton === 'attente' ? <ActivityIndicator size={12} /> : null}
            <Text
              variant="bodySmall"
              style={{
                color: statut.ton === 'echec' ? theme.colors.error : theme.colors.onSurfaceVariant,
              }}
            >
              {statut.texte}
            </Text>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panneau: { gap: 12 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  // Hauteur réservée : la ligne apparaît et s'efface sans faire sauter l'historique.
  statut: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 18 },
})
