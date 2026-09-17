import type { MigrationBuilder } from 'node-pg-migrate'

/**
 * Garde l'identifiant de démarrage annoncé par chaque objet sur son topic
 * `state`. Le contrat du kit compose le `message_id` d'une mesure avec ce même
 * identifiant suivi d'un numéro de séquence, donc une mesure dont le préfixe ne
 * correspond pas ne vient pas de la session que l'objet a annoncée.
 *
 * Ajouté en J3, après avoir montré qu'un client tiers pouvait publier une
 * fausse mesure crédible sur le topic d'un capteur.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('device_state', {
    boot_id: { type: 'text', notNull: false },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('device_state', 'boot_id')
}
