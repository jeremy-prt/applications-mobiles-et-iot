import test from 'node:test'
import assert from 'node:assert/strict'
import { Telemetrie, Etat, Disponibilite } from './mqtt.ts'

/**
 * Ces schémas sont la frontière du système. Depuis que le consommateur MQTT
 * écrit dans la zone brute sans valider, c'est le job de consolidation qui les
 * applique : un message refusé ici reste dans la zone brute et n'entre pas dans
 * les mesures.
 */

const mesureValide = {
  schema_version: 1,
  message_id: 'bfa49075a42c4f63ae56d382bdb089ee-42',
  device_id: 'sensor-001',
  room_id: 'salle-203',
  observed_at: '2026-09-16T09:00:00.000Z',
  temperature: { value: 22.14, unit: '°C' },
  co2: { value: 912, unit: 'ppm' },
}

test('une mesure conforme au contrat est acceptée', () => {
  assert.equal(Telemetrie.safeParse(mesureValide).success, true)
})

// C'est exactement l'incident invalid du kit : co2.value devient une chaîne.
test('une mesure dont le CO2 est une chaîne est refusée', () => {
  const res = Telemetrie.safeParse({
    ...mesureValide,
    co2: { value: 'invalide', unit: 'ppm' },
  })
  assert.equal(res.success, false)
  assert.deepEqual(res.error?.issues[0]?.path, ['co2', 'value'])
})

test('une mesure sans unité est refusée', () => {
  assert.equal(
    Telemetrie.safeParse({ ...mesureValide, co2: { value: 912 } }).success,
    false,
  )
})

test('une mesure dont la date est sans fuseau est refusée', () => {
  assert.equal(
    Telemetrie.safeParse({ ...mesureValide, observed_at: '2026-09-16T09:00:00' }).success,
    false,
  )
})

test('une autre version de schéma est refusée', () => {
  assert.equal(Telemetrie.safeParse({ ...mesureValide, schema_version: 2 }).success, false)
})

test('une valeur non finie est refusée', () => {
  assert.equal(
    Telemetrie.safeParse({
      ...mesureValide,
      temperature: { value: Number.POSITIVE_INFINITY, unit: '°C' },
    }).success,
    false,
  )
})

test('un état conforme au contrat est accepté', () => {
  assert.equal(
    Etat.safeParse({
      schema_version: 1,
      device_id: 'sensor-001',
      reported_at: '2026-09-16T09:00:00.000Z',
      boot_id: 'bfa49075a42c4f63ae56d382bdb089ee',
      ventilation: true,
    }).success,
    true,
  )
})

// Le contrat impose un booléen JSON strict, pas la chaîne "true".
test('une ventilation donnée en chaîne est refusée', () => {
  assert.equal(
    Etat.safeParse({
      schema_version: 1,
      device_id: 'sensor-001',
      reported_at: '2026-09-16T09:00:00.000Z',
      boot_id: 'bfa49075a42c4f63ae56d382bdb089ee',
      ventilation: 'true',
    }).success,
    false,
  )
})

test('une disponibilité hors des deux valeurs du contrat est refusée', () => {
  assert.equal(
    Disponibilite.safeParse({
      schema_version: 1,
      device_id: 'sensor-001',
      status: 'unknown',
      reported_at: '2026-09-16T09:00:00.000Z',
    }).success,
    false,
  )
})

test('une disponibilité conforme est acceptée', () => {
  assert.equal(
    Disponibilite.safeParse({
      schema_version: 1,
      device_id: 'sensor-001',
      status: 'offline',
      reported_at: '2026-09-16T09:00:00.000Z',
    }).success,
    true,
  )
})

/**
 * Le testament du broker : publié à la place de l'objet quand il disparaît sans
 * prévenir. Le contrat du kit le décrit sans date, puisque le broker ne sait
 * pas quand l'objet est tombé.
 */
test('un testament du broker, sans date, est accepté', () => {
  const res = Disponibilite.safeParse({
    schema_version: 1,
    device_id: 'sensor-001',
    status: 'offline',
    reason: 'connection_lost',
  })
  assert.equal(res.success, true)
  assert.equal(res.data?.reported_at, undefined)
})

test('un arrêt propre garde sa date et sa raison', () => {
  const res = Disponibilite.safeParse({
    schema_version: 1,
    device_id: 'sensor-001',
    status: 'offline',
    reason: 'shutdown',
    reported_at: '2026-09-16T09:00:00.000Z',
  })
  assert.equal(res.success, true)
  assert.equal(res.data?.reason, 'shutdown')
})

// J3, scenario 3c. Ces trois cas passaient avant la correction : le schema
// n'exigeait qu'un nombre fini, donc -300 °C entrait en base et etait servi par
// l'API comme une mesure fraiche.
test('une temperature physiquement impossible est refusée', () => {
  const message = { ...mesureValide, temperature: { value: -300, unit: '°C' } }
  assert.equal(Telemetrie.safeParse(message).success, false)
})

test('un CO2 hors de la plage du capteur est refusé', () => {
  const message = { ...mesureValide, co2: { value: 99999, unit: 'ppm' } }
  assert.equal(Telemetrie.safeParse(message).success, false)
})

test('une valeur anormale mais plausible reste acceptée', () => {
  // 3000 ppm sort du modele du kit mais reste une mesure vraie, que la
  // supervision doit remonter et non jeter.
  const message = { ...mesureValide, co2: { value: 3000, unit: 'ppm' } }
  assert.equal(Telemetrie.safeParse(message).success, true)
})
