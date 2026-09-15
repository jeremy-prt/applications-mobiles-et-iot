# Contexte du projet Campus connecté

## En une phrase

Le responsable d'un campus veut consulter la température et le CO2 des salles depuis son
téléphone, et commander la ventilation. Il doit pouvoir distinguer une situation normale,
une donnée ancienne et un équipement qui ne répond plus.

## Cadre

| Point | Valeur |
|---|---|
| Durée | 5 jours : J1 à J4 de dev, J5 démonstration et soutenance |
| Équipe | Groupe de 2 |
| Environnement | 100 % local, Docker Compose |
| Techno backend | Libre, à justifier |
| Techno mobile | Libre, à justifier |
| Sujet | https://sand-metacarpal-859.notion.site/M2-Applications-mobiles-IoT-Projet-Campus-connect-3d4a4f0ae4ab817f91bade97288ed3a9 |

## Ce qui est fourni (le kit)

Dépôt d'origine : https://github.com/LargeGaultier/MdsIoTMobile. Il est intégré ici dans `infra/kit`.

- Un broker MQTT **Mosquitto**.
- Trois objets simulés `sensor-001` à `sensor-003`, salles 203 à 205.
- Mesures température (°C) et CO2 (ppm), toutes les 2 secondes.
- Une ventilation simulée qui fait baisser le CO2 quand elle est active.
- Un contrat MQTT documenté (`kit/docs/contrat-mqtt.md`).
- Des incidents déclenchables à la demande (doublon, retard, message invalide, capteur muet,
  commande sans réponse, CO2 haut...).
- Des outils de diagnostic en ligne de commande.

Le simulateur est en Python. Cela n'impose rien pour notre backend.

## Ce qu'on doit construire

```
[Objets simulés] --MQTT--> [Mosquitto] --MQTT--> [NOTRE BACKEND] <--> [NOTRE STOCKAGE]
                                                        |
                                                       API
                                                        |
                                                 [NOTRE MOBILE]
```

### Backend
- Consommer les messages MQTT et valider leur contenu.
- Identifier les objets, les associer aux salles.
- Stocker les mesures : dernier état + historique borné.
- Gérer doublons et mesures en retard selon une règle écrite.
- Distinguer « dernière mesure connue », sa fraîcheur, et la disponibilité de l'objet.
- Exposer une API pour le mobile.
- Envoyer les commandes et suivre leur résultat, y compris quand il n'y a pas de réponse.
- Gérer une règle d'alerte, les droits, et produire des traces.

### Mobile
- Navigation : liste des salles > équipements > détail d'un objet.
- Afficher mesure, unité, date, historique.
- États explicites : chargement, vide, erreur, données anciennes.
- Cache local pour consultation hors ligne.
- Reprise correcte après coupure réseau ou passage en arrière-plan.
- Scan QR pour associer un objet, avec gestion du refus de la permission caméra.
- Commander la ventilation avec retour : en attente / confirmé / échec.
- Session utilisateur et protection des identifiants.

## Contrat MQTT (l'essentiel)

MQTT 3.1.1, TCP, port 1883. JSON UTF-8, dates ISO 8601 UTC.

| Topic | Qui publie | Retained |
|---|---|---|
| `campus/v1/devices/{id}/telemetry` | Objet | Non |
| `campus/v1/devices/{id}/state` | Objet | Oui |
| `campus/v1/devices/{id}/availability` | Objet / broker (Will) | Oui |
| `campus/v1/devices/{id}/commands` | Notre backend | Non |
| `campus/v1/devices/{id}/results` | Objet | Non |

Exemple de mesure :

```json
{
  "schema_version": 1,
  "message_id": "a6ca5d400a2d468299792b252a0ed0dc-4",
  "device_id": "sensor-001",
  "room_id": "salle-203",
  "observed_at": "2026-09-15T07:51:24.994Z",
  "temperature": {"value": 22.11, "unit": "°C"},
  "co2": {"value": 700, "unit": "ppm"}
}
```

Compte MQTT pour notre backend : `backend` / `backend-demo`.
Hôte : `localhost:1883` si le backend tourne sur la machine, `mosquitto:1883` s'il est
ajouté dans le Compose du kit.

## Règles de travail imposées

- **Un seul monorepo GitHub** pour l'équipe, source de vérité.
- Structure attendue : `backend/`, `mobile/`, `infra/`, `docs/`, `README.md`.
- `docs/` contient `architecture.md`, `decisions/`, et un `J1.md` à `J4.md`.
- Chaque fin de journée : push + **tag Git** `J1`, `J2`, `J3`, `J4`.
- Chaque `Jx.md` finit par 4 rubriques : Fonctionne / Incomplet ou en échec / Limites connues /
  Prochaine priorité. Plus la trace des contributions de chacun.
- **Une fonctionnalité sans preuve reproductible n'est pas démontrée.**
  Ordre de préférence : test automatisé > commande reproductible + traces > capture d'écran.
- Le README racine doit permettre à quelqu'un d'extérieur de lancer le projet sans explication orale.

## Les 4 journées

| Jour | Objectif |
|---|---|
| J1 | Du capteur au téléphone : une mesure traverse toute la chaîne et s'affiche |
| J2 | Des données fiables : doublons, retards, fraîcheur, cache, hors ligne, reprise |
| J3 | Associer et agir : scan QR, droits, commandes et suivi du résultat |
| J4 | Produit exploitable : alertes, plusieurs salles, volume, lisibilité, traces |
| J5 | Démonstration, incidents contrôlés, diagnostic, questions individuelles |

## Recette (13 scénarios à préparer)

R01 mesure bout en bout, R02 message invalide, R03 doublon et retard, R04 capteur silencieux,
R05 téléphone hors ligne, R06 reconnexion et cycle de vie, R07 broker interrompu,
R08 commande exécutée, R09 commande sans réponse, R10 association et permission,
R11 autorisation, R12 alerte et retour à la normale, R13 reproductibilité.

Détail dans la page « 03 Recette et preuves de fonctionnement » du sujet.

## Points d'attention

- Chacun des deux doit savoir expliquer **le backend ET le mobile**. Revue croisée quotidienne.
- Une commande acceptée n'est pas une action réalisée. Ne jamais afficher « activé » sans confirmation.
- Masquer un bouton dans l'app n'est pas un contrôle d'accès : la vérification est côté backend.
- Hors ligne : la consultation est obligatoire, les commandes sont bloquées avec explication
  et ne doivent pas être rejouées silencieusement.
- `localhost` sur le téléphone désigne le téléphone, pas notre ordinateur.
