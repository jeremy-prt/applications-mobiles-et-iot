import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

/**
 * Courbe d'historique, dessinée avec des barres.
 *
 * Aucune bibliothèque de graphiques n'est ajoutée : celles qui font de vraies
 * courbes passent par du code natif, qui n'est pas disponible dans Expo Go, et
 * nous démontrons sur un iPhone avec Expo Go. Des barres suffisent à lire une
 * tendance, qui est ce que l'écran doit montrer.
 */

const HAUTEUR = 72
/** Une barre au minimum reste visible, sinon la plus basse disparaît. */
const HAUTEUR_MINIMALE = 3

export function Courbe({
  titre,
  unite,
  valeurs,
  decimales = 0,
}: {
  titre: string
  unite: string
  valeurs: readonly number[]
  decimales?: number
}) {
  const theme = useTheme()

  if (valeurs.length === 0) return null

  const bas = Math.min(...valeurs)
  const haut = Math.max(...valeurs)
  // Toutes les valeurs identiques : sans ce cas, on diviserait par zéro.
  const amplitude = haut - bas === 0 ? 1 : haut - bas

  return (
    <View style={styles.bloc}>
      <View style={styles.entete}>
        <Text variant="labelLarge">{titre}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {bas.toFixed(decimales)} à {haut.toFixed(decimales)} {unite}
        </Text>
      </View>
      <View style={styles.barres}>
        {valeurs.map((valeur, index) => (
          <View
            key={index}
            style={[
              styles.barre,
              {
                backgroundColor: theme.colors.primary,
                height: Math.max(
                  HAUTEUR_MINIMALE,
                  ((valeur - bas) / amplitude) * HAUTEUR,
                ),
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barres: { flexDirection: 'row', alignItems: 'flex-end', height: HAUTEUR, gap: 1 },
  barre: { flex: 1, borderRadius: 1, minWidth: 1 },
})
