import test from 'node:test'
import assert from 'node:assert/strict'
import { detecterBascules, vientDeLaSessionAnnoncee } from './surveillance.ts'

// Le seuil déclaré dans docs/architecture.md, avant les tests de recette.
const SEUIL = 30
const T = (iso: string) => new Date(iso)

test('un objet vu pour la première fois ne bascule pas', () => {
  const connus = new Map<string, boolean>()
  const changements = detecterBascules(
    [{ deviceId: 'sensor-001', recordedAt: T('2026-09-17T10:00:00Z') }],
    connus,
    T('2026-09-17T10:05:00Z'),
    SEUIL,
  )
  assert.deepEqual(changements, [])
  // Son état est quand même retenu, sinon la bascule suivante serait manquée.
  assert.equal(connus.get('sensor-001'), true)
})

test('un capteur qui se tait bascule une seule fois', () => {
  const connus = new Map([['sensor-001', false]])
  const etats = [{ deviceId: 'sensor-001', recordedAt: T('2026-09-17T10:00:00Z') }]

  const premier = detecterBascules(etats, connus, T('2026-09-17T10:00:45Z'), SEUIL)
  assert.equal(premier.length, 1)
  assert.equal(premier[0]?.bascule, 'devenue_ancienne')
  assert.equal(premier[0]?.ageSecondes, 45)

  // Le job repasse toutes les 5 secondes : sans mémoire il répéterait la ligne.
  const second = detecterBascules(etats, connus, T('2026-09-17T10:00:50Z'), SEUIL)
  assert.deepEqual(second, [])
})

test('un capteur qui recommence à mesurer bascule dans l autre sens', () => {
  const connus = new Map([['sensor-001', true]])
  const changements = detecterBascules(
    [{ deviceId: 'sensor-001', recordedAt: T('2026-09-17T10:01:00Z') }],
    connus,
    T('2026-09-17T10:01:05Z'),
    SEUIL,
  )
  assert.equal(changements.length, 1)
  assert.equal(changements[0]?.bascule, 'redevenue_fraiche')
  assert.equal(connus.get('sensor-001'), false)
})

test('chaque objet est suivi séparément', () => {
  const connus = new Map([
    ['sensor-001', false],
    ['sensor-002', false],
  ])
  const changements = detecterBascules(
    [
      { deviceId: 'sensor-001', recordedAt: T('2026-09-17T10:00:00Z') },
      { deviceId: 'sensor-002', recordedAt: T('2026-09-17T10:00:40Z') },
    ],
    connus,
    T('2026-09-17T10:00:45Z'),
    SEUIL,
  )
  assert.equal(changements.length, 1)
  assert.equal(changements[0]?.deviceId, 'sensor-001')
  assert.equal(connus.get('sensor-002'), false)
})

test('un objet qui n a jamais mesuré est ancien, sans âge calculable', () => {
  const connus = new Map([['sensor-003', false]])
  const changements = detecterBascules(
    [{ deviceId: 'sensor-003', recordedAt: null }],
    connus,
    T('2026-09-17T10:00:00Z'),
    SEUIL,
  )
  assert.equal(changements[0]?.bascule, 'devenue_ancienne')
  assert.equal(changements[0]?.ageSecondes, null)
})

test('une mesure de la session annoncée est reconnue', () => {
  assert.equal(vientDeLaSessionAnnoncee('abc123-42', 'abc123'), true)
})

test('une mesure forgée par un tiers ne porte pas le bon préfixe', () => {
  assert.equal(vientDeLaSessionAnnoncee('usurp-b-3', 'abc123'), false)
})

test('un préfixe qui ressemble sans le tiret ne passe pas', () => {
  assert.equal(vientDeLaSessionAnnoncee('abc1234-42', 'abc123'), false)
})

test('sans boot_id connu, on ne conclut pas', () => {
  assert.equal(vientDeLaSessionAnnoncee('abc123-42', null), null)
})
