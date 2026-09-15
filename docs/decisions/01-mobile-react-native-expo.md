# Choix de la techno mobile : React Native avec Expo

## Contexte

L'application doit faire quatre choses qui touchent au matériel et au système, et qui sont
toutes des points notés du sujet : scanner un QR code avec la caméra et gérer un refus de
permission, garder un cache consultable hors ligne, détecter la perte et le retour du
réseau, et reprendre correctement après un passage en arrière-plan.

Le test se fera sur un iPhone réel. On a quatre jours.

## Options envisagées

React Native avec Expo, Flutter, natif Swift.

## Choix retenu

React Native avec Expo, testé sur iPhone via Expo Go.

## Pourquoi

Les quatre besoins matériels ci-dessus correspondent chacun à un module fourni par le SDK
Expo : la caméra et le scan de codes, l'état du réseau, le stockage local et l'état de
l'application. On ne passe pas de temps à brancher du natif, on passe le temps sur ce qui
est évalué, c'est à dire le comportement de l'interface face aux incidents.

Expo Go permet de lancer l'application sur un iPhone réel sans build natif et sans compte
développeur Apple payant. En natif Swift il faudrait Xcode, un provisioning profile et un
compte à 99 dollars par an pour installer sur un téléphone physique. Sur quatre jours,
cette seule contrainte suffit à écarter le natif.

Le rechargement à chaud change la façon de travailler sur les états d'interface. On doit
démontrer chargement, vide, erreur et données anciennes, ce qui veut dire les provoquer et
les regarder des dizaines de fois. Attendre une compilation à chaque essai coûterait des
heures sur la semaine.

Le sujet précise que la comparaison entre plateformes fait partie de l'analyse, mais que
produire deux versions distribuées n'est pas exigé. React Native nous laisse un seul code
et la possibilité de parler de ce qui diffère entre iOS et Android sans avoir à tout écrire
deux fois.

Le cours fournit un support React Native, donc c'est la techno sur laquelle on peut
s'appuyer et poser des questions si on bloque.

Flutter couvre les mêmes besoins et gère très bien les états d'interface. Il faudrait
apprendre Dart et son modèle de widgets pendant les jours qui doivent servir au projet
lui-même, et sans support de cours pour nous rattraper.

## Ce que ça coûte

Expo Go n'accepte que les modules du SDK. Si on avait besoin d'une bibliothèque native
absente, il faudrait passer par un build de développement, ce qui ramènerait Xcode dans
l'équation. Tout ce que demande le sujet est couvert par le SDK, donc on ne devrait pas y
arriver.

## Conséquence

L'iPhone et le Mac doivent être sur le même réseau Wi-Fi. L'application doit viser
l'adresse IP locale du Mac et pas `localhost`, qui sur le téléphone désigne le téléphone.
Cette adresse sera une variable de configuration, pas une valeur écrite en dur.
