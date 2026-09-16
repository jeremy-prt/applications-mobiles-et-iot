import type { MigrationBuilder } from 'node-pg-migrate'

/**
 * Table des agrégats, écrite par le job de consolidation.
 *
 * Elle n'est pas un agrégat continu de TimescaleDB : le job est explicite parce
 * qu'il applique aussi des règles métier qu'une définition SQL ne sait pas
 * exprimer, comme la non-régression du dernier état connu. Voir
 * docs/decisions/08-base-brute-mongodb.md.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('telemetry_bucket', {
    device_id: {
      type: 'text',
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE',
    },
    // Début de la tranche, aligné sur l'heure ronde. Recalculer une tranche
    // donne toujours le même résultat, donc le job est rejouable.
    bucket_start: { type: 'timestamptz', notNull: true },
    bucket_minutes: { type: 'integer', notNull: true },
    samples: { type: 'integer', notNull: true },
    temperature_avg: { type: 'double precision', notNull: true },
    temperature_min: { type: 'double precision', notNull: true },
    temperature_max: { type: 'double precision', notNull: true },
    co2_avg: { type: 'double precision', notNull: true },
    co2_min: { type: 'double precision', notNull: true },
    co2_max: { type: 'double precision', notNull: true },
    computed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  // Recalculer une tranche écrase la précédente au lieu d'en créer une seconde.
  pgm.addConstraint('telemetry_bucket', 'telemetry_bucket_pk', {
    primaryKey: ['device_id', 'bucket_start', 'bucket_minutes'],
  })

  // Lecture de l'historique : un objet, une période, du plus récent au plus ancien.
  pgm.createIndex(
    'telemetry_bucket',
    ['device_id', { name: 'bucket_start', sort: 'DESC' }],
    { name: 'telemetry_bucket_par_objet' },
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('telemetry_bucket')
}
