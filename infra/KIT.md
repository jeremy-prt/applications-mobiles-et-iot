# Kit fourni par l'école

`kit/` contient le kit de l'école, tel quel et jamais modifié. Le `compose.yaml` racine inclut
celui du kit et ajoute notre backend et notre base.

| | |
|---|---|
| Dépôt d'origine | https://github.com/LargeGaultier/MdsIoTMobile |
| Commit utilisé | `852f1b1` |
| Date d'intégration | 15 septembre 2026 |

## Paramètres du kit

Valeurs par défaut, sauf celles listées ici.

| Paramètre | Valeur | Remarque |
|---|---|---|
| `PUBLISH_INTERVAL` | 2 secondes | Défaut du kit |
| `devices.json` | 3 objets, salles 203 à 205 | Config initiale, non modifiée |
| `MQTT_PORT` | 1883 | Défaut |

Changer un de ces paramètres pour un test se note dans le journal du jour, car ça change le
comportement observé.
