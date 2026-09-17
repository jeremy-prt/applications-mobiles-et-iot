import { pino } from 'pino'
import { randomUUID } from 'node:crypto'
import { config } from './config/index.ts'

/**
 * Les traces du backend. Le sujet de J3 impose des noms de champs précis, pour
 * qu'une recherche dans les logs centralisés soit la même quel que soit le
 * service qui a écrit la ligne : `timestamp`, `service`, `level`, `eventType`,
 * `deviceId`, `eventId`, `topic`, `status`, et `reason` en cas de rejet.
 *
 * Pino sort déjà du JSON, mais avec ses propres noms : `time` en millisecondes
 * depuis 1970, `level` en nombre, plus `pid` et `hostname`. On les remplace ici
 * une fois pour toutes, plutôt qu'à chaque appel.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  // Remplace pid et hostname, qui ne distinguent rien quand un seul processus
  // tourne par conteneur. `environment` sépare les traces quand plusieurs
  // instances écrivent dans le même Loki.
  base: {
    service: config.SERVICE_NAME,
    environment: process.env.NODE_ENV ?? 'development',
  },
  // 30 ne se cherche pas, "info" si.
  formatters: { level: (label) => ({ level: label }) },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
})

/**
 * Les événements qu'on sait produire. Les écrire une fois ici évite qu'une
 * faute de frappe rende une ligne introuvable : le compilateur refuse un nom
 * qui n'est pas dans cette liste, et le tableau de bord cherche ces valeurs.
 */
export type EventType =
  | 'message_recu'
  | 'mesure_enregistree'
  | 'mesure_rejetee'
  | 'doublon_ecarte'
  | 'mesure_ancienne'
  | 'session_inattendue'
  | 'etat_applique'
  | 'disponibilite_appliquee'
  | 'message_differe'
  | 'message_abandonne'
  | 'consolidation_passage'
  | 'broker_connecte'
  | 'broker_perdu'
  | 'broker_reconnexion'
  | 'broker_erreur'
  | 'abonnement'
  | 'api_demarree'
  | 'arret_demande'

/** L'issue d'un traitement, quand elle a un sens pour l'événement. */
export type Statut =
  | 'accepte'
  | 'etat_courant_mis_a_jour'
  | 'historique_seulement'
  | 'rejete'
  | 'differe'
  | 'abandonne'
  | 'perdu'
  | 'retabli'

/** Les motifs de refus. Codes fixes, pour pouvoir compter par motif. */
export type Motif =
  | 'json_illisible'
  | 'schema_invalide'
  | 'valeur_hors_bornes'
  | 'date_dans_l_avenir'
  | 'identite_incoherente'
  | 'doublon'
  | 'topic_hors_contrat'
  | 'objet_inconnu'
  | 'session_inattendue'
  | 'plus_ancienne_que_l_etat_courant'
  | 'aucune_mesure_depuis_le_seuil'
  | 'erreur_technique'

export interface Evenement {
  eventType: EventType
  /** L'objet concerné, quand l'événement en désigne un. */
  deviceId?: string | null
  /**
   * L'identifiant de corrélation. Il est créé à la réception du message MQTT et
   * suit la mesure jusqu'à son écriture en base, ce qui permet de reconstituer
   * son parcours à partir d'une seule recherche.
   */
  eventId?: string
  topic?: string
  status?: Statut
  /**
   * Pourquoi le message a été refusé, sous forme de code stable et non de
   * phrase : une recherche groupe sur `schema_invalide`, pas sur un texte qui
   * change avec le champ fautif. Le détail lisible reste dans `msg` et dans les
   * champs qui l'accompagnent. Obligatoire dès que `status` vaut `rejete`.
   */
  reason?: Motif
  [champ: string]: unknown
}

/**
 * Crée un identifiant de corrélation. Un par message MQTT reçu : c'est notre
 * identité à nous, distincte du `message_id` du capteur, qui est volontairement
 * répété par le kit lors d'un doublon et ne distinguerait donc pas les deux
 * réceptions.
 */
export function nouvelEventId(): string {
  return randomUUID()
}

export function tracer(evenement: Evenement, message: string): void {
  logger.info(evenement, message)
}

export function alerter(evenement: Evenement, message: string): void {
  logger.warn(evenement, message)
}

export function echouer(evenement: Evenement, message: string): void {
  logger.error(evenement, message)
}
