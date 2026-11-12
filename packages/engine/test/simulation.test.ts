/**
 * Simule des milliers de parties avec des joueurs aléatoires, et vérifie après
 * chaque action que l'état reste cohérent. Les joueurs tentent aussi des
 * actions au hasard (souvent interdites) : le moteur doit toujours répondre
 * par une GameError propre, jamais par un plantage.
 */
import { describe, expect, it } from "vitest";
declare const process: { env: Record<string, string | undefined> };
import {
  applyAction,
  buildError,
  createGame,
  currentPlayer,
  GameError,
  groupPositions,
  mortgageError,
  parisTheme,
  sellError,
} from "../src";
import { randomInt } from "../src/rng";
import type { Action, GameState, PlayerId } from "../src";
import { players } from "./helpers";

function checkInvariants(s: GameState) {
  let housesOnBoard = 0;
  let hotelsOnBoard = 0;
  for (const [key, prop] of Object.entries(s.properties)) {
    const pos = Number(key);
    if (prop.owner) {
      const owner = s.players.find((p) => p.id === prop.owner);
      expect(owner, `propriétaire inconnu en ${pos}`).toBeDefined();
      expect(owner!.bankrupt, `propriété ${pos} à un joueur en faillite`).toBe(false);
    }
    if (prop.houses === 5) hotelsOnBoard++;
    else housesOnBoard += prop.houses;
    if (prop.houses > 0) {
      const sq = s.theme.squares[pos]!;
      expect(sq.kind).toBe("street");
      if (sq.kind !== "street") continue;
      const group = groupPositions(s, sq.group);
      expect(group.every((g) => s.properties[g]!.owner === prop.owner), "construction sans groupe complet").toBe(true);
      expect(group.some((g) => s.properties[g]!.mortgaged), "construction sur groupe hypothéqué").toBe(false);
      const levels = group.map((g) => s.properties[g]!.houses);
      expect(Math.max(...levels) - Math.min(...levels), "construction non uniforme").toBeLessThanOrEqual(1);
    }
    expect(prop.mortgaged && prop.houses > 0).toBe(false);
  }
  expect(s.bank.houses + housesOnBoard).toBe(s.options.totalHouses);
  expect(s.bank.hotels + hotelsOnBoard).toBe(s.options.totalHotels);
  expect(s.bank.houses).toBeGreaterThanOrEqual(0);
  expect(s.bank.hotels).toBeGreaterThanOrEqual(0);

  for (const p of s.players) {
    expect(p.cash, `${p.name} a de l'argent négatif`).toBeGreaterThanOrEqual(0);
    expect(p.position).toBeGreaterThanOrEqual(0);
    expect(p.position).toBeLessThan(40);
    if (p.bankrupt) {
      expect(p.cash).toBe(0);
      expect(p.jailCards).toHaveLength(0);
    }
  }

  // Les cartes « Libéré de prison » sont soit dans un paquet, soit dans une main.
  const held = s.players.flatMap((p) => p.jailCards);
  expect(s.decks.chance.length + held.filter((d) => d === "chance").length).toBe(s.theme.chance.length);
  expect(s.decks.community.length + held.filter((d) => d === "community").length).toBe(s.theme.community.length);

  if (s.phase !== "gameOver") {
    // Le joueur courant peut être en faillite seulement le temps de régler enchères, dettes et décisions.
    if (currentPlayer(s).bankrupt) {
      const pending = s.auction !== null || s.debts.length > 0 || s.mortgageDecisions.length > 0;
      expect(pending, "le joueur courant est en faillite sans rien en attente").toBe(true);
    }
    expect(s.phase === "auction").toBe(s.auction !== null);
  } else {
    expect(s.players.filter((p) => !p.bankrupt).length).toBeGreaterThanOrEqual(1);
  }
}

const rnd = { rng: 0 };
const pick = <T>(arr: T[]): T => arr[randomInt(rnd, 0, arr.length - 1)]!;
const chance = (pct: number) => randomInt(rnd, 1, 100) <= pct;

