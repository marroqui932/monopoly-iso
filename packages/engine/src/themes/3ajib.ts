import type { BoardTheme, Card, CardEffect, Square } from "../types";
import { parisTheme } from "./paris";

/**
 * Monopoly 3ajib Edition : le plateau entre potes.
 *
 * Prix et loyers identiques au plateau classique ; seuls les noms changent.
 * Pour modifier un nom : changer le texte ci-dessous. Pour les cartes :
 * voir `chance` et `community` en bas du fichier.
 */

const NAMES: Record<number, string> = {
  1: "145 Rue de Paris",
  3: "2 Rue des Fleurs",
  5: "Le Bourget",
  6: "Taiba",
  8: "Pepper Grill",
  9: "Sahane",
  11: "Bois de Boulogne",
  12: "EDF",
  13: "Pigalle",
  14: "Le Marais",
  15: "Garges-Sarcelles",
  16: "Carrefour Stains",
  18: "Leclerc Clichy",
  19: "Aldi Villetaneuse",
  21: "Bowling Saint-Gratien",
  23: "CGR Épinay",
  24: "Casino d'Enghien",
  25: "Pierrefitte-Stains",
  26: "Clos-Saint-Lazare",
  27: "Chêne Pointu",
  28: "Total",
  29: "Les 4000",
  31: "Bobigny",
  32: "Marville",
  34: "La Villette",
  35: "Villetaneuse Université",
  37: "CDG",
  39: "Orly",
};

const squares: Square[] = parisTheme.squares.map((sq, i) => (NAMES[i] ? { ...sq, name: NAMES[i]! } : sq));

/** Les cartes classiques, avec les noms de cases mis à jour. Remplacez les textes à volonté. */
function retitle(cards: Card[]): Card[] {
  return cards.map((c) => ({
    ...c,
    text: c.text
      .replace("la Rue de la Paix", "Orly")
      .replace("au Boulevard de la Villette", "au Bois de Boulogne")
      .replace("à l'Avenue Henri-Martin", "au Casino d'Enghien")
      .replace("à la Gare de Lyon", "à Garges-Sarcelles")
      .replace("au Boulevard de Belleville", "au 145 Rue de Paris"),
  }));
}

const classicChance = retitle(parisTheme.chance);
const keep = (i: number): Card => classicChance[i - 1]!;
const card = (text: string, effect: CardEffect): Card => ({ text, effect });

/** Cartes Chance de la 3ajib Edition (numérotées comme dans le paquet classique). */
const chance: Card[] = [
  /* 1 */ keep(1),
  /* 2 */ card("Cavale : des mecs de Sevran veulent ta peau, cours à Orly !", { type: "advanceTo", position: 39, collectGo: true }),
  /* 3 */ card("Hechek : l'envie te prend d'aller au Bois de Boulogne.", { type: "advanceTo", position: 11, collectGo: true }),
  /* 4 */ card("Faut se refaire : direction le Casino d'Enghien.", { type: "advanceTo", position: 24, collectGo: true }),
  /* 5 */ card("Maïs : tu vas à Garges-Sarcelles pour taper du bon maïs chaud des tantines.", { type: "advanceTo", position: 15, collectGo: true }),
  /* 6 */ keep(6),
  /* 7 */ card("Délit : séquestration, kidnapping, trafic de stupéfiants… Direction Fleury !", { type: "goToJail" }),
  /* 8 */ card("Bénef : le CROUS se trompe et te verse 50 €.", { type: "gain", amount: 50 }),
  /* 9 */ card("Bon baveux : le baveux de Tel-Aviv peut te faire sortir du hebs. Garde cette carte.", { type: "jailFree" }),
  /* 10 */ keep(10),
  /* 11 */ keep(11),
  /* 12 */ card("Excès de vitesse : tu tartinais trop sur la route fami. −90 €", { type: "pay", amount: 90 }),
  /* 13 */ card("Scam : t'as cru au brouteur camerounais au tel. −200 €", { type: "pay", amount: 200 }),
  /* 14 */ card("Amende : trop d'aura. −67 €", { type: "pay", amount: 67 }),
  /* 15 */ card("Revolut : un boug se trompe et t'envoie 150 €, tu le bloques direct.", { type: "gain", amount: 150 }),
  /* 16 */ card("Chômage : France Travail te régale. +100 €", { type: "gain", amount: 100 }),
];

export const ajibTheme: BoardTheme = {
  ...parisTheme,
  id: "3ajib",
  name: "3ajib Edition",
  // Ce qu'on fait en tombant chez un autre joueur (à la place de « paie le loyer »).
  actions: {
    1: "squatte au 145 Rue de Paris",
    3: "dort chez un pote au 2 Rue des Fleurs",
    5: "prend le RER au Bourget sans valider",
    6: "mange un kebab chez Taiba",
    8: "se prend un menu chez Pepper Grill",
    9: "commande à emporter chez Sahane",
    11: "traîne au Bois de Boulogne",
    12: "paie sa facture EDF",
    13: "passe la soirée à Pigalle",
    14: "se balade dans le Marais",
    15: "prend le RER à Garges-Sarcelles",
    16: "fait ses courses au Carrefour Stains",
    18: "remplit le caddie au Leclerc Clichy",
    19: "chope les promos chez Aldi Villetaneuse",
    21: "fait un strike au Bowling Saint-Gratien",
    23: "va voir un film au CGR Épinay",
    24: "flambe au Casino d'Enghien",
    25: "prend le RER à Pierrefitte-Stains",
    26: "passe faire un tour au Clos-Saint-Lazare",
    27: "passe faire un tour au Chêne Pointu",
    28: "fait le plein chez Total",
    29: "passe faire un tour aux 4000",
    31: "loue un five à Bobigny",
    32: "loue un five à Marville",
    34: "loue un five à La Villette",
    35: "prend le RER à Villetaneuse Université",
    37: "prend l'avion à CDG",
    39: "prend l'avion à Orly",
  },
  groupNames: {
    lightblue: "Fast food",
    pink: "Hechek",
    orange: "Magasins",
    red: "Divertissement",
    yellow: "Terrains de shit",
    green: "Five",
    darkblue: "Aéroports",
  },
  squares,
  chance,
  community: retitle(parisTheme.community),
};
