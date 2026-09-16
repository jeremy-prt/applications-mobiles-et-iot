# Recette

Les 13 scénarios obligatoires du sujet. Chacun doit avoir un résultat déclaré, même en cas
d'échec. Statuts possibles : réussi, partiel, échoué.

Les seuils et délais utilisés sont déclarés avant les tests, dans docs/architecture.md.

## Suivi

| Ref | Scénario | Statut | Résultat observé | Preuve |
|---|---|---|---|---|
| R01 | Mesure de bout en bout | réussi | Le même `message_id` et les mêmes valeurs se retrouvent sur le broker, dans la zone brute, dans la base consolidée et dans l'API | Fiche R01 |
| R02 | Message invalide | réussi | Aucune mesure créée, le service répond toujours, et le message fautif est conservé dans la zone brute avec son motif | Fiche R02 |
| R03 | Doublon et retard | réussi | Le doublon est reçu deux fois dans la zone brute, une seule ligne en base. La mesure en retard entre dans l'historique, l'état courant continue d'avancer | Fiche R03 |
| R04 | Capteur silencieux | réussi | `is_stale` passe à vrai entre 25 et 40 secondes, `availability` reste `online` | Fiche R04 |
| R05 | Téléphone hors ligne | réussi | Mode Avion sur iPhone : les valeurs restent, le bandeau dit « Téléphone hors ligne » et les date, la fraîcheur n'est plus affirmée | `docs/preuves/J2-hors-ligne.png` |
| R06 | Reconnexion et cycle de vie | partiel | Le retour du serveur ramène les valeurs en direct, sans chargement infini et sans doublon d'écran. L'arrière-plan reste à exercer sur l'appareil | Fiche R06 |
| R07 | Broker interrompu | réussi | `/health` et `/rooms` répondent pendant la coupure, reconnexion toutes les 2 secondes, ingestion reprise. Le mobile affiche « fraîcheur inconnue » au lieu de « donnée récente » | Fiche R07 |
| R08 | Commande exécutée | à faire | | |
| R09 | Commande sans réponse | à faire | | |
| R10 | Association et permission caméra | à faire | | |
| R11 | Autorisation | à faire | | |
| R12 | Alerte et retour à la normale | à faire | | |
| R13 | Reproductibilité et terminal | à faire | | |

## Détail des scénarios

Les commandes `incident` et `command` se lancent depuis `infra/kit`.

| Ref | Action | Attendu |
|---|---|---|
| R01 | Faire évoluer une mesure simulée | Le même objet et la nouvelle mesure sont identifiables dans les échanges MQTT, dans le backend et sur le mobile. L'unité et la date sont visibles |
| R02 | `incident sensor-001 invalid` | Le traitement reste disponible, la donnée invalide ne devient pas une mesure normale, et une trace explique son rejet |
| R03 | `incident sensor-001 duplicate` puis `incident sensor-001 delay` | Aucun doublon dans l'historique, pas de régression silencieuse du dernier état. La politique appliquée aux mesures tardives est expliquée |
| R04 | `incident sensor-001 pause` | La mesure devient ancienne selon la règle déclarée. L'application ne prétend pas que le téléphone a perdu son réseau. La dernière valeur reste identifiable comme ancienne |
| R05 | Couper le réseau du téléphone après une consultation réussie | Le cache est consultable, les dates sont visibles, l'état hors ligne est explicite. Une tentative de commande est bloquée avec une explication et n'est pas rejouée automatiquement au retour du réseau |
| R06 | Rétablir le réseau, passer l'application en arrière-plan, la reprendre | Retour à des données cohérentes, pas d'abonnements ni de mises à jour dupliqués, pas de chargement infini. Expliquer aussi la restauration après fermeture complète |
| R07 | `docker compose stop mosquitto` puis `docker compose up -d --wait mosquitto` | Le backend reste diagnosticable et se reconnecte. Le mobile ne présente pas les anciennes mesures comme fraîches. Les pertes éventuelles sont identifiées |
| R08 | Demander l'activation de la ventilation quand l'objet est disponible | Suivi de l'attente puis d'un retour confirmé. Le CO2 simulé baisse. Un accusé de transport seul ne vaut pas preuve |
| R09 | `incident sensor-001 no-response` puis commander | Un délai borné conduit à un échec ou à un résultat inconnu. Le mobile n'affiche jamais « activé » sans confirmation. Le comportement en cas de réponse tardive est documenté |
| R10 | Scanner un code valide, un code invalide, puis refuser la permission caméra | Association correcte dans le premier cas, messages utiles et reprise possible dans les autres, sans blocage de l'application |
| R11 | Tenter une commande avec un utilisateur sans droit, y compris directement sur l'API | Refus côté backend. Masquer le bouton dans l'application ne suffit pas |
| R12 | `incident sensor-001 high-co2` puis `incident sensor-001 normal-co2` | Alerte identifiable, pas de création répétée à chaque mesure, retour à la normale selon la règle documentée |
| R13 | Relancer le projet en suivant uniquement le README, sur le terminal prévu | Configuration compréhensible, état persistant conforme à la documentation, parcours principal démontrable, adresse du backend adaptée au terminal |

