import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  envoiPeutEtreArrive,
  estDefinitif,
  estIdCommandeValide,
  idPourIntention,
  libelleSuivi,
  ligneStatut,
  messageErreurEnvoi,
  DUREE_CONFIRMATION_MS,
  PLAFOND_SUIVI_MS,
  STATUTS_COMMANDE,
  suiviEnCours,
  type SuiviCommande,
} from './commandes.ts'

const commande = (champs: Partial<SuiviCommande>): SuiviCommande => ({
  status: 'pending',
  reason: null,
  published_at: '2026-10-07T10:00:00Z',
  late: false,
  ...champs,
})

test('seul pending attend encore', () => {
  assert.deepEqual(
    STATUTS_COMMANDE.filter((statut) => !estDefinitif(statut)),
    ['pending'],
  )
})

test('le suivi continue tant que pending et sous le plafond', () => {
  assert.equal(suiviEnCours('pending', 5_000), true)
  assert.equal(suiviEnCours('pending', PLAFOND_SUIVI_MS), true)
})

test('le suivi s arrete au plafond meme sans statut definitif', () => {
  assert.equal(suiviEnCours('pending', PLAFOND_SUIVI_MS + 1), false)
})

test('le suivi s arrete des un statut definitif', () => {
  assert.equal(suiviEnCours('executed', 0), false)
  assert.equal(suiviEnCours('rejected', 0), false)
  assert.equal(suiviEnCours('unknown', 0), false)
})

// Le libelle d'une commande ne doit jamais faire croire que l'objet a agi.
test('aucun libelle ne parle d activation', () => {
  for (const status of STATUTS_COMMANDE) {
    assert.doesNotMatch(libelleSuivi(commande({ status }), 0), /activ/i)
  }
})

test('pending, publiee ou non : en attente de confirmation', () => {
  assert.equal(libelleSuivi(commande({ published_at: null }), 0), 'En attente de confirmation')
  assert.equal(libelleSuivi(commande({}), 0), 'En attente de confirmation')
})

test('executee', () => {
  assert.equal(libelleSuivi(commande({ status: 'executed' }), 0), 'Commande confirmée')
})

test('refusee avec sa raison', () => {
  assert.equal(
    libelleSuivi(commande({ status: 'rejected', reason: 'commande expirée' }), 0),
    "Refusée par l'objet, commande expirée",
  )
})

test('refusee sans raison', () => {
  assert.equal(libelleSuivi(commande({ status: 'rejected' }), 0), "Refusée par l'objet")
})

test('sans reponse', () => {
  assert.equal(libelleSuivi(commande({ status: 'unknown' }), 0), 'Sans réponse, résultat inconnu')
})

test('une reponse en retard est signalee', () => {
  assert.match(libelleSuivi(commande({ status: 'executed', late: true }), 0), /après le délai/)
})

test('pending au dela du plafond : resultat inconnu, pas en attente', () => {
  assert.equal(
    libelleSuivi(commande({}), PLAFOND_SUIVI_MS + 1),
    'Sans confirmation, résultat inconnu',
  )
})

const etat = (champs: Partial<Parameters<typeof ligneStatut>[0]>) =>
  ligneStatut({
    enLigne: true,
    envoiEnCours: false,
    erreurEnvoi: null,
    commande: undefined,
    ecouleMs: 0,
    depuisReponseMs: 0,
    ...champs,
  })

test('rien a dire sans commande', () => {
  assert.equal(etat({}), null)
})

test('envoi ou suivi en cours : une seule ligne d attente', () => {
  assert.equal(etat({ envoiEnCours: true })?.ton, 'attente')
  assert.deepEqual(etat({ commande: commande({}) }), {
    texte: 'En attente de confirmation',
    ton: 'attente',
  })
})

test('hors ligne, la ligne dit pourquoi le bouton est bloque', () => {
  assert.deepEqual(etat({ enLigne: false }), {
    texte: 'Hors ligne, commande impossible',
    ton: 'info',
  })
})

