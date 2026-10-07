import test from 'node:test'
import assert from 'node:assert/strict'
import {
  comparerDemande,
  dateExpiration,
  deciderResultat,
  limiteSansReponse,
} from './commandes.ts'

// Les valeurs déclarées dans docs/architecture.md, avant les tests de recette.
const ATTENTE = 15
const EXPIRATION = 10
const T = (iso: string) => new Date(iso)
const DEMANDEE = T('2026-10-07T10:00:00Z')

test('le même command_id avec le même contenu est un renvoi', () => {
  assert.equal(
    comparerDemande({ device_id: 'sensor-001', enabled: true }, { device_id: 'sensor-001', enabled: true }),
    'renvoi',
  )
})

test('le même command_id avec une autre consigne est un conflit', () => {
  assert.equal(
    comparerDemande({ device_id: 'sensor-001', enabled: true }, { device_id: 'sensor-001', enabled: false }),
    'conflit',
  )
})

test('le même command_id sur un autre objet est un conflit', () => {
  assert.equal(
    comparerDemande({ device_id: 'sensor-001', enabled: true }, { device_id: 'sensor-002', enabled: true }),
    'conflit',
  )
})

test('l expiration est posée 10 secondes après l envoi', () => {
  assert.equal(dateExpiration(DEMANDEE, EXPIRATION).toISOString(), '2026-10-07T10:00:10.000Z')
})

test('la limite d attente remonte de 15 secondes', () => {
  assert.equal(
    limiteSansReponse(T('2026-10-07T10:00:20Z'), ATTENTE).toISOString(),
    '2026-10-07T10:00:05.000Z',
  )
})

test('un résultat dans les temps rend la commande définitive', () => {
  assert.deepEqual(
    deciderResultat('pending', 'executed', DEMANDEE, T('2026-10-07T10:00:01Z'), ATTENTE),
    { effet: 'appliquer', status: 'executed', late: false },
  )
})

test('un rejet de l objet est appliqué comme tel', () => {
  assert.deepEqual(
    deciderResultat('pending', 'rejected', DEMANDEE, T('2026-10-07T10:00:01Z'), ATTENTE),
    { effet: 'appliquer', status: 'rejected', late: false },
  )
})

test('un résultat pour une commande abandonnée est appliqué en retard', () => {
  assert.deepEqual(
    deciderResultat('unknown', 'executed', DEMANDEE, T('2026-10-07T10:00:30Z'), ATTENTE),
    { effet: 'appliquer', status: 'executed', late: true },
  )
})

test('un résultat reçu après l attente est en retard même si le job n a pas encore abandonné', () => {
  assert.deepEqual(
    deciderResultat('pending', 'executed', DEMANDEE, T('2026-10-07T10:00:16Z'), ATTENTE),
    { effet: 'appliquer', status: 'executed', late: true },
  )
})

test('un second résultat pour une commande exécutée est un doublon', () => {
  assert.deepEqual(
    deciderResultat('executed', 'executed', DEMANDEE, T('2026-10-07T10:00:02Z'), ATTENTE),
    { effet: 'doublon' },
  )
})

test('un résultat contraire après un rejet ne change rien', () => {
  assert.deepEqual(
    deciderResultat('rejected', 'executed', DEMANDEE, T('2026-10-07T10:00:02Z'), ATTENTE),
    { effet: 'doublon' },
  )
})