/** Choisit une action « raisonnable » pour faire avancer la partie. */
function sensibleAction(s: GameState): [PlayerId, Action] {
  if (s.mortgageDecisions.length > 0) {
    const d = s.mortgageDecisions[0]!;
    return [d.player, { type: "resolveMortgage", position: d.position, unmortgage: chance(30) }];
  }
  if (s.auction) {
    const a = s.auction;
    const id = pick(a.active);
    const pl = s.players.find((p) => p.id === id)!;
    if (a.highestBidder === id) {
      const other = a.active.find((x) => x !== id)!;
      return [other, { type: "passAuction" }];
    }
    if (pl.cash > a.highestBid && chance(55)) {
      return [id, { type: "bid", amount: Math.min(pl.cash, a.highestBid + randomInt(rnd, 1, 60)) }];
    }
    return [id, { type: "passAuction" }];
  }
  if (s.debts.length > 0) {
    const d = s.debts[0]!;
    const pl = s.players.find((p) => p.id === d.debtor)!;
    if (pl.cash >= d.amount) return [pl.id, { type: "payDebt", debtId: d.id }];
    const owned = Object.keys(s.properties).map(Number).filter((pos) => s.properties[pos]!.owner === pl.id);
    const sell = owned.find((pos) => !sellError(s, pl.id, pos));
    if (sell !== undefined) return [pl.id, { type: "sellBuilding", position: sell }];
    const mort = owned.find((pos) => !mortgageError(s, pl.id, pos));
    if (mort !== undefined) return [pl.id, { type: "mortgage", position: mort }];
    return [pl.id, { type: "declareBankruptcy" }];
  }
  if (s.trades.length > 0 && chance(50)) {
    const t = s.trades[0]!;
    return chance(50) ? [t.to, { type: "acceptTrade", tradeId: t.id }] : [t.to, { type: "rejectTrade", tradeId: t.id }];
  }

  const cur = currentPlayer(s);
  // Actions libres : construire, échanger, hypothéquer.
  if (chance(15)) {
    const owned = Object.keys(s.properties).map(Number).filter((pos) => s.properties[pos]!.owner === cur.id);
    const buildable = owned.filter((pos) => !buildError(s, cur.id, pos));
    if (buildable.length > 0) return [cur.id, { type: "build", position: pick(buildable) }];
    if (owned.length > 0 && chance(30)) {
      const others = s.players.filter((p) => !p.bankrupt && p.id !== cur.id);
      const other = pick(others);
      const theirs = Object.keys(s.properties).map(Number).filter((pos) => s.properties[pos]!.owner === other.id);
      return [
        cur.id,
        {
          type: "proposeTrade",
          to: other.id,
          give: { cash: randomInt(rnd, 0, Math.min(cur.cash, 100)), properties: [pick(owned)], jailCards: 0 },
          take: { cash: 0, properties: theirs.length && chance(50) ? [pick(theirs)] : [], jailCards: Math.min(other.jailCards.length, 1) },
        },
      ];
    }
  }

  switch (s.phase) {
    case "roll":
      if (cur.inJail && cur.jailCards.length > 0 && chance(50)) return [cur.id, { type: "useJailCard" }];
      if (cur.inJail && cur.cash >= 50 && chance(30)) return [cur.id, { type: "payJailFine" }];
      return [cur.id, { type: "roll" }];
    case "buy": {
      const price = (s.theme.squares[cur.position] as { price: number }).price;
      return [cur.id, cur.cash >= price && chance(75) ? { type: "buy" } : { type: "declineBuy" }];
    }
    case "cardChoice":
      return [cur.id, { type: "chooseCard", option: chance(50) ? "pay" : "draw" }];
    case "end":
      return [cur.id, chance(3) ? { type: "forfeit" } : { type: "endTurn" }];
    default:
      throw new Error(`phase inattendue ${s.phase}`);
  }
}

/** Action au hasard (souvent illégale) pour vérifier la robustesse. */
function chaosAction(s: GameState): [PlayerId, Action] {
  const pl = pick(s.players);
  const pos = randomInt(rnd, 0, 39);
  const actions: Action[] = [
    { type: "roll" },
    { type: "buy" },
    { type: "declineBuy" },
    { type: "bid", amount: randomInt(rnd, -5, 2000) },
    { type: "passAuction" },
    { type: "payJailFine" },
    { type: "useJailCard" },
    { type: "chooseCard", option: "draw" },
    { type: "build", position: pos },
    { type: "sellBuilding", position: pos },
    { type: "mortgage", position: pos },
    { type: "unmortgage", position: pos },
    { type: "resolveMortgage", position: pos, unmortgage: true },
    { type: "payDebt", debtId: randomInt(rnd, 0, 50) },
    { type: "declareBankruptcy" },
    { type: "acceptTrade", tradeId: randomInt(rnd, 0, 50) },
    { type: "endTurn" },
    {
      type: "proposeTrade",
      to: pick(s.players).id,
      give: { cash: randomInt(rnd, 0, 3000), properties: [pos], jailCards: randomInt(rnd, 0, 2) },
      take: { cash: 0.5, properties: [], jailCards: 0 },
    },
  ];
  return [pl.id, pick(actions)];
}

function playGame(seed: number, nPlayers: number, maxRounds: number | null) {
  rnd.rng = seed * 7919;
  let s = createGame(parisTheme, players(nPlayers), { maxRounds, freeParkingJackpot: seed % 3 === 0 }, seed, 0);
  checkInvariants(s);
  let steps = 0;
  while (s.phase !== "gameOver" && steps < 6000) {
    steps++;
    const [who, action] = chance(20) ? chaosAction(s) : sensibleAction(s);
    try {
      s = applyAction(s, who, action, { now: steps }).state;
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      continue;
    }
    checkInvariants(s);
    // L'état doit rester sérialisable (pour le réseau et la sauvegarde).
    if (steps % 200 === 0) expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  }
  return { s, steps };
}

describe("simulation de parties aléatoires", () => {
  const GAMES = Number(process.env.SIM_GAMES ?? 60);
  it(`${GAMES} parties de 2 à 6 joueurs sans incohérence`, () => {
    let finished = 0;
    let totalSteps = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      const { s, steps } = playGame(seed, 2 + (seed % 5), seed % 2 === 0 ? 40 : null);
      totalSteps += steps;
      if (s.phase === "gameOver") finished++;
    }
    console.log(`${finished}/${GAMES} parties terminées, ${totalSteps} actions jouées`);
    // La plupart des parties doivent aller au bout.
    expect(finished).toBeGreaterThan(GAMES * 0.6);
  }, 600_000);
});
