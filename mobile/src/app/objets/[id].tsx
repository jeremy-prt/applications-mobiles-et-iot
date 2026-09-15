import { Stack, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Divider, Text, useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useObjet } from '@/api/salles'
import { EtatChargement, EtatErreur, EtatVide } from '@/components/etats'
import { depuis } from '@/lib/dates'

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text variant="bodyMedium">{libelle}</Text>
      <Text variant="bodyMedium" style={styles.valeur}>
        {valeur}
      </Text>
    </View>
  )
}

/**
 * Ce que dit le topic `availability` du broker : l'objet est-il joignable.
 * C'est une question différente de la fraîcheur de ses mesures.
 */
function disponibilite(valeur: string | null): string {
  if (valeur === null) return 'Inconnue'
  return valeur === 'offline' ? 'Déconnecté' : 'En ligne'
}

/**
 * L'état réel de la ventilation vient du topic `state`, pas d'une commande
 * envoyée. Tant qu'il n'a rien annoncé, on ne le devine pas.
 */
function ventilation(valeur: boolean | null): string {
  if (valeur === null) return 'Inconnue'
  return valeur ? 'En marche' : 'À l’arrêt'
}

/** Troisième niveau du parcours : le détail d'un objet. */
export default function EcranObjet() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isPending, isError, error, refetch, isRefetching } = useObjet(id)

  if (isPending) {
    return <EtatChargement message="Chargement du capteur" />
  }

  if (isError) {
    return (
      <EtatErreur
        message={error instanceof ErreurApi ? error.message : 'Une erreur inattendue est survenue'}
        onReessayer={() => void refetch()}
      />
    )
  }

  if (data === null) {
    return <EtatVide titre="Capteur introuvable" detail={`Le backend ne connaît pas ${id}.`} />
  }

  const { objet, salle } = data

  return (
    <>
      <Stack.Screen options={{ title: objet.device_id }} />
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.contenu}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        <View style={styles.mesures}>
          <View>
            <Text variant="labelMedium">Température</Text>
            <Text variant="displaySmall">
              {objet.temperature === null
                ? '—'
                : `${objet.temperature.value} ${objet.temperature.unit}`}
            </Text>
          </View>
          <View>
            <Text variant="labelMedium">CO2</Text>
            <Text variant="displaySmall">
              {objet.co2 === null ? '—' : `${objet.co2.value} ${objet.co2.unit}`}
            </Text>
          </View>
        </View>

        <Divider style={styles.separateur} />

        <Ligne libelle="Salle" valeur={salle.label} />
        <Ligne libelle="Dernière mesure" valeur={depuis(objet.recorded_at)} />
        {/* Ancienne et déconnecté sont deux problèmes distincts : un capteur
            peut être en ligne et ne plus rien mesurer. */}
        <Ligne
          libelle="Fraîcheur"
          valeur={objet.is_stale ? 'Donnée ancienne' : 'Donnée récente'}
        />
        <Ligne libelle="Disponibilité" valeur={disponibilite(objet.availability)} />
        <Ligne libelle="Ventilation" valeur={ventilation(objet.ventilation)} />
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  contenu: { padding: 16 },
  mesures: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  separateur: { marginBottom: 8 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: 16 },
  valeur: { flexShrink: 1, textAlign: 'right' },
})
