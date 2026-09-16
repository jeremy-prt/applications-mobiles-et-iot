import { Stack, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Divider, Text, useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useObjet } from '@/api/salles'
import { useHistorique } from '@/api/telemetrie'
import { BandeauDonnees } from '@/components/bandeau'
import { Courbe } from '@/components/courbe'
import { EtatChargement, EtatErreur, EtatHorsLigne, EtatVide } from '@/components/etats'
import { dateEtHeure, depuis } from '@/lib/dates'
import { fraicheurAffichee, libelleFraicheur } from '@/lib/fraicheur'
import { useMaintenant } from '@/lib/horloge'
import { useEnLigne } from '@/lib/reseau'

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

/** Troisième niveau du parcours : le détail d'un objet et son historique. */
export default function EcranObjet() {
  const theme = useTheme()
  const enLigne = useEnLigne()
  const maintenant = useMaintenant()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isPending, isError, error, refetch, isRefetching, dataUpdatedAt, fetchStatus, failureCount } = useObjet(id)
  const historique = useHistorique(id)

  if (isPending && fetchStatus === 'paused') {
    return <EtatHorsLigne onReessayer={() => void refetch()} />
  }

  if (isPending) {
    return <EtatChargement message="Chargement du capteur" />
  }

  // L'écran d'erreur ne remplace les données que lorsqu'il n'y en a aucune.
  if (data === undefined) {
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
  const points = historique.data?.points ?? []
  const fraicheur = fraicheurAffichee(objet.is_stale, maintenant - dataUpdatedAt)

  return (
    <>
      <Stack.Screen options={{ title: objet.device_id }} />
      <View style={[styles.ecran, { backgroundColor: theme.colors.background }]}>
        <BandeauDonnees
          enLigne={enLigne}
          enPause={fetchStatus === 'paused'}
          enEchec={failureCount > 0}
          misAJourA={dataUpdatedAt}
          maintenant={maintenant}
        />
        <ScrollView
          contentContainerStyle={styles.contenu}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch()
                void historique.refetch()
              }}
            />
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
          <Ligne libelle="Dernière mesure" valeur={depuis(objet.recorded_at, maintenant)} />
          {/* Ancienne et déconnecté sont deux problèmes distincts : un capteur
              peut être en ligne et ne plus rien mesurer. Et une réponse gardée
              en cache ne permet plus d'affirmer quoi que ce soit du capteur. */}
          <Ligne libelle="Fraîcheur" valeur={libelleFraicheur(fraicheur)} />
          <Ligne libelle="Disponibilité" valeur={disponibilite(objet.availability)} />
          <Ligne libelle="Ventilation" valeur={ventilation(objet.ventilation)} />

          <Divider style={styles.separateur} />

          <Text variant="titleSmall" style={styles.titreHistorique}>
            Historique
          </Text>
          {/* Trois raisons différentes de n'avoir aucun point, qu'il ne faut pas
              présenter de la même façon. L'appel n'est pas encore revenu, il a
              échoué, ou il a réussi et le job n'a pas encore produit de tranche.
              Annoncer la troisième dans les deux premiers cas est un mensonge :
              on l'a fait, et ça a envoyé chercher un problème de job là où
              c'était le réseau. */}
          {historique.isPending ? (
            <Text variant="bodySmall" style={styles.sousTitre}>
              Chargement de l&apos;historique.
            </Text>
          ) : historique.isError || historique.failureCount > 0 ? (
            <View style={styles.sousTitre}>
              <Text variant="bodySmall">
                L&apos;historique n&apos;a pas pu être chargé. Les valeurs ci-dessus
                viennent d&apos;un autre appel, elles restent valables.
              </Text>
              <Button
                compact
                mode="text"
                onPress={() => void historique.refetch()}
                style={styles.reessayer}
              >
                Réessayer
              </Button>
            </View>
          ) : (
            <Text variant="bodySmall" style={styles.sousTitre}>
              {points.length === 0
                ? "Aucune tranche pour ce capteur. La première apparaît au bout de 5 minutes de mesures."
                : `${points.length} tranches de 5 minutes, de ${dateEtHeure(points[0]?.at ?? null)} à ${dateEtHeure(points[points.length - 1]?.at ?? null)}.`}
            </Text>
          )}

          <Courbe
            titre="Température"
            unite="°C"
            decimales={1}
            valeurs={points.map((point) => point.temperature)}
          />
          <Courbe titre="CO2" unite="ppm" valeurs={points.map((point) => point.co2)} />
        </ScrollView>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  contenu: { padding: 16 },
  mesures: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  separateur: { marginBottom: 8 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: 16 },
  valeur: { flexShrink: 1, textAlign: 'right' },
  titreHistorique: { marginTop: 8 },
  sousTitre: { marginBottom: 12 },
  reessayer: { alignSelf: 'flex-start', marginTop: 4 },
})
