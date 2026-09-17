import { estAncienne } from './fraicheur.ts'

/**
 * Détecte le moment où un objet passe de mesures fraîches à mesures anciennes,
 * et l'inverse.
 *
 * L'API calcule déjà `is_stale` à chaque lecture, mais ce calcul ne laisse
 * aucune trace : personne ne peut dire après coup à quelle heure un capteur
 * s'est tu. Le sujet de J3 demande de retrouver les données devenues anciennes
 * dans les logs, donc il faut un événement, donc il faut savoir quand l'état
 * change plutôt que de répéter la même ligne toutes les 5 secondes.
 */

export interface EtatObjet {
  deviceId: string
  recordedAt: Date | null
}

export type Bascule = 'devenue_ancienne' | 'redevenue_fraiche'

export interface Changement {
  deviceId: string
  bascule: Bascule
  recordedAt: Date | null
  /** Depuis combien de temps la dernière mesure date, au moment de la bascule. */
  ageSecondes: number | null
}

/**
 * Compare l'état observé à ce qui était connu, et ne renvoie que les objets qui
 * ont changé de côté. `connus` est modifié au passage pour porter le nouvel
 * état : c'est la mémoire entre deux appels.
 */
export function detecterBascules(
  etats: EtatObjet[],
  connus: Map<string, boolean>,
  maintenant: Date,
  seuilSecondes: number,
): Changement[] {
  const changements: Changement[] = []

  for (const etat of etats) {
    const ancienne = estAncienne(etat.recordedAt, maintenant, seuilSecondes)
    const connu = connus.get(etat.deviceId)

    // Un objet vu pour la première fois n'a basculé de nulle part. On retient
    // son état sans rien signaler, sinon chaque redémarrage du backend
    // annoncerait faussement que tous les capteurs viennent de se taire.
    if (connu === undefined) {
      connus.set(etat.deviceId, ancienne)
      continue
    }

    if (connu !== ancienne) {
      connus.set(etat.deviceId, ancienne)
      changements.push({
        deviceId: etat.deviceId,
        bascule: ancienne ? 'devenue_ancienne' : 'redevenue_fraiche',
        recordedAt: etat.recordedAt,
        ageSecondes:
          etat.recordedAt === null
            ? null
            : Math.round((maintenant.getTime() - etat.recordedAt.getTime()) / 1000),
      })
    }
  }

  return changements
}

/**
 * Dit si une mesure vient de la session que l'objet a lui-même annoncée.
 *
 * Le contrat du kit compose le `message_id` d'un identifiant de démarrage
 * aléatoire, puis d'un tiret et d'un numéro de séquence. Ce même identifiant
 * est publié sur le topic `state` sous le nom `boot_id`. Une mesure dont le
 * préfixe ne correspond pas n'a donc pas été produite par la session en cours.
 *
 * Ce n'est pas une authentification. Le `boot_id` est publié en retained et
 * quiconque peut lire le topic `state` peut le recopier. Ça détecte une
 * injection qui ne s'en donne pas la peine, pas un client déterminé : la seule
 * vraie réponse serait un compte MQTT par objet, que le kit ne permet pas.
 *
 * Renvoie `null` quand on ne sait pas encore, faute de `boot_id` connu.
 */
export function vientDeLaSessionAnnoncee(
  messageId: string,
  bootIdConnu: string | null,
): boolean | null {
  if (bootIdConnu === null) return null
  return messageId.startsWith(`${bootIdConnu}-`)
}
