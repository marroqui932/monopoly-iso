import type { BoardTheme, Card, Square } from "../types";
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

export const ajibTheme: BoardTheme = {
  ...parisTheme,
  id: "3ajib",
  name: "3ajib Edition",
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
  chance: retitle(parisTheme.chance),
  community: retitle(parisTheme.community),
};
