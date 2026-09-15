# Préparation de la soutenance

## Trame de la journée

1. Présenter la mission et l'architecture
2. Montrer une mesure de bout en bout et une commande suivie
3. Démontrer une perturbation IoT et une perturbation mobile
4. Expliquer une décision, et une correction apportée à une proposition de l'IA
5. Répondre aux questions individuelles

Aucun support de présentation long n'est demandé.

## Questions individuelles

Chacun répond seul à une question IoT et une question mobile. On prépare donc au moins un
exemple de chaque, par personne.

### Jérémy Perret

| | À préparer |
|---|---|
| Exemple IoT | |
| Exemple mobile | |
| Correction apportée à l'IA | |

### Kylian Patry

| | À préparer |
|---|---|
| Exemple IoT | |
| Exemple mobile | |
| Correction apportée à l'IA | |

## Les perturbations à démontrer

| Type | Incident | Ce qu'on montre |
|---|---|---|
| IoT | `incident sensor-001 pause` | La mesure devient ancienne alors que l'objet reste en ligne |
| Mobile | Couper le Wi-Fi du téléphone | Le cache reste consultable, avec sa date, et la commande est bloquée avec une explication |

## Avant de rendre

- Le système démarre en suivant uniquement le README
- Le backend et le mobile utilisent les contrats documentés
- Les 13 scénarios ont un résultat déclaré, même en cas d'échec
- Les limites et défauts connus sont visibles
- Chacun sait expliquer les deux axes
- Aucun secret réel dans le dépôt
