import test from 'node:test'
import assert from 'node:assert/strict'
import {
  conditionDeRetour,
  libelleEpisode,
  resumeSallesEnAlerte,
  sallesEnAlerte,
  type AlerteAffichee,
} from './alertes.ts'

const ACTIVE: AlerteAffichee = {
  status: 'active',
  threshold_off: 800,
  opened_at: '2026-10-28T08:29:58.736Z',
  peak_value: 2056.4,
  closed_at: null,
  closing_value: null,
}
const RESOLUE: AlerteAffichee = {
  ...ACTIVE,
  status: 'resolved',
  closed_at: '2026-10-28T08:30:42.964Z',
  closing_value: 610,
}
const heure = (iso: string) => iso.slice(11, 16)
const salle = (...alertes: (AlerteAffichee | null)[]) => ({ devices: alertes.map((alert) => ({ alert })) })

test('une salle compte une fois, même avec deux capteurs en alerte', () => {
  assert.equal(sallesEnAlerte([salle(ACTIVE, ACTIVE), salle(null), salle(ACTIVE)]), 2)
})

test('une alerte revenue à la normale ne compte pas', () => {
  assert.equal(sallesEnAlerte([salle(RESOLUE), salle(null)]), 0)
})

test('le résumé s accorde, et disparaît sans alerte', () => {
  assert.equal(resumeSallesEnAlerte(0), null)
  assert.equal(resumeSallesEnAlerte(1), '1 salle en alerte CO2')
  assert.equal(resumeSallesEnAlerte(3), '3 salles en alerte CO2')
})

test('une alerte active dit à quelle valeur elle se termine', () => {
  assert.equal(conditionDeRetour(ACTIVE), 'Pic à 2056 ppm. Retour à la normale sous 800 ppm.')
})

test('une alerte en cours n a pas de fin', () => {
  assert.equal(libelleEpisode(ACTIVE, heure), 'En cours depuis le 08:29, pic 2056 ppm')
})

test('une alerte terminée donne son début, sa fin et sa valeur de retour', () => {
  assert.equal(libelleEpisode(RESOLUE, heure), 'Du 08:29 au 08:30, pic 2056 ppm, revenue à 610 ppm')
})
