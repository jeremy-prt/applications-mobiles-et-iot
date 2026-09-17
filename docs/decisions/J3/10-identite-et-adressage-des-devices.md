# ADR 10 — Identité et adressage des devices

## Contexte

Plusieurs capteurs publient simultanément. Une mesure attribuée au mauvais objet
fausserait son état courant, son historique et la salle affichée sur le mobile.
Le compte MQTT du simulateur étant partagé, son authentification ne suffit pas à
prouver l'identité individuelle d'un capteur.

## Décision

Le `device_id` de `devices.json` est l'identité stable. Il est placé dans le
topic MQTT et dans le corps du message. Le backend considère le topic comme la
source de routage et exige l'égalité avec le corps avant tout traitement métier.
Il conserve l'identité dans toutes les clés de stockage, les réponses API et les
logs. Le `message_id` identifie une observation et devient l'`eventId` de
corrélation dans les traces.

## Alternatives envisagées

- Utiliser seulement le champ du corps : rejeté, car un producteur pourrait
  écrire dans l'état d'un autre device.
- Utiliser seulement le topic : rejeté, car une incohérence du producteur
  passerait silencieusement.
- Créer un compte et un certificat MQTT par device : meilleure isolation en
  production, mais hors du contrat du kit pédagogique qui fournit un compte
  simulateur partagé.

## Conséquences

Les flux restent séparés du broker jusqu'à l'API et sont vérifiables dans Loki.
Une incohérence est conservée dans la zone brute, rejetée avant PostgreSQL et
tracée avec `reason=device_identity_mismatch`. Cette mitigation détecte une
usurpation, mais ne remplace pas une authentification MQTT propre à chaque objet.
