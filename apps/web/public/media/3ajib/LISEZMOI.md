# Sons et images du plateau 3ajib Edition

Déposez vos fichiers dans ce dossier, puis déclarez-les dans `medias.json`.
Tout est facultatif : ce qui n'est pas renseigné garde le son ou le décor d'origine.

## Formats

- **Sons** : `.mp3` (le plus simple), `.ogg` ou `.wav`. Courts de préférence (1 à 4 secondes).
- **Images** : `.jpg`, `.png` ou `.webp`. Elles sont recadrées au centre ; évitez les fichiers énormes
  (moins de 500 Ko par image, environ 800 px de large suffisent).
- Noms de fichiers sans espaces ni accents : `casino.mp3`, `prison-1.mp3`, `bowling.jpg`.

## Exemple complet de `medias.json`

```json
{
  "sons": {
    "dice": "des.mp3",
    "jail": ["prison-1.mp3", "prison-2.mp3"],
    "buy": "achat.mp3",
    "bankrupt": "faillite.mp3",
    "cases": {
      "Casino d'Enghien": "casino.mp3",
      "Orly": "avion.mp3"
    }
  },
  "images": {
    "cases": {
      "Taiba": "taiba.jpg",
      "Les 4000": "4000.jpg"
    },
    "chance": { "2": "cavale.jpg", "13": "brouteur.jpg" },
    "communaute": { "9": "anniversaire.jpg" }
  }
}
```

Une liste de fichiers (`["prison-1.mp3", "prison-2.mp3"]`) fait tirer un son au hasard à chaque fois.

## Sons disponibles

| Clé | Quand |
|---|---|
| `dice` | lancer de dés |
| `step` | chaque case parcourue par un pion |
| `coinIn` | on reçoit de l'argent |
| `coinOut` | on paie |
| `buy` | achat d'une propriété (ou enchère gagnée) |
| `card` | on tire une carte |
| `jail` | direction la prison |
| `build` | construction d'une maison ou d'un hôtel |
| `bankrupt` | faillite |
| `yourTurn` | début de tour |
| `trade` | échange proposé ou conclu |
| `error` | action impossible |
| `click` | clic sur un bouton |
| `cases` | son quand un pion **arrive** sur une case précise |

## Repérer une case ou une carte

- **Case** : son nom tel qu'affiché sur le plateau (« Casino d'Enghien », « Les 4000 »…), sans se soucier
  des majuscules ni des accents, ou son numéro (0 = Départ, puis dans l'ordre jusqu'à 39 = Orly).
- **Carte** : son numéro dans le paquet, de 1 à 16, dans l'ordre de la liste des cartes.
