# Recette

Les 13 scénarios obligatoires du sujet. Chacun doit avoir un résultat déclaré, même en cas
d'échec. Statuts possibles : réussi, partiel, échoué.

Les seuils et délais utilisés sont déclarés avant les tests, dans docs/architecture.md.

## Suivi

| Ref | Scénario | Statut | Résultat observé | Preuve |
|---|---|---|---|---|
| R01 | Mesure de bout en bout | à faire | | |
| R02 | Message invalide | à faire | | |
| R03 | Doublon et retard | à faire | | |
| R04 | Capteur silencieux | à faire | | |
| R05 | Téléphone hors ligne | à faire | | |
| R06 | Reconnexion et cycle de vie | à faire | | |
| R07 | Broker interrompu | à faire | | |
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

## Fiche de preuve

À recopier pour chaque scénario exécuté.

- Scénario et responsable :
- Version du projet et environnement :
- Conditions initiales et paramètres :
- Action effectuée :
- Résultat attendu :
- Résultat observé et preuve :
- Conclusion : réussi, partiel ou échoué
- Correction ou limite identifiée :
