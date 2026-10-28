# Cache hors ligne et fraîcheur affichée

## Problème

J2 demande des données consultables sans réseau, leur ancienneté affichée et un état cohérent à
la reprise. En J1, l'app ne gardait rien et affichait une erreur plein écran.

## Options

- Stockage : persistance de TanStack Query sur AsyncStorage, `expo-sqlite`, ou rien.
- Fraîcheur : reprendre `is_stale` de la réponse, le recalculer sur le téléphone, ou distinguer
  les deux.

## Choix et compromis

Cache TanStack Query sur AsyncStorage, gardé 24 heures. `expo-sqlite` demanderait schéma, requêtes
et migrations pour stocker une réponse, sa clé et sa date.

`is_stale` vient du backend. Le téléphone ne peut pas le recalculer, son horloge diffère
(3 secondes d'écart mesurées entre le Mac et le conteneur). Mais en cache le verdict se fige : une
réponse de dix minutes disait encore « donnée récente », ce que R07 interdit. L'écran a donc trois
états : mesure ancienne, mesure récente, ou réponse trop vieille pour le dire.

Défauts trouvés en essai :
- seules les requêtes réussies allaient sur disque, donc une ouverture sans réseau vidait le
  cache. On écrit maintenant toute requête qui a des données ;
- l'ancienneté restait figée (« il y a 11 s » pendant plus d'une minute). Une horloge locale
  redessine chaque seconde, et les fonctions reçoivent l'heure en paramètre, donc testables ;
- une requête en pause hors ligne n'est pas une erreur (`isError` faux), donc pas de bandeau.
  L'écran lit maintenant `fetchStatus` et `failureCount`.

Sur téléphone, NetInfo et `AppState` remplacent les évènements `online` du navigateur. Coupés sur
le web, où NetInfo nous croit hors ligne alors que le serveur répond.

Coût : quatre dépendances, un cache en clair sur disque, et un rafraîchissement périodique arrêté
hors premier plan, à savoir en recette.

## Aide de l'IA

Elle a proposé `networkMode: 'always'` car « une requête en pause ne reprend jamais ». Annulé, son
observation venait d'un onglet caché. Son écran affichait « chargement » sans fin hors ligne et
sans cache, ce que R06 interdit. Son écran d'historique accusait le job dès qu'il n'y avait aucun
point, même là où la route n'existait pas.

## Vérification

`cd mobile && npm test` : 20 tests sans téléphone ni serveur, dont les trois cas de fraîcheur et
les quatre états du lien avec le serveur.

iPhone en mode Avion, capture `docs/preuves/J2-hors-ligne.png` :

| Situation | Observé |
|---|---|
| Mode Avion activé | « Téléphone hors ligne », mesures et historique toujours affichés |
| La même, 37 secondes après | « Reçues le 16/09 10:39, il y a 37 s », et cette durée avance |
| Ligne Fraîcheur | « Fraîcheur inconnue, données du cache » |
| Serveur coupé au lieu du téléphone | « Serveur injoignable », et le cache survit à un rechargement complet |

## Limite

Reprise après retour du réseau et après l'arrière-plan non testée : couper le réseau du téléphone
coupe aussi son lien avec Expo. Observée en rétablissant le serveur, même code mais sans NetInfo.
Rouvrir l'app sans réseau n'est pas testable non plus, Expo Go recharge le code au lancement.

Cache en clair sur disque, à revoir quand l'app gardera un jeton de session, qui ira dans
`expo-secure-store`.
