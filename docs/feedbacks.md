# Réponses aux feedbacks

Réponses point par point à l'issue du 17 septembre 2026. Chaque sujet se termine par la
décision prise et la commande qui la prouve.

## 1. Auto-enregistrement des devices

| Question | Réponse |
|---|---|
| Si je publie une télémétrie valide avec `device_id=sensor-999` et `room_id=666`, qu'est-ce qui se passe ? | Avant correction, l'objet et la salle étaient créés, la mesure entrait en base, et `GET /rooms` servait au téléphone une salle nommée `666` avec `is_stale` à faux. Sa trace était identique à celle d'un vrai capteur. Depuis, le message est refusé avec `reason="objet_non_autorise"`, et rien n'est créé |
| Est-ce qu'identifier un device suffit à l'autoriser ? | C'était exactement le défaut. Le `device_id` répondait à trois questions à la fois : qui est cet objet, existe-t-il, et a-t-il le droit d'écrire. Aujourd'hui l'identité reste portée par le `device_id`, l'existence par une ligne dans `devices`, et l'autorisation par la colonne `autorise` |
| Comment introduiriez-vous un registre des devices autorisés ? | La table `devices` devient le registre, avec un drapeau `autorise` posé à l'enrôlement et jamais par un message entrant. Les trois capteurs du kit y sont insérés par migration. Un déploiement réel les enrôlerait à la pose, ce que J4 fera avec le QR code prévu par `POST /associations` |
| À quel endroit de l'architecture cette vérification devrait-elle être faite ? | Dans le job de consolidation, avec le reste de la validation. Pas dans le consommateur MQTT, sinon le message serait jeté avant d'être conservé et on ne pourrait pas expliquer le refus. Pas dans l'ACL du broker non plus : elle protège un compte, or le kit n'en donne qu'un seul pour tous les objets |

Décision : corrigé. Le comportement était indéfendable sur un dépôt public, puisqu'un message
suffisait à créer une salle affichée au téléphone. Détail dans
`docs/decisions/J3/13-registre-des-objets-autorises.md`.

```sh
docker run --rm --network applications-mobiles-et-iot_default eclipse-mosquitto:2.0.22 \
  mosquitto_pub -h mosquitto -p 1883 -u teacher -P teacher-demo -q 1 \
  -t "campus/v1/devices/sensor-999/telemetry" \
  -m '{"schema_version":1,"message_id":"intrus","device_id":"sensor-999","room_id":"666","observed_at":"2026-09-17T13:00:00.000Z","temperature":{"value":21.5,"unit":"°C"},"co2":{"value":800,"unit":"ppm"}}'
docker compose exec -T postgres psql -U campus -d campus -c "select count(*) from rooms"
```

Avant : 4 salles. Après : 3 salles, et une ligne `eventType="mesure_rejetee"` portant
`reason="objet_non_autorise"` et la salle revendiquée.

## 2. Rôle des deux bases de données