## Observation complémentaire

Augmenter le nombre d'objets ou leur fréquence dans `infra/kit/devices.json`, puis relever
le contexte, le volume, le temps de réponse observé et les limites. Aucun chiffre de
performance n'est imposé, l'objectif est de mesurer et d'expliquer.

## Fiches de preuve

### R01, mesure de bout en bout

- Scénario et responsable : R01, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : trois capteurs en ligne, publication toutes les 2 secondes
- Action effectuée : lecture d'un message sur le broker, puis recherche de son `message_id` à chaque étape

```sh
docker compose --profile tools run --rm tools watch \
  --topic "campus/v1/devices/sensor-001/telemetry" --count 1
```

- Résultat attendu : le même objet et la même mesure sont identifiables à chaque étape, avec leur unité et leur date
- Résultat observé et preuve : `message_id` `035be0d8e8664437a94696954a1475e9-44`

| Étape | Ce qu'on lit |
|---|---|
| Broker | `observed_at` 09:04:29.466, CO2 1178 ppm |
| Zone brute MongoDB | `statut` traité, reçu à 09:04:29.475, CO2 1178 |
| Base consolidée | `recorded_at` 09:04:29.466, CO2 1178, température 21,64 |
| API `GET /rooms` | `sensor-001`, CO2 en ppm, `recorded_at` daté, `is_stale` faux |

Neuf millisecondes entre l'observation et la réception. La mesure visible dans l'API est plus récente que celle qu'on trace, c'est normal : le capteur publie toutes les 2 secondes et l'API rend toujours la dernière.

- Conclusion : réussi
- Correction ou limite identifiée : aucune

### R02, message invalide

- Scénario et responsable : R02, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt
- Conditions initiales et paramètres : `sensor-001` en ligne, 6574 mesures en base pour cet objet
- Action effectuée : `docker compose --profile tools run --rm tools incident sensor-001 invalid`
- Résultat attendu : le service reste disponible, la donnée invalide ne devient pas une mesure, une trace explique le rejet
- Résultat observé et preuve : `/health` répond toujours `{"status":"ok","db":true}`. Les 5 mesures ajoutées pendant les 12 secondes d'observation sont les mesures normales du capteur, pas l'invalide.

La trace du backend nomme le champ fautif :

```
{"topic":"campus/v1/devices/sensor-001/telemetry",
 "issues":[{"expected":"number","code":"invalid_type","path":["co2","value"],
            "message":"Invalid input: expected number, received string"}],
 "msg":"mesure rejetée"}
```

Le message est en plus conservé dans la zone brute avec `statut: "rejete"`, `motif: "mesure non conforme au contrat"` et son contenu d'origine, `co2.value` valant la chaîne `invalide`. En J1 il disparaissait après la trace.

