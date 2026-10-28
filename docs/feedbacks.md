# Réponses aux feedbacks

Réponses à l'issue du 17 septembre 2026, avec décision et commande de preuve.

## 1. Auto-enregistrement des devices

| Question | Réponse |
|---|---|
| Si je publie une télémétrie valide avec `device_id=sensor-999` et `room_id=666`, qu'est-ce qui se passe ? | Avant, la salle `666` était créée et affichée au téléphone avec `is_stale` à faux. Maintenant le message est refusé avec `reason="objet_non_autorise"` |
| Est-ce qu'identifier un device suffit à l'autoriser ? | Non, c'était le défaut. Maintenant l'autorisation est une colonne `autorise` dans `devices` |
| Comment introduiriez-vous un registre des devices autorisés ? | La table `devices`, avec un drapeau `autorise` posé à l'enrôlement, jamais par un message. Les trois capteurs du kit sont insérés par migration |
| À quel endroit de l'architecture cette vérification devrait-elle être faite ? | Dans le job de consolidation, qui garde le message et trace le refus. L'ACL du broker ne peut pas, car le kit n'a qu'un compte pour tous les objets |

Décision : corrigé, car un message suffisait à créer une salle. Détail dans
`docs/decisions/J3/13-registre-des-objets-autorises.md`.

```sh
docker run --rm --network applications-mobiles-et-iot_default eclipse-mosquitto:2.0.22 \
  mosquitto_pub -h mosquitto -p 1883 -u teacher -P teacher-demo -q 1 \
  -t "campus/v1/devices/sensor-999/telemetry" \
  -m '{"schema_version":1,"message_id":"intrus","device_id":"sensor-999","room_id":"666","observed_at":"2026-09-17T13:00:00.000Z","temperature":{"value":21.5,"unit":"°C"},"co2":{"value":800,"unit":"ppm"}}'
docker compose exec -T postgres psql -U campus -d campus -c "select count(*) from rooms"
```

Avant : 4 salles. Après : 3, et une ligne `eventType="mesure_rejetee"` avec
`reason="objet_non_autorise"`.

## 2. Rôle des deux bases de données

| Question | Réponse |
|---|---|
| Pourquoi stocker les messages bruts dans MongoDB plutôt que directement dans les tables métier PostgreSQL ? | Une table refuse ce qui ne rentre pas dans ses colonnes. Or on veut garder les messages rejetés pour expliquer le rejet et rejouer |
| Quelles caractéristiques du message brut rendent un stockage documentaire intéressant ? | Trois topics de formes différentes, des champs imbriqués ou optionnels, parfois pas du JSON, et un contrat qui change sans nous |
| Pourquoi les mesures consolidées, l'état courant et les agrégats sont-ils mieux adaptés à PostgreSQL et TimescaleDB ? | Il faut des garanties : objet existant, pas de doublon, salle qui ne disparaît pas. TimescaleDB ajoute la rétention et le découpage par période |
| Quelles contraintes utilisez-vous dans PostgreSQL que vous n'utilisez pas dans la zone brute ? | Clés étrangères, unicité sur `(device_id, message_id, recorded_at)`, colonnes obligatoires, mise à jour conditionnelle de l'état courant. La zone brute n'a que l'index de rétention à 7 jours |
| Que gagneriez-vous et que perdriez-vous si les rôles étaient inversés ? | On gagnerait la liberté de schéma. On perdrait la déduplication par contrainte, la rétention et le découpage temporel. Et la zone brute refuserait les messages abîmés qu'on veut garder |
| Que se passe-t-il si MongoDB accepte un message mais que sa consolidation vers PostgreSQL échoue ? | Pas de transaction. On écrit dans PostgreSQL puis on marque le message dans MongoDB. Si le marquage échoue, le message est rejoué et l'unicité absorbe le doublon. Si PostgreSQL est coupé, tout attend. Limite : un message qui plante toujours bloque la file |
| Comment le système sait-il qu'un message brut reste à retraiter ? | Par son `statut` `en_attente`, le seul que le job traite. Si l'objet est inconnu, le message est différé, puis abandonné après 60 passages |
| Pourquoi conserver le message brut après sa consolidation ? | La consolidation peut être fausse. En J2, six testaments rejetés depuis J1 ont été rejoués après correction du schéma |
| Dans quel scénario le rejeu devient-il utile ? | Quand notre code est en tort, pas quand le capteur envoie n'importe quoi |
| Si un nouveau firmware ajoute des champs que le backend ne connaît pas, que se passe-t-il dans MongoDB, et à la consolidation ? | MongoDB garde tout, sans validateur. Zod (`z.object()` sans `strict`) retire les champs inconnus : la mesure passe, le champ est perdu après les 7 jours de rétention. Avec `schema_version: 2`, tout est rejeté mais rejouable |

Décision : documenté, sans changement de code. Acceptable ici, mais un champ ajouté par un
firmware est perdu en silence.

## 3. Déduplication

| Question | Réponse |
|---|---|
| Si je republie le même `message_id` avec un `observed_at` différent, est-ce un doublon chez vous ? | Non. Deux lignes sont créées, et la plus récente devient l'état courant |
| Pour vous, qu'est-ce qui définit l'identité d'un événement ? | Une observation d'un objet à un instant, pas un `message_id` |
| Le `message_id` suffit-il ? | Non. Il est unique par objet seulement, et le kit le renouvelle à chaque redémarrage |
| Pourquoi votre contrainte d'unicité contient-elle plusieurs champs ? | `device_id` car le `message_id` est propre à un objet, `recorded_at` car TimescaleDB l'impose dans tout index unique |
| Votre contrainte traduit-elle réellement votre définition métier d'un doublon ? | Par chance seulement. Elle code « même objet, même identifiant, même instant », pas « même observation ». Ça tient tant que le producteur ne donne pas deux dates au même identifiant, ce que rien ne testait |
| Que se passe-t-il si un producteur réutilise accidentellement un ancien `message_id` ? | Date différente : la mesure entre. Date identique : la vraie mesure est jetée comme doublon, sans qu'on le voie. Reproduit avec une mesure à 2000 ppm |

