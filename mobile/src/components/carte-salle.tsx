import { StyleSheet } from 'react-native'
import { Card, Text } from 'react-native-paper'
import type { Salle } from '@/api/schemas'

/** Accorde « équipement » au nombre, sans dépendre d'une bibliothèque. */
function nombreEquipements(total: number): string {
  if (total === 0) return 'Aucun équipement'
  return total === 1 ? '1 équipement' : `${total} équipements`
}

/**
 * Une salle dans la liste d'accueil. Elle porte l'état de ses capteurs, pour
 * qu'on sache où aller sans ouvrir chaque salle.
 */
export function CarteSalle({ salle, onPress }: { salle: Salle; onPress: () => void }) {
  const deconnectes = salle.devices.filter((objet) => objet.availability === 'offline').length
  const anciens = salle.devices.filter(
    (objet) => objet.availability !== 'offline' && objet.is_stale,
  ).length

  // Deux problèmes distincts, jamais fondus en un seul message : un capteur
  // déconnecté ne répond plus, un capteur ancien répond mais ne mesure plus.
  const alertes: string[] = []
  if (deconnectes > 0) alertes.push(`${deconnectes} déconnecté${deconnectes > 1 ? 's' : ''}`)
  if (anciens > 0) alertes.push(`${anciens} sans mesure récente`)

  return (
    <Card style={styles.carte} mode="outlined" onPress={onPress}>
      <Card.Title
        title={salle.label}
        subtitle={nombreEquipements(salle.devices.length)}
        right={() =>
          alertes.length === 0 ? null : (
            <Text variant="bodySmall" style={styles.alerte}>
              {alertes.join(', ')}
            </Text>
          )
        }
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  carte: { marginBottom: 8 },
  alerte: { marginRight: 16, textAlign: 'right', maxWidth: 140 },
})
