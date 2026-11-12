// Géométrie du plateau : 13 × 13 unités, coins de 2 × 2, cases de 1 × 2.
//
// Repère local d'une case : largeur sur x, profondeur sur z,
// +z = bord extérieur du plateau, −z = vers le centre.

export const HALF = 6.5;
export const CELL_H = 0.12;

export interface CellLayout {
  x: number;
  z: number;
  /** Rotation autour de y pour passer du repère local au plateau. */
  rot: number;
  corner: boolean;
  width: number;
  depth: number;
}

export function cellLayout(pos: number): CellLayout {
  const side = Math.floor(pos / 10);
  const i = pos % 10;
  if (i === 0) {
    const corners = [
      { x: 5.5, z: 5.5, rot: Math.PI / 4 },
      { x: -5.5, z: 5.5, rot: -Math.PI / 4 },
      { x: -5.5, z: -5.5, rot: (-3 * Math.PI) / 4 },
      { x: 5.5, z: -5.5, rot: (3 * Math.PI) / 4 },
    ];
    return { ...corners[side]!, corner: true, width: 2, depth: 2 };
  }
  switch (side) {
    case 0:
      return { x: 5 - i, z: 5.5, rot: 0, corner: false, width: 1, depth: 2 };
    case 1:
      return { x: -5.5, z: 5 - i, rot: -Math.PI / 2, corner: false, width: 1, depth: 2 };
    case 2:
      return { x: i - 5, z: -5.5, rot: Math.PI, corner: false, width: 1, depth: 2 };
    default:
      return { x: 5.5, z: i - 5, rot: Math.PI / 2, corner: false, width: 1, depth: 2 };
  }
}

/** Passe d'un point local (lx, lz) d'une case aux coordonnées du plateau. */
export function localToBoard(pos: number, lx: number, lz: number): [number, number] {
  const c = cellLayout(pos);
  const rot = c.corner ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][Math.floor(pos / 10)]! : c.rot;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [c.x + lx * cos + lz * sin, c.z - lx * sin + lz * cos];
}

/** Point du repère « diagonal » d'un coin (celui du contenu affiché : −z vers le centre du plateau). */
export function cornerToBoard(pos: number, lx: number, lz: number): [number, number] {
  const c = cellLayout(pos);
  const cos = Math.cos(c.rot);
  const sin = Math.sin(c.rot);
  return [c.x + lx * cos + lz * sin, c.z - lx * sin + lz * cos];
}

/** Prison : repère aligné sur le plateau, x vers le centre, −z vers le centre. */
export const JAIL_CELL = { x0: -0.3, z1: 0.3 }; // la cellule couvre x ∈ [−0,3 ; 1] et z ∈ [−1 ; 0,3]

/** Emplacement d'un pion sur une case (6 places pour 6 joueurs). */
export function pawnSpot(pos: number, slot: number, inJail: boolean): [number, number] {
  const col = (slot % 3) - 1;
  const row = Math.floor(slot / 3);
  if (pos === 10) {
    const c = cellLayout(10);
    if (inJail) {
      // Dans la cellule orange.
      return [c.x + 0.35 + col * 0.33, c.z - 0.38 + row * 0.38];
    }
    // « Simple visite » : bande de gauche, deux colonnes.
    const visit: [number, number][] = [
      [-0.8, -0.72], [-0.5, -0.72], [-0.8, -0.3], [-0.5, -0.3], [-0.8, 0.12], [-0.5, 0.12],
    ];
    const [vx, vz] = visit[slot]!;
    return [c.x + vx, c.z + vz];
  }
  if (cellLayout(pos).corner) {
    // Zone réservée aux pions : côté extérieur du coin, sous le titre et l'icône.
    return cornerToBoard(pos, col * 0.36, row === 0 ? 0.42 : 0.78);
  }
  // Côté centre de la case (le décor occupe le côté extérieur).
  return localToBoard(pos, col * 0.3, -0.48 + row * 0.4);
}
