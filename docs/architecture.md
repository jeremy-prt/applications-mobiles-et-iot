# Architecture

> À compléter en J1, une fois la stack choisie.

## Vue d'ensemble

```mermaid
flowchart LR
    S["Capteurs simulés (kit)"] -->|MQTT| M["Mosquitto (kit)"]
    M -->|MQTT| B["Backend (nous)"]
    B --> D[("Base de données (nous)")]
    B -->|HTTP| A["Application mobile (nous)"]
    B -->|MQTT commandes| M
```

## Technologies retenues

| Couche | Techno | Justification |
|---|---|---|
| Backend | à définir | |
| Base de données | à définir | |
| Mobile | à définir | |

## Flux des données

À compléter.

## Règles à documenter

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| Seuil de fraîcheur d'une mesure | à définir | |
| Délai maximum d'attente d'une commande | à définir | |
| Règle d'alerte CO2 | à définir | |
