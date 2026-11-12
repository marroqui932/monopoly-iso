import type { ColorGroup, GameState, OwnableSquare, Player, PlayerId, Square } from "./types";

export const BOARD_SIZE = 40;
export const JAIL_POSITION = 10;
export const RAILROAD_BASE_RENT = 25;

export function isOwnable(sq: Square): sq is OwnableSquare {
  return sq.kind === "street" || sq.kind === "railroad" || sq.kind === "utility";
}

export function square(s: GameState, position: number): Square {
  const sq = s.theme.squares[position];
  if (!sq) throw new Error(`Case inconnue : ${position}`);
  return sq;
}

export function ownable(s: GameState, position: number): OwnableSquare | null {
  const sq = square(s, position);
  return isOwnable(sq) ? sq : null;
}

export function getPlayer(s: GameState, id: PlayerId): Player | undefined {
  return s.players.find((p) => p.id === id);
}

export function currentPlayer(s: GameState): Player {
  return s.players[s.currentPlayer]!;
}

export function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.bankrupt);
}

export function groupPositions(s: GameState, group: ColorGroup): number[] {
  const out: number[] = [];
  s.theme.squares.forEach((sq, i) => {
    if (sq.kind === "street" && sq.group === group) out.push(i);
  });
  return out;
}

/** Positions des propriétés du même type (même groupe de couleur, ou toutes les gares, ou toutes les compagnies). */
export function siblings(s: GameState, position: number): number[] {
  const sq = square(s, position);
  if (sq.kind === "street") return groupPositions(s, sq.group);
  const out: number[] = [];
  s.theme.squares.forEach((other, i) => {
    if (other.kind === sq.kind) out.push(i);
  });
  return out;
}

export function ownsGroup(s: GameState, playerId: PlayerId, group: ColorGroup): boolean {
  return groupPositions(s, group).every((pos) => s.properties[pos]?.owner === playerId);
}

export function mortgageValue(s: GameState, position: number): number {
  const sq = ownable(s, position);
  return sq ? Math.floor(sq.price / 2) : 0;
}

/** Intérêt de 10 % (arrondi au supérieur) dû à la levée d'hypothèque. */
export function mortgageInterest(s: GameState, position: number): number {
  return Math.ceil(mortgageValue(s, position) / 10);
}

export function unmortgageCost(s: GameState, position: number): number {
  return mortgageValue(s, position) + mortgageInterest(s, position);
}

/** Le groupe de couleur contient-il au moins une construction ? */
export function groupHasBuildings(s: GameState, position: number): boolean {
  const sq = square(s, position);
  if (sq.kind !== "street") return false;
  return groupPositions(s, sq.group).some((pos) => (s.properties[pos]?.houses ?? 0) > 0);
}

/** Loyer dû en tombant sur la case (0 si libre ou hypothéquée). */
export function rentFor(s: GameState, position: number, diceTotal: number): number {
  const sq = ownable(s, position);
  const prop = s.properties[position];
  if (!sq || !prop || !prop.owner || prop.mortgaged) return 0;
  const owner = prop.owner;
  switch (sq.kind) {
    case "street": {
      if (prop.houses > 0) return sq.rents[prop.houses]!;
      const base = sq.rents[0];
      return ownsGroup(s, owner, sq.group) ? base * 2 : base;
    }
    case "railroad": {
      const n = siblings(s, position).filter((p) => s.properties[p]?.owner === owner).length;
      return RAILROAD_BASE_RENT * 2 ** (n - 1);
    }
    case "utility": {
      const n = siblings(s, position).filter((p) => s.properties[p]?.owner === owner).length;
      return diceTotal * (n >= 2 ? 10 : 4);
    }
  }
}

export function countBuildings(s: GameState, playerId: PlayerId): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const [pos, prop] of Object.entries(s.properties)) {
    if (prop.owner !== playerId) continue;
    void pos;
    if (prop.houses === 5) hotels++;
    else houses += prop.houses;
  }
  return { houses, hotels };
}

/** Valeur totale d'un joueur : argent + propriétés (moitié si hypothéquées) + constructions au prix d'achat. */
export function netWorth(s: GameState, playerId: PlayerId): number {
  const p = getPlayer(s, playerId);
  if (!p || p.bankrupt) return 0;
  let total = p.cash;
  for (const [key, prop] of Object.entries(s.properties)) {
    if (prop.owner !== playerId) continue;
    const pos = Number(key);
    const sq = ownable(s, pos)!;
    total += prop.mortgaged ? mortgageValue(s, pos) : sq.price;
    if (sq.kind === "street") total += prop.houses * sq.houseCost;
  }
  return total;
}

// ── Règles de construction (réutilisées par l'interface) ────

export function buildError(s: GameState, playerId: PlayerId, position: number): string | null {
  const sq = square(s, position);
  const prop = s.properties[position];
  if (sq.kind !== "street" || !prop) return "On ne peut construire que sur un terrain.";
  if (prop.owner !== playerId) return "Ce terrain ne vous appartient pas.";
  if (!ownsGroup(s, playerId, sq.group)) return "Il faut posséder tout le groupe de couleur.";
  const group = groupPositions(s, sq.group);
  if (group.some((pos) => s.properties[pos]!.mortgaged)) return "Un terrain du groupe est hypothéqué.";
  if (prop.houses >= 5) return "Ce terrain a déjà un hôtel.";
  const min = Math.min(...group.map((pos) => s.properties[pos]!.houses));
  if (prop.houses > min) return "Il faut construire uniformément sur le groupe.";
  if (prop.houses === 4 && s.bank.hotels <= 0) return "La banque n'a plus d'hôtel.";
  if (prop.houses < 4 && s.bank.houses <= 0) return "La banque n'a plus de maison.";
  const p = getPlayer(s, playerId)!;
  if (p.cash < sq.houseCost) return "Pas assez d'argent.";
  return null;
}

export function sellError(s: GameState, playerId: PlayerId, position: number): string | null {
  const sq = square(s, position);
  const prop = s.properties[position];
  if (sq.kind !== "street" || !prop) return "Il n'y a rien à vendre ici.";
  if (prop.owner !== playerId) return "Ce terrain ne vous appartient pas.";
  if (prop.houses === 0) return "Aucune construction sur ce terrain.";
  const group = groupPositions(s, sq.group);
  const max = Math.max(...group.map((pos) => s.properties[pos]!.houses));
  if (prop.houses < max) return "Il faut vendre uniformément sur le groupe.";
  if (prop.houses === 5 && s.bank.houses < 4) {
    return "La banque n'a pas 4 maisons pour remplacer l'hôtel.";
  }
  return null;
}

export function mortgageError(s: GameState, playerId: PlayerId, position: number): string | null {
  const prop = s.properties[position];
  if (!prop) return "Cette case ne s'hypothèque pas.";
  if (prop.owner !== playerId) return "Cette propriété ne vous appartient pas.";
  if (prop.mortgaged) return "Déjà hypothéquée.";
  if (groupHasBuildings(s, position)) return "Vendez d'abord les constructions du groupe.";
  return null;
}

export function unmortgageError(s: GameState, playerId: PlayerId, position: number): string | null {
  const prop = s.properties[position];
  if (!prop) return "Cette case ne s'hypothèque pas.";
  if (prop.owner !== playerId) return "Cette propriété ne vous appartient pas.";
  if (!prop.mortgaged) return "Cette propriété n'est pas hypothéquée.";
  if (getPlayer(s, playerId)!.cash < unmortgageCost(s, position)) return "Pas assez d'argent.";
  return null;
}
