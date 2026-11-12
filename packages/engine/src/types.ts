// ─────────────────────────────────────────────────────────────
// Types du moteur de jeu. Aucun lien avec l'affichage ni le réseau.
// ─────────────────────────────────────────────────────────────

export type PlayerId = string;

// ── Thème (plateau + cartes) ─────────────────────────────────

export type ColorGroup =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue";

export type Square =
  | { kind: "go"; name: string }
  | {
      kind: "street";
      name: string;
      group: ColorGroup;
      price: number;
      /** Loyer nu, 1 maison, 2, 3, 4 maisons, hôtel */
      rents: [number, number, number, number, number, number];
      houseCost: number;
    }
  | { kind: "railroad"; name: string; price: number }
  | { kind: "utility"; name: string; price: number }
  | { kind: "tax"; name: string; amount: number }
  | { kind: "chance"; name: string }
  | { kind: "community"; name: string }
  | { kind: "jail"; name: string }
  | { kind: "freeParking"; name: string }
  | { kind: "goToJail"; name: string };

export type OwnableSquare = Extract<Square, { price: number }>;

export type DeckName = "chance" | "community";

export type CardEffect =
  /** Aller à une case. collectGo : toucher le salaire si on passe par Départ. */
  | { type: "advanceTo"; position: number; collectGo: boolean }
  /** Avancer (positif) ou reculer (négatif) de N cases. */
  | { type: "moveBy"; steps: number }
  | { type: "gain"; amount: number }
  | { type: "pay"; amount: number }
  | { type: "goToJail" }
  | { type: "jailFree" }
  | { type: "repairs"; perHouse: number; perHotel: number }
  /** Chaque autre joueur vous donne amount (ex. anniversaire). */
  | { type: "collectFromEach"; amount: number }
  /** Vous payez amount à chaque autre joueur. */
  | { type: "payEach"; amount: number }
  /** Payer amount OU tirer une carte dans l'autre paquet. */
  | { type: "payOrDraw"; amount: number; deck: DeckName };

export interface Card {
  text: string;
  effect: CardEffect;
}

export interface BoardTheme {
  name: string;
  /** Symbole affiché après les montants, ex. "€" */
  currency: string;
  squares: Square[]; // exactement 40
  groupColors: Record<ColorGroup, string>;
  chance: Card[];
  community: Card[];
}

// ── Options de partie ────────────────────────────────────────

export interface GameOptions {
  startingCash: number;
  salary: number;
  jailFine: number;
  /** Règle maison : taxes et amendes vont au Parc gratuit. Désactivée dans les règles officielles. */
  freeParkingJackpot: boolean;
  /** Nombre de tours de table maximum (null = illimité). */
  maxRounds: number | null;
  /** Durée maximale de la partie en millisecondes (null = illimitée). */
  timeLimitMs: number | null;
  totalHouses: number;
  totalHotels: number;
}

// ── État de la partie ────────────────────────────────────────

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  token: string;
  cash: number;
  position: number;
  inJail: boolean;
  /** Nombre de tentatives ratées pour sortir de prison. */
  jailAttempts: number;
  /** Cartes "Libéré de prison" détenues, par paquet d'origine. */
  jailCards: DeckName[];
  bankrupt: boolean;
}

export interface PropertyState {
  owner: PlayerId | null;
  /** 0 à 4 maisons, 5 = hôtel */
  houses: number;
  mortgaged: boolean;
}

export type Phase =
  /** Le joueur courant doit lancer les dés (ou gérer la prison). */
  | "roll"
  /** Le joueur courant décide d'acheter ou non la case où il est. */
  | "buy"
  /** Enchère en cours. */
  | "auction"
  /** Carte "Payez une amende ou tirez une carte Chance". */
  | "cardChoice"
  /** Le joueur courant peut terminer son tour. */
  | "end"
  | "gameOver";

export interface Debt {
  id: number;
  debtor: PlayerId;
  /** null = la banque */
  creditor: PlayerId | null;
  amount: number;
  reason: string;
  /** Avec la règle maison du Parc gratuit, l'argent va dans la cagnotte. */
  toPot: boolean;
}

export interface Auction {
  position: number;
  highestBid: number;
  highestBidder: PlayerId | null;
  /** Joueurs encore en lice. */
  active: PlayerId[];
  /** Phase à retrouver après l'enchère. */
  returnPhase: Phase;
}

export interface TradeSide {
  cash: number;
  properties: number[];
  jailCards: number;
}

export interface Trade {
  id: number;
  from: PlayerId;
  to: PlayerId;
  /** Ce que `from` donne */
  give: TradeSide;
  /** Ce que `from` demande */
  take: TradeSide;
}

