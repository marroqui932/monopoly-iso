import { create } from "zustand";
import {
  applyAction,
  createGame,
  GameError,
  MAX_PLAYERS,
  parisTheme,
  type Action,
  type GameEvent,
  type GameOptions,
  type GameState,
  type NewPlayer,
  type PlayerId,
} from "@monopoly/engine";
import { anim, nowSec, playEvents } from "./anim";
import { buildFeedback, makeNote, type Note } from "./feedback";
import { play } from "./sound";
import { ClientNet, HostNet, newRoomCode, type HostMsg, type Lobby, type NetStatus, type Profile } from "./net";
import { PLAYER_COLORS, TOKENS } from "./tokens";

const LOCAL_SAVE = "monopoly-iso:partie";
const HOST_SAVE = "monopoly-iso:salle";
const PROFILE_KEY = "monopoly-iso:profil";

export type Mode = "local" | "host" | "client";

export interface CardPopup {
  id: number;
  deck: "chance" | "community";
  text: string;
  player: PlayerId;
  showAt: number;
}

interface HostSave {
  code: string;
  lobby: Lobby;
  game: GameState | null;
}

interface Store {
  mode: Mode;
  /** Mon identifiant de joueur (null en partie locale : tout le monde joue sur cet écran). */
  me: PlayerId | null;
  game: GameState | null;
  lobby: Lobby | null;
  net: NetStatus | null;
  rejected: string | null;

  /** Notifications affichées au centre de l'écran. */
  notes: Note[];
  selected: number | null;
  card: CardPopup | null;
  tradeOpen: boolean;
  busyUntil: number;

  // Partie locale
  startGame(players: NewPlayer[], options: Partial<GameOptions>): void;
  resumeSaved(): boolean;

  // En ligne
  hostRoom(profile: Profile): void;
  resumeHost(): boolean;
  joinRoom(code: string, profile: Profile): void;
  setLobbyOptions(options: Partial<GameOptions>): void;
  kick(playerId: PlayerId): void;
  hostStart(): void;

  quit(): void;
  dispatch(playerId: PlayerId, action: Action): boolean;
  select(pos: number | null): void;
  setTradeOpen(open: boolean): void;
  closeCard(): void;
}

let cardId = 0;
const MAX_NOTES = 30;
let host: HostNet | null = null;
let client: ClientNet | null = null;

// ── Stockage local ──────────────────────────────────────────

