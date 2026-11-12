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

/** Emplacement d'un pion sur une case (6 places pour 6 joueurs). */
export function pawnSpot(pos: number, slot: number, inJail: boolean): [number, number] {
  const col = (slot % 3) - 1;
  const row = Math.floor(slot / 3);
  if (pos === 10) {
    if (inJail) {
      // Dans la cellule (partie intérieure du coin).
      return [-5.1 + col * 0.36, 5.3 - row * 0.4];
    }
    // « Simple visite » : le long des bords extérieurs.
    const visit: [number, number][] = [
      [-6.15, 6.15], [-5.45, 6.15], [-4.8, 6.15], [-6.15, 5.45], [-6.15, 4.8], [-5.85, 5.85],
    ];
    return visit[slot]!;
  }
  if (cellLayout(pos).corner) {
    return localToBoard(pos, col * 0.5, 0.15 + (row - 0.5) * 0.6);
  }
  return localToBoard(pos, col * 0.28, 0.25 + row * 0.45);
}
