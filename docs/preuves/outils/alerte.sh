#!/bin/sh
# Scenario R12 : alerte CO2 puis retour a la normale sur un capteur.
#
#   ./docs/preuves/outils/alerte.sh [capteur] [adresse]
#   ./docs/preuves/outils/alerte.sh sensor-001 http://127.0.0.1:3000
#
# A lancer depuis n'importe ou, pile demarree. Ramene d'abord le capteur sous
# 800 ppm, puis joue high-co2, laisse passer une vingtaine de mesures, et joue
# normal-co2. Affiche l'alerte a chaque etape, le nombre de lignes creees, et
# les traces alerte_ouverte et alerte_fermee du backend.

CAPTEUR="${1:-sensor-001}"
API="${2:-http://127.0.0.1:3000}"
RACINE="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$RACINE" || exit 1

incident() { docker compose --profile tools run --rm tools incident "$CAPTEUR" "$1" > /dev/null 2>&1; }
alerte() {
  curl -s "$API/alerts?device_id=$CAPTEUR&limit=1" | node -e '
    const a = JSON.parse(require("fs").readFileSync(0, "utf8")).alerts[0]
    if (a === undefined) { console.log("aucune alerte"); process.exit() }
    console.log(`id ${a.id}  ${a.status}  ouverte ${a.opened_at} a ${a.opening_value} ppm  pic ${a.peak_value}  derniere ${a.last_value}  mesures ${a.measures}  fermee ${a.closed_at ?? "-"} a ${a.closing_value ?? "-"} ppm`)'
}
lignes() {
  docker compose exec -T postgres psql -U campus -d campus -tAc \
    "select count(*) from alerts where device_id = '$CAPTEUR' and opened_at >= '$DEBUT'"
}

incident normal-co2
sleep 12
DEBUT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Depart, $CAPTEUR sous le seuil de retour :"; alerte

incident high-co2
sleep 12
echo "12 s apres high-co2 :"; alerte
sleep 30
echo "42 s apres high-co2 :"; alerte

incident normal-co2
sleep 12
echo "12 s apres normal-co2 :"; alerte
echo "Alertes creees pendant le scenario : $(lignes)"

echo "Traces :"
docker compose logs --no-log-prefix --since "$DEBUT" backend \
  | grep "\"deviceId\":\"$CAPTEUR\"" | grep '"eventType":"alerte_' \
  | node -e '
    for (const l of require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean)) {
      const t = JSON.parse(l)
      console.log(`${t.timestamp}  ${t.eventType}  alerte ${t.alertId}  ${t.co2} ppm  mesure ${t.eventId}`)
    }'