| Question | Réponse |
|---|---|
| Pourquoi stocker les messages bruts dans MongoDB plutôt que directement dans les tables métier PostgreSQL ? | Une table refuse ce qui ne rentre pas dans ses colonnes, or la zone brute doit justement accepter ce qu'on refusera ensuite : un JSON illisible, un champ manquant, une valeur impossible. C'est ce qui permet d'expliquer après coup ce qu'un capteur avait envoyé et de rejouer le calcul après correction |
| Quelles caractéristiques du message brut rendent un stockage documentaire intéressant ? | Trois topics de formes différentes tiennent dans une seule collection, le corps est imbriqué et porte des champs optionnels, un message peut n'être pas du JSON du tout, et le contrat est amené à changer côté objet sans que nous décidions quand |
| Pourquoi les mesures consolidées, l'état courant et les agrégats sont-ils mieux adaptés à PostgreSQL et TimescaleDB ? | Parce qu'on y a besoin de garanties qu'une base documentaire ne donne pas : une mesure appartient à un objet qui existe, un doublon est impossible, une salle ne disparaît pas sous ses capteurs. TimescaleDB ajoute la rétention automatique et le découpage par période sur des séries datées |
| Quelles contraintes utilisez-vous dans PostgreSQL que vous n'utilisez pas dans la zone brute ? | Les clés étrangères entre mesure, objet et salle, l'unicité sur `(device_id, message_id, recorded_at)`, les colonnes obligatoires, et la mise à jour conditionnelle qui empêche l'état courant de reculer. La zone brute n'a aucun validateur de schéma, aucune clé étrangère et aucune unicité : son seul mécanisme structurel est l'index de rétention à 7 jours |
| Que gagneriez-vous et que perdriez-vous si les rôles étaient inversés ? | On gagnerait de ne plus écrire de migration quand le contrat change, et la liberté de garder l'historique sous des formes différentes. On perdrait ce qui fait tenir le système : la déduplication deviendrait un test applicatif, donc une course entre deux traitements simultanés, les droits devraient être recopiés dans chaque mesure au risque de diverger, et on perdrait la rétention automatique et le découpage temporel. Et une zone brute sous PostgreSQL refuserait les messages abîmés, c'est à dire précisément ceux qu'on veut garder |
| Que se passe-t-il si MongoDB accepte un message mais que sa consolidation vers PostgreSQL échoue ? | Il n'y a pas de transaction entre les deux bases. L'écriture PostgreSQL se fait avant le marquage dans MongoDB : si le marquage échoue, le message repart en attente et sera rejoué, et l'unicité absorbe le doublon. Si PostgreSQL est indisponible, rien n'est marqué et tout s'accumule dans la zone brute jusqu'au rétablissement. La limite connue est qu'un message qui fait systématiquement lever une exception bloque la tête de file, puisque le traitement suit l'ordre d'arrivée |
| Comment le système sait-il qu'un message brut reste à retraiter ? | Par son `statut`. Il vaut `en_attente` à l'écriture et ne change qu'une fois le traitement fini. Le job ne sélectionne que ce statut, dans l'ordre d'arrivée. Un message dont l'objet n'existe pas encore est différé, avec un compteur d'essais, et abandonné au bout de 60 passages |
| Pourquoi conserver le message brut après sa consolidation ? | Parce que la consolidation peut être fausse. Garder l'original permet de corriger la règle et de recalculer. C'est ce qui a servi en J2 : six testaments du broker rejetés depuis J1 ont été retrouvés et rejoués après correction du schéma |
| Dans quel scénario le rejeu devient-il utile ? | Quand notre code était en tort : une règle trop stricte, un champ mal lu, un calcul faux. Pas quand c'est le capteur qui a envoyé n'importe quoi, auquel cas rejouer redonnerait le même rejet |
| Si un nouveau firmware ajoute des champs que le backend ne connaît pas, que se passe-t-il dans MongoDB, et à la consolidation ? | Dans MongoDB, le message est stocké entier, champs inconnus compris, car aucun validateur n'est déclaré. À la consolidation, nos schémas sont des `z.object()` sans `strict`, donc Zod ignore les champs inconnus et les retire : la mesure est acceptée et le champ disparaît sans trace, définitivement perdu après 7 jours de rétention. En revanche si le firmware passe à `schema_version: 2`, tous ses messages sont rejetés en bloc, et restent rejouables une fois le schéma mis à jour |

Décision : documenté, sans changement de code. Le comportement face à un champ inconnu est
acceptable pour ce projet, mais il n'était écrit nulle part et personne dans l'équipe ne
l'avait vérifié. Il l'est maintenant, avec sa conséquence : un champ ajouté par un firmware
est perdu en silence, et seule une montée de `schema_version` se voit.

## 3. Déduplication

| Question | Réponse |
|---|---|
| Si je republie le même `message_id` avec un `observed_at` différent, est-ce un doublon chez vous ? | Non. Deux lignes sont créées, aucun `doublon_ecarte` n'est tracé, et si la seconde date est plus récente elle devient l'état courant affiché |
| Pour vous, qu'est-ce qui définit l'identité d'un événement ? | Une observation faite par un objet donné à un instant donné. Ce n'est pas l'identifiant du message, qui n'est que la façon dont le producteur la nomme |
| Le `message_id` suffit-il ? | Non, pour deux raisons. Il n'est unique que par objet, donc il lui faut le `device_id`. Et le contrat du kit le renouvelle à chaque redémarrage du capteur, donc rien ne garantit son unicité dans le temps |
| Pourquoi votre contrainte d'unicité contient-elle plusieurs champs ? | `device_id` parce que le `message_id` est propre à un objet, et `recorded_at` parce que TimescaleDB impose la colonne de temps dans tout index unique d'une table découpée par période. Le troisième champ est donc d'abord une contrainte technique |
| Votre contrainte traduit-elle réellement votre définition métier d'un doublon ? | Oui, mais par chance plus que par choix, et nous ne l'avions pas vu avant cette question. Elle code « même objet, même identifiant, même instant », alors que notre définition est « même observation ». Les deux coïncident tant que le producteur n'émet jamais deux dates pour un même identifiant. Le kit respecte cette hypothèse, elle n'était écrite nulle part et aucun test ne la vérifiait |
| Que se passe-t-il si un producteur réutilise accidentellement un ancien `message_id` ? | Deux cas. Si la date d'observation diffère, la mesure entre normalement : rien n'est perdu, mais l'idée qu'un identifiant désigne un événement devient fausse sans qu'on le sache. Si la date est identique, la vraie mesure est jetée et tracée comme un doublon, indiscernable d'un vrai. Nous l'avons reproduit : une mesure à 2000 ppm a disparu de cette façon |

