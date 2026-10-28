#!/bin/sh
# Lectures sous un flux plus fort : les capteurs publient toutes les
# INTERVALLE secondes au lieu de 2, et on lit en boucle les routes que le
# mobile appelle, plus la page d'historique la plus lourde.
#
#   ./docs/preuves/outils/charge-lectures.sh [intervalle] [duree_s] [adresse]
#   ./docs/preuves/outils/charge-lectures.sh 0.1 60 http://127.0.0.1:3000
#
# 0.1 seconde est le minimum accepte par le kit, soit 30 messages par seconde
# pour les trois capteurs. Le simulateur est remis a l'intervalle du .env a la
# fin. Mesure la latence des lectures, l'age de la derniere mesure servie, les
# mesures ecrites par seconde et le nombre d'alertes creees pendant l'essai.

INTERVALLE="${1:-0.1}"
DUREE="${2:-60}"
API="${3:-http://127.0.0.1:3000}"
RACINE="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$RACINE" || exit 1

psql() { docker compose exec -T postgres psql -U campus -d campus -tAc "$1"; }
mesurer() {
  DUREE="$1" API="$API" node --input-type=module <<'EOF'
const API = process.env.API
const fin = Date.now() + Number(process.env.DUREE) * 1000
const ROUTES = {
  '/rooms': '/rooms',
  '/alerts': '/alerts?limit=100',
  'historique raw 500': '/devices/sensor-001/telemetry?resolution=raw&limit=500',
  'historique 5m 72': '/devices/sensor-001/telemetry?resolution=5m&limit=72',
}
const temps = Object.fromEntries(Object.keys(ROUTES).map((r) => [r, []]))
let erreurs = 0, ageMax = 0, santeKo = 0
const centile = (v, p) => { const t = [...v].sort((a, b) => a - b); return Math.round(t[Math.min(t.length - 1, Math.ceil((p / 100) * t.length) - 1)]) }
while (Date.now() < fin) {
  for (const [nom, chemin] of Object.entries(ROUTES)) {
    const t0 = performance.now()
    const r = await fetch(API + chemin).catch(() => null)
    temps[nom].push(performance.now() - t0)
    if (r === null || !r.ok) { erreurs++; continue }
    const corps = await r.json()
    if (nom === '/rooms') {
      for (const s of corps.rooms) for (const d of s.devices) ageMax = Math.max(ageMax, Date.now() - new Date(d.recorded_at).getTime())
    }
  }
  const s = await fetch(API + '/health').then((r) => r.json()).catch(() => ({ status: 'injoignable' }))
  if (s.status !== 'ok') santeKo++
  await new Promise((r) => setTimeout(r, 500))
}
for (const [nom, v] of Object.entries(temps)) console.log(`${nom.padEnd(20)} ${v.length} appels  p50 ${centile(v, 50)} ms  p95 ${centile(v, 95)} ms  max ${Math.round(Math.max(...v))} ms`)
console.log(`erreurs ${erreurs}  /health non ok ${santeKo}  age max de la derniere mesure ${(ageMax / 1000).toFixed(1)} s`)
EOF
}

palier() {
  DEBUT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  AVANT=$(psql "select count(*) from telemetry where received_at >= '$DEBUT'::timestamptz - interval '1 hour'")
  mesurer "$DUREE"
  APRES=$(psql "select count(*) from telemetry where received_at >= '$DEBUT'::timestamptz - interval '1 hour'")
  echo "mesures ecrites par seconde $(node -p "(($APRES - $AVANT) / $DUREE).toFixed(1)")  alertes ouvertes pendant l'essai $(psql "select count(*) from alerts where opened_at >= '$DEBUT'")  alertes actives $(psql "select count(*) from alerts where status = 'active'")"
}

echo "== Flux nominal, publication toutes les 2 s"
palier
echo "== Flux fort, publication toutes les $INTERVALLE s"
PUBLISH_INTERVAL="$INTERVALLE" docker compose up -d simulator > /dev/null 2>&1
sleep 5
palier
docker compose up -d simulator > /dev/null 2>&1
echo "Simulateur remis a l'intervalle du .env"
