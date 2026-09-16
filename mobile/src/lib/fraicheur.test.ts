import test from 'node:test'
import assert from 'node:assert/strict'
import {
  etatDonnees,
  fraicheurAffichee,
  libelleFraicheur,
  messageEtatDonnees,
  SEUIL_FRAICHEUR_MS,
} from './fraicheur.ts'

test('reponse fraiche et mesure fraiche : donnee recente', () => {
  assert.equal(fraicheurAffichee(false, 2_000), 'recente')
})

test('le serveur a dit ancienne : ca reste ancienne', () => {
  assert.equal(fraicheurAffichee(true, 0), 'ancienne')
})

// C'est l'exigence de R07 : le mobile ne presente pas les anciennes mesures
// comme fraiches.
test('reponse gardee en cache au dela du seuil : fraicheur inconnue', () => {
  assert.equal(fraicheurAffichee(false, SEUIL_FRAICHEUR_MS + 1), 'inconnue')
})

test('pile au seuil, la reponse vaut encore', () => {
  assert.equal(fraicheurAffichee(false, SEUIL_FRAICHEUR_MS), 'recente')
})

test('une mesure ancienne le reste meme avec une reponse perimee', () => {
  assert.equal(fraicheurAffichee(true, 10 * SEUIL_FRAICHEUR_MS), 'ancienne')
})

test('chaque etat a un libelle distinct', () => {
  const libelles = (['recente', 'ancienne', 'inconnue'] as const).map(libelleFraicheur)
  assert.equal(new Set(libelles).size, 3)
})

test('tout va bien : rien a signaler', () => {
  assert.equal(etatDonnees(true, false, false, 1_000), 'a-jour')
  assert.equal(messageEtatDonnees('a-jour'), null)
})

test('sans reseau, c est le telephone qu on nomme', () => {
  assert.equal(etatDonnees(false, true, false, 1_000), 'hors-ligne')
})

// Le cas qui a ete manque au premier essai : TanStack Query met la requete en
// pause au lieu de l'echouer, donc isError reste faux et le bandeau ne
// s'affichait pas.
test('une requete en pause compte comme un serveur injoignable', () => {
  assert.equal(etatDonnees(true, true, false, 1_000), 'serveur-injoignable')
})

test('un appel parti et echoue aussi', () => {
  assert.equal(etatDonnees(true, false, true, 1_000), 'serveur-injoignable')
})

test('le telephone hors ligne prime sur le serveur injoignable', () => {
  assert.equal(etatDonnees(false, true, true, 1_000), 'hors-ligne')
})

test('tout marche mais la reponse a vieilli au dela du seuil', () => {
  assert.equal(etatDonnees(true, false, false, SEUIL_FRAICHEUR_MS + 1), 'cache')
})

test('pile au seuil, rien a signaler', () => {
  assert.equal(etatDonnees(true, false, false, SEUIL_FRAICHEUR_MS), 'a-jour')
})

test('chaque etat signale a son propre message', () => {
  const messages = (['hors-ligne', 'serveur-injoignable', 'cache'] as const).map(
    messageEtatDonnees,
  )
  assert.equal(new Set(messages).size, 3)
})
