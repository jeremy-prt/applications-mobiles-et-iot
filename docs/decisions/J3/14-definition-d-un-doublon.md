# Définition d'un doublon

## Problème

L'unicité en base porte sur `(device_id, message_id, recorded_at)`. Est-ce notre définition
d'un doublon, ou juste TimescaleDB qui exige la colonne de temps dans l'index unique ? Le même
`message_id` avec une autre date crée une deuxième ligne. Avec la même date, la mesure est
jetée même si son contenu diffère.

## Options

- Garder la contrainte et écrire l'hypothèse qu'elle fait sur le producteur.
- Unicité sur `(device_id, message_id)`, refusée par TimescaleDB sur une hypertable.
- Une empreinte des valeurs mesurées.

## Choix et compromis

On garde la contrainte et on écrit l'hypothèse : un producteur n'envoie jamais deux dates sous
le même `message_id`. Le kit la respecte, son `message_id` étant un identifiant de démarrage
plus un compteur. Tant qu'elle tient, la contrainte colle à notre définition : la même
observation d'un objet au même instant.

L'empreinte coûte un calcul par message, et confondrait deux vraies mesures identiques à la
même seconde.

Coût : une mesure perdue par réutilisation d'identifiant ressemble à un vrai doublon dans les
traces.

## Aide de l'IA

L'IA avait validé la contrainte avec le scénario 4 de J3, qui rejoue un message identique et ne
pouvait pas voir le problème. Un test manuel a montré deux lignes pour un même `message_id`.
Elle proposait aussi l'unicité sur deux colonnes, refusée par TimescaleDB, ce que dit le
CLAUDE.md depuis J1.

## Vérification

Même `message_id`, dates différentes : deux lignes, deux traces `mesure_enregistree`, aucun
`doublon_ecarte`.

```sh
docker compose exec -T postgres psql -U campus -d campus -c \
  "select message_id, recorded_at, temperature_c from telemetry where message_id='dedup-test-1'"
```

Cas inverse : une mesure à 2000 ppm sous un `message_id` déjà utilisé à la même date est jetée
et tracée `doublon_ecarte`.

## Limite

Rien ne vérifie l'hypothèse. Si le kit changeait ses identifiants, aucun test ne le verrait, et
les pertes seraient comptées comme doublons dans le tableau de bord.

Ce qui ferait changer d'avis : un producteur dont on ne maîtrise pas la numérotation. Il
faudrait comparer le contenu, malgré le coût.