Décision : accepté et documenté, sans changement de la contrainte. Elle est correcte pour le
contrat du kit, et la resserrer sur le contenu de la mesure coûterait un calcul d'empreinte à
chaque message pour un cas que le producteur actuel ne produit pas. Le risque est désormais
écrit, ce qui est le point important : une mesure perdue de cette façon est aujourd'hui
invisible. Détail dans `docs/decisions/J3/14-definition-d-un-doublon.md`.

```sh
./docs/preuves/outils/loki.sh '{service_name="backend"} | json | eventType="doublon_ecarte"' 20 1h
```

## 4. Perte pendant une coupure du backend

| Question | Réponse |
|---|---|
| Vous perdez environ 80 % des messages sur une coupure de 30 secondes. Pourquoi est-ce acceptable ? | Cette question nous a fait trouver un bug dans notre code, donc la prémisse a changé. Après correction, la perte est de 35 % et non de 80. Ce qui reste est acceptable parce que l'usage visé est la supervision d'une salle en temps quasi réel : l'état courant est rétabli en quelques secondes, les tranches d'agrégat de 5 minutes restent représentatives, et aucune décision ne se prend sur une mesure isolée. Ce ne le serait pas pour de la facturation ou un journal réglementaire |
| Quelle garantie pensiez-vous obtenir avec QoS 1 ? | Zéro perte. C'était écrit dans notre hypothèse de J3 et dans `docs/J2.md` : session persistante plus QoS 1 égale rien de perdu |
| Quelle garantie avez-vous réellement observée ? | Que le broker retient bien, et que c'était notre code qui jetait. Un abonné témoin resté connecté pendant la coupure a vu passer les 46 messages sans aucun trou : le broker avait tout. Notre backend posait son écouteur de messages après l'abonnement, donc après un aller-retour réseau, alors que le broker envoie sa file dès la connexion acceptée. Tout ce qui arrivait pendant cet intervalle tombait sans que personne n'écoute |
| Comment l'utilisateur sait-il aujourd'hui que l'historique contient un trou ? | Il ne le sait pas. Aucun écran ne le signale, et l'API n'expose rien qui le dise |
| Le système est-il capable de détecter qu'il manque des événements ? | Non. Rien dans le code ne suit les numéros de séquence. Nous l'avons fait à la main, avec un script, après coup. Le système sait seulement qu'une coupure a eu lieu, par les événements `broker_perdu` et `broker_connecte` qui la datent sans la chiffrer |
| Si cette perte devenait inacceptable, quelles solutions pourriez-vous envisager ? | Dans l'ordre de coût croissant : surveiller les numéros de séquence pour au moins détecter et signaler le trou, ce qui ne le comble pas mais le rend visible ; régler la file du broker avec `max_queued_messages` et une expiration de session, ce qui suppose de modifier le kit ; passer en MQTT 5 avec une expiration de session explicite ; faire tamponner les mesures par l'objet et les rejouer à la reconnexion, ce que le contrat du kit ne prévoit pas |
| La correction devrait-elle se situer côté broker, backend ou device ? | Les trois répondent à des choses différentes. Le device est le seul endroit qui peut vraiment garantir qu'aucune mesure n'est perdue, puisqu'il est le seul présent pendant toute la coupure. Le broker décide combien de temps et combien de messages il garde. Le backend ne peut rien pendant son absence, mais il est le seul à pouvoir constater le trou au retour, et c'est la correction la moins chère |

Décision : corrigé pour la partie qui nous incombait, le reste documenté. Le bug de l'écouteur
posé trop tard est corrigé et mesuré. La perte résiduelle, concentrée sur les douze premières
secondes de la coupure, reste inexpliquée : nous avons vérifié que le broker avait bien reçu
ces messages, et une tentative de correction sur l'ordre d'arrêt n'a rien changé. Nous
préférons l'écrire que de proposer une explication non vérifiée, ce que nous avions fait dans
la première version de l'ADR 12.

