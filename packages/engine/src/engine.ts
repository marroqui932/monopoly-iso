import {
  BOARD_SIZE,
  JAIL_POSITION,
  activePlayers,
  buildError,
  countBuildings,
  currentPlayer,
  getPlayer,
  groupHasBuildings,
  isOwnable,
  mortgageError,
  mortgageInterest,
  mortgageValue,
  netWorth,
  ownable,
  rentFor,
  sellError,
  square,
  unmortgageCost,
  unmortgageError,
} from "./board";
import { randomInt, shuffle } from "./rng";
import type {
  Action,
  ActionContext,
  ActionResult,
  BoardTheme,
  DeckName,
  GameEvent,
  GameOptions,
  GameState,
  NewPlayer,
  Phase,
  Player,
  PlayerId,
  PropertyState,
  Trade,
  TradeSide,
} from "./types";

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

function fail(message: string): never {
  throw new GameError(message);
}

export const DEFAULT_OPTIONS: GameOptions = {
  startingCash: 1500,
  salary: 200,
  jailFine: 50,
  freeParkingJackpot: false,
  maxRounds: null,
  timeLimitMs: null,
  totalHouses: 32,
  totalHotels: 12,
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
const LOG_LIMIT = 300;
const MAX_OPEN_TRADES_PER_PLAYER = 5;

/** Contexte de travail pendant l'application d'une action. */
interface Ctx {
  s: GameState;
  events: GameEvent[];
  now: number;
}

// ─────────────────────────────────────────────────────────────
// Création de partie
// ─────────────────────────────────────────────────────────────

export function createGame(
  theme: BoardTheme,
  players: NewPlayer[],
  options: Partial<GameOptions> = {},
  seed: number = Date.now(),
  now: number = Date.now(),
): GameState {
  if (theme.squares.length !== BOARD_SIZE) fail(`Le plateau doit avoir ${BOARD_SIZE} cases.`);
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    fail(`Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} joueurs.`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) fail("Identifiants de joueurs en double.");
  if (theme.chance.length === 0 || theme.community.length === 0) fail("Les paquets de cartes sont vides.");

  const opts: GameOptions = { ...DEFAULT_OPTIONS, ...options };
  const properties: Record<number, PropertyState> = {};
  theme.squares.forEach((sq, i) => {
    if (isOwnable(sq)) properties[i] = { owner: null, houses: 0, mortgaged: false };
  });

  const rngHolder = { rng: seed | 0 };
  const order = shuffle(rngHolder, players);
  const s: GameState = {
    version: 1,
    theme,
    options: opts,
    players: order.map((p) => ({
      ...p,
      cash: opts.startingCash,
      position: 0,
      inJail: false,
      jailAttempts: 0,
      jailCards: [],
      bankrupt: false,
    })),
    properties,
    bank: { houses: opts.totalHouses, hotels: opts.totalHotels },
    decks: {
      chance: shuffle(rngHolder, theme.chance.map((_, i) => i)),
      community: shuffle(rngHolder, theme.community.map((_, i) => i)),
    },
    currentPlayer: 0,
    phase: "roll",
    dice: null,
    doublesCount: 0,
    extraRoll: false,
    pendingCard: null,
    auction: null,
    auctionQueue: [],
    debts: [],
    trades: [],
    mortgageDecisions: [],
    freeParkingPot: 0,
    round: 1,
    startedAt: now,
    winner: null,
    endReason: null,
    rng: rngHolder.rng,
    nextId: 1,
    log: [],
    logCounter: 0,
  };
  const c: Ctx = { s, events: [], now };
  log(c, `La partie commence ! ${order.map((p) => p.name).join(", ")}.`);
  log(c, `C'est au tour de ${currentPlayer(s).name}.`);
  return s;
}

// ─────────────────────────────────────────────────────────────
// Point d'entrée : appliquer une action
// ─────────────────────────────────────────────────────────────

/**
 * Applique l'action d'un joueur. Ne modifie jamais l'état reçu : renvoie un
 * nouvel état et la liste des événements (pour les animations et les sons).
 * Lève une GameError (message en français) si l'action est interdite.
 */
export function applyAction(
  state: GameState,
  playerId: PlayerId,
  action: Action,
  ctx: ActionContext = { now: Date.now() },
): ActionResult {
  const s = structuredClone(state);
  const c: Ctx = { s, events: [], now: ctx.now };

  if (s.phase === "gameOver") fail("La partie est terminée.");
  const p = getPlayer(s, playerId);
  if (!p) fail("Joueur inconnu.");
  if (p.bankrupt) fail("Vous avez fait faillite.");

  switch (action.type) {
    case "roll":
      doRoll(c, p);
      break;
    case "buy":
      doBuy(c, p);
      break;
    case "declineBuy":
      assertTurn(c, p, "buy");
      assertNoBlockers(c);
      startAuction(c, p.position, "end");
      break;
    case "bid":
      doBid(c, p, action.amount);
      break;
    case "passAuction":
      doPassAuction(c, p);
      break;
    case "payJailFine":
      doPayJailFine(c, p);
      break;
    case "useJailCard":
      doUseJailCard(c, p);
      break;
    case "chooseCard":
      doChooseCard(c, p, action.option);
      break;
    case "build":
      doBuild(c, p, action.position);
      break;
    case "sellBuilding":
      doSellBuilding(c, p, action.position);
      break;
    case "mortgage":
      doMortgage(c, p, action.position);
      break;
    case "unmortgage":
      doUnmortgage(c, p, action.position);
      break;
    case "resolveMortgage":
      doResolveMortgage(c, p, action.position, action.unmortgage);
      break;
    case "payDebt":
      doPayDebt(c, p, action.debtId);
      break;
    case "declareBankruptcy":
      doDeclareBankruptcy(c, p);
      break;
    case "proposeTrade":
      doProposeTrade(c, p, action.to, action.give, action.take);
      break;
    case "acceptTrade":
      doAcceptTrade(c, p, action.tradeId);
      break;
    case "rejectTrade":
      doCloseTrade(c, p, action.tradeId, "reject");
      break;
    case "cancelTrade":
      doCloseTrade(c, p, action.tradeId, "cancel");
      break;
    case "endTurn":
      assertTurn(c, p, "end");
      assertNoBlockers(c);
      advanceTurn(c);
      break;
    case "forfeit":
      log(c, `${p.name} abandonne la partie.`);
      goBankrupt(c, p, null);
      break;
    default: {
      const never: never = action;
      fail(`Action inconnue : ${JSON.stringify(never)}`);
    }
  }

  normalize(c);
  return { state: s, events: c.events };
}

// ─────────────────────────────────────────────────────────────
// Outils internes
// ─────────────────────────────────────────────────────────────

function log(c: Ctx, text: string) {
  c.s.logCounter++;
  c.s.log.push({ n: c.s.logCounter, text });
  if (c.s.log.length > LOG_LIMIT) c.s.log.splice(0, c.s.log.length - LOG_LIMIT);
}

function money(c: Ctx, amount: number): string {
  return `${amount} ${c.s.theme.currency}`;
}

function nameOf(c: Ctx, id: PlayerId | null): string {
  if (id === null) return "la banque";
  return getPlayer(c.s, id)?.name ?? "?";
}

function assertTurn(c: Ctx, p: Player, phase: Phase) {
  if (currentPlayer(c.s).id !== p.id) fail("Ce n'est pas votre tour.");
  if (c.s.phase !== phase) fail("Action impossible pour le moment.");
}

/** Dettes, enchère ou décisions d'hypothèque en attente bloquent la suite du tour. */
function assertNoBlockers(c: Ctx) {
  if (c.s.debts.length > 0) fail("Des dettes doivent d'abord être réglées.");
  if (c.s.mortgageDecisions.length > 0) fail("Des propriétés hypothéquées reçues attendent une décision.");
  if (c.s.auction) fail("Une enchère est en cours.");
}

function assertInt(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) fail(`${what} invalide.`);
}

