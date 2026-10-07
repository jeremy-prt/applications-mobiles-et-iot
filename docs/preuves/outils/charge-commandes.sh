#!/bin/sh
# Montee en charge des commandes : paliers de N commandes envoyees en meme temps,
# reparties sur les trois capteurs, consignes on et off melangees, et une
# commande sur cinq envoyee deux fois en meme temps avec le meme command_id.
#
#   ./docs/preuves/outils/charge-commandes.sh [paliers] [adresse]
#   ./docs/preuves/outils/charge-commandes.sh "10 50 200" http://127.0.0.1:3000
#
# Aucune dependance a installer : Node 24 (fetch integre) et Docker Compose.
# A lancer avec la pile demarree. Pour chaque palier : codes HTTP, latence du
# POST, delai jusqu'au statut definitif, statuts obtenus, lignes en base contre
# command_id uniques, publications MQTT tracees, et latence de /rooms et /health
# avant et pendant la charge, avec l'age de la derniere mesure consolidee.

PALIERS="${1:-10 50 200}"
API="${2:-http://127.0.0.1:3000}"
RACINE="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$RACINE" || exit 1

RUN="charge-$(date +%s)"
DEBUT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SORTIE=$(mktemp)

PALIERS="$PALIERS" API="$API" RUN="$RUN" node --input-type=module - > "$SORTIE" <<'EOF'
const API = process.env.API
const RUN = process.env.RUN
const PALIERS = process.env.PALIERS.split(/\s+/).filter(Boolean).map(Number)
const DEVICES = ['sensor-001', 'sensor-002', 'sensor-003']
const PART_REJOUEE = 0.2
const ATTENTE_MAX_MS = 30_000

const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const centile = (valeurs, p) => {
  if (valeurs.length === 0) return null
  const tri = [...valeurs].sort((a, b) => a - b)
  return Math.round(tri[Math.min(tri.length - 1, Math.ceil((p / 100) * tri.length) - 1)])
}

async function chronometrer(url, options) {
  const t0 = performance.now()
  try {
    const r = await fetch(url, options)
    const corps = await r.json().catch(() => null)
    return { code: r.status, ms: performance.now() - t0, corps }
  } catch (err) {
    return { code: 'erreur', ms: performance.now() - t0, corps: null }
  }
}

/** Interroge /rooms et /health en boucle tant que `actif()` est vrai. */
async function sonder(actif) {
  const rooms = [], health = []
  let ageMax = 0, perimees = 0, sondes = 0, healthKo = 0
  while (actif()) {
    const [r, h] = await Promise.all([chronometrer(`${API}/rooms`), chronometrer(`${API}/health`)])
    rooms.push(r.ms); health.push(h.ms); sondes += 1
    if (r.corps?.rooms) {
      for (const d of r.corps.rooms.flatMap((s) => s.devices)) {
        if (d.recorded_at) ageMax = Math.max(ageMax, (Date.now() - Date.parse(d.recorded_at)) / 1000)
        if (d.is_stale) perimees += 1
      }
    }
    if (h.corps?.status !== 'ok') healthKo += 1
    await attendre(200)
  }
  return { rooms, health, ageMax: Math.round(ageMax * 10) / 10, perimees, sondes, healthKo }
}

const resultats = []

