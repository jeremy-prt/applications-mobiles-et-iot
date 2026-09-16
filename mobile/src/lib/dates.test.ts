import test from 'node:test'
import assert from 'node:assert/strict'
import { dateEtHeure, depuis } from './dates.ts'

const T = (iso: string) => new Date(iso).getTime()

test('quelques secondes', () => {
  assert.equal(depuis('2026-09-16T10:00:00Z', T('2026-09-16T10:00:12Z')), 'il y a 12 s')
})

test('au dela d une minute, on passe aux minutes', () => {
  assert.equal(depuis('2026-09-16T10:00:00Z', T('2026-09-16T10:03:00Z')), 'il y a 3 min')
})

test('au dela d une heure, on passe aux heures', () => {
  assert.equal(depuis('2026-09-16T10:00:00Z', T('2026-09-16T14:00:00Z')), 'il y a 4 h')
})

test('sans date, on ne devine pas', () => {
  assert.equal(depuis(null, T('2026-09-16T10:00:00Z')), 'jamais')
})

// L'horloge du capteur peut avancer sur celle du telephone : la mesure
// paraitrait alors dans le futur. On n'affiche jamais une duree negative.
test('une mesure datee dans le futur affiche zero et non un negatif', () => {
  assert.equal(depuis('2026-09-16T10:00:05Z', T('2026-09-16T10:00:00Z')), 'il y a 0 s')
})

test('une date illisible ne casse pas l affichage', () => {
  assert.equal(dateEtHeure('pas une date'), 'jamais')
  assert.equal(dateEtHeure(null), 'jamais')
})
