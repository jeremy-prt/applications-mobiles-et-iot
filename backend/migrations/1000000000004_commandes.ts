import type { MigrationBuilder } from 'node-pg-migrate'

/**
 * Le cycle de vie des commandes. La clé est le `command_id` choisi par le
 * mobile : c'est elle qui empêche un renvoi de la même demande de créer une
 * seconde commande, et donc une seconde exécution.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('commands', {
    command_id: { type: 'text', primaryKey: true },
    device_id: { type: 'text', notNull: true, references: 'devices', onDelete: 'RESTRICT' },
    action: { type: 'text', notNull: true, default: 'set_ventilation' },
    enabled: { type: 'boolean', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status in ('pending', 'executed', 'rejected', 'unknown')",
    },
    // La raison donnée par l'objet quand il refuse, telle qu'il l'a écrite.
    reason: { type: 'text' },
    requested_at: { type: 'timestamptz', notNull: true },
    published_at: { type: 'timestamptz' },
    expires_at: { type: 'timestamptz', notNull: true },
    result_at: { type: 'timestamptz' },
    late: { type: 'boolean', notNull: true, default: false },
  })

  // Le job cherche à chaque passage les commandes restées sans réponse. Index
  // partiel : il ne contient que les `pending`, quelques lignes au plus, quel
  // que soit le nombre de commandes passées.
  pgm.createIndex('commands', 'requested_at', {
    name: 'commands_en_attente',
    where: "status = 'pending'",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('commands')
}
