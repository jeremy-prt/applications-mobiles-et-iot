import { Stack, router, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useSalle } from '@/api/salles'
import { BandeauDonnees } from '@/components/bandeau'
import { CarteObjet } from '@/components/carte-objet'
import { EtatChargement, EtatErreur, EtatHorsLigne, EtatVide } from '@/components/etats'
import { useMaintenant } from '@/lib/horloge'
import { useEnLigne } from '@/lib/reseau'

/** Deuxième niveau du parcours : les équipements d'une salle. */
export default function EcranSalle() {
  const theme = useTheme()
  const enLigne = useEnLigne()
  const maintenant = useMaintenant()
  const { id } = useLocalSearchParams<{ id: string }>()
  const {
    data: salle,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    dataUpdatedAt,
    fetchStatus,
    failureCount,
  } = useSalle(id)

  if (isPending && fetchStatus === 'paused') {
    return <EtatHorsLigne onReessayer={() => void refetch()} />
  }

  if (isPending) {
    return <EtatChargement message="Chargement de la salle" />
  }

  // L'écran d'erreur ne remplace les données que lorsqu'il n'y en a aucune.
  if (salle === undefined) {
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
                ageReponseMs={maintenant - dataUpdatedAt}
                maintenant={maintenant}
                onPress={() =>
                  router.push({ pathname: '/objets/[id]', params: { id: objet.device_id } })
                }
              />
            ))
          )}
        </ScrollView>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  liste: { padding: 16, flexGrow: 1 },
})
