import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper'

/** L'état réel vient du topic `state` de l'objet, jamais d'une commande envoyée. */
function libelleEtatReel(valeur: boolean | null): string {
  if (valeur === null) return 'Inconnu'
  return valeur ? 'En marche' : 'À l’arrêt'
}

export function PanneauVentilation({
  etatReel,
  bloque,
  explication,
  titreSuivi,
  libelleSuivi,
  envoiEnCours,
  erreur,
  onCommander,
}: {
  etatReel: boolean | null
  bloque: boolean
  /** Pourquoi les boutons sont bloqués, quand ce n'est pas évident. */
  explication: string | null
  titreSuivi: string | null
  libelleSuivi: string | null
  envoiEnCours: boolean
  erreur: string | null
  onCommander: (enabled: boolean) => void
}) {
  const theme = useTheme()

  return (
    <View style={styles.panneau}>
      <Text variant="titleSmall">Ventilation</Text>
      <View style={styles.ligne}>
        <Text variant="bodyMedium">État réel</Text>
        <Text variant="bodyMedium">{libelleEtatReel(etatReel)}</Text>
      </View>

      <View style={styles.boutons}>
        <Button mode="contained" disabled={bloque} onPress={() => onCommander(true)} style={styles.bouton}>
          Activer
        </Button>
        <Button mode="outlined" disabled={bloque} onPress={() => onCommander(false)} style={styles.bouton}>
          Arrêter
        </Button>
      </View>

      {explication === null ? null : <Text variant="bodySmall">{explication}</Text>}

      {titreSuivi === null ? null : (
        <View style={styles.suivi} accessibilityLiveRegion="polite">
          <Text variant="labelMedium">{titreSuivi}</Text>
          {envoiEnCours ? (
            <View style={styles.envoi}>
              <ActivityIndicator size="small" />
              <Text variant="bodyMedium">Envoi au serveur</Text>
            </View>
          ) : null}
          {libelleSuivi === null ? null : <Text variant="bodyMedium">{libelleSuivi}</Text>}
          {erreur === null ? null : (
            <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
              {erreur}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panneau: { gap: 8, marginBottom: 8 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  boutons: { flexDirection: 'row', gap: 8 },
  bouton: { flex: 1 },
  suivi: { gap: 4 },
  envoi: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