```sh
./docs/preuves/outils/mesure-coupure.sh 30 1
```

| Mesure, coupure de 30 secondes, 45 messages attendus | Rejoués par le broker | Manquants |
|---|---|---|
| Avant correction | 2 | 43 |
| Après correction | 32 | 16 |

## 5. Healthcheck et état réel du système

| Question | Réponse |
|---|---|
| Votre `/health` renvoie ok si PostgreSQL répond. Si MQTT est indisponible, êtes-vous réellement healthy ? | Non, et c'était le cas le plus trompeur : l'API annonçait `ok` alors que plus aucune mesure n'entrait. `/health` répond maintenant `degraded` et nomme le composant en cause |
| Si MongoDB est indisponible, que se passe-t-il ? | Au démarrage, le processus ne démarre pas du tout. En cours de route, chaque message reçu est perdu un par un, avec une trace `status="perdu"`, et le job de consolidation échoue à chaque passage. Nous l'avons reproduit : 24 messages perdus en 20 secondes pendant que `/health` répondait `ok`. Il répond maintenant `degraded` |
| L'API peut-elle continuer à répondre alors que plus aucune télémétrie n'est ingérée ? | Oui, et c'est voulu : le consommateur MQTT et le serveur HTTP sont indépendants, donc les mesures déjà en base restent consultables. C'est une qualité, à condition que le service le dise, ce qui n'était pas le cas |
| Quelle différence faites-vous entre liveness et readiness ? | La liveness dit si le processus est vivant et s'il faut le redémarrer. La readiness dit s'il est en état de servir des requêtes. Redémarrer ne répare pas un broker absent, donc une chaîne d'ingestion cassée ne doit pas faire échouer la liveness |
| Quels composants doivent participer au calcul de l'état de santé ? | Les trois dont dépend l'ingestion : le broker apporte les messages, MongoDB les conserve, PostgreSQL reçoit le résultat. Ils sont maintenant listés un par un dans la réponse |
| Quels composants peuvent être indisponibles sans empêcher l'API de répondre ? | Le broker et MongoDB. Sans eux, l'API sert encore l'historique et l'état courant, simplement figés. PostgreSQL est le seul indispensable |
| Comment représenteriez-vous un état `degraded` ? | Par un état global, plus le détail par composant. `ok` quand tout fonctionne, `degraded` quand l'API répond mais que l'ingestion est cassée, `down` quand PostgreSQL ne répond plus |
| Quel état un orchestrateur doit-il utiliser pour décider de redémarrer le processus ? | Le code HTTP, et lui seul. 200 tant que le service peut répondre, y compris en `degraded`, et 503 quand PostgreSQL est perdu. Redémarrer sur un broker absent ferait boucler les redémarrages sans rien réparer |
| Quel état présenter à un exploitant pour comprendre que la chaîne est partiellement dégradée ? | Le corps de la réponse, qui nomme le composant fautif, et le tableau de bord Grafana dont la première section répond à « la chaîne fonctionne-t-elle en ce moment » |

Décision : corrigé. `/health` teste maintenant les trois composants, renvoie `ok`, `degraded`
ou `down`, et sépare le code HTTP, lu par un orchestrateur, du détail, lu par un humain. Le
champ `db` est conservé pour ne pas casser les appelants écrits en J1.

```sh
curl -s -w " (HTTP %{http_code})\n" http://localhost:3000/health
docker compose stop mosquitto && sleep 12 && curl -s http://localhost:3000/health
```

```json
{"status":"degraded","db":true,"composants":{"postgres":true,"mongo":true,"broker":false}}
```

## Ce que ces questions ont changé

Deux vrais défauts trouvés et corrigés : l'auto-enregistrement, qui laissait n'importe qui
créer une salle affichée au téléphone, et l'écouteur MQTT posé trop tard, qui vidait la
reprise après coupure. Le second a aussi montré qu'une analyse écrite en J3 était fausse : la
perte était attribuée à une limite de MQTT alors qu'elle venait de notre code.

Deux comportements acceptés après vérification : les champs inconnus ignorés en silence, et la
contrainte de déduplication qui repose sur une hypothèse concernant le producteur.

Un point reste ouvert : la perte résiduelle des premières secondes d'une coupure, dont nous
n'avons pas trouvé la cause.
