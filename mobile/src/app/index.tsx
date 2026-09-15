import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Card, Chip, Text } from 'react-native-paper'
import { useSalles } from '../api/salles'
import { ErreurApi } from '../api/client'
import type { Objet, Salle } from '../api/schemas'

/** Affiche une date comme "il y a 12 s", pour que l'ancienneté soit lisible. */
function depuis(iso: string | null): string {
  if (iso === null) return 'jamais'
  const secondes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secondes < 60) return `il y a ${secondes} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  return `il y a ${Math.round(minutes / 60)} h`
}

function CarteObjet({ objet }: { objet: Objet }) {
  const sansMesure = objet.temperature === null || objet.co2 === null

  return (
    <Card style={styles.carte} mode="outlined">
      <Card.Title
        title={objet.device_id}
        subtitle={objet.availability === 'offline' ? 'Capteur déconnecté' : undefined}
      />
      <Card.Content>
        {sansMesure ? (
          <Text variant="bodyMedium">
            Aucune mesure pour ce capteur. Il est connu mais n'a encore rien envoyé.
          </Text>
        ) : (
          <>
            <View style={styles.mesures}>
              <View>
                <Text variant="labelMedium">Température</Text>
                <Text variant="headlineSmall">
                  {objet.temperature!.value} {objet.temperature!.unit}
                </Text>
              </View>
              <View>
                <Text variant="labelMedium">CO2</Text>
                <Text variant="headlineSmall">
                  {objet.co2!.value} {objet.co2!.unit}
                </Text>
              </View>
            </View>

            <View style={styles.pastilles}>
              <Text variant="bodySmall">Mesure {depuis(objet.recorded_at)}</Text>
              {/* L'ancienneté est calculée par le backend : l'horloge du
                  téléphone peut différer de la sienne. */}
              {objet.is_stale ? (
                <Chip compact icon="clock-alert-outline" style={styles.pastilleAncienne}>
                  Donnée ancienne
                </Chip>
              ) : null}
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  )
}

function CarteSalle({ salle }: { salle: Salle }) {
  return (
    <View style={styles.salle}>
      <Text variant="titleLarge" style={styles.titreSalle}>
        {salle.label}
      </Text>
      {salle.devices.map((objet) => (
        <CarteObjet key={objet.device_id} objet={objet} />
      ))}
    </View>
  )
}

export default function EcranSalles() {
  const { data, isPending, isError, error, refetch, isRefetching } = useSalles()

  // 1. Chargement : premier appel, rien à afficher encore.
  if (isPending) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.texteCentre}>
          Chargement des salles
        </Text>
      </View>
    )
  }

  // 2. Erreur : le serveur ne répond pas, ou répond autre chose qu'attendu.
  if (isError) {
    const message =
      error instanceof ErreurApi ? error.message : 'Une erreur inattendue est survenue'
    return (
      <View style={styles.centre}>
        <Text variant="titleMedium">{message}</Text>
        <Text variant="bodySmall" style={styles.texteCentre}>
          Vérifiez que le backend tourne et que le téléphone est sur le même réseau.
        </Text>
        <Button mode="contained" onPress={() => void refetch()} style={styles.bouton}>
          Réessayer
        </Button>
      </View>
    )
  }

  // 3. Vide : l'appel a réussi mais aucune salle n'est connue.
  if (data.rooms.length === 0) {
    return (
      <View style={styles.centre}>
        <Text variant="titleMedium">Aucune salle</Text>
        <Text variant="bodySmall" style={styles.texteCentre}>
          Le backend n'a encore reçu aucune mesure.
        </Text>
      </View>
    )
  }

  // 4. Données.
  return (
    <ScrollView
      contentContainerStyle={styles.liste}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
    >
      {data.rooms.map((salle) => (
        <CarteSalle key={salle.id} salle={salle} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  liste: { padding: 16, gap: 8 },
  salle: { marginBottom: 16 },
  titreSalle: { marginBottom: 8 },
  carte: { marginBottom: 8 },
  mesures: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pastilles: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pastilleAncienne: { alignSelf: 'flex-start' },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  texteCentre: { textAlign: 'center' },
  bouton: { marginTop: 8 },
})
