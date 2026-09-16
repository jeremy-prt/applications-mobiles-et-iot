import { StyleSheet, View } from 'react-native'
import { Card, Chip, Text } from 'react-native-paper'
import type { Objet } from '@/api/schemas'
import { depuis } from '@/lib/dates'
import { fraicheurAffichee, libelleFraicheur } from '@/lib/fraicheur'

/**
 * Le résumé d'un capteur dans la liste d'une salle.
 *
 * Le composant ne connaît pas les routes : c'est l'écran qui décide où mène
 * l'appui. Seul `src/app/` sait naviguer.
 */
export function CarteObjet({
  objet,
  ageReponseMs,
  maintenant,
  onPress,
}: {
  objet: Objet
  /** Âge de la réponse qui porte cette mesure, pour ne pas la dire fraîche à tort. */
  ageReponseMs: number
  /** Horloge qui redessine l'écran, sinon l'ancienneté affichée se fige. */
  maintenant: number
  onPress?: () => void
}) {
  const fraicheur = fraicheurAffichee(objet.is_stale, ageReponseMs)

  return (
    <Card style={styles.carte} mode="outlined" onPress={onPress}>
      <Card.Title
        title={objet.device_id}
        subtitle={objet.availability === 'offline' ? 'Capteur déconnecté' : undefined}
      />
      <Card.Content>
        {/* 0 °C et 0 ppm sont des valeurs valides. L'absence de mesure se lit
            sur `null`, jamais sur une valeur nulle. */}
        {objet.temperature === null || objet.co2 === null ? (
          <Text variant="bodyMedium">
            Aucune mesure pour ce capteur. Il est connu mais n&apos;a encore rien envoyé.
          </Text>
        ) : (
          <>
            <View style={styles.mesures}>
              <View>
                <Text variant="labelMedium">Température</Text>
                <Text variant="headlineSmall">
                  {objet.temperature.value} {objet.temperature.unit}
                </Text>
              </View>
              <View>
                <Text variant="labelMedium">CO2</Text>
                <Text variant="headlineSmall">
                  {objet.co2.value} {objet.co2.unit}
                </Text>
              </View>
            </View>

            <View style={styles.pastilles}>
              <Text variant="bodySmall">Mesure {depuis(objet.recorded_at, maintenant)}</Text>
              {/* L'ancienneté est décidée par le backend, dont l'horloge sert de
                  référence. Mais une réponse gardée en cache fige ce verdict :
                  au-delà du seuil, on ne prétend plus que la mesure est fraîche. */}
              {fraicheur === 'recente' ? null : (
                <Chip compact icon="clock-alert-outline" style={styles.pastille}>
                  {libelleFraicheur(fraicheur)}
                </Chip>
              )}
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  )
}

const styles = StyleSheet.create({
  carte: { marginBottom: 8 },
  mesures: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pastilles: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pastille: { alignSelf: 'flex-start' },
})