for (const n of PALIERS) {
  let fini = false
  const avant = await sonder((() => { let i = 0; return () => i++ < 10 })())

  const sondeurPendant = sonder(() => !fini)
  const commandes = Array.from({ length: n }, (_, i) => ({
    id: `${RUN}-${n}-${i}`,
    device: DEVICES[i % DEVICES.length],
    enabled: Math.random() < 0.5,
  }))
  const envois = commandes.flatMap((c, i) => {
    const une = () => chronometrer(`${API}/devices/${c.device}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command_id: c.id, enabled: c.enabled }),
    }).then((r) => ({ ...r, c }))
    // Les renvois partent en meme temps que l'original : c'est la course que
    // la cle primaire doit trancher, pas la lecture prealable.
    return i < Math.round(n * PART_REJOUEE) ? [une(), une()] : [une()]
  })
  const t0 = Date.now()
  const reponses = await Promise.all(envois)

  const codes = {}
  for (const r of reponses) codes[r.code] = (codes[r.code] ?? 0) + 1

  // Suivi comme le ferait le mobile, mais jusqu'a 30 s pour voir aussi les unknown.
  const definitif = new Map()
  while (definitif.size < n && Date.now() - t0 < ATTENTE_MAX_MS) {
    await attendre(1000)
    const restantes = commandes.filter((c) => !definitif.has(c.id))
    for (let i = 0; i < restantes.length; i += 20) {
      await Promise.all(restantes.slice(i, i + 20).map(async (c) => {
        const r = await chronometrer(`${API}/commands/${c.id}`)
        if (r.corps?.status && r.corps.status !== 'pending') {
          definitif.set(c.id, { ...r.corps, vuApresMs: Date.now() - t0 })
        }
      }))
    }
  }
  fini = true
  const pendant = await sondeurPendant

  const statuts = { executed: 0, rejected: 0, unknown: 0, pending: n - definitif.size }
  const raisons = {}
  for (const d of definitif.values()) {
    statuts[d.status] += 1
    if (d.reason) raisons[d.reason] = (raisons[d.reason] ?? 0) + 1
  }
  const vus = [...definitif.values()].map((d) => d.vuApresMs)
  const objet = [...definitif.values()]
    .filter((d) => d.result_at)
    .map((d) => Date.parse(d.result_at) - Date.parse(d.requested_at))

  resultats.push({
    palier: n,
    requetes: reponses.length,
    codes,
    postP50: centile(reponses.map((r) => r.ms), 50),
    postP95: centile(reponses.map((r) => r.ms), 95),
    definitifP50: centile(vus, 50),
    definitifP95: centile(vus, 95),
    reponseObjetP95: centile(objet, 95),
    statuts,
    raisons,
    roomsAvantP50: centile(avant.rooms, 50),
    roomsPendantP50: centile(pendant.rooms, 50),
    roomsPendantP95: centile(pendant.rooms, 95),
    healthAvantP50: centile(avant.health, 50),
    healthPendantP95: centile(pendant.health, 95),
    ageMaxMesureS: pendant.ageMax,
    objetsPerimes: pendant.perimees,
    healthNonOk: pendant.healthKo,
  })
  // Laisse retomber la file du simulateur et du job avant le palier suivant.
  await attendre(6000)
}

console.log(JSON.stringify(resultats))
EOF

[ $? -eq 0 ] || { cat "$SORTIE"; rm -f "$SORTIE"; exit 1; }

# Ce qui est en base et ce qui a ete publie, compte a la source.
LIGNES=$(docker compose exec -T postgres psql -U campus -d campus -tAc \
  "select count(*) || ' ' || count(distinct command_id) || ' ' || count(published_at) from commands where command_id like '${RUN}-%'")
PUBLICATIONS=$(docker compose logs --no-log-prefix --since "$DEBUT" backend 2>/dev/null \
  | grep "\"commandId\":\"${RUN}-" | grep -c '"eventType":"commande_publiee"')
NON_PUBLIEES=$(docker compose logs --no-log-prefix --since "$DEBUT" backend 2>/dev/null \
  | grep "\"commandId\":\"${RUN}-" | grep -c '"eventType":"commande_non_publiee"')
EN_ATTENTE=$(docker compose exec -T mongo mongosh campus_brut --quiet --eval "db.messages.countDocuments({statut:'en_attente'})")
# Le temps mesure par le serveur lui-meme, sans le reseau ni la redirection de
# port de Docker Desktop ou OrbStack, qui saturent avant le backend.
SERVEUR=$(docker compose logs --no-log-prefix --since "$DEBUT" backend 2>/dev/null | node --input-type=module -e "
let texte = ''; for await (const b of process.stdin) texte += b
const urls = new Map(), t = []
for (const l of texte.split('\\n')) {
  let d; try { d = JSON.parse(l) } catch { continue }
  if (d.msg === 'incoming request') urls.set(d.reqId, d.req?.method + ' ' + d.req?.url)
  else if (d.msg === 'request completed' && /^POST .*commands/.test(urls.get(d.reqId) ?? '')) t.push(d.responseTime)
}
t.sort((a, b) => a - b)
const c = (p) => Math.round(t[Math.min(t.length - 1, Math.ceil(p / 100 * t.length) - 1)] ?? 0)
console.log(t.length + ' POST, p50 ' + c(50) + ' ms, p95 ' + c(95) + ' ms, max ' + c(100) + ' ms')
")
REFUS_SIMU=$(docker compose logs --no-log-prefix --since "$DEBUT" simulator 2>/dev/null | grep -c 'non remise')

node --input-type=module -e "
const r = JSON.parse(process.argv[1])
const fmt = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + ' ' + v).join(', ')
console.log('| Palier | Requetes | Codes HTTP | POST p50 / p95 (ms) | Definitif vu p50 / p95 (ms) | Statuts | /rooms p50 avant / pendant / p95 (ms) | /health p50 avant / p95 pendant (ms) | /health non ok | Age max mesure (s) |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
for (const x of r) console.log('| ' + [x.palier, x.requetes, fmt(x.codes), x.postP50 + ' / ' + x.postP95,
  x.definitifP50 + ' / ' + x.definitifP95, fmt(x.statuts), x.roomsAvantP50 + ' / ' + x.roomsPendantP50 + ' / ' + x.roomsPendantP95,
  x.healthAvantP50 + ' / ' + x.healthPendantP95, x.healthNonOk, x.ageMaxMesureS].join(' | ') + ' |')
for (const x of r) if (Object.keys(x.raisons).length) console.log('Raisons de rejet, palier ' + x.palier + ' : ' + fmt(x.raisons))
" "$(cat "$SORTIE")"
rm -f "$SORTIE"

set -- $LIGNES
echo
echo "Execution : $RUN"
echo "Lignes en base : $1, command_id distincts : $2, publiees (published_at) : $3"
echo "Traces commande_publiee : $PUBLICATIONS, commande_non_publiee : $NON_PUBLIEES"
echo "Messages bruts encore en attente de consolidation : $EN_ATTENTE"
echo "Publications refusees par le client MQTT du simulateur : $REFUS_SIMU"
echo "Temps de traitement cote serveur : $SERVEUR"
