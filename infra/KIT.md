# Kit fourni par l'école

Le dossier `kit/` contient le kit livré par l'école, intégré tel quel. Nous ne le
modifions pas : notre backend et notre base sont ajoutés par le `compose.yaml` à la racine
du dépôt, qui inclut celui du kit.

| | |
|---|---|
| Dépôt d'origine | https://github.com/LargeGaultier/MdsIoTMobile |
| Commit utilisé | `852f1b1` |
| Date d'intégration | 15 septembre 2026 |

## Paramètres du kit

Les valeurs par défaut sont conservées, à l'exception de celles listées ici.

| Paramètre | Valeur | Remarque |
|---|---|---|
| `PUBLISH_INTERVAL` | 2 secondes | Valeur par défaut du kit |
| `devices.json` | 3 objets, salles 203 à 205 | Configuration initiale du kit, non modifiée |
| `MQTT_PORT` | 1883 | Valeur par défaut |

Toute modification de ces paramètres pour un test doit être notée dans le journal de la
journée concernée, parce qu'elle change le comportement observé.
