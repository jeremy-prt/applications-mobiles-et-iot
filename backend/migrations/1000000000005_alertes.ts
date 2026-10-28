import type { MigrationBuilder } from 'node-pg-migrate'

/**
 * Les alertes CO2. Une ligne par épisode, de l'activation au retour à la
 * normale, et non une ligne par mesure au-dessus du seuil. Les seuils sont
 * recopiés dans chaque alerte, pour qu'elle reste lisible si on les change.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('alerts', {
    id: 'id',
    device_id: { type: 'text', notNull: true, references: 'devices', onDelete: 'CASCADE' },
    room_id: { type: 'text', notNull: true, references: 'rooms', onDelete: 'RESTRICT' },
    kind: { type: 'text', notNull: true, check: "kind in ('co2_high')" },
    status: {
      type: 'text',
      notNull: true,
      default: 'active',
      check: "status in ('active', 'resolved')",
    },
    threshold_on: { type: 'double precision', notNull: true },
    threshold_off: { type: 'double precision', notNull: true },
    opened_at: { type: 'timestamptz', notNull: true },
    opening_value: { type: 'double precision', notNull: true },
    peak_value: { type: 'double precision', notNull: true },
    last_value: { type: 'double precision', notNull: true },
    last_measure_at: { type: 'timestamptz', notNull: true },
    measures: { type: 'integer', notNull: true, default: 1 },
    closed_at: { type: 'timestamptz' },
    closing_value: { type: 'double precision' },
  })

  // Une seule alerte active par objet et par type. C'est la base qui le
  // garantit, pas un test applicatif qui serait une course.
  pgm.createIndex('alerts', ['device_id', 'kind'], {
    name: 'alerts_une_active',
    unique: true,
    where: "status = 'active'",
  })
  pgm.createIndex('alerts', [{ name: 'opened_at', sort: 'DESC' }], { name: 'alerts_recentes' })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('alerts')
}