function changeCash(c: Ctx, p: Player, delta: number, reason: string) {
  if (delta === 0) return;
  p.cash += delta;
  c.events.push({ type: "cashChanged", player: p.id, delta, reason });
}

/**
 * Fait payer `amount` à `debtor`. S'il n'a pas assez, une dette est créée :
 * il devra vendre, hypothéquer ou échanger, puis la régler (ou faire faillite).
 */
function charge(
  c: Ctx,
  debtor: Player,
  creditor: Player | null,
  amount: number,
  reason: string,
  toPot = false,
): boolean {
  if (amount <= 0 || debtor.bankrupt) return true;
  if (debtor.cash >= amount) {
    transfer(c, debtor, creditor, amount, reason, toPot);
    return true;
  }
  const debt = {
    id: c.s.nextId++,
    debtor: debtor.id,
    creditor: creditor?.id ?? null,
    amount,
    reason,
    toPot,
  };
  c.s.debts.push(debt);
  c.events.push({ type: "debtCreated", debt });
  log(c, `${debtor.name} doit ${money(c, amount)} à ${nameOf(c, debt.creditor)} mais n'a que ${money(c, debtor.cash)}.`);
  return false;
}

function transfer(c: Ctx, from: Player, to: Player | null, amount: number, reason: string, toPot: boolean) {
  changeCash(c, from, -amount, reason);
  if (to) {
    changeCash(c, to, amount, reason);
    log(c, `${from.name} paie ${money(c, amount)} à ${to.name} (${reason}).`);
  } else {
    if (toPot && c.s.options.freeParkingJackpot) c.s.freeParkingPot += amount;
    log(c, `${from.name} paie ${money(c, amount)} (${reason}).`);
  }
}

