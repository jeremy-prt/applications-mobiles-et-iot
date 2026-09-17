#!/bin/sh
# Mesure ce qu'une coupure du backend fait perdre, en comptant les trous dans les
# numeros de sequence des message_id.
#
#   ./docs/preuves/outils/mesure-coupure.sh <duree_s> <qos>
#
# Le kit compose le message_id d'un identifiant de demarrage et d'un numero qui
# s'incremente de 1 a chaque mesure : un numero absent est un message qui n'est
# jamais arrive, sans avoir a faire confiance a une horloge.

DUREE="${1:-30}"
QOS="${2:-1}"
cd "$(dirname "$0")/.." || exit 1

echo "== coupure de ${DUREE}s, abonnement en QoS ${QOS} =="

MQTT_QOS="$QOS" docker compose up -d backend >/dev/null 2>&1
sleep 20

AVANT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose stop backend >/dev/null 2>&1
sleep "$DUREE"
docker compose start backend >/dev/null 2>&1
APRES=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Laisser le temps de se reconnecter, de recevoir la file eventuelle et de consolider.
sleep 30

docker compose exec -T mongo mongosh campus_brut --quiet --eval "
const debut = new Date('$AVANT'); debut.setSeconds(debut.getSeconds() - 20);
const fin = new Date('$APRES'); fin.setSeconds(fin.getSeconds() + 25);
let total = 0, perdus = 0, rejoues = 0;
for (const dev of ['sensor-001','sensor-002','sensor-003']) {
  const docs = db.messages.find({genre:'telemetry', device_id:dev,
    received_at:{\$gte:debut, \$lte:fin}}).sort({'payload.observed_at':1}).toArray();
  let prev = null;
  for (const d of docs) {
    const seq = parseInt((d.payload?.message_id ?? '').split('-')[1]);
    if (isNaN(seq)) continue;
    if (prev !== null && seq !== prev + 1) perdus += seq - prev - 1;
    // Un message observe avant la reprise mais recu apres a ete retenu par le broker.
    if (d.payload?.observed_at < '$APRES' && d.received_at > new Date('$APRES')) rejoues++;
    prev = seq; total++;
  }
}
print('  messages recus   : ' + total);
print('  messages perdus  : ' + perdus);
print('  dont rejoues par le broker apres reconnexion : ' + rejoues);
print('  attendu pendant la coupure : environ ' + Math.round($DUREE / 2) * 3 + ' (3 capteurs, 2 s)');
"
