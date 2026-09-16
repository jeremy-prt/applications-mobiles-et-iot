import { router } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useSalles } from '@/api/salles'
import { BandeauDonnees } from '@/components/bandeau'
import { CarteSalle } from '@/components/carte-salle'
import { EtatChargement, EtatErreur, EtatHorsLigne, EtatVide } from '@/components/etats'
import { useMaintenant } from '@/lib/horloge'
import { useEnLigne } from '@/lib/reseau'

/** Premier niveau du parcours : les salles du campus. */
export default function EcranSalles() {
  const theme = useTheme()
  const enLigne = useEnLigne()
  const maintenant = useMaintenant()
  const { data, isPending, isError, error, refetch, isRefetching, dataUpdatedAt, fetchStatus, failureCount } = useSalles()

  // La pause vient avant le chargement : hors ligne, la requête n'est pas
  // envoyée et ne finira donc jamais. L'afficher comme un chargement donnerait
  // l'écran qui tourne indéfiniment que R06 interdit.
  if (isPending && fetchStatus === 'paused') {
    return <EtatHorsLigne onReessayer={() => void refetch()} />
  }

  if (isPending) {
    return <EtatChargement message="Chargement des salles" />
  }

  // L'écran d'erreur ne remplace les données que lorsqu'il n'y en a aucune.
  // Sans cache, hors ligne, l'application n'aurait rien à montrer ; avec un
  // cache, remplacer les dernières valeurs connues par une erreur serait une
  // perte d'information.
  if (data === undefined) {
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
    <View style={[styles.ecran, { backgroundColor: theme.colors.background }]}>
      <BandeauDonnees
        enLigne={enLigne}
        enPause={fetchStatus === 'paused'}
        enEchec={failureCount > 0}
        misAJourA={dataUpdatedAt}
        maintenant={maintenant}
      />
      <ScrollView
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
    </View>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  liste: { padding: 16 },
})