test('hors ligne prime sur une erreur precedente', () => {
  assert.equal(etat({ enLigne: false, erreurEnvoi: 'Erreur' })?.ton, 'info')
})

test('une erreur d envoi reste affichee', () => {
  assert.deepEqual(etat({ erreurEnvoi: 'Erreur', depuisReponseMs: 60_000 }), {
    texte: 'Erreur',
    ton: 'echec',
  })
})

test('la confirmation s efface seule', () => {
  const executee = commande({ status: 'executed' })
  assert.equal(etat({ commande: executee })?.texte, 'Commande confirmée')
  assert.equal(etat({ commande: executee, depuisReponseMs: DUREE_CONFIRMATION_MS + 1 }), null)
})

test('un refus ou une absence de reponse reste affiche', () => {
  for (const status of ['rejected', 'unknown'] as const) {
    assert.equal(etat({ commande: commande({ status }), depuisReponseMs: 60_000 })?.ton, 'echec')
  }
  assert.equal(etat({ commande: commande({}), ecouleMs: PLAFOND_SUIVI_MS + 1 })?.ton, 'echec')
})

test('un nouvel identifiant respecte le format du contrat', () => {
  const id = idPourIntention(true, null, randomUUID)
  assert.match(id, /^cmd-/)
  assert.equal(estIdCommandeValide(id), true)
})

test('le format refuse le vide, les caracteres hors liste et plus de 80 caracteres', () => {
  assert.equal(estIdCommandeValide(''), false)
  assert.equal(estIdCommandeValide('cmd 1'), false)
  assert.equal(estIdCommandeValide('a'.repeat(81)), false)
  assert.equal(estIdCommandeValide('a'.repeat(80)), true)
})

// La cle d'idempotence : un envoi incertain rejoue avec le meme identifiant, pour
// que le serveur reconnaisse la commande au lieu de la publier deux fois.
test('la meme intention apres un envoi incertain reprend le meme identifiant', () => {
  const precedent = { enabled: true, commandId: 'cmd-premier' }
  assert.equal(idPourIntention(true, precedent, randomUUID), 'cmd-premier')
})

test('une autre intention tire un nouvel identifiant', () => {
  const precedent = { enabled: true, commandId: 'cmd-premier' }
  assert.notEqual(idPourIntention(false, precedent, randomUUID), 'cmd-premier')
})

test('deux intentions successives ont deux identifiants', () => {
  assert.notEqual(idPourIntention(true, null, randomUUID), idPourIntention(true, null, randomUUID))
})

test('objet hors ligne : la commande n est pas partie', () => {
  assert.equal(
    messageErreurEnvoi('DEVICE_OFFLINE', 409),
    "Objet hors ligne, rien n'a été envoyé",
  )
})

test('sans reponse du serveur, on ne pretend pas que rien n est parti', () => {
  assert.match(messageErreurEnvoi(null, null), /a pu partir/)
  assert.match(messageErreurEnvoi(null, 503), /a pu partir/)
  assert.match(messageErreurEnvoi(null, 202), /a pu partir/)
})

test('seul un refus 4xx garantit que rien n est parti', () => {
  assert.equal(envoiPeutEtreArrive(409), false)
  assert.equal(envoiPeutEtreArrive(400), false)
  assert.equal(envoiPeutEtreArrive(null), true)
  assert.equal(envoiPeutEtreArrive(500), true)
  assert.equal(envoiPeutEtreArrive(202), true)
})

test('chaque erreur connue a son propre message', () => {
  const codes = ['DEVICE_OFFLINE', 'DEVICE_NOT_FOUND', 'DEVICE_NOT_AUTHORIZED', 'COMMAND_ID_CONFLICT']
  const messages = codes.map((code) => messageErreurEnvoi(code, 409))
  assert.equal(new Set(messages).size, codes.length)
})