Décision : contrainte inchangée, risque documenté. Elle convient au kit, et comparer le contenu
coûterait une empreinte par message. Détail dans
`docs/decisions/J3/14-definition-d-un-doublon.md`.

```sh
./docs/preuves/outils/loki.sh '{service_name="backend"} | json | eventType="doublon_ecarte"' 20 1h
```

## 4. Perte pendant une coupure du backend

| Question | Réponse |
|---|---|
| Vous perdez environ 80 % des messages sur une coupure de 30 secondes. Pourquoi est-ce acceptable ? | La question nous a fait trouver un bug : après correction, la perte est de 35 %. C'est acceptable pour superviser une salle, car l'état courant revient en quelques secondes. Pas pour de la facturation |
| Quelle garantie pensiez-vous obtenir avec QoS 1 ? | Zéro perte, avec session persistante et QoS 1 (hypothèse de J3 et `docs/J2.md`) |
| Quelle garantie avez-vous réellement observée ? | Le broker gardait tout : un abonné témoin a reçu les 46 messages. Notre backend posait son écouteur après l'abonnement, donc ratait la file envoyée dès la connexion |
| Comment l'utilisateur sait-il aujourd'hui que l'historique contient un trou ? | Il ne le sait pas, rien ne le signale |
| Le système est-il capable de détecter qu'il manque des événements ? | Non. On a compté les trous à la main avec un script. `broker_perdu` et `broker_connecte` datent la coupure sans la chiffrer |
| Si cette perte devenait inacceptable, quelles solutions pourriez-vous envisager ? | Du moins cher au plus cher : suivre les numéros de séquence pour signaler le trou ; régler `max_queued_messages` et l'expiration de session, donc modifier le kit ; MQTT 5 ; tampon dans l'objet, hors contrat du kit |
| La correction devrait-elle se situer côté broker, backend ou device ? | Seul le device peut garantir zéro perte. Le broker fixe ce qu'il garde. Le backend peut détecter le trou au retour, c'est le moins cher |

Décision : bug de l'écouteur corrigé et mesuré. La perte des douze premières secondes reste
inexpliquée : le broker avait les messages, et changer l'ordre d'arrêt n'a rien donné. On
l'écrit plutôt que d'inventer une cause, ce qu'on avait fait dans la première version de l'ADR 12.

```sh
./docs/preuves/outils/mesure-coupure.sh 30 1
```

| Mesure, coupure de 30 secondes, 45 à 48 messages publiés selon la durée réelle | Rejoués par le broker | Manquants |
|---|---|---|
| Avant correction | 2 | 43 |
| Après correction | 32 | 16 |

## 5. Healthcheck et état réel du système

| Question | Réponse |
|---|---|
| Votre `/health` renvoie ok si PostgreSQL répond. Si MQTT est indisponible, êtes-vous réellement healthy ? | Non. L'API disait `ok` alors que plus rien n'entrait. Elle répond maintenant `degraded` avec le composant en cause |
| Si MongoDB est indisponible, que se passe-t-il ? | Au démarrage, le processus ne démarre pas. Ensuite, chaque message est perdu : 24 en 20 secondes avec `/health` à `ok`. Maintenant : `degraded` |
| L'API peut-elle continuer à répondre alors que plus aucune télémétrie n'est ingérée ? | Oui, c'est voulu, car MQTT et HTTP sont indépendants. Mais il faut le signaler |
| Quelle différence faites-vous entre liveness et readiness ? | Liveness : faut-il redémarrer. Readiness : peut-il servir. Une ingestion cassée ne fait pas échouer la liveness, car redémarrer ne répare pas un broker absent |
| Quels composants doivent participer au calcul de l'état de santé ? | Broker, MongoDB et PostgreSQL, car l'ingestion dépend des trois |
| Quels composants peuvent être indisponibles sans empêcher l'API de répondre ? | Le broker et MongoDB : l'API sert alors des données figées |
| Comment représenteriez-vous un état `degraded` ? | `ok`, `degraded` si l'ingestion est cassée, `down` sans PostgreSQL, plus le détail par composant |
| Quel état un orchestrateur doit-il utiliser pour décider de redémarrer le processus ? | Le code HTTP : 200 même en `degraded`, 503 sans PostgreSQL |
| Quel état présenter à un exploitant pour comprendre que la chaîne est partiellement dégradée ? | Le corps de la réponse, qui nomme le composant, et le tableau de bord Grafana |

Décision : corrigé. Le champ `db` reste pour les appelants de J1.

```sh
curl -s -w " (HTTP %{http_code})\n" http://localhost:3000/health
docker compose stop mosquitto && sleep 12 && curl -s http://localhost:3000/health
```

```json
{"status":"degraded","db":true,"composants":{"postgres":true,"mongo":true,"broker":false}}
```

## Ce que ces questions ont changé

Deux défauts corrigés : l'auto-enregistrement et l'écouteur MQTT posé trop tard. Le second a
montré que notre analyse de J3 était fausse.

Deux comportements acceptés : les champs inconnus ignorés et la déduplication.

Un point ouvert : la perte des premières secondes d'une coupure.