// ─────────────────────────────────────────────────────────────
// Dés et déplacements
// ─────────────────────────────────────────────────────────────

function doRoll(c: Ctx, p: Player) {
  assertTurn(c, p, "roll");
  assertNoBlockers(c);
  const s = c.s;
  const dice = { a: randomInt(s, 1, 6), b: randomInt(s, 1, 6) };
  s.dice = dice;
  const total = dice.a + dice.b;
  const isDouble = dice.a === dice.b;
  c.events.push({ type: "diceRolled", player: p.id, dice });
  log(c, `${p.name} lance les dés : ${dice.a} + ${dice.b}${isDouble ? " (double !)" : ""}.`);

  s.phase = "end";
  s.extraRoll = false;

  if (p.inJail) {
    if (isDouble) {
      leaveJail(c, p, "grâce à un double");
      moveBy(c, p, total);
      land(c, p);
      return;
    }
    p.jailAttempts++;
    if (p.jailAttempts >= 3) {
      log(c, `${p.name} a raté 3 fois : il paie l'amende et sort.`);
      charge(c, p, null, s.options.jailFine, "amende de prison", true);
      leaveJail(c, p, "après 3 tentatives");
      moveBy(c, p, total);
      land(c, p);
    } else {
      log(c, `${p.name} reste en prison (tentative ${p.jailAttempts}/3).`);
    }
    return;
  }

  if (isDouble) {
    s.doublesCount++;
    if (s.doublesCount >= 3) {
      log(c, `${p.name} fait 3 doubles de suite : direction la prison !`);
      sendToJail(c, p);
      return;
    }
    s.extraRoll = true;
  }
  moveBy(c, p, total);
  land(c, p);
}

function passGo(c: Ctx, p: Player) {
  const amount = c.s.options.salary;
  changeCash(c, p, amount, "case Départ");
  c.events.push({ type: "passedGo", player: p.id, amount });
  log(c, `${p.name} passe par la case Départ et reçoit ${money(c, amount)}.`);
}

