// Effets visuels déclenchés par les événements du moteur (montants flottants,
// pièces, éclats, case illuminée…). Ils sont calés sur la chronologie des
// animations : un loyer s'affiche quand le pion arrive, pas avant.

import { create } from "zustand";
import type { GameEvent, GameState, PlayerId } from "@monopoly/engine";
import type { Timeline } from "./anim";
import { cellLayout, pawnSpot } from "./layout";

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export type Fx =
  | { id: number; kind: "float"; start: number; x: number; z: number; text: string; color: string }
  | { id: number; kind: "coins"; start: number; from: [number, number]; to: [number, number]; count: number }
  | { id: number; kind: "burst"; start: number; x: number; z: number; color: string; size: number }
  | { id: number; kind: "glow"; start: number; pos: number; color: string }
  | { id: number; kind: "cardLift"; start: number; deck: "chance" | "community" };

/** Durée de vie de chaque effet (s). */
export const FX_LIFE: Record<Fx["kind"], number> = { float: 1.8, coins: 1.2, burst: 1.0, glow: 1.4, cardLift: 0.9 };

let fxId = 0;

export const useFx = create<{ list: Fx[] }>(() => ({ list: [] }));

export function removeFx(id: number) {
  useFx.setState((s) => ({ list: s.list.filter((f) => f.id !== id) }));
}

/** Centre du plateau : là où « vit » la banque. */
const BANK: [number, number] = [0, 0];

export function buildFx(state: GameState, events: GameEvent[], timeline: Timeline) {
  const out: Fx[] = [];
  const now = performance.now() / 1000;
  const slot = (id: PlayerId) => state.players.findIndex((p) => p.id === id);
  const where = (id: PlayerId): [number, number] => {
    const p = state.players.find((pl) => pl.id === id);
    return p ? pawnSpot(p.position, slot(id), p.inJail) : BANK;
  };
  const color = (id: PlayerId | null) => state.players.find((p) => p.id === id)?.color ?? "#ffffff";
  const fmt = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("fr-FR")} ${state.theme.currency}`;

  // Deux montants pour le même joueur ne doivent pas se superposer : on les espace.
  const lastFloat = new Map<PlayerId, number>();

  events.forEach((e, i) => {
    const at = timeline.times[i] ?? now;
    const add = (fx: DistributiveOmit<Fx, "id" | "start">, delay = 0) => out.push({ ...(fx as Fx), id: ++fxId, start: at + delay });
    switch (e.type) {
      case "cashChanged": {
        const [x, z] = where(e.player);
        const wanted = at + 0.15;
        const start = Math.max(wanted, (lastFloat.get(e.player) ?? -Infinity) + 0.6);
        lastFloat.set(e.player, start);
        add({ kind: "float", x, z, text: fmt(e.delta), color: e.delta > 0 ? "#5cf2c2" : "#ff7a85" }, start - at);
        break;
      }
      case "paid": {
        // Les pièces partent du payeur vers celui qui reçoit (ou la banque, au centre).
        add({ kind: "coins", from: where(e.from), to: e.to ? where(e.to) : BANK, count: Math.min(8, 3 + Math.floor(e.amount / 150)) });
        break;
      }
      case "passedGo": {
        const c = cellLayout(0);
        add({ kind: "burst", x: c.x, z: c.z, color: "#ffd166", size: 1.4 });
        add({ kind: "coins", from: BANK, to: where(e.player), count: 5 });
        break;
      }
      case "propertyBought":
        add({ kind: "glow", pos: e.position, color: color(e.player) });
        break;
      case "auctionEnded":
        if (e.winner) add({ kind: "glow", pos: e.position, color: color(e.winner) });
        break;
      case "built": {
        const c = cellLayout(e.position);
        add({ kind: "burst", x: c.x, z: c.z, color: "#9be564", size: 0.8 });
        break;
      }
      case "sentToJail": {
        const c = cellLayout(10);
        add({ kind: "burst", x: c.x + 0.35, z: c.z - 0.35, color: "#ff4d5e", size: 1.2 }, 0.6);
        break;
      }
      case "leftJail": {
        const c = cellLayout(10);
        add({ kind: "burst", x: c.x + 0.35, z: c.z - 0.35, color: "#5cf2c2", size: 0.9 });
        break;
      }
      case "bankrupt": {
        const [x, z] = where(e.player);
        add({ kind: "burst", x, z, color: "#8d8da8", size: 1.6 });
        break;
      }
      case "cardDrawn":
        add({ kind: "cardLift", deck: e.deck });
        break;
      default:
        break;
    }
  });
  if (out.length) useFx.setState((s) => ({ list: [...s.list, ...out] }));
}