- Conclusion : réussi
- Correction ou limite identifiée : la validation a changé de place avec la nouvelle architecture. Elle était dans le consommateur MQTT, elle est maintenant dans le job de consolidation, ce qui laisse le message entrer dans la zone brute avant d'être refusé. C'est voulu : rien n'est perdu à l'ingestion

### R03, doublon et retard

- Scénario et responsable : R03, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : trois capteurs en ligne, publication toutes les 2 secondes, seuil de fraîcheur 30 secondes, job de consolidation toutes les 5 secondes
- Action effectuée :

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 delay
```

- Résultat attendu : aucun doublon métier dans l'historique, et le dernier état ne recule pas
- Résultat observé et preuve :

```sh
docker compose exec mongo mongosh campus_brut --quiet --eval '
  db.messages.aggregate([{$match:{genre:"telemetry"}},
    {$group:{_id:"$payload.message_id",recus:{$sum:1},motifs:{$addToSet:"$motif"}}},
    {$match:{recus:{$gt:1}}}]).toArray()'
# [{ _id: "30ce989...-420", recus: 2, motifs: ["doublon écarté"] }]

docker compose exec postgres psql -U campus -d campus -tAc \
  "select count(*) from (select device_id, message_id from telemetry
   group by device_id, message_id having count(*)>1) x"
