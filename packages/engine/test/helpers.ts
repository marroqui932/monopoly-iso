import { applyAction, createGame, parisTheme } from "../src";
import { randomInt } from "../src/rng";
import type { Action, GameOptions, GameState, NewPlayer } from "../src";

export const NOW = 1_000_000;

export function players(n: number): NewPlayer[] {
  const names = ["Alice", "Bob", "Chloé", "David", "Emma", "Farid"];
  return names.slice(0, n).map((name, i) => ({ id: `p${i}`, name, color: "#000", token: "hat" }));
}

/** Partie de test : ordre des joueurs fixé (p0, p1, …). */
export function newGame(n = 2, options: Partial<GameOptions> = {}): GameState {
  const s = createGame(parisTheme, players(n), { rollForOrder: false, ...options }, 42, NOW);
  s.players.sort((a, b) => a.id.localeCompare(b.id));
  s.currentPlayer = 0;
  return s;
}

/** Règle le générateur pour que le prochain lancer donne exactement (a, b). */
export function rigDice(s: GameState, a: number, b: number): GameState {
  for (let seed = 0; seed < 1_000_000; seed++) {
    const h = { rng: seed };
    if (randomInt(h, 1, 6) === a && randomInt(h, 1, 6) === b) {
      s.rng = seed;
      return s;
    }
  }
  throw new Error("graine introuvable");
}

export function act(s: GameState, playerId: string, action: Action, now = NOW): GameState {
  return applyAction(s, playerId, action, { now }).state;
}

export function rollWith(s: GameState, playerId: string, a: number, b: number): GameState {
  const copy = structuredClone(s);
  rigDice(copy, a, b);
  return act(copy, playerId, { type: "roll" });
}

export function p(s: GameState, id: string) {
  return s.players.find((pl) => pl.id === id)!;
}

export function give(s: GameState, playerId: string, ...positions: number[]): GameState {
  for (const pos of positions) s.properties[pos]!.owner = playerId;
  return s;
}

/** Index de la carte dont le texte contient `needle`. */
export function cardIndex(deck: "chance" | "community", needle: string): number {
  const cards = deck === "chance" ? parisTheme.chance : parisTheme.community;
  const i = cards.findIndex((c) => c.text.includes(needle));
  if (i < 0) throw new Error(`carte introuvable : ${needle}`);
  return i;
}
