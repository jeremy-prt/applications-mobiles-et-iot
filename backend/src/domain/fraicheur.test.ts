import test from 'node:test'
import assert from 'node:assert/strict'
import { estAncienne, remplaceEtatCourant, estDansLAvenir } from './fraicheur.ts'

// Le seuil déclaré dans docs/architecture.md, avant les tests de recette.
const SEUIL = 30
const T = (iso: string) => new Date(iso)

test('une mesure plus jeune que le seuil n est pas ancienne', () => {
  assert.equal(
    estAncienne(T('2026-09-16T10:00:00Z'), T('2026-09-16T10:00:20Z'), SEUIL),
    false,
  )
})

test('une mesure plus vieille que le seuil est ancienne', () => {
  assert.equal(
    estAncienne(T('2026-09-16T10:00:00Z'), T('2026-09-16T10:00:35Z'), SEUIL),
    true,
  )
})

test('pile au seuil, la mesure n est pas encore ancienne', () => {
  assert.equal(
    estAncienne(T('2026-09-16T10:00:00Z'), T('2026-09-16T10:00:30Z'), SEUIL),
    false,
  )
})

test('un objet qui n a jamais mesuré est traité comme ancien', () => {
  assert.equal(estAncienne(null, T('2026-09-16T10:00:00Z'), SEUIL), true)
})

test('la première mesure remplace toujours l état courant', () => {
  assert.equal(remplaceEtatCourant(null, T('2026-09-16T10:00:00Z')), true)
})

test('une mesure plus récente remplace l état courant', () => {
  assert.equal(
    remplaceEtatCourant(T('2026-09-16T10:00:00Z'), T('2026-09-16T10:00:02Z')),
    true,
  )
})

// C'est le jalon 2 de J2, et l'incident delay du kit : une observation datée de
// 60 secondes avant doit entrer dans l'historique sans faire reculer l'écran.
test('une mesure en retard ne remplace pas l état courant', () => {
  assert.equal(
    remplaceEtatCourant(T('2026-09-16T10:00:00Z'), T('2026-09-16T09:59:00Z')),
    false,
  )
})

test('une mesure à la même date que l état courant ne le remplace pas', () => {
  assert.equal(
    remplaceEtatCourant(T('2026-09-16T10:00:00Z'), T('2026-09-16T10:00:00Z')),
    false,
  )
})

// J3, scenario 3c. Une mesure datee de l'avenir passait avant la correction :
// plus recente que tout, elle prenait l'etat courant et l'y bloquait, tout en
// restant sous le seuil de fraicheur.
test('une mesure datée au dela de la tolérance est refusée', () => {
  assert.equal(
    estDansLAvenir(T('2026-09-17T10:02:00Z'), T('2026-09-17T10:00:00Z'), 10),
    true,
  )
})

test('un léger écart d horloge reste accepté', () => {
  assert.equal(
    estDansLAvenir(T('2026-09-17T10:00:03Z'), T('2026-09-17T10:00:00Z'), 10),
    false,
  )
})

test('une mesure du passé n est jamais dans l avenir', () => {
  assert.equal(
    estDansLAvenir(T('2026-09-17T09:59:00Z'), T('2026-09-17T10:00:00Z'), 10),
    false,
  )
})
