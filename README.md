# Campus connecté

Superviser la température et le CO2 de salles de cours depuis un téléphone, être alerté quand
le CO2 dépasse 1000 ppm, et commander leur ventilation. Projet de M2 en applications mobiles et objets connectés, par Jérémy Perret et Kylian
Patry. Les capteurs sont simulés. Le broker, le backend, les bases et l'application sont réels.

```
Capteurs simulés  ->  Mosquitto  ->  Backend  ->  MongoDB, les messages bruts
                                                       |
                                               job toutes les 5 s
                                                       |
                                         PostgreSQL  ->  API  ->  Mobile
```

## Lancer le projet

Prérequis : Docker Desktop démarré, Git, et Node 24 pour les tests et le mobile. Testé sur
macOS avec OrbStack et sur Windows 11 avec Docker Desktop.

```sh
git clone https://github.com/jeremy-prt/applications-mobiles-et-iot.git
cd applications-mobiles-et-iot
cp .env.example .env           # PowerShell : Copy-Item .env.example .env
docker compose up -d --build   # aussi après un changement dans backend/
```

Toutes les commandes se lancent depuis la racine du dépôt.

Le service `migrate` passe en « Exited » juste après. C'est normal, il applique les migrations
puis s'arrête. Si le backend tourne, c'est qu'elles ont réussi, il refuse de démarrer sinon.

Laisser une dizaine de secondes au backend, puis vérifier :

```sh
curl http://localhost:3000/health
curl http://localhost:3000/rooms
curl "http://localhost:3000/devices/sensor-001/telemetry?resolution=5m"
curl "http://localhost:3000/alerts?status=active"
```

`/health` doit répondre `"status":"ok"`. Sinon le corps nomme le composant en cause :
`postgres`, `mongo`, `broker` ou `consolidation`.

Le CO2 simulé monte de 12 ppm toutes les 2 secondes tant que la ventilation est arrêtée. Une
alerte s'ouvre donc d'elle-même dans chaque salle environ une minute après le démarrage, et se
ferme quand la ventilation, commandée depuis l'application, fait redescendre le CO2 sous
800 ppm.

Les logs de tous les conteneurs sont centralisés dans Grafana sur
<http://localhost:3001>. Se connecter avec `admin` et le mot de passe
`GRAFANA_ADMIN_PASSWORD` (`admin` par défaut), puis ouvrir le tableau de bord
**Campus connecté - Logs**. La configuration, les panneaux et les scénarios de
preuve sont décrits dans `docs/observabilite.md`.

Le kit simule trois objets, `sensor-001` à `sensor-003`, associés aux salles 203 à 205. Seule
l'API est exposée au réseau local, sur le port 3000, parce que le téléphone doit l'atteindre. Le
broker MQTT (1883), PostgreSQL (5432) et MongoDB (27017) sont liés à `127.0.0.1`.

Arrêter : `docker compose stop`, qui garde les conteneurs. Relancer : `docker compose start`.
Repartir d'une base vide : `docker compose down -v`, qui supprime les conteneurs et les données.

## Lancer l'application mobile

Prérequis : Expo Go pour le SDK 57 sur le téléphone, et le téléphone sur le même réseau que
la machine.

```sh
cd mobile && npm ci && npx expo start
```

Scanner le code affiché dans le terminal. L'application déduit l'adresse du backend de celle du
serveur Expo, donc rien à configurer même en changeant de réseau.

Si le téléphone reste sur « Chargement des salles », le pare-feu de la machine bloque le
port 3000. Sous Windows, dans un PowerShell administrateur :

```powershell
New-NetFirewallRule -DisplayName "Campus API 3000 (réseau privé)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
```

et pour la retirer ensuite :

```powershell
Remove-NetFirewallRule -DisplayName "Campus API 3000 (réseau privé)"
```

## Lancer les tests

```sh
cd backend && npm ci && npm test && npm run typecheck
cd mobile && npm ci && npm test && npm run typecheck
```

Les tests portent sur les règles, sans base ni broker : ils passent pile arrêtée.

## Simuler des pannes

Depuis la racine, pas depuis `infra/kit`. Le Compose du kit lancé seul crée un second projet
Docker qui échoue sur le port 1883.

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 reset
```

Liste complète dans `infra/kit/README.md`, résultats attendus dans `docs/recette.md`. Trois
scénarios ont un script qui affiche le résultat :

```sh
./docs/preuves/outils/alerte.sh sensor-001          # R12, alerte puis retour à la normale
./docs/preuves/outils/charge-lectures.sh 0.1 60     # lectures sous 30 messages par seconde
./docs/preuves/outils/charge-commandes.sh "10 50"   # commandes simultanées
```

Sous Windows, les lancer depuis Git Bash.

## Limites connues

- L'API est ouverte : ni authentification ni droits, R11 n'est pas faisable. Voir
  `docs/securite.md`.
- Le scan de QR et l'association d'un objet à une salle, R10, ne sont pas faits.
- Une alerte n'est pas poussée au téléphone, il la voit à son rafraîchissement, toutes les
  15 secondes.
- Le parcours sur iPhone de J4 et J5 n'a pas été rejoué : R05, R06, R08 et R09 restent
  partiels.
- Tout est en clair, HTTP et MQTT, sur le réseau local.

La liste complète, avec ce qui est incomplet et les écarts au périmètre, est dans
`docs/J5.md`. Les limites propres à chaque journée sont dans `docs/J1.md` à `docs/J4.md`.

## Documentation

| Fichier | Contenu |
|---|---|
| `docs/architecture.md` | Composants, flux, règles et seuils déclarés |
| `docs/api.md` | Contrat de l'API |
| `docs/modele-de-donnees.md` | Tables, index et garanties de la base |
| `docs/observabilite.md` | Traces, Grafana et recherche d'un parcours |
| `docs/securite.md` | Ce qui est protégé, et ce qui ne l'est pas |
| `docs/recette.md` | Les 13 scénarios et leur résultat |
| `docs/decisions/` | Les choix techniques, par journée |
| `docs/J1.md` à `docs/J5.md` | Journal de chaque journée |
