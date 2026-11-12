// Réseau pair-à-pair (WebRTC via PeerJS).
//
// L'hôte (celui qui crée la salle) fait tourner le moteur : il reçoit les
// actions des autres, les applique et renvoie le nouvel état à tout le monde.
// Le serveur public de PeerJS ne sert qu'à mettre les navigateurs en contact.

import Peer, { type DataConnection, type PeerOptions } from "peerjs";
import type { Action, GameEvent, GameOptions, GameState, PlayerId } from "@monopoly/engine";

const PREFIX = "monopoly-iso-v1-";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newRoomCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

export function inviteLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("salle", code);
  const peer = new URLSearchParams(window.location.search).get("peer");
  if (peer) url.searchParams.set("peer", peer);
  return url.toString();
}

/** `?peer=localhost:9000` permet d'utiliser un serveur de signalisation local (tests). */
function peerOptions(): PeerOptions {
  const custom = new URLSearchParams(window.location.search).get("peer");
  if (custom) {
    const [host, port] = custom.split(":");
    return { host, port: Number(port ?? 9000), path: "/", secure: false, debug: 1 };
  }
  return { debug: 1 };
}

// ── Messages ────────────────────────────────────────────────

export interface Profile {
  name: string;
  color: string;
  token: string;
}

export interface LobbyPlayer extends Profile {
  id: PlayerId;
  online: boolean;
  host: boolean;
}

export interface Lobby {
  code: string;
  players: LobbyPlayer[];
  options: Partial<GameOptions>;
  /** Plateau choisi par l'hôte. */
  themeId?: string;
}

const PING_EVERY = 3000;
/** Sans nouvelles depuis ce délai, la connexion est considérée comme morte. */
const DEAD_AFTER = 10000;

export type ClientMsg =
  | { t: "ping" }
  | { t: "hello"; clientId: string; profile: Profile }
  | { t: "action"; action: Action };

export type HostMsg =
  | { t: "ping" }
  | { t: "lobby"; lobby: Lobby }
  | { t: "state"; state: GameState; events: GameEvent[] }
  | { t: "error"; text: string }
  | { t: "rejected"; reason: string };

export type NetStatus =
  | { kind: "connecting" }
  | { kind: "ready" }
  | { kind: "reconnecting"; detail: string }
  | { kind: "failed"; detail: string };

// ── Hôte ─────────────────────────────────────────────────────

export interface HostHandlers {
  onStatus(s: NetStatus): void;
  onHello(clientId: string, profile: Profile): void;
  onAction(clientId: string, action: Action): void;
  onLeave(clientId: string): void;
}

export class HostNet {
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>();
  private destroyed = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private lastSeen = new Map<DataConnection, number>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly code: string,
    private h: HostHandlers,
  ) {}

  start() {
    if (this.destroyed) return;
    this.h.onStatus({ kind: "connecting" });
    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => {
        const now = Date.now();
        for (const [conn, seen] of this.lastSeen) {
          if (now - seen > DEAD_AFTER) {
            this.lastSeen.delete(conn);
            conn.close();
            conn.emit("close");
          } else if (conn.open) {
            conn.send({ t: "ping" } satisfies HostMsg);
          }
        }
      }, PING_EVERY);
    }
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;

    peer.on("open", () => this.h.onStatus({ kind: "ready" }));
    peer.on("disconnected", () => {
      if (this.destroyed) return;
      this.h.onStatus({ kind: "reconnecting", detail: "Connexion au serveur perdue, reconnexion…" });
      setTimeout(() => !this.destroyed && !peer.destroyed && peer.reconnect(), 1500);
    });
    peer.on("error", (err) => {
      if (this.destroyed) return;
      const type = (err as { type?: string }).type;
      if (type === "unavailable-id") {
        // L'identifiant de la salle est encore réservé (page rechargée) : on réessaie.
        this.h.onStatus({ kind: "reconnecting", detail: "La salle se libère, nouvel essai…" });
        this.restart(3000);
      } else if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
        this.h.onStatus({ kind: "reconnecting", detail: "Serveur de connexion injoignable, nouvel essai…" });
        this.restart(4000);
      } else if (type === "browser-incompatible") {
        this.h.onStatus({ kind: "failed", detail: "Ce navigateur ne permet pas le jeu en ligne." });
      }
      // Les erreurs de connexion d'un joueur isolé sont gérées par sa connexion.
    });
    peer.on("connection", (conn) => this.accept(conn));
  }

  private restart(delay: number) {
    if (this.retry) clearTimeout(this.retry);
    this.peer?.destroy();
    this.retry = setTimeout(() => this.start(), delay);
  }

  private accept(conn: DataConnection) {
    let clientId: string | null = null;
    this.lastSeen.set(conn, Date.now());
    conn.on("data", (raw) => {
      const msg = raw as ClientMsg;
      this.lastSeen.set(conn, Date.now());
      if (msg.t === "ping") return;
      if (msg.t === "hello") {
        clientId = String(msg.clientId).slice(0, 64);
        const old = this.conns.get(clientId);
        if (old && old !== conn) old.close();
        this.conns.set(clientId, conn);
        this.h.onHello(clientId, msg.profile);
      } else if (msg.t === "action" && clientId) {
        this.h.onAction(clientId, msg.action);
      }
    });
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      this.lastSeen.delete(conn);
      if (clientId && this.conns.get(clientId) === conn) {
        this.conns.delete(clientId);
        this.h.onLeave(clientId);
      }
    };
    conn.on("close", leave);
    conn.on("error", leave);
  }

  isOnline(clientId: string) {
    return this.conns.has(clientId);
  }

  send(clientId: string, msg: HostMsg) {
    const c = this.conns.get(clientId);
    if (c?.open) c.send(msg);
  }

  broadcast(msg: HostMsg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  kick(clientId: string, reason: string) {
    const c = this.conns.get(clientId);
    if (!c) return;
    if (c.open) c.send({ t: "rejected", reason } satisfies HostMsg);
    this.conns.delete(clientId);
    setTimeout(() => c.close(), 300);
  }

  destroy() {
    this.destroyed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.peer?.destroy();
  }
}