/** Déplacement relatif (dés ou carte). Seul un déplacement en avant fait toucher le salaire. */
function moveBy(c: Ctx, p: Player, steps: number) {
  const from = p.position;
  const to = (((from + steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  p.position = to;
  c.events.push({ type: "moved", player: p.id, from, to, steps, direct: false });
  if (steps > 0 && from + steps >= BOARD_SIZE) passGo(c, p);
}

/** Déplacement vers une case précise, toujours vers l'avant (sauf collectGo = false : on "retourne"). */
function moveTo(c: Ctx, p: Player, target: number, collectGo: boolean) {
  const from = p.position;
  const forward = (target - from + BOARD_SIZE) % BOARD_SIZE;
  p.position = target;
  c.events.push({
    type: "moved",
    player: p.id,
    from,
    to: target,
    steps: collectGo ? forward : -((from - target + BOARD_SIZE) % BOARD_SIZE),
    direct: true,
  });
  if (collectGo && forward > 0 && from + forward >= BOARD_SIZE) passGo(c, p);
}

function sendToJail(c: Ctx, p: Player) {
  const from = p.position;
  p.position = JAIL_POSITION;
  p.inJail = true;
  p.jailAttempts = 0;
  c.events.push({ type: "moved", player: p.id, from, to: JAIL_POSITION, steps: 0, direct: true });
  c.events.push({ type: "sentToJail", player: p.id });
  log(c, `${p.name} va en prison.`);
  if (currentPlayer(c.s).id === p.id) {
    c.s.extraRoll = false;
    c.s.doublesCount = 0;
  }
}

function leaveJail(c: Ctx, p: Player, how: string) {
  p.inJail = false;
  p.jailAttempts = 0;
  c.events.push({ type: "leftJail", player: p.id });
  log(c, `${p.name} sort de prison ${how}.`);
}

/** Résout l'arrivée sur une case. */
function land(c: Ctx, p: Player) {
  const s = c.s;
  const pos = p.position;
  const sq = square(s, pos);
  switch (sq.kind) {
    case "go":
    case "jail":
      return;
    case "freeParking":
      if (s.options.freeParkingJackpot && s.freeParkingPot > 0) {
        const pot = s.freeParkingPot;
        s.freeParkingPot = 0;
        changeCash(c, p, pot, "cagnotte du Parc gratuit");
        log(c, `${p.name} remporte la cagnotte du Parc gratuit : ${money(c, pot)} !`);
      }
      return;
    case "goToJail":
      sendToJail(c, p);
      return;
    case "tax":
      charge(c, p, null, sq.amount, sq.name, true);
      return;
    case "chance":
      drawCard(c, p, "chance");
      return;
    case "community":
      drawCard(c, p, "community");
      return;
    case "street":
    case "railroad":
    case "utility": {
      const prop = s.properties[pos]!;
      if (!prop.owner) {
        s.phase = "buy";
        log(c, `${sq.name} est à vendre (${money(c, sq.price)}).`);
        return;
      }
      if (prop.owner === p.id) return;
      if (prop.mortgaged) {
        log(c, `${sq.name} est hypothéquée : pas de loyer.`);
        return;
      }
      const owner = getPlayer(s, prop.owner)!;
      const total = s.dice ? s.dice.a + s.dice.b : 0;
      const rent = rentFor(s, pos, total);
      charge(c, p, owner, rent, `loyer de ${sq.name}`);
      return;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Cartes
// ─────────────────────────────────────────────────────────────

function drawCard(c: Ctx, p: Player, deck: DeckName) {
  const s = c.s;
  const index = s.decks[deck].shift();
  if (index === undefined) {
    log(c, "Le paquet est vide.");
    return;
  }
  const card = (deck === "chance" ? s.theme.chance : s.theme.community)[index]!;
  if (card.effect.type === "jailFree") p.jailCards.push(deck);
  else s.decks[deck].push(index);

  c.events.push({ type: "cardDrawn", player: p.id, deck, text: card.text });
  log(c, `${p.name} tire une carte ${deck === "chance" ? "Chance" : "Caisse de communauté"} : « ${card.text} »`);

  const e = card.effect;
  switch (e.type) {
    case "advanceTo":
      moveTo(c, p, e.position, e.collectGo);
      land(c, p);
      break;
    case "moveBy":
      moveBy(c, p, e.steps);
      land(c, p);
      break;
    case "gain":
      changeCash(c, p, e.amount, "carte");
      break;
    case "pay":
      charge(c, p, null, e.amount, "carte", true);
      break;
    case "goToJail":
      sendToJail(c, p);
      break;
    case "jailFree":
      break;
    case "repairs": {
      const { houses, hotels } = countBuildings(s, p.id);
      charge(c, p, null, houses * e.perHouse + hotels * e.perHotel, "réparations", true);
      break;
    }
    case "collectFromEach":
      for (const other of activePlayers(s)) {
        if (other.id !== p.id) charge(c, other, p, e.amount, "carte");
      }
      break;
    case "payEach":
      for (const other of activePlayers(s)) {
        if (other.id !== p.id) charge(c, p, other, e.amount, "carte");
      }
      break;
    case "payOrDraw":
      s.pendingCard = { deck, index };
      s.phase = "cardChoice";
      break;
  }
}

function doChooseCard(c: Ctx, p: Player, option: "pay" | "draw") {
  assertTurn(c, p, "cardChoice");
  const s = c.s;
  const pending = s.pendingCard;
  if (!pending) fail("Aucune carte en attente.");
  const card = (pending.deck === "chance" ? s.theme.chance : s.theme.community)[pending.index]!;
  if (card.effect.type !== "payOrDraw") fail("Carte inattendue.");
  s.pendingCard = null;
  s.phase = "end";
  if (option === "pay") {
    charge(c, p, null, card.effect.amount, "amende", true);
  } else {
    drawCard(c, p, card.effect.deck);
  }
}

function returnJailCard(c: Ctx, deck: DeckName) {
  const cards = deck === "chance" ? c.s.theme.chance : c.s.theme.community;
  const inDeck = new Set(c.s.decks[deck]);
  const index = cards.findIndex((card, i) => card.effect.type === "jailFree" && !inDeck.has(i));
  if (index >= 0) c.s.decks[deck].push(index);
}

// ─────────────────────────────────────────────────────────────
// Prison
// ─────────────────────────────────────────────────────────────

function doPayJailFine(c: Ctx, p: Player) {
  assertTurn(c, p, "roll");
  assertNoBlockers(c);
  if (!p.inJail) fail("Vous n'êtes pas en prison.");
  const fine = c.s.options.jailFine;
  if (p.cash < fine) fail("Pas assez d'argent pour payer l'amende.");
  transfer(c, p, null, fine, "amende de prison", true);
  leaveJail(c, p, "en payant l'amende");
}

function doUseJailCard(c: Ctx, p: Player) {
  assertTurn(c, p, "roll");
  assertNoBlockers(c);
  if (!p.inJail) fail("Vous n'êtes pas en prison.");
  const deck = p.jailCards.shift();
  if (!deck) fail("Vous n'avez pas de carte « Libéré de prison ».");
  returnJailCard(c, deck);
  leaveJail(c, p, "avec une carte « Libéré de prison »");
}

// ─────────────────────────────────────────────────────────────
// Achat et enchères
// ─────────────────────────────────────────────────────────────

function doBuy(c: Ctx, p: Player) {
  assertTurn(c, p, "buy");
  assertNoBlockers(c);
  const sq = ownable(c.s, p.position);
  const prop = c.s.properties[p.position];
  if (!sq || !prop || prop.owner) fail("Rien à acheter ici.");
  if (p.cash < sq.price) fail("Pas assez d'argent : hypothéquez, vendez, ou laissez partir aux enchères.");
  changeCash(c, p, -sq.price, `achat de ${sq.name}`);
  prop.owner = p.id;
  c.events.push({ type: "propertyBought", player: p.id, position: p.position, price: sq.price });
  log(c, `${p.name} achète ${sq.name} pour ${money(c, sq.price)}.`);
  c.s.phase = "end";
}

function startAuction(c: Ctx, position: number, returnPhase: Phase) {
  const s = c.s;
  const sq = ownable(s, position)!;
  // L'ordre de parole commence par le joueur courant.
  const n = s.players.length;
  const active: PlayerId[] = [];
  for (let i = 0; i < n; i++) {
    const pl = s.players[(s.currentPlayer + i) % n]!;
    if (!pl.bankrupt) active.push(pl.id);
  }
  s.auction = { position, highestBid: 0, highestBidder: null, active, returnPhase };
  s.phase = "auction";
  c.events.push({ type: "auctionStarted", position });
  log(c, `${sq.name} est mise aux enchères.`);
}

function doBid(c: Ctx, p: Player, amount: number) {
  const a = c.s.auction;
  if (!a || c.s.phase !== "auction") fail("Aucune enchère en cours.");
  if (!a.active.includes(p.id)) fail("Vous vous êtes retiré de cette enchère.");
  assertInt(amount, "Montant");
  if (amount <= a.highestBid) fail(`Il faut proposer plus de ${money(c, a.highestBid)}.`);
  if (amount > p.cash) fail("Vous n'avez pas assez d'argent.");
  a.highestBid = amount;
  a.highestBidder = p.id;
  c.events.push({ type: "auctionBid", player: p.id, amount });
  log(c, `${p.name} enchérit : ${money(c, amount)}.`);
  checkAuctionEnd(c);
}

function doPassAuction(c: Ctx, p: Player) {
  const a = c.s.auction;
  if (!a || c.s.phase !== "auction") fail("Aucune enchère en cours.");
  if (!a.active.includes(p.id)) fail("Vous vous êtes déjà retiré.");
  if (a.highestBidder === p.id) fail("Vous êtes le meilleur enchérisseur.");
  a.active = a.active.filter((id) => id !== p.id);
  log(c, `${p.name} se retire de l'enchère.`);
  checkAuctionEnd(c);
}

function checkAuctionEnd(c: Ctx) {
  const s = c.s;
  const a = s.auction;
  if (!a) return;
  const sq = ownable(s, a.position)!;
  const leaderAlone = a.highestBidder !== null && a.active.length === 1 && a.active[0] === a.highestBidder;
  if (!leaderAlone && a.active.length > 0) return;

  let winner: PlayerId | null = null;
  if (leaderAlone) {
    const w = getPlayer(s, a.highestBidder!)!;
    changeCash(c, w, -a.highestBid, `enchère sur ${sq.name}`);
    s.properties[a.position]!.owner = w.id;
    winner = w.id;
    log(c, `${w.name} remporte ${sq.name} pour ${money(c, a.highestBid)}.`);
  } else {
    log(c, `Personne n'a acheté ${sq.name}.`);
  }
  c.events.push({ type: "auctionEnded", position: a.position, winner, amount: winner ? a.highestBid : 0 });
  s.auction = null;
  s.phase = a.returnPhase;
}

// ─────────────────────────────────────────────────────────────
// Constructions et hypothèques
// ─────────────────────────────────────────────────────────────

function doBuild(c: Ctx, p: Player, position: number) {
  const err = buildError(c.s, p.id, position);
  if (err) fail(err);
  const sq = square(c.s, position);
  if (sq.kind !== "street") return;
  const prop = c.s.properties[position]!;
  if (prop.houses === 4) {
    c.s.bank.hotels--;
    c.s.bank.houses += 4;
  } else {
    c.s.bank.houses--;
  }
  prop.houses++;
  changeCash(c, p, -sq.houseCost, "construction");
  c.events.push({ type: "built", player: p.id, position, houses: prop.houses });
  log(c, `${p.name} construit ${prop.houses === 5 ? "un hôtel" : "une maison"} sur ${sq.name}.`);
}

function doSellBuilding(c: Ctx, p: Player, position: number) {
  const err = sellError(c.s, p.id, position);
  if (err) fail(err);
  const sq = square(c.s, position);
  if (sq.kind !== "street") return;
  const prop = c.s.properties[position]!;
  const wasHotel = prop.houses === 5;
  if (wasHotel) {
    c.s.bank.hotels++;
    c.s.bank.houses -= 4;
  } else {
    c.s.bank.houses++;
  }
  prop.houses--;
  const refund = Math.floor(sq.houseCost / 2);
  changeCash(c, p, refund, "vente de construction");
  c.events.push({ type: "sold", player: p.id, position, houses: prop.houses });
  log(c, `${p.name} revend ${wasHotel ? "un hôtel" : "une maison"} de ${sq.name} (${money(c, refund)}).`);
}

function doMortgage(c: Ctx, p: Player, position: number) {
  const err = mortgageError(c.s, p.id, position);
  if (err) fail(err);
  const value = mortgageValue(c.s, position);
  c.s.properties[position]!.mortgaged = true;
  changeCash(c, p, value, "hypothèque");
  c.events.push({ type: "mortgaged", player: p.id, position, mortgaged: true });
  log(c, `${p.name} hypothèque ${square(c.s, position).name} (${money(c, value)}).`);
}

function doUnmortgage(c: Ctx, p: Player, position: number) {
  const err = unmortgageError(c.s, p.id, position);
  if (err) fail(err);
  const cost = unmortgageCost(c.s, position);
  c.s.properties[position]!.mortgaged = false;
  changeCash(c, p, -cost, "levée d'hypothèque");
  c.events.push({ type: "mortgaged", player: p.id, position, mortgaged: false });
  log(c, `${p.name} lève l'hypothèque de ${square(c.s, position).name} (${money(c, cost)}).`);
}

function doResolveMortgage(c: Ctx, p: Player, position: number, unmortgage: boolean) {
  const s = c.s;
  const idx = s.mortgageDecisions.findIndex((d) => d.player === p.id && d.position === position);
  if (idx < 0) fail("Aucune décision en attente pour cette propriété.");
  const name = square(s, position).name;
  if (unmortgage) {
    const cost = unmortgageCost(s, position);
    if (p.cash < cost) fail("Pas assez d'argent pour lever l'hypothèque.");
    s.properties[position]!.mortgaged = false;
    changeCash(c, p, -cost, "levée d'hypothèque");
    c.events.push({ type: "mortgaged", player: p.id, position, mortgaged: false });
    log(c, `${p.name} lève immédiatement l'hypothèque de ${name}.`);
  } else {
    log(c, `${p.name} garde ${name} hypothéquée et paie 10 % d'intérêts.`);
    charge(c, p, null, mortgageInterest(s, position), "intérêts d'hypothèque");
  }
  s.mortgageDecisions.splice(idx, 1);
}

// ─────────────────────────────────────────────────────────────
// Dettes et faillite
// ─────────────────────────────────────────────────────────────

function doPayDebt(c: Ctx, p: Player, debtId: number) {
  const s = c.s;
  const idx = s.debts.findIndex((d) => d.id === debtId);
  const debt = s.debts[idx];
  if (!debt) fail("Dette introuvable.");
  if (debt.debtor !== p.id) fail("Cette dette n'est pas la vôtre.");
  if (p.cash < debt.amount) fail("Pas encore assez d'argent : vendez, hypothéquez ou échangez.");
  const creditor = debt.creditor ? getPlayer(s, debt.creditor) ?? null : null;
  transfer(c, p, creditor && !creditor.bankrupt ? creditor : null, debt.amount, debt.reason, debt.toPot);
  s.debts.splice(idx, 1);
}

function doDeclareBankruptcy(c: Ctx, p: Player) {
  const mine = c.s.debts.filter((d) => d.debtor === p.id);
  if (mine.length === 0) fail("Vous n'avez aucune dette.");
  const toPlayer = mine.find((d) => d.creditor !== null);
  const creditor = toPlayer ? getPlayer(c.s, toPlayer.creditor!) ?? null : null;
  goBankrupt(c, p, creditor && !creditor.bankrupt ? creditor : null);
}

/**
 * Faillite :
 * - les constructions sont revendues à la banque (moitié du prix) ;
 * - envers un joueur : il récupère argent, propriétés (il devra décider pour
 *   les hypothéquées) et cartes « Libéré de prison » ;
 * - envers la banque : les propriétés sont libérées puis mises aux enchères.
 */
function goBankrupt(c: Ctx, p: Player, creditor: Player | null) {
  const s = c.s;

  for (const [key, prop] of Object.entries(s.properties)) {
    if (prop.owner !== p.id || prop.houses === 0) continue;
    const sq = square(s, Number(key));
    if (sq.kind !== "street") continue;
    if (prop.houses === 5) s.bank.hotels++;
    else s.bank.houses += prop.houses;
    changeCash(c, p, Math.floor((prop.houses * sq.houseCost) / 2), "liquidation");
    prop.houses = 0;
  }

  if (creditor) {
    if (p.cash > 0) changeCash(c, creditor, p.cash, `faillite de ${p.name}`);
    for (const [key, prop] of Object.entries(s.properties)) {
      if (prop.owner !== p.id) continue;
      prop.owner = creditor.id;
      if (prop.mortgaged) s.mortgageDecisions.push({ player: creditor.id, position: Number(key) });
    }
    creditor.jailCards.push(...p.jailCards);
  } else {
    for (const [key, prop] of Object.entries(s.properties)) {
      if (prop.owner !== p.id) continue;
      prop.owner = null;
      prop.mortgaged = false;
      s.auctionQueue.push(Number(key));
    }
    for (const deck of p.jailCards) returnJailCard(c, deck);
  }
  if (p.cash !== 0) changeCash(c, p, -p.cash, "faillite");
  p.jailCards = [];
  p.bankrupt = true;
  p.inJail = false;

  s.debts = s.debts.filter((d) => d.debtor !== p.id && d.creditor !== p.id);
  s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
  s.mortgageDecisions = s.mortgageDecisions.filter((d) => d.player !== p.id);
  if (s.auction) {
    s.auction.active = s.auction.active.filter((id) => id !== p.id);
    if (s.auction.highestBidder === p.id) s.auction.highestBidder = null;
  }

  c.events.push({ type: "bankrupt", player: p.id, creditor: creditor?.id ?? null });
  log(c, `💥 ${p.name} fait faillite${creditor ? ` au profit de ${creditor.name}` : ""}.`);

  const alive = activePlayers(s);
  if (alive.length <= 1) {
    endGame(c, alive[0]?.id ?? null, "dernier joueur en lice");
    return;
  }
  if (s.auction) checkAuctionEnd(c);
}

// ─────────────────────────────────────────────────────────────
// Échanges
// ─────────────────────────────────────────────────────────────

function validateSide(c: Ctx, owner: Player, side: TradeSide, label: string) {
  assertInt(side.cash, "Montant");
  assertInt(side.jailCards, "Nombre de cartes");
  if (side.cash > owner.cash) fail(`${label} : pas assez d'argent.`);
  if (side.jailCards > owner.jailCards.length) fail(`${label} : pas assez de cartes « Libéré de prison ».`);
  if (new Set(side.properties).size !== side.properties.length) fail("Propriété en double dans l'échange.");
  for (const pos of side.properties) {
    const prop = c.s.properties[pos];
    if (!prop) fail("Propriété invalide dans l'échange.");
    if (prop.owner !== owner.id) fail(`${label} : ${square(c.s, pos).name} n'appartient pas à ${owner.name}.`);
    if (groupHasBuildings(c.s, pos)) {
      fail(`${square(c.s, pos).name} : vendez d'abord les constructions du groupe.`);
    }
  }
}

function sideIsEmpty(side: TradeSide) {
  return side.cash === 0 && side.jailCards === 0 && side.properties.length === 0;
}

function validateTrade(c: Ctx, from: Player, to: Player, give: TradeSide, take: TradeSide) {
  if (to.bankrupt) fail("Ce joueur a fait faillite.");
  if (from.id === to.id) fail("Impossible d'échanger avec soi-même.");
  if (sideIsEmpty(give) && sideIsEmpty(take)) fail("L'échange est vide.");
  validateSide(c, from, give, from.name);
  validateSide(c, to, take, to.name);
}

function doProposeTrade(c: Ctx, p: Player, toId: PlayerId, give: TradeSide, take: TradeSide) {
  const to = getPlayer(c.s, toId);
  if (!to) fail("Joueur inconnu.");
  validateTrade(c, p, to, give, take);
  if (c.s.trades.filter((t) => t.from === p.id).length >= MAX_OPEN_TRADES_PER_PLAYER) {
    fail("Trop de propositions en attente.");
  }
  const trade: Trade = {
    id: c.s.nextId++,
    from: p.id,
    to: to.id,
    give: { cash: give.cash, properties: [...give.properties], jailCards: give.jailCards },
    take: { cash: take.cash, properties: [...take.properties], jailCards: take.jailCards },
  };
  c.s.trades.push(trade);
  c.events.push({ type: "tradeProposed", trade });
  log(c, `${p.name} propose un échange à ${to.name}.`);
}

function doAcceptTrade(c: Ctx, p: Player, tradeId: number) {
  const s = c.s;
  const idx = s.trades.findIndex((t) => t.id === tradeId);
  const trade = s.trades[idx];
  if (!trade) fail("Échange introuvable.");
  if (trade.to !== p.id) fail("Cet échange ne vous est pas destiné.");
  const from = getPlayer(s, trade.from)!;
  validateTrade(c, from, p, trade.give, trade.take);

  // Chaque receveur de propriété hypothéquée doit pouvoir payer au moins les 10 %.
  const feeFor = (positions: number[]) =>
    positions.filter((pos) => s.properties[pos]!.mortgaged).reduce((sum, pos) => sum + mortgageInterest(s, pos), 0);
  const fromCashAfter = from.cash - trade.give.cash + trade.take.cash;
  const toCashAfter = p.cash - trade.take.cash + trade.give.cash;
  if (fromCashAfter < feeFor(trade.take.properties)) fail(`${from.name} ne pourra pas payer les intérêts d'hypothèque.`);
  if (toCashAfter < feeFor(trade.give.properties)) fail(`${p.name} ne pourra pas payer les intérêts d'hypothèque.`);

  const move = (giver: Player, receiver: Player, side: TradeSide) => {
    if (side.cash > 0) {
      changeCash(c, giver, -side.cash, "échange");
      changeCash(c, receiver, side.cash, "échange");
    }
    for (const pos of side.properties) {
      const prop = s.properties[pos]!;
      prop.owner = receiver.id;
      if (prop.mortgaged) s.mortgageDecisions.push({ player: receiver.id, position: pos });
    }
    receiver.jailCards.push(...giver.jailCards.splice(0, side.jailCards));
  };
  move(from, p, trade.give);
  move(p, from, trade.take);

  s.trades.splice(idx, 1);
  c.events.push({ type: "tradeAccepted", tradeId });
  log(c, `${p.name} accepte l'échange proposé par ${from.name}.`);
}

function doCloseTrade(c: Ctx, p: Player, tradeId: number, how: "reject" | "cancel") {
  const idx = c.s.trades.findIndex((t) => t.id === tradeId);
  const trade = c.s.trades[idx];
  if (!trade) fail("Échange introuvable.");
  if (how === "reject" && trade.to !== p.id) fail("Cet échange ne vous est pas destiné.");
  if (how === "cancel" && trade.from !== p.id) fail("Ce n'est pas votre proposition.");
  c.s.trades.splice(idx, 1);
  c.events.push({ type: "tradeClosed", tradeId });
  log(c, how === "reject" ? `${p.name} refuse l'échange.` : `${p.name} retire sa proposition d'échange.`);
}

// ─────────────────────────────────────────────────────────────
// Fin de tour et fin de partie
// ─────────────────────────────────────────────────────────────

function advanceTurn(c: Ctx) {
  const s = c.s;
  s.extraRoll = false;
  s.doublesCount = 0;
  s.pendingCard = null;

  const n = s.players.length;
  let next = s.currentPlayer;
  for (let i = 1; i <= n; i++) {
    const idx = (s.currentPlayer + i) % n;
    if (!s.players[idx]!.bankrupt) {
      next = idx;
      break;
    }
  }
  if (next <= s.currentPlayer) s.round++;

  if (s.options.maxRounds !== null && s.round > s.options.maxRounds) {
    endByNetWorth(c, "limite de tours atteinte");
    return;
  }
  if (s.options.timeLimitMs !== null && c.now - s.startedAt >= s.options.timeLimitMs) {
    endByNetWorth(c, "temps écoulé");
    return;
  }

  s.currentPlayer = next;
  s.phase = "roll";
  const p = currentPlayer(s);
  c.events.push({ type: "turnStarted", player: p.id });
  log(c, `C'est au tour de ${p.name}.`);
}

function endByNetWorth(c: Ctx, reason: string) {
  let best: Player | null = null;
  let bestWorth = -Infinity;
  for (const p of activePlayers(c.s)) {
    const w = netWorth(c.s, p.id);
    log(c, `${p.name} : patrimoine de ${money(c, w)}.`);
    if (w > bestWorth) {
      best = p;
      bestWorth = w;
    }
  }
  endGame(c, best?.id ?? null, reason);
}

function endGame(c: Ctx, winner: PlayerId | null, reason: string) {
  const s = c.s;
  s.phase = "gameOver";
  s.winner = winner;
  s.endReason = reason;
  s.auction = null;
  s.auctionQueue = [];
  s.trades = [];
  s.debts = [];
  s.mortgageDecisions = [];
  c.events.push({ type: "gameOver", winner, reason });
  log(c, `🏆 Fin de la partie (${reason}). Vainqueur : ${winner ? nameOf(c, winner) : "personne"} !`);
}

/**
 * Remet l'état d'aplomb après chaque action :
 * enchères en file d'attente, double à rejouer, joueur courant en faillite.
 */
function normalize(c: Ctx) {
  const s = c.s;
  if (s.phase === "gameOver") return;

  if (!s.auction && s.auctionQueue.length > 0) {
    const pos = s.auctionQueue.shift()!;
    startAuction(c, pos, s.phase);
    return;
  }

  const cur = currentPlayer(s);
  if (s.phase === "end" && s.extraRoll && !cur.inJail && !cur.bankrupt) {
    s.extraRoll = false;
    s.phase = "roll";
    log(c, `${cur.name} a fait un double : il rejoue.`);
  }

  if (cur.bankrupt && !s.auction && s.debts.length === 0 && s.mortgageDecisions.length === 0) {
    advanceTurn(c);
  }
}
