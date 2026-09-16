import test from 'node:test'
import assert from 'node:assert/strict'
import { debutDeTranche, tranchesTouchees } from './agregats.ts'

const T = (iso: string) => new Date(iso)

test('une date est ramenée au début de sa tranche', () => {
  assert.equal(
    debutDeTranche(T('2026-09-16T10:07:42.318Z'), 5).toISOString(),
    '2026-09-16T10:05:00.000Z',
  )
})

test('une date pile sur une borne reste sur sa borne', () => {
  assert.equal(
    debutDeTranche(T('2026-09-16T10:05:00.000Z'), 5).toISOString(),
    '2026-09-16T10:05:00.000Z',
  )
})

// Les bornes sont alignées sur l'heure ronde, donc deux exécutions du job
// trouvent les mêmes. C'est ce qui rend le recalcul rejouable.
test('les tranches sont alignées sur l heure ronde', () => {
  assert.equal(
    debutDeTranche(T('2026-09-16T10:59:59.999Z'), 5).toISOString(),
    '2026-09-16T10:55:00.000Z',
  )
  assert.equal(
    debutDeTranche(T('2026-09-16T11:00:00.000Z'), 5).toISOString(),
    '2026-09-16T11:00:00.000Z',
  )
})

test('une largeur nulle ou négative est refusée', () => {
  assert.throws(() => debutDeTranche(T('2026-09-16T10:00:00Z'), 0), RangeError)
  assert.throws(() => debutDeTranche(T('2026-09-16T10:00:00Z'), -5), RangeError)
})

test('un lot de mesures de la même tranche ne donne qu une tranche', () => {
  const dates = [
    T('2026-09-16T10:05:01Z'),
    T('2026-09-16T10:07:03Z'),
    T('2026-09-16T10:09:59Z'),
  ]
  assert.deepEqual(
    tranchesTouchees(dates, 5).map((d) => d.toISOString()),
    ['2026-09-16T10:05:00.000Z'],
  )
})

test('les tranches touchées sont rendues triées et sans doublon', () => {
  const dates = [
    T('2026-09-16T10:12:00Z'),
    T('2026-09-16T10:02:00Z'),
    T('2026-09-16T10:13:00Z'),
    T('2026-09-16T10:02:30Z'),
  ]
  assert.deepEqual(
    tranchesTouchees(dates, 5).map((d) => d.toISOString()),
    ['2026-09-16T10:00:00.000Z', '2026-09-16T10:10:00.000Z'],
  )
})

test('un lot vide ne touche aucune tranche', () => {
  assert.deepEqual(tranchesTouchees([], 5), [])
})
