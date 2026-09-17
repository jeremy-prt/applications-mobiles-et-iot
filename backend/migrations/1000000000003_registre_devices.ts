import type { MigrationBuilder } from 'node-pg-migrate'

/**
 * Marque les objets déclarés comme autorisés à écrire des mesures.
 *
 * Jusqu'ici la table `devices` était peuplée par découverte : la première
 * mesure d'un objet inconnu le créait, ainsi que sa salle. Identifier un objet
 * suffisait donc à l'autoriser. Un client tiers pouvait créer une salle et un
 * capteur en publiant un seul message, et le téléphone les affichait comme les
 * autres.
 *
 * La colonne sépare trois choses que le code confondait : l'identité, portée
 * par le `device_id`, l'existence en base, et le droit d'écrire des mesures.
 * Voir docs/decisions/J3/13-registre-des-objets-autorises.md.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('devices', {
    autorise: { type: 'boolean', notNull: true, default: false },
  })

  // Les objets déjà en base viennent du kit et sont légitimes.
  pgm.sql('update devices set autorise = true')

  // Les trois capteurs du kit, pour qu'une base neuve parte avec le même
  // registre que docs/architecture.md décrit. Un déploiement réel les
  // enrôlerait à la pose, pas par une migration.
  pgm.sql(`
    insert into rooms (id, label) values
      ('salle-203', 'Salle 203'),
      ('salle-204', 'Salle 204'),
      ('salle-205', 'Salle 205')
    on conflict (id) do nothing
  `)
  pgm.sql(`
    insert into devices (id, room_id, autorise) values
      ('sensor-001', 'salle-203', true),
      ('sensor-002', 'salle-204', true),
      ('sensor-003', 'salle-205', true)
    on conflict (id) do update set autorise = true
  `)
  pgm.sql(`
    insert into device_state (device_id) values
      ('sensor-001'), ('sensor-002'), ('sensor-003')
    on conflict (device_id) do nothing
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('devices', 'autorise')
}
