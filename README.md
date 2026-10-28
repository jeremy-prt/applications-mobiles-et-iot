# Campus connecté

Suivi du CO2 et de la température des salles de cours sur mobile, avec alerte au-dessus de
1000 ppm et commande de la ventilation. Projet de M2 de Jérémy Perret et Kylian Patry. Capteurs
simulés (`sensor-001` à `sensor-003`, salles 203 à 205), voir
[`docs/architecture.md`](docs/architecture.md).

## Lancer le projet

Prérequis : Docker Desktop démarré, Git, Node 24. Testé sur macOS (OrbStack) et Windows 11.

```sh
git clone https://github.com/jeremy-prt/applications-mobiles-et-iot.git
cd applications-mobiles-et-iot
cp .env.example .env           # PowerShell : Copy-Item .env.example .env
docker compose up -d --build   # aussi après un changement dans backend/
```

Tout se lance depuis la racine. `migrate` passe en « Exited » : normal, il applique les
migrations puis s'arrête.

Vérifier après une dizaine de secondes :

```sh
curl http://localhost:3000/health
curl http://localhost:3000/rooms
curl "http://localhost:3000/devices/sensor-001/telemetry?resolution=5m"
curl "http://localhost:3000/alerts?status=active"
```

`/health` doit répondre `"status":"ok"`, sinon il nomme le composant en cause (`postgres`,
`mongo`, `broker` ou `consolidation`).

Sans ventilation, le CO2 monte de 12 ppm toutes les 2 secondes. Une alerte s'ouvre donc dans
chaque salle après environ une minute. Elle se ferme quand la ventilation ramène le CO2 sous
800 ppm.

Logs dans Grafana : <http://localhost:3001>, `admin` / `GRAFANA_ADMIN_PASSWORD` (`admin` par
défaut), tableau **Campus connecté - Logs**. Voir `docs/observabilite.md`.

Seule l'API (port 3000) est ouverte au réseau local, pour le téléphone. MQTT (1883), PostgreSQL
(5432) et MongoDB (27017) restent sur `127.0.0.1`.

Arrêter : `docker compose stop`. Relancer : `docker compose start`. Tout effacer :
`docker compose down -v`.

## Lancer l'application mobile

Prérequis : Expo Go pour le SDK 57, téléphone sur le même réseau que la machine.

```sh
cd mobile && npm ci && npx expo start
```

Scanner le code du terminal. Aucune adresse à configurer. Si l'application reste sur
« Chargement des salles », le pare-feu bloque le port 3000. Sous Windows, en PowerShell
administrateur :

```powershell
New-NetFirewallRule -DisplayName "Campus API 3000 (réseau privé)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
```

Pour la retirer :

```powershell
Remove-NetFirewallRule -DisplayName "Campus API 3000 (réseau privé)"
```

## Lancer les tests

```sh
cd backend && npm ci && npm test && npm run typecheck
cd mobile && npm ci && npm test && npm run typecheck
```

Sans base ni broker, donc ils passent pile arrêtée.

## Simuler des pannes

Depuis la racine, pas depuis `infra/kit` (conflit sur le port 1883).

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 reset
```

Liste dans `infra/kit/README.md`, résultats attendus dans `docs/recette.md`. Scripts de preuve
(Git Bash sous Windows) :

```sh
./docs/preuves/outils/alerte.sh sensor-001          # R12, alerte puis retour à la normale
./docs/preuves/outils/charge-lectures.sh 0.1 60     # lectures sous 30 messages par seconde
./docs/preuves/outils/charge-commandes.sh "10 50"   # commandes simultanées
```

## Limites connues

- API sans authentification : R11 impossible (`docs/securite.md`).
- R10 non fait : scan de QR et association objet-salle.
- Pas de push : alerte vue au rafraîchissement, toutes les 15 secondes.
- Parcours iPhone de J4 et J5 non rejoué : R05, R06, R08, R09 partiels.
- HTTP et MQTT en clair.

Détails dans `docs/J1.md` à `docs/J5.md`.

## Documentation

| Fichier | Contenu |
|---|---|
| `docs/architecture.md` | Composants, flux, seuils |
| `docs/api.md` | Contrat de l'API |
| `docs/modele-de-donnees.md` | Tables et index |
| `docs/observabilite.md` | Traces et Grafana |
| `docs/securite.md` | Protections et manques |
| `docs/recette.md` | Les 13 scénarios |
| `docs/decisions/` | Choix techniques |
| `docs/J1.md` à `docs/J5.md` | Journal de chaque journée |
