import test from 'node:test'
import assert from 'node:assert/strict'
import { deciderAlerte, seuilsValides, type DecisionAlerte } from './alertes.ts'

// Les seuils déclarés dans docs/architecture.md, avant les tests de recette.
const SEUILS = { declenchement: 1000, retour: 800 }

/** Rejoue une suite de mesures comme le job, et rend chaque décision. */
function rejouer(valeurs: number[]): DecisionAlerte[] {
  let active = false
  return valeurs.map((co2) => {
    const decision = deciderAlerte(active, co2, SEUILS)
    if (decision === 'ouvrir') active = true
    if (decision === 'fermer') active = false
    return decision
  })
}

test('sous le seuil de déclenchement, rien ne s ouvre', () => {
  assert.equal(deciderAlerte(false, 999, SEUILS), 'rien')
})

test('le seuil de déclenchement ouvre une alerte', () => {
  assert.equal(deciderAlerte(false, 1000, SEUILS), 'ouvrir')
})

test('une alerte active au-dessus du seuil est prolongée, pas recréée', () => {
  assert.deepEqual(rejouer([1012, 1024, 1800, 1812]), ['ouvrir', 'prolonger', 'prolonger', 'prolonger'])
})

test('entre les deux seuils, une alerte active le reste', () => {
  assert.equal(deciderAlerte(true, 900, SEUILS), 'prolonger')
  assert.equal(deciderAlerte(true, 800, SEUILS), 'prolonger')
})

test('sous le seuil de retour, l alerte revient à la normale', () => {
  assert.equal(deciderAlerte(true, 799, SEUILS), 'fermer')
})

test('une valeur qui oscille autour de 1000 ppm n ouvre qu une alerte', () => {
  const decisions = rejouer([990, 1005, 995, 1003, 997, 1010, 985])
  assert.equal(decisions.filter((d) => d === 'ouvrir').length, 1)
  assert.equal(decisions.includes('fermer'), false)
})

test('high-co2 puis normal-co2 du kit : une ouverture puis un retour', () => {
  assert.deepEqual(rejouer([650, 1800, 1812, 600, 612]), ['rien', 'ouvrir', 'prolonger', 'fermer', 'rien'])
})

test('après un retour à la normale, un nouveau dépassement ouvre une nouvelle alerte', () => {
  assert.deepEqual(rejouer([1200, 700, 1100]), ['ouvrir', 'fermer', 'ouvrir'])
})

test('des seuils égaux ou inversés sont refusés', () => {
  assert.equal(seuilsValides(SEUILS), true)
  assert.equal(seuilsValides({ declenchement: 1000, retour: 1000 }), false)
  assert.equal(seuilsValides({ declenchement: 800, retour: 1000 }), false)
})
