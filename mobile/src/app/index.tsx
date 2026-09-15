import { router } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useSalles } from '@/api/salles'
import { CarteSalle } from '@/components/carte-salle'
import { EtatChargement, EtatErreur, EtatVide } from '@/components/etats'

/** Premier niveau du parcours : les salles du campus. */
export default function EcranSalles() {
  const theme = useTheme()
  const { data, isPending, isError, error, refetch, isRefetching } = useSalles()

  if (isPending) {
    return <EtatChargement message="Chargement des salles" />
  }

  if (isError) {
    return (
      <EtatErreur
        message={error instanceof ErreurApi ? error.message : 'Une erreur inattendue est survenue'}
        detail="Vérifiez que le backend tourne et que le téléphone est sur le même réseau."
        onReessayer={() => void refetch()}
      />
    )
  }

  if (data.rooms.length === 0) {
    return (
      <EtatVide titre="Aucune salle" detail="Le backend n'a encore reçu aucune mesure." />
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.liste}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
    >
      {data.rooms.map((salle) => (
        <CarteSalle
          key={salle.id}
          salle={salle}
          onPress={() => router.push({ pathname: '/salles/[id]', params: { id: salle.id } })}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  liste: { padding: 16 },
})
