import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('timescaledb', { ifNotExists: true })

  pgm.createTable('rooms', {
    id: { type: 'text', primaryKey: true },
    label: { type: 'text', notNull: true },
  })

  pgm.createTable('devices', {
    id: { type: 'text', primaryKey: true },
    room_id: { type: 'text', notNull: true, references: 'rooms', onDelete: 'RESTRICT' },
    first_seen_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  // Historique de toutes les mesures reçues, y compris celles qui arrivent
  // en retard. C'est l'hypertable TimescaleDB.
  pgm.createTable('telemetry', {
    device_id: { type: 'text', notNull: true },
    message_id: { type: 'text', notNull: true },
    recorded_at: { type: 'timestamptz', notNull: true },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    temperature_c: { type: 'double precision', notNull: true },
    co2_ppm: { type: 'double precision', notNull: true },
  })

  pgm.sql(`
    SELECT create_hypertable(
      'telemetry',
      by_range('recorded_at', INTERVAL '1 day'),
      if_not_exists => TRUE
    );
  `)

  // Déduplication. TimescaleDB impose que tout index unique d'une hypertable
  // contienne la colonne de partitionnement, donc recorded_at en fait partie.
  // Ce n'est pas un problème ici : recorded_at vient du message du capteur,
  // donc un doublon rejoue exactement le même triplet.
  pgm.createIndex('telemetry', ['device_id', 'message_id', 'recorded_at'], {
    name: 'telemetry_dedup',
    unique: true,
  })

  pgm.createIndex('telemetry', ['device_id', { name: 'recorded_at', sort: 'DESC' }], {
    name: 'telemetry_par_objet',
  })

  pgm.sql(`
    SELECT add_retention_policy(
      'telemetry',
      drop_after => INTERVAL '7 days',
      if_not_exists => TRUE
    );
  `)

  // Dernier état connu de chaque objet, une ligne par objet.
  // La disponibilité vient du topic availability, pas des mesures : un objet
  // peut être en ligne et ne plus rien mesurer.
  pgm.createTable('device_state', {
    device_id: { type: 'text', primaryKey: true, references: 'devices', onDelete: 'CASCADE' },
    recorded_at: { type: 'timestamptz' },
    received_at: { type: 'timestamptz' },
    temperature_c: { type: 'double precision' },
    co2_ppm: { type: 'double precision' },
    ventilation: { type: 'boolean' },
    availability: { type: 'text' },
    availability_at: { type: 'timestamptz' },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`SELECT remove_retention_policy('telemetry', if_exists => TRUE);`)
  pgm.dropTable('device_state')
  pgm.dropTable('telemetry')
  pgm.dropTable('devices')
  pgm.dropTable('rooms')
}
