import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { appeler, ErreurApi } from '@/api/client'
import { requeteSalles } from '@/api/salles'
import { Commande } from '@/api/schemas'
import {
  envoiPeutEtreArrive,
  estDefinitif,
  idPourIntention,
  INTERVALLE_SUIVI_MS,
  suiviEnCours,
  type EnvoiIncertain,
} from '@/lib/commandes'

const DELAI_ENVOI_MS = 10_000

interface CommandeSuivie {
  commandId: string
  envoyeeA: number
}

/**
 * Envoi d'une consigne de ventilation puis suivi de la commande jusqu'à un statut
 * définitif ou au plafond de `lib/commandes.ts`.
 */
export function useCommandeVentilation(deviceId: string) {
  const client = useQueryClient()
  const [incertain, setIncertain] = useState<EnvoiIncertain | null>(null)
  const [suivie, setSuivie] = useState<CommandeSuivie | null>(null)

  const envoi = useMutation({
    mutationFn: ({ commandId, enabled }: EnvoiIncertain) =>
      appeler(`/devices/${encodeURIComponent(deviceId)}/commands`, Commande, {
        methode: 'POST',
        corps: { command_id: commandId, enabled },
        delaiMs: DELAI_ENVOI_MS,
      }),
    // Hors ligne, le mode par défaut met l'envoi en pause et le rejoue au retour du
    // réseau, peut-être bien après que l'utilisateur a changé d'avis.
    networkMode: 'always',
    retry: false,
    onSuccess: (commande) => {
      setIncertain(null)
      client.setQueryData(['commande', commande.command_id], commande)
      setSuivie({ commandId: commande.command_id, envoyeeA: Date.now() })
    },
    onError: (erreur, intention) => {
      const statut = erreur instanceof ErreurApi ? erreur.statut : null
      setIncertain(envoiPeutEtreArrive(statut) ? intention : null)
    },
  })

  const suivi = useQuery({
    queryKey: ['commande', suivie?.commandId],
    queryFn: () => appeler(`/commands/${encodeURIComponent(suivie?.commandId ?? '')}`, Commande),
    enabled: suivie !== null,
    refetchInterval: (requete) => {
      const statut = requete.state.data?.status
      if (statut === undefined || suivie === null) return false
      return suiviEnCours(statut, Date.now() - suivie.envoyeeA) ? INTERVALLE_SUIVI_MS : false
    },
    staleTime: (requete) => {
      const statut = requete.state.data?.status
      return statut !== undefined && estDefinitif(statut) ? Infinity : 0
    },
    gcTime: 60_000,
  })

  const statut = suivi.data?.status
  useEffect(() => {
    if (statut === 'executed') {
      void client.invalidateQueries({ queryKey: requeteSalles().queryKey })
    }
  }, [statut, client])

  function envoyer(enabled: boolean) {
    setSuivie(null)
    envoi.mutate({ enabled, commandId: idPourIntention(enabled, incertain, randomUUID) })
  }

  return {
    envoyer,
    envoiEnCours: envoi.isPending,
    erreurEnvoi: envoi.error,
    commande: suivie === null ? undefined : suivi.data,
    envoyeeA: suivie?.envoyeeA ?? null,
    /** Le suivi ne bouge plus une fois définitif : c'est l'heure du verdict. */
    reponseA: suivi.dataUpdatedAt,
  }
}
