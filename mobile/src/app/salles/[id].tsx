import { Stack, router, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useSalle } from '@/api/salles'
import { CarteObjet } from '@/components/carte-objet'
import { EtatChargement, EtatErreur, EtatVide } from '@/components/etats'

/** Deuxième niveau du parcours : les équipements d'une salle. */
export default function EcranSalle() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: salle, isPending, isError, error, refetch, isRefetching } = useSalle(id)

  if (isPending) {
    return <EtatChargement message="Chargement de la salle" />
  }

  if (isError) {
    return (
      <EtatErreur
        message={error instanceof ErreurApi ? error.message : 'Une erreur inattendue est survenue'}
        onReessayer={() => void refetch()}
      />
    )
  }

  // La salle a disparu de la réponse : elle a été supprimée, ou le lien vient
  // d'un historique de navigation plus ancien que les données.
  if (salle === null) {
    return <EtatVide titre="Salle introuvable" detail={`Le backend ne connaît pas ${id}.`} />
  }

  return (
    <>
      <Stack.Screen options={{ title: salle.label }} />
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.liste}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        {salle.devices.length === 0 ? (
          <EtatVide
            titre="Aucun équipement"
            detail="Aucun capteur n'est rattaché à cette salle."
          />
        ) : (
          salle.devices.map((objet) => (
            <CarteObjet
              key={objet.device_id}
              objet={objet}
              onPress={() =>
                router.push({ pathname: '/objets/[id]', params: { id: objet.device_id } })
              }
            />
          ))
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  liste: { padding: 16, flexGrow: 1 },
})