/** Propriété hypothéquée reçue : le nouveau propriétaire doit lever l'hypothèque ou payer 10 %. */
export interface MortgageDecision {
  player: PlayerId;
  position: number;
}

export interface Dice {
  a: number;
  b: number;
}

export interface LogEntry {
  n: number;
  text: string;
}

export interface GameState {
  version: 1;
  theme: BoardTheme;
  options: GameOptions;
  players: Player[];
  /** Indexé par position de case (seulement les cases achetables). */
  properties: Record<number, PropertyState>;
  bank: { houses: number; hotels: number };
  /** Indices des cartes, dans l'ordre de tirage. */
  decks: Record<DeckName, number[]>;
  currentPlayer: number;
  phase: Phase;
  dice: Dice | null;
  doublesCount: number;
  /** Le joueur rejoue après ce tour (double). */
  extraRoll: boolean;
  /** Dernière carte tirée en attente d'un choix. */
  pendingCard: { deck: DeckName; index: number } | null;
  auction: Auction | null;
  /** Propriétés de la banque à mettre aux enchères (après faillite envers la banque). */
  auctionQueue: number[];
  debts: Debt[];
  trades: Trade[];
  mortgageDecisions: MortgageDecision[];
  freeParkingPot: number;
  round: number;
  startedAt: number;
  winner: PlayerId | null;
  endReason: string | null;
  rng: number;
  nextId: number;
  log: LogEntry[];
  logCounter: number;
}

// ── Actions ──────────────────────────────────────────────────

export type Action =
  | { type: "roll" }
  | { type: "buy" }
  | { type: "declineBuy" }
  | { type: "bid"; amount: number }
  | { type: "passAuction" }
  | { type: "payJailFine" }
  | { type: "useJailCard" }
  | { type: "chooseCard"; option: "pay" | "draw" }
  | { type: "build"; position: number }
  | { type: "sellBuilding"; position: number }
  | { type: "mortgage"; position: number }
  | { type: "unmortgage"; position: number }
  | { type: "resolveMortgage"; position: number; unmortgage: boolean }
  | { type: "payDebt"; debtId: number }
  | { type: "declareBankruptcy" }
  | { type: "proposeTrade"; to: PlayerId; give: TradeSide; take: TradeSide }
  | { type: "acceptTrade"; tradeId: number }
  | { type: "rejectTrade"; tradeId: number }
  | { type: "cancelTrade"; tradeId: number }
  | { type: "endTurn" }
  /** Abandon : le joueur quitte la partie (faillite envers la banque). */
  | { type: "forfeit" };

// ── Événements (pour les animations et les sons) ────────────

export type GameEvent =
  | { type: "diceRolled"; player: PlayerId; dice: Dice }
  | { type: "moved"; player: PlayerId; from: number; to: number; steps: number; direct: boolean }
  | { type: "passedGo"; player: PlayerId; amount: number }
  | { type: "sentToJail"; player: PlayerId }
  | { type: "leftJail"; player: PlayerId }
  | { type: "cardDrawn"; player: PlayerId; deck: DeckName; text: string }
  | { type: "cashChanged"; player: PlayerId; delta: number; reason: string }
  /** Paiement d'un joueur à un autre (to) ou à la banque (to = null). */
  | { type: "paid"; from: PlayerId; to: PlayerId | null; amount: number; reason: string }
  | { type: "propertyBought"; player: PlayerId; position: number; price: number }
  | { type: "auctionStarted"; position: number }
  | { type: "auctionBid"; player: PlayerId; amount: number }
  | { type: "auctionEnded"; position: number; winner: PlayerId | null; amount: number }
  | { type: "built"; player: PlayerId; position: number; houses: number }
  | { type: "sold"; player: PlayerId; position: number; houses: number }
  | { type: "mortgaged"; player: PlayerId; position: number; mortgaged: boolean }
  | { type: "tradeProposed"; trade: Trade }
  | { type: "tradeAccepted"; tradeId: number }
  | { type: "tradeClosed"; tradeId: number }
  | { type: "debtCreated"; debt: Debt }
  | { type: "bankrupt"; player: PlayerId; creditor: PlayerId | null }
  | { type: "turnStarted"; player: PlayerId }
  | { type: "gameOver"; winner: PlayerId | null; reason: string };

export interface ActionContext {
  /** Heure actuelle (ms). Fournie par l'hôte pour la limite de temps. */
  now: number;
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

export interface NewPlayer {
  id: PlayerId;
  name: string;
  color: string;
  token: string;
}
