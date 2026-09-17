#!/bin/sh
# Interroge Loki depuis le reseau Docker du projet, sans passer par Grafana.
#
#   ./docs/preuves/outils/loki.sh '{service_name="backend"} | json | deviceId="sensor-001"' [limite] [depuis]
#
# depuis : duree relative acceptee par Loki, par defaut 15m.

QUERY="$1"
LIMIT="${2:-50}"
SINCE="${3:-15m}"
NET=applications-mobiles-et-iot_default

docker run --rm --network "$NET" curlimages/curl:latest -sG \
  'http://loki:3100/loki/api/v1/query_range' \
  --data-urlencode "query=$QUERY" \
  --data-urlencode "limit=$LIMIT" \
  --data-urlencode "since=$SINCE" \
| python3 -c "
import sys, json
from datetime import datetime, timezone
try:
    r = json.loads(sys.stdin.read())['data']['result']
except Exception as e:
    print('reponse inattendue de Loki :', e); raise SystemExit(1)
lignes = []
for s in r:
    for ns, v in s['values']:
        lignes.append((int(ns), v))
lignes.sort()
for ns, v in lignes:
    t = datetime.fromtimestamp(ns/1e9, timezone.utc).strftime('%H:%M:%S.%f')[:-3]
    try:
        d = json.loads(v)
        print(f\"{t}  {d.get('level','?'):5} {d.get('eventType','-'):24} {d.get('deviceId') or '-':12} {d.get('status') or '-':10} {d.get('reason') or d.get('msg','')}\")
    except Exception:
        print(f'{t}  {v}')
print(f'-- {len(lignes)} ligne(s)')
"
