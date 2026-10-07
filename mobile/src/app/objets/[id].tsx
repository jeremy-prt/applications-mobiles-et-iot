import { Stack, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'
import { ErreurApi } from '@/api/client'
import { useCommandeVentilation } from '@/api/commandes'
import { useObjet } from '@/api/salles'
import { useHistorique } from '@/api/telemetrie'
import { BandeauDonnees } from '@/components/bandeau'
import { Courbe } from '@/components/courbe'
import { EtatChargement, EtatErreur, EtatHorsLigne, EtatVide } from '@/components/etats'
import { PanneauVentilation } from '@/components/ventilation'
import { ligneStatut, messageErreurEnvoi } from '@/lib/commandes'
import { dateEtHeure, depuis } from '@/lib/dates'
import { fraicheurAffichee, type Fraicheur } from '@/lib/fraicheur'
import { useMaintenant } from '@/lib/horloge'
import { useEnLigne } from '@/lib/reseau'

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  const theme = useTheme()
  return (
    <View style={styles.ligne}>
      <Text variant="bodyLarge">{libelle}</Text>
      <Text variant="bodyLarge" style={[styles.valeur, { color: theme.colors.onSurfaceVariant }]}>
        {valeur}
      </Text>
    </View>
  )
}

function Mesure({ libelle, valeur }: { libelle: string; valeur: string }) {
  const theme = useTheme()
  return (
    <View>
      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        {libelle}
      </Text>
      <Text variant="displaySmall">{valeur}</Text>
    </View>
  )
}

// Inconnue : la réponse vient du cache, le bandeau du haut dit pourquoi.
const FRAICHEUR: Record<Fraicheur, string> = {
  recente: 'Récente',
  ancienne: 'Ancienne',
  inconnue: 'Inconnue',
}

/** Topic `availability` du broker : l'objet est-il joignable, pas ses mesures fraîches. */
function disponibilite(valeur: string | null): string {
  if (valeur === null) return 'Inconnue'
  return valeur === 'offline' ? 'Déconnecté' : 'En ligne'
}

/** Troisième niveau du parcours : le détail d'un objet et son historique. */
export default function EcranObjet() {
  const theme = useTheme()
  const enLigne = useEnLigne()
  const maintenant = useMaintenant()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isPending, isError, error, refetch, isRefetching, dataUpdatedAt, fetchStatus, failureCount } = useObjet(id)
  const historique = useHistorique(id)
  const commande = useCommandeVentilation(id)

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

  const statut = ligneStatut({
    enLigne,
    envoiEnCours: commande.envoiEnCours,
    erreurEnvoi:
      commande.erreurEnvoi === null
        ? null
        : commande.erreurEnvoi instanceof ErreurApi
          ? messageErreurEnvoi(commande.erreurEnvoi.code, commande.erreurEnvoi.statut)
          : "Erreur inattendue pendant l'envoi",
    commande: commande.commande,
    ecouleMs: commande.envoyeeA === null ? 0 : maintenant - commande.envoyeeA,
    depuisReponseMs: maintenant - commande.reponseA,
  })

  const echecHistorique = historique.isError || historique.failureCount > 0
  // Chargement, échec et absence de tranche ne se disent pas pareil : annoncer
  // « aucune tranche » sur un échec réseau a déjà fait chercher un bug du job.
  const legendeHistorique = historique.isPending
    ? "Chargement de l'historique"
    : echecHistorique
      ? points.length === 0
        ? 'Historique indisponible'
        : 'Historique non actualisé'
      : points.length === 0
        ? 'Première tranche après 5 min de mesures'
        : `Par tranches de 5 min, du ${dateEtHeure(points[0]?.at ?? null)} au ${dateEtHeure(points[points.length - 1]?.at ?? null)}`

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
            <Mesure
              libelle="Température"
              valeur={
                objet.temperature === null
                  ? '—'
                  : `${objet.temperature.value} ${objet.temperature.unit}`
              }
            />
            <Mesure
              libelle="CO2"
              valeur={objet.co2 === null ? '—' : `${objet.co2.value} ${objet.co2.unit}`}
            />
          </View>

          <View>
            <Ligne libelle="Salle" valeur={salle.label} />
            <Ligne libelle="Dernière mesure" valeur={depuis(objet.recorded_at, maintenant)} />
            {/* Ancienne et déconnecté sont deux problèmes distincts : un capteur
                peut être en ligne et ne plus rien mesurer. */}
            <Ligne libelle="Fraîcheur" valeur={FRAICHEUR[fraicheur]} />
            <Ligne libelle="Disponibilité" valeur={disponibilite(objet.availability)} />
          </View>

          <PanneauVentilation
            etatReel={objet.ventilation}
            bloque={!enLigne || statut?.ton === 'attente'}
            statut={statut}
            onCommander={commande.envoyer}
          />

          <View style={styles.historique}>
            <View>
              <View style={styles.enteteHistorique}>
                <Text variant="titleMedium">Historique</Text>
                {echecHistorique ? (
                  <Button
                    compact
                    mode="text"
                    onPress={() => void historique.refetch()}
                    accessibilityLabel="Recharger l'historique"
                  >
                    Réessayer
                  </Button>
                ) : null}
              </View>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {legendeHistorique}
              </Text>
            </View>
            <Courbe
              titre="Température"
              unite="°C"
              decimales={1}
              valeurs={points.map((point) => point.temperature)}
            />
            <Courbe titre="CO2" unite="ppm" valeurs={points.map((point) => point.co2)} />
          </View>
        </ScrollView>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  contenu: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 32 },
  mesures: { flexDirection: 'row', justifyContent: 'space-between' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 16 },
  valeur: { flexShrink: 1, textAlign: 'right' },
  historique: { gap: 16 },
  enteteHistorique: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
  },
})
