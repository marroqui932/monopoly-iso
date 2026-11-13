# Monopoly Iso

Un Monopoly entre potes, en 3D low-poly et vue isométrique, jouable dans le navigateur.

- **Hébergement** : GitHub Pages (site 100 % statique).
- **Multijoueur** : le navigateur de la personne qui crée la partie fait office de serveur ; les autres s'y connectent en pair-à-pair (WebRTC). Connexion par simple pseudo + code de salon.
- **Règles** : celles du Monopoly classique, édition française (euros, 200 € à la case Départ).

## Structure

```
packages/engine   Moteur de règles (TypeScript pur, aucune dépendance) + tests
apps/web          Le jeu dans le navigateur (Vite + React + React Three Fiber)
```

## Avancement

- [x] **Étape 1 : moteur de règles complet**, testé
- [x] **Étape 2 : plateau 3D isométrique** (pions, maisons, hôtels, dés animés)
- [x] **Étape 3 : partie locale jouable** sur un seul écran, sauvegarde automatique
- [x] **Étape 4 : multijoueur en ligne** (hôte dans le navigateur, code de salon, reconnexion automatique)
- [ ] Étape 5 : interface complète (enchères, constructions, hypothèques, échanges)
- [x] **Étape 6 : sons**, notifications au centre, pions du joueur actif mis en valeur
- [ ] Étape 7 : sauvegarde / reprise, modes de fin de partie
- [ ] Étape 8 : mise en ligne sur GitHub Pages
- [x] Plateau perso « 3ajib Edition » (cartes perso à venir)
- [ ] Peaufinage visuel, version téléphone

## Le moteur (`packages/engine`)

Le moteur est une fonction pure :

```ts
import { createGame, applyAction, parisTheme } from "@monopoly/engine";

let state = createGame(parisTheme, joueurs, { maxRounds: 30 });
const { state: next, events } = applyAction(state, "id-joueur", { type: "roll" });
```

- `state` est un simple objet JSON : facile à envoyer sur le réseau et à sauvegarder.
- `events` liste ce qui s'est passé (dés, déplacements, paiements…) pour piloter les animations et les sons.
- Une action interdite lève une `GameError` avec un message en français, prêt à afficher.
- Le hasard (dés, mélange des cartes) vient d'un générateur à graine stocké dans l'état : une partie sauvegardée reprend à l'identique.

### Règles implémentées

- Déplacements, salaire de 200 € au passage de la case Départ, doubles (on rejoue), 3 doubles = prison
- Achat ; si le joueur refuse, **enchère** ouverte à tous
- Loyers : terrains (doublés avec le groupe complet), maisons, hôtels, gares (25/50/100/200), compagnies (4× ou 10× les dés)
- Constructions **uniformes**, hôtel après 4 maisons, **pénurie** de maisons (32) et d'hôtels (12), revente à moitié prix
- **Hypothèques** (moitié du prix), levée à +10 %
- **Prison** : amende de 50 €, carte « Libéré de prison », double pour sortir (sans rejouer), sortie forcée après 3 échecs
- 32 cartes Chance et Caisse de communauté de l'édition française, dont « Payez 10 € ou tirez une carte Chance »
- **Échanges** (argent, propriétés, cartes prison) proposés pendant son tour (ou pour payer une dette) ; propriétés hypothéquées reçues : lever l'hypothèque ou payer 10 %
- **Dettes** : si un joueur ne peut pas payer, il vend, hypothèque ou échange avant de régler, ou déclare faillite
- **Faillite** envers un joueur (il récupère tout) ou envers la banque (propriétés remises aux enchères)
- Ordre de jeu tiré aux dés en début de partie (les égalités relancent)
- Fins de partie : dernier survivant, nombre de tours ou limite de temps (le plus gros patrimoine gagne)
- Options maison : cagnotte du Parc gratuit, propriétés d'un joueur en faillite toujours remises aux enchères

Écart connu : un hôtel ne peut être revendu que si la banque a 4 maisons pour le remplacer.

### Créer votre thème entre potes

Le plateau « 3ajib Edition » est dans `packages/engine/src/themes/3ajib.ts` (choisi par défaut). Pour un autre plateau, copiez `paris.ts`, ajoutez-le dans `themes/index.ts`, puis changez les noms des cases, les couleurs, les textes et effets des cartes, et la monnaie. Les prix et loyers peuvent aussi être modifiés.

## Jouer en local

```bash
pnpm install
pnpm --filter @monopoly/web dev   # puis ouvrir http://localhost:5173
```

## Mise en ligne

Chaque push sur `main` lance les tests, construit le jeu et le publie sur GitHub Pages
(`.github/workflows/pages.yml`). Réglage à faire une seule fois sur GitHub :
**Settings → Pages → Build and deployment → Source : GitHub Actions**.
Le jeu est alors disponible sur https://marroqui932.github.io/monopoly-iso/

## Jouer en ligne

1. Un joueur clique sur **Créer une salle** et envoie le lien (ou le code à 5 lettres) aux autres.
2. Les autres ouvrent le lien, choisissent un pseudo et cliquent sur **Rejoindre**.
3. L'hôte règle la fin de partie et lance.

L'onglet de l'hôte fait tourner la partie : s'il le ferme, la partie se met en pause ; il peut la
rouvrir depuis l'accueil (**Rouvrir la salle**) et les autres se reconnectent tout seuls. Un invité qui
recharge sa page revient directement dans la partie. L'hôte peut faire abandonner un joueur parti
pour de bon, ou passer pour lui pendant une enchère.

La mise en relation passe par le serveur public gratuit de PeerJS ; les échanges de jeu se font ensuite
directement entre navigateurs (WebRTC).

Le bouton ⚙️ permet de choisir la vue (3D isométrique ou de dessus), les décors, les ombres et les effets de lumière. Paramètres d'adresse utiles : `?lite` (sans ombres par défaut), `?sans3d` (aucun rendu 3D,
pour les tests automatiques), `?peer=hote:port` (serveur de signalisation PeerJS local).

## Développement

```bash
pnpm install
pnpm test        # tests du moteur, dont des centaines de parties simulées
pnpm typecheck
```

`SIM_GAMES=600 pnpm --filter @monopoly/engine test` lance une simulation plus longue.
