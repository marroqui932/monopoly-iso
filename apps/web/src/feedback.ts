// Transforme les événements du moteur en notifications (au centre de l'écran) et en sons.

import type { GameEvent, GameState, PlayerId } from "@monopoly/engine";
import type { Timeline } from "./anim";
import { play, playSquare, type SoundName } from "./sound";

export type NoteKind = "info" | "good" | "bad" | "turn" | "error";

export interface Note {
  id: number;
  text: string;
  kind: NoteKind;
  /** Couleur du joueur concerné (pastille). */
  color?: string;
  showAt: number;
}

let noteId = 0;

export function makeNote(text: string, kind: NoteKind, showAt: number, color?: string): Note {
  return { id: ++noteId, text, kind, showAt, color };
}

export function buildFeedback(
  state: GameState,
  events: GameEvent[],
  timeline: Timeline,
  me: PlayerId | null,
  online: boolean,
): Note[] {
  const notes: Note[] = [];
  const name = (id: PlayerId | null) => (id ? (state.players.find((p) => p.id === id)?.name ?? "?") : "la banque");
  const color = (id: PlayerId | null) => (id ? state.players.find((p) => p.id === id)?.color : undefined);
  const sq = (pos: number) => state.theme.squares[pos]?.name ?? "?";
  const cur = state.theme.currency;
  const fmt = (n: number) => `${n.toLocaleString("fr-FR")} ${cur}`;
  const you = (id: PlayerId | null) => online && id === me;
  const now = performance.now() / 1000;
  const sound = (s: SoundName, at: number) => play(s, at - now);

  for (const t of timeline.hops) sound("step", t);

  // Son perso d'arrivée : sur la dernière case atteinte par chaque pion.
  const lastMove = new Map<PlayerId, number>();
  events.forEach((e, i) => {
    if (e.type === "moved") lastMove.set(e.player, i);
  });
  for (const i of lastMove.values()) {
    const e = events[i]!;
    if (e.type !== "moved") continue;
    const arrival = timeline.times[i + 1] ?? timeline.end;
    playSquare(e.to, arrival - now);
  }

  events.forEach((e, i) => {
    const at = timeline.times[i] ?? now;
    const note = (text: string, kind: NoteKind, who?: PlayerId | null) => notes.push(makeNote(text, kind, at, who ? color(who) : undefined));
    switch (e.type) {
      case "diceRolled":
        sound("dice", at);
        if (e.dice.a === e.dice.b) notes.push(makeNote(`🎲 Double ${e.dice.a} !`, "good", at + 0.9, color(e.player)));
        break;
      case "turnStarted":
        if (you(e.player)) {
          note("🎲 À toi de jouer !", "turn", e.player);
          sound("yourTurn", at);
        } else if (!online) {
          // Sur un seul écran, chaque tour est annoncé en grand.
          note(`Au tour de ${name(e.player)}`, "turn", e.player);
          sound("yourTurn", at);
        } else {
          note(`Au tour de ${name(e.player)}`, "info", e.player);
        }
        break;
      case "paid": {
        const reason = e.reason ? ` (${e.reason})` : "";
        if (e.to) {
          const kind: NoteKind = you(e.to) ? "good" : you(e.from) ? "bad" : "info";
          note(`${you(e.from) ? "Tu paies" : `${name(e.from)} paie`} ${fmt(e.amount)} à ${you(e.to) ? "toi" : name(e.to)}${reason}`, kind, e.from);
        } else {
          note(`${you(e.from) ? "Tu paies" : `${name(e.from)} paie`} ${fmt(e.amount)}${reason}`, you(e.from) ? "bad" : "info", e.from);
        }
        sound(you(e.to) ? "coinIn" : "coinOut", at);
        break;
      }
      case "passedGo":
        note(`${name(e.player)} passe par la case Départ : +${fmt(e.amount)}`, you(e.player) ? "good" : "info", e.player);
        sound("coinIn", at);
        break;
      case "cashChanged":
        if (e.reason === "carte" && e.delta > 0) sound("coinIn", at + 0.3);
        if (e.reason.startsWith("cagnotte")) {
          note(`🎉 ${name(e.player)} remporte la cagnotte : +${fmt(e.delta)}`, "good", e.player);
          sound("coinIn", at);
        }
        break;
      case "propertyBought":
        note(`🏠 ${name(e.player)} achète ${sq(e.position)} (${fmt(e.price)})`, you(e.player) ? "good" : "info", e.player);
        sound("buy", at);
        break;
      case "auctionStarted":
        note(`🔨 ${sq(e.position)} part aux enchères !`, "info");
        break;
      case "auctionEnded":
        if (e.winner) {
          note(`🔨 ${name(e.winner)} remporte ${sq(e.position)} pour ${fmt(e.amount)}`, you(e.winner) ? "good" : "info", e.winner);
          sound("buy", at);
        } else {
          note(`Personne n'achète ${sq(e.position)}`, "info");
        }
        break;
      case "cardDrawn":
        sound("card", at);
        break;
      case "sentToJail":
        note(`🚔 ${name(e.player)} va en prison !`, "bad", e.player);
        sound("jail", at);
        break;
      case "leftJail":
        note(`🔓 ${name(e.player)} sort de prison`, "info", e.player);
        break;
      case "built":
        note(`🏗️ ${name(e.player)} construit ${e.houses === 5 ? "un hôtel" : "une maison"} sur ${sq(e.position)}`, "info", e.player);
        sound("build", at);
        break;
      case "sold":
        note(`${name(e.player)} revend une construction sur ${sq(e.position)}`, "info", e.player);
        sound("coinIn", at);
        break;
      case "mortgaged":
        note(
          e.mortgaged ? `${name(e.player)} hypothèque ${sq(e.position)}` : `${name(e.player)} lève l'hypothèque de ${sq(e.position)}`,
          "info",
          e.player,
        );
        sound(e.mortgaged ? "coinIn" : "coinOut", at);
        break;
      case "tradeProposed":
        if (you(e.trade.to)) note(`🤝 ${name(e.trade.from)} te propose un échange !`, "turn", e.trade.from);
        else note(`🤝 ${name(e.trade.from)} propose un échange à ${name(e.trade.to)}`, "info", e.trade.from);
        sound("trade", at);
        break;
      case "tradeAccepted":
        note("🤝 Échange conclu !", "good");
        sound("trade", at);
        break;
      case "debtCreated":
        note(`⚠️ ${name(e.debt.debtor)} doit ${fmt(e.debt.amount)} et n'a pas assez !`, "bad", e.debt.debtor);
        sound("error", at);
        break;
      case "bankrupt":
        note(`💥 ${name(e.player)} fait faillite !`, "bad", e.player);
        sound("bankrupt", at);
        break;
      default:
        break;
    }
  });
  return notes;
}