function store<T>(key: string, value: T | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function loadSaved(): GameState | null {
  const g = load<GameState>(LOCAL_SAVE);
  return g && g.version === 1 && g.phase !== "gameOver" ? g : null;
}

export function loadHostSave(): HostSave | null {
  return load<HostSave>(HOST_SAVE);
}

export function loadProfile(): Profile & { clientId: string; lastRoom?: string } {
  const saved = load<Profile & { clientId: string; lastRoom?: string }>(PROFILE_KEY);
  if (saved?.clientId) return saved;
  const p = {
    clientId: `c-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    name: "",
    color: PLAYER_COLORS[Math.floor(Math.random() * 6)]!.value,
    token: TOKENS[Math.floor(Math.random() * TOKENS.length)]!.id,
  };
  store(PROFILE_KEY, p);
  return p;
}

export function saveProfile(p: Partial<Profile> & { lastRoom?: string }) {
  store(PROFILE_KEY, { ...loadProfile(), ...p });
}

/** Met le code de la salle dans l'adresse : un rechargement de page ramène dans la salle. */
function setUrlRoom(code: string | null) {
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("salle", code);
    else url.searchParams.delete("salle");
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* sans importance */
  }
}

function resetAnim(game: GameState | null) {
  anim.pawns.clear();
  anim.busyUntil = 0;
  if (game?.dice) anim.dice = { a: game.dice.a, b: game.dice.b, rollId: 0, startedAt: -10 };
}

function teardownNet() {
  host?.destroy();
  client?.destroy();
  host = null;
  client = null;
}

export const useGame = create<Store>((set, get) => {
  /** Affiche un nouvel état : animations, carte tirée, sauvegarde. */
  function show(state: GameState, events: GameEvent[]) {
    const timeline = playEvents(events, state);
    const { end, times } = timeline;
    let card = get().card;
    const drawn = [...events].reverse().find((e) => e.type === "cardDrawn");
    if (drawn && drawn.type === "cardDrawn") {
      const idx = events.indexOf(drawn);
      card = { id: ++cardId, deck: drawn.deck, text: drawn.text, player: drawn.player, showAt: Math.min(end, (times[idx] ?? end) + 0.05) };
    }
    const { me, mode } = get();
    const fresh = buildFeedback(state, events, timeline, me, mode !== "local");
    const now = nowSec();
    const notes = [...get().notes.filter((n) => n.showAt > now - 6), ...fresh].slice(-MAX_NOTES);
    set({ game: state, busyUntil: end, card, notes });
  }

  function fail(text: string) {
    play("error");
    set({ notes: [...get().notes, makeNote(`⚠️ ${text}`, "error", nowSec())].slice(-MAX_NOTES) });
  }

  // ── Hôte ──

  function saveHost() {
    const { lobby, game } = get();
    if (!lobby) return;
    store<HostSave>(HOST_SAVE, game?.phase === "gameOver" ? null : { code: lobby.code, lobby, game });
  }

  function hostLobbyUpdate(lobby: Lobby) {
    set({ lobby });
    host?.broadcast({ t: "lobby", lobby });
    saveHost();
  }

  function setOnline(id: string, online: boolean) {
    const lobby = get().lobby;
    if (!lobby) return;
    hostLobbyUpdate({ ...lobby, players: lobby.players.map((p) => (p.id === id ? { ...p, online } : p)) });
  }

  function hostApply(playerId: PlayerId, action: Action): string | null {
    const game = get().game;
    if (!game) return "La partie n'a pas commencé.";
    try {
      const { state, events } = applyAction(game, playerId, action, { now: Date.now() });
      show(state, events);
      host?.broadcast({ t: "state", state, events });
      saveHost();
      return null;
    } catch (e) {
      if (e instanceof GameError) return e.message;
      throw e;
    }
  }

  function startHostNet(code: string) {
    host = new HostNet(code, {
      onStatus: (net) => set({ net }),
      onHello(clientId, profile) {
        const { lobby, game } = get();
        if (!lobby || !host) return;
        if (game) {
          if (!game.players.some((p) => p.id === clientId)) {
            host.kick(clientId, "La partie a déjà commencé sans vous.");
            return;
          }
          setOnline(clientId, true);
          host.send(clientId, { t: "lobby", lobby: get().lobby! });
          host.send(clientId, { t: "state", state: game, events: [] });
          return;
        }
        const existing = lobby.players.find((p) => p.id === clientId);
        if (!existing && lobby.players.length >= MAX_PLAYERS) {
          host.kick(clientId, "La salle est pleine (6 joueurs maximum).");
          return;
        }
        const others = lobby.players.filter((p) => p.id !== clientId);
        const color = others.some((p) => p.color === profile.color)
          ? PLAYER_COLORS.find((c) => !others.some((p) => p.color === c.value))!.value
          : profile.color;
        const token = others.some((p) => p.token === profile.token)
          ? (TOKENS.find((t) => !others.some((p) => p.token === t.id))?.id ?? profile.token)
          : profile.token;
        const player = {
          id: clientId,
          name: (profile.name || "Invité").slice(0, 16),
          color,
          token,
          online: true,
          host: false,
        };
        hostLobbyUpdate({
          ...lobby,
          players: existing ? lobby.players.map((p) => (p.id === clientId ? player : p)) : [...lobby.players, player],
        });
      },
      onAction(clientId, action) {
        const err = hostApply(clientId, action);
        if (err) host?.send(clientId, { t: "error", text: err });
      },
      onLeave(clientId) {
        setOnline(clientId, false);
      },
    });
    host.start();
  }

  // ── Invité ──

  function onHostMessage(msg: HostMsg) {
    switch (msg.t) {
      case "lobby":
        set({ lobby: msg.lobby });
        break;
      case "state":
        if (!get().game) resetAnim(msg.state);
        show(msg.state, msg.events);
        break;
      case "error":
        fail(msg.text);
        break;
      case "rejected":
        set({ rejected: msg.reason });
        break;
    }
  }

  return {
    mode: "local",
    me: null,
    game: null,
    lobby: null,
    net: null,
    rejected: null,
    notes: [],
    selected: null,
    card: null,
    tradeOpen: false,
    busyUntil: 0,

    startGame(players, options) {
      teardownNet();
      const game = createGame(parisTheme, players, options);
      resetAnim(game);
      store(LOCAL_SAVE, game);
      set({ mode: "local", me: null, lobby: null, net: null, game, selected: null, card: null, notes: [], tradeOpen: false, busyUntil: 0 });
    },

    resumeSaved() {
      const game = loadSaved();
      if (!game) return false;
      teardownNet();
      resetAnim(game);
      set({ mode: "local", me: null, lobby: null, net: null, game, selected: null, card: null, notes: [], tradeOpen: false, busyUntil: 0 });
      return true;
    },

    hostRoom(profile) {
      teardownNet();
      const { clientId } = loadProfile();
      const code = newRoomCode();
      const lobby: Lobby = {
        code,
        players: [{ id: clientId, ...profile, name: profile.name || "Hôte", online: true, host: true }],
        options: {},
      };
      store<HostSave>(HOST_SAVE, { code, lobby, game: null });
      setUrlRoom(null);
      set({ mode: "host", me: clientId, lobby, game: null, rejected: null, selected: null, card: null, tradeOpen: false });
      startHostNet(code);
    },

    resumeHost() {
      const saved = loadHostSave();
      if (!saved) return false;
      teardownNet();
      const { clientId } = loadProfile();
      const lobby: Lobby = {
        ...saved.lobby,
        players: saved.lobby.players.map((p) => ({ ...p, online: p.id === clientId })),
      };
      resetAnim(saved.game);
      set({ mode: "host", me: clientId, lobby, game: saved.game, rejected: null, selected: null, card: null, tradeOpen: false, busyUntil: 0 });
      startHostNet(saved.code);
      return true;
    },

    joinRoom(code, profile) {
      teardownNet();
      const { clientId } = loadProfile();
      saveProfile({ ...profile, lastRoom: code });
      setUrlRoom(code);
      resetAnim(null);
      set({ mode: "client", me: clientId, lobby: null, game: null, rejected: null, net: { kind: "connecting" }, selected: null, card: null, tradeOpen: false, busyUntil: 0 });
      client = new ClientNet(code, clientId, profile, {
        onStatus: (net) => set({ net }),
        onMessage: onHostMessage,
      });
      client.start();
    },

    setLobbyOptions(options) {
      const lobby = get().lobby;
      if (get().mode !== "host" || !lobby) return;
      hostLobbyUpdate({ ...lobby, options });
    },

    kick(playerId) {
      const lobby = get().lobby;
      if (get().mode !== "host" || !lobby || get().game) return;
      host?.kick(playerId, "L'hôte vous a retiré de la salle.");
      hostLobbyUpdate({ ...lobby, players: lobby.players.filter((p) => p.id !== playerId) });
    },

    hostStart() {
      const lobby = get().lobby;
      if (get().mode !== "host" || !lobby) return;
      let game: GameState;
      try {
        game = createGame(
          parisTheme,
          lobby.players.map(({ id, name, color, token }) => ({ id, name, color, token })),
          lobby.options,
        );
      } catch (e) {
        if (e instanceof GameError) return fail(e.message);
        throw e;
      }
      resetAnim(game);
      set({ game });
      host?.broadcast({ t: "state", state: game, events: [] });
      saveHost();
    },

    quit() {
      teardownNet();
      setUrlRoom(null);
      if (get().mode === "client") saveProfile({ lastRoom: "" });
      set({ mode: "local", me: null, game: null, lobby: null, net: null, rejected: null, selected: null, card: null, tradeOpen: false });
    },

    dispatch(playerId, action) {
      const { mode, game } = get();
      if (!game) return false;
      if (mode === "client") {
        if (!client?.send({ t: "action", action })) {
          fail("Pas de connexion avec l'hôte.");
          return false;
        }
        return true;
      }
      if (mode === "host") {
        const err = hostApply(playerId, action);
        if (err) fail(err);
        return !err;
      }
      try {
        const { state, events } = applyAction(game, playerId, action, { now: Date.now() });
        show(state, events);
        store(LOCAL_SAVE, state.phase === "gameOver" ? null : state);
        return true;
      } catch (e) {
        if (e instanceof GameError) {
          fail(e.message);
          return false;
        }
        throw e;
      }
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
  };
});

/** Ce joueur peut-il être piloté depuis cet écran ? */
export function useCanAct() {
  const mode = useGame((s) => s.mode);
  const me = useGame((s) => s.me);
  return (playerId: PlayerId | null | undefined) => !!playerId && (mode === "local" || playerId === me);
}

/** Joueurs hors ligne (en ligne seulement). */
export function useOffline() {
  const lobby = useGame((s) => s.lobby);
  const mode = useGame((s) => s.mode);
  return (playerId: PlayerId) => mode !== "local" && !!lobby && lobby.players.some((p) => p.id === playerId && !p.online);
}

export function money(game: GameState, amount: number) {
  return `${amount.toLocaleString("fr-FR")} ${game.theme.currency}`;
}