// ── Invité ───────────────────────────────────────────────────

export interface ClientHandlers {
  onStatus(s: NetStatus): void;
  onMessage(msg: HostMsg): void;
}

export class ClientNet {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private destroyed = false;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastSeen = 0;

  constructor(
    readonly code: string,
    private clientId: string,
    private profile: Profile,
    private h: ClientHandlers,
  ) {}

  start() {
    if (this.destroyed) return;
    this.h.onStatus({ kind: "connecting" });
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on("open", () => this.connect());
    peer.on("disconnected", () => {
      if (!this.destroyed && !peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1500);
    });
    peer.on("error", (err) => {
      if (this.destroyed) return;
      const type = (err as { type?: string }).type;
      if (type === "peer-unavailable") {
        this.scheduleRetry(
          this.attempts < 3 ? "Recherche de la salle…" : "Salle introuvable pour l'instant (l'hôte est-il connecté ?). Nouvel essai…",
        );
      } else if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
        this.restartPeer("Serveur de connexion injoignable, nouvel essai…");
      } else if (type === "browser-incompatible") {
        this.h.onStatus({ kind: "failed", detail: "Ce navigateur ne permet pas le jeu en ligne." });
      }
    });
  }

  private connect() {
    if (this.destroyed || !this.peer || this.peer.destroyed) return;
    this.attempts++;
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    this.conn = conn;
    const openTimeout = setTimeout(() => {
      if (!conn.open) {
        conn.close();
        this.scheduleRetry("La connexion à l'hôte tarde, nouvel essai…");
      }
    }, 10000);
    conn.on("open", () => {
      clearTimeout(openTimeout);
      this.attempts = 0;
      this.lastSeen = Date.now();
      conn.send({ t: "hello", clientId: this.clientId, profile: this.profile } satisfies ClientMsg);
      this.h.onStatus({ kind: "ready" });
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        if (this.conn !== conn) return;
        if (Date.now() - this.lastSeen > DEAD_AFTER) {
          // L'hôte ne répond plus (page fermée, réseau coupé…) : on se reconnecte.
          clearInterval(this.heartbeat!);
          this.heartbeat = null;
          this.conn = null;
          conn.close();
          this.scheduleRetry("L'hôte ne répond plus, reconnexion…");
        } else if (conn.open) {
          conn.send({ t: "ping" } satisfies ClientMsg);
        }
      }, PING_EVERY);
    });
    conn.on("data", (raw) => {
      const msg = raw as HostMsg;
      this.lastSeen = Date.now();
      if (msg.t === "ping") return;
      if (msg.t === "rejected") {
        this.h.onMessage(msg);
        this.destroy();
        return;
      }
      this.h.onMessage(msg);
    });
    conn.on("close", () => {
      clearTimeout(openTimeout);
      if (this.conn === conn && !this.destroyed) this.scheduleRetry("Connexion avec l'hôte perdue, reconnexion…");
    });
  }

  private scheduleRetry(detail: string) {
    if (this.destroyed) return;
    this.h.onStatus({ kind: "reconnecting", detail });
    if (this.timer) clearTimeout(this.timer);
    const delay = Math.min(8000, 1500 + this.attempts * 1000);
    this.timer = setTimeout(() => this.connect(), delay);
  }

  private restartPeer(detail: string) {
    this.h.onStatus({ kind: "reconnecting", detail });
    if (this.timer) clearTimeout(this.timer);
    this.peer?.destroy();
    this.timer = setTimeout(() => this.start(), 4000);
  }

  send(msg: ClientMsg) {
    if (this.conn?.open) {
      this.conn.send(msg);
      return true;
    }
    return false;
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.conn?.close();
    this.peer?.destroy();
  }
}