# 0
```

Le message est bien arrivé deux fois, et une seule ligne existe en base. La zone brute permet de le montrer, ce qui n'était pas possible en J1 où le doublon disparaissait sans trace.

Mesure en retard : état courant à 07:52:43 avant l'incident, 07:52:53 après, donc il a avancé. La mesure injectée est dans l'historique avec `recorded_at` 07:51:46 et `received_at` 07:52:49, soit 63 secondes d'écart.

- Conclusion : réussi
- Correction ou limite identifiée : une mesure en retard est acceptée dans l'historique sans limite d'ancienneté. Au-delà de 7 jours elle serait supprimée par la rétention, et son `message_id` ne protégerait plus d'un nouveau doublon

### R04, capteur silencieux

- Scénario et responsable : R04, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt
- Conditions initiales et paramètres : `sensor-001` en ligne et mesurant, seuil de fraîcheur 30 secondes
- Action effectuée : `docker compose --profile tools run --rm tools incident sensor-001 pause`
- Résultat attendu : la mesure devient ancienne au-delà du seuil, la disponibilité reste `online`
- Résultat observé et preuve :

| Temps écoulé | `is_stale` | `availability` |
|---|---|---|
| 10 s | faux | `online` |
| 25 s | faux | `online` |
| 40 s | vrai | `online` |

La bascule a lieu entre 25 et 40 secondes, ce qui encadre le seuil déclaré de 30. La disponibilité ne change pas : le capteur répond toujours au broker, il ne mesure plus. L'application affiche « Donnée ancienne » à côté de la valeur et ne parle pas du réseau du téléphone.

- Conclusion : réussi
- Correction ou limite identifiée : aucune

### R05, téléphone hors ligne

- Scénario et responsable : R05, Jérémy Perret et Kylian Patry
- Version du projet et environnement : J2, iPhone sous Expo Go, backend et kit sur le Mac, les deux sur le même réseau
- Conditions initiales et paramètres : consultation réussie préalable sur le détail de `sensor-001`, cache de 24 heures, seuil de fraîcheur 30 secondes
- Action effectuée : activation du mode Avion sur le téléphone après une consultation réussie
- Résultat attendu : le cache reste consultable, les dates sont visibles, l'état est explicite
- Résultat observé et preuve : `docs/preuves/J2-hors-ligne.png`, prise à 10:40 avec le mode Avion visible dans la barre d'état.

| Ce que l'écran affiche | Pourquoi ça compte |
|---|---|
| « Téléphone hors ligne. Données conservées, elles ne décrivent plus la salle en direct. » | Nomme le téléphone, et non le capteur ni le serveur |
| « Reçues le 16/09 10:39, il y a 37 s. » | La réponse est datée, et cette durée avance seule |
| « Dernière mesure : il y a 44 s » | L'ancienneté de la mesure est distincte de celle de la réponse |
| « Fraîcheur inconnue, données du cache » | L'écran cesse d'affirmer « Donnée récente », qui serait faux |
| Température, CO2 et les dix tranches d'historique toujours affichés | Le cache est consultable, R05 est servi |

La même séquence a d'abord été exercée en coupant le serveur au lieu du téléphone. Le bandeau disait alors « Serveur injoignable », et le cache survivait à un rechargement complet de l'application.

- Conclusion : réussi
- Correction ou limite identifiée : deux défauts ont été trouvés et corrigés pendant ce scénario. Le cache était effacé dès qu'un appel échouait, parce que seule une requête en succès est écrite sur le disque par défaut. Et l'ancienneté affichée se figeait, faute d'horloge qui redessine l'écran. Non couvert : fermer complètement l'application puis la rouvrir sans réseau. Expo Go recharge le code depuis le serveur de développement au lancement, donc l'application ne peut pas démarrer sans réseau tant qu'on ne produit pas un build autonome. La persistance elle-même a été vérifiée autrement, par un rechargement complet serveur éteint. Le blocage d'une commande hors ligne reste à faire, les commandes ne sont pas encore implémentées

### R06, reconnexion et cycle de vie

- Scénario et responsable : R06, Jérémy Perret
- Version du projet et environnement : J2, application servie par Expo sur le navigateur
- Conditions initiales et paramètres : application affichant le cache avec le bandeau « serveur injoignable »
- Action effectuée : remise en marche du serveur, sans toucher à l'application
- Résultat attendu : retour à des données cohérentes, pas de chargement infini, pas de doublon
- Résultat observé et preuve : le bandeau disparaît et les valeurs repassent en direct. Aucun écran de chargement infini : l'état hors ligne sans cache affiche un message et un bouton Réessayer
- Conclusion : partiel, la reprise a été observée en coupant le serveur, pas le réseau du téléphone
- Correction ou limite identifiée : le passage en arrière-plan et le retour au premier plan passent par `AppState`, qui n'existe pas dans un navigateur. Ils restent à exercer sur l'iPhone. Un défaut a été trouvé pendant ce scénario : hors ligne sans rien en cache, l'écran affichait un chargement qui ne se terminait jamais, parce qu'une requête mise en pause ne se termine pas. Corrigé par un état hors ligne distinct

### R07, broker interrompu

- Scénario et responsable : R07, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt
- Conditions initiales et paramètres : chaîne complète en marche, 16 487 mesures en base
- Action effectuée :

```sh
docker compose stop mosquitto
docker compose up -d --wait mosquitto
```

- Résultat attendu : le backend reste diagnosticable et se reconnecte, le mobile ne présente pas les anciennes mesures comme fraîches
- Résultat observé et preuve : pendant la coupure, `/health` répond `{"status":"ok","db":true}` et `/rooms` répond 200. Les traces montrent « reconnexion au broker » toutes les 2 secondes. Après la remise en marche, l'ingestion reprend : 15 mesures dans les 10 secondes suivantes, soit le rythme nominal des trois capteurs
- Conclusion : réussi
- Correction ou limite identifiée : le simulateur suspend ses mesures pendant la coupure du broker, donc rien n'est perdu. Ce n'est pas une garantie de notre backend, c'est un comportement du kit et il ne faut pas l'annoncer comme une reprise de messages manqués. Ce qui protège de notre côté, c'est la session persistante `clean: false`, qui n'a pas été mise à l'épreuve ici puisqu'il n'y avait rien à rejouer

### Fiche vierge

À recopier pour chaque scénario exécuté.

- Scénario et responsable :
- Version du projet et environnement :
- Conditions initiales et paramètres :
- Action effectuée :
- Résultat attendu :
- Résultat observé et preuve :
- Conclusion : réussi, partiel ou échoué
- Correction ou limite identifiée :
