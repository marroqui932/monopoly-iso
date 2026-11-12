import { create } from "zustand";
import {
  applyAction,
  createGame,
  GameError,
  parisTheme,
  type Action,
  type GameEvent,
  type GameOptions,
  type GameState,
  type NewPlayer,
  type PlayerId,
} from "@monopoly/engine";
import { anim, nowSec, playEvents } from "./anim";

const SAVE_KEY = "monopoly-iso:partie";

export interface CardPopup {
  id: number;
  deck: "chance" | "community";
  text: string;
  player: PlayerId;
  showAt: number;
}

interface Store {
  game: GameState | null;
  error: { id: number; text: string } | null;
  selected: number | null;
  card: CardPopup | null;
  tradeOpen: boolean;
  /** Fin des animations en cours : l'interface attend avant de proposer la suite. */
  busyUntil: number;

  startGame(players: NewPlayer[], options: Partial<GameOptions>): void;
  resumeSaved(): boolean;
  quit(): void;
  dispatch(playerId: PlayerId, action: Action): boolean;
  select(pos: number | null): void;
  setTradeOpen(open: boolean): void;
  closeCard(): void;
  clearError(): void;
}

let errorId = 0;
let cardId = 0;

function save(game: GameState | null) {
  try {
    if (game && game.phase !== "gameOver") localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* stockage indisponible : tant pis */
  }
}

export function loadSaved(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    return g.version === 1 ? g : null;
  } catch {
    return null;
  }
}

function resetAnim(game: GameState) {
  anim.pawns.clear();
  anim.busyUntil = 0;
  if (game.dice) anim.dice = { a: game.dice.a, b: game.dice.b, rollId: 0, startedAt: -10 };
}

export const useGame = create<Store>((set, get) => ({
  game: null,
  error: null,
  selected: null,
  card: null,
  tradeOpen: false,
  busyUntil: 0,

  startGame(players, options) {
    const game = createGame(parisTheme, players, options);
    resetAnim(game);
    save(game);
    set({ game, selected: null, card: null, error: null, tradeOpen: false, busyUntil: 0 });
  },

  resumeSaved() {
    const game = loadSaved();
    if (!game) return false;
    resetAnim(game);
    set({ game, selected: null, card: null, error: null, tradeOpen: false, busyUntil: 0 });
    return true;
  },

  quit() {
    set({ game: null, selected: null, card: null, tradeOpen: false });
  },

  dispatch(playerId, action) {
    const game = get().game;
    if (!game) return false;
    let result: { state: GameState; events: GameEvent[] };
    try {
      result = applyAction(game, playerId, action, { now: Date.now() });
    } catch (e) {
      if (e instanceof GameError) {
        set({ error: { id: ++errorId, text: e.message } });
        return false;
      }
      throw e;
    }
    const before = nowSec();
    const end = playEvents(result.events, result.state);
    const drawn = [...result.events].reverse().find((e) => e.type === "cardDrawn");
    let card = get().card;
    if (drawn && drawn.type === "cardDrawn") {
      // La carte s'affiche quand le pion est arrivé sur la case Chance / Caisse.
      const moveIndex = result.events.indexOf(drawn);
      const showAt = moveIndex >= 0 ? Math.min(end, before + 0.05 + estimateUntil(result.events, moveIndex)) : end;
      card = { id: ++cardId, deck: drawn.deck, text: drawn.text, player: drawn.player, showAt };
    }
    save(result.state);
    set({ game: result.state, busyUntil: end, card });
    return true;
  },

  select(pos) {
    set({ selected: pos });
  },
  setTradeOpen(open) {
    set({ tradeOpen: open });
  },
  closeCard() {
    set({ card: null });
  },
  clearError() {
    set({ error: null });
  },
}));

/** Durée d'animation jusqu'à l'événement n° `index`. */
function estimateUntil(events: GameEvent[], index: number): number {
  let t = 0;
  for (let i = 0; i < index; i++) {
    const e = events[i]!;
    if (e.type === "diceRolled") t += 0.9;
    if (e.type === "moved") t += !e.direct && Math.abs(e.steps) <= 12 ? Math.abs(e.steps) * 0.2 : 0.7;
  }
  return t;
}

export function money(game: GameState, amount: number) {
  return `${amount.toLocaleString("fr-FR")} ${game.theme.currency}`;
}
