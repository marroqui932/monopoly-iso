// Petites scènes 3D low-poly posées sur les cases, selon ce qu'elles représentent.
// Repère local d'une case : x = largeur (±0,45), z = profondeur (+z vers le bord extérieur).

import { useMemo } from "react";
import * as THREE from "three";

export type DecorKind =
  | "house"
  | "flowerHouse"
  | "kebab"
  | "burger"
  | "soda"
  | "woods"
  | "windmill"
  | "marais"
  | "supermarketBlue"
  | "supermarketOrange"
  | "supermarketYellow"
  | "bowling"
  | "cinema"
  | "casino"
  | "hlmTwin"
  | "hlmMix"
  | "hlmBarre"
  | "five"
  | "airportTower"
  | "airport"
  | "rer"
  | "pylon"
  | "pump";

/** Décor de chaque case, par plateau. */
export const DECOR: Record<string, Partial<Record<number, DecorKind>>> = {
  "3ajib": {
    1: "house",
    3: "flowerHouse",
    5: "rer",
    6: "kebab",
    8: "burger",
    9: "soda",
    11: "woods",
    12: "pylon",
    13: "windmill",
    14: "marais",
    15: "rer",
    16: "supermarketBlue",
    18: "supermarketOrange",
    19: "supermarketYellow",
    21: "bowling",
    23: "cinema",
    24: "casino",
    25: "rer",
    26: "hlmTwin",
    27: "hlmMix",
    28: "pump",
    29: "hlmBarre",
    31: "five",
    32: "five",
    34: "five",
    35: "rer",
    37: "airportTower",
    39: "airport",
  },
};

/** Échelle par décor (1,25 par défaut) : les grands décors occupent déjà toute la case. */
export const DECOR_SCALE: Partial<Record<DecorKind, number>> = {
  five: 1.05,
  rer: 1,
  airport: 0.95,
  airportTower: 0.95,
  bowling: 1.15,
};

// ── Matériaux partagés ──────────────────────────────────────

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = color + JSON.stringify(extra);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    matCache.set(key, m);
  }
  return m;
}

const texCache = new Map<string, THREE.CanvasTexture>();
/** Façade avec une grille de fenêtres (quelques-unes allumées). */
function windowsTexture(wall: string, cols: number, rows: number) {
  const key = `${wall}-${cols}-${rows}`;
  const cached = texCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 64, 128);
  const cw = 64 / cols;
  const rh = 128 / rows;
  let seed = cols * 31 + rows * 7;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      seed = (seed * 9301 + 49297) % 233280;
      ctx.fillStyle = seed / 233280 < 0.22 ? "#ffd166" : "#2b3a55";
      ctx.fillRect(x * cw + cw * 0.22, y * rh + rh * 0.25, cw * 0.56, rh * 0.5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function Building({
  w,
  h,
  d,
  wall,
  cols,
  rows,
  roof,
  position,
}: {
  w: number;
  h: number;
  d: number;
  wall: string;
  cols: number;
  rows: number;
  roof?: string;
  position: [number, number, number];
}) {
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ map: windowsTexture(wall, cols, rows), roughness: 0.8 });
    const top = mat(roof ?? "#8d99ae");
    return [side, side, top, top, side, side];
  }, [wall, cols, rows, roof]);
  return (
    <mesh position={[position[0], position[1] + h / 2, position[2]]} material={materials} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

function Box({ size, pos, color, rot, extra }: { size: [number, number, number]; pos: [number, number, number]; color: string; rot?: [number, number, number]; extra?: Partial<THREE.MeshStandardMaterialParameters> }) {
  return (
    <mesh position={pos} rotation={rot} material={mat(color, extra)}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Cyl({ r, h, pos, color, seg = 10, rot, r2 }: { r: number; h: number; pos: [number, number, number]; color: string; seg?: number; rot?: [number, number, number]; r2?: number }) {
  return (
    <mesh position={pos} rotation={rot} material={mat(color)}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
    </mesh>
  );
}

function Ball({ r, pos, color, extra }: { r: number; pos: [number, number, number]; color: string; extra?: Partial<THREE.MeshStandardMaterialParameters> }) {
  return (
    <mesh position={pos} material={mat(color, extra)}>
      <icosahedronGeometry args={[r, 1]} />
    </mesh>
  );
}

/** Toit à deux pans (prisme). */
function Gable({ w, h, d, pos, color }: { w: number; h: number; d: number; pos: [number, number, number]; color: string }) {
  return (
    <mesh position={[pos[0], pos[1] + h / 2, pos[2]]} rotation={[0, 0, 0]} scale={[w, h, d]} material={mat(color)} castShadow>
      <cylinderGeometry args={[0, 0.72, 1, 4, 1]} />
    </mesh>
  );
}

// ── Les décors ──────────────────────────────────────────────

function House({ flowers }: { flowers?: boolean }) {
  return (
    <group>
      <Box size={[0.42, 0.24, 0.32]} pos={[0, 0.12, 0]} color="#f2e8cf" />
      <Gable w={0.62} h={0.18} d={0.46} pos={[0, 0.24, 0]} color="#bc4749" />
      <Box size={[0.09, 0.14, 0.02]} pos={[0, 0.07, 0.165]} color="#6f4518" />
      <Box size={[0.08, 0.07, 0.02]} pos={[-0.13, 0.15, 0.165]} color="#8ecae6" />
      <Box size={[0.08, 0.07, 0.02]} pos={[0.13, 0.15, 0.165]} color="#8ecae6" />
      {flowers &&
        [-0.3, -0.18, 0.18, 0.3].map((x, i) => (
          <group key={x}>
            <Cyl r={0.008} h={0.08} pos={[x, 0.04, 0.24]} color="#386641" seg={4} />
            <Ball r={0.035} pos={[x, 0.09, 0.24]} color={["#ff006e", "#ffbe0b", "#fb5607", "#8338ec"][i]!} />
          </group>
        ))}
    </group>
  );
}

function Restaurant({ awning, children }: { awning: string; children: React.ReactNode }) {
  return (
    <group>
      <Box size={[0.6, 0.26, 0.34]} pos={[0, 0.13, 0]} color="#fefae0" />
      <Box size={[0.6, 0.02, 0.34]} pos={[0, 0.27, 0]} color="#6c757d" />
      {/* Auvent rayé */}
      {[-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map((x, i) => (
        <Box key={x} size={[0.1, 0.02, 0.14]} pos={[x, 0.22, 0.22]} rot={[0.45, 0, 0]} color={i % 2 ? "#ffffff" : awning} />
      ))}
      <Box size={[0.4, 0.12, 0.02]} pos={[0, 0.09, 0.171]} color="#8ecae6" extra={{ roughness: 0.2 }} />
      <group position={[0, 0.28, -0.02]}>{children}</group>
    </group>
  );
}

function Kebab() {
  return (
    <group>
      <Cyl r={0.012} h={0.36} pos={[0, 0.18, 0]} color="#adb5bd" seg={6} />
      <Cyl r={0.06} r2={0.1} h={0.22} pos={[0, 0.16, 0]} color="#a0522d" seg={9} />
      <Cyl r={0.1} h={0.02} pos={[0, 0.04, 0]} color="#adb5bd" seg={10} />
    </group>
  );
}

function Burger() {
  return (
    <group position={[0, 0.02, 0]}>
      <Cyl r={0.13} h={0.04} pos={[0, 0.02, 0]} color="#e9a23b" seg={14} />
      <Cyl r={0.135} h={0.04} pos={[0, 0.06, 0]} color="#5c3317" seg={14} />
      <Cyl r={0.14} h={0.015} pos={[0, 0.085, 0]} color="#ffd60a" seg={4} />
      <Cyl r={0.14} h={0.015} pos={[0, 0.095, 0]} color="#70e000" seg={14} />
      <mesh position={[0, 0.11, 0]} material={mat("#e9a23b")} castShadow scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

function Soda() {
  return (
    <group>
      <Cyl r={0.08} r2={0.1} h={0.26} pos={[0, 0.13, 0]} color="#d62828" seg={12} />
      <Cyl r={0.105} h={0.025} pos={[0, 0.27, 0]} color="#ffffff" seg={12} />
      <Cyl r={0.012} h={0.16} pos={[0.03, 0.34, 0]} color="#ffbe0b" seg={6} rot={[0, 0, -0.25]} />
      <Cyl r={0.101} h={0.05} pos={[0, 0.13, 0]} color="#ffffff" seg={12} />
    </group>
  );
}

function Tree({ pos, s = 1 }: { pos: [number, number, number]; s?: number }) {
  return (
    <group position={pos} scale={s}>
      <Cyl r={0.03} h={0.1} pos={[0, 0.05, 0]} color="#7f5539" seg={6} />
      <mesh position={[0, 0.2, 0]} material={mat("#2d6a4f")} castShadow>
        <coneGeometry args={[0.12, 0.24, 7]} />
      </mesh>
      <mesh position={[0, 0.32, 0]} material={mat("#40916c")} castShadow>
        <coneGeometry args={[0.09, 0.18, 7]} />
      </mesh>
    </group>
  );
}

function Woods() {
  return (
    <group>
      <Tree pos={[-0.25, 0, -0.08]} s={1.1} />
      <Tree pos={[0.05, 0, 0.1]} s={0.9} />
      <Tree pos={[0.27, 0, -0.1]} s={1.2} />
      <Tree pos={[-0.08, 0, -0.18]} s={0.75} />
      {/* Réverbère rose */}
      <Cyl r={0.012} h={0.32} pos={[-0.3, 0.16, 0.2]} color="#343a40" seg={6} />
      <Ball r={0.035} pos={[-0.3, 0.33, 0.2]} color="#ff70a6" extra={{ emissive: "#ff70a6", emissiveIntensity: 0.8 }} />
    </group>
  );
}

function Windmill() {
  return (
    <group>
      <Box size={[0.5, 0.2, 0.3]} pos={[0, 0.1, 0]} color="#c1121f" />
      <Box size={[0.5, 0.04, 0.03]} pos={[0, 0.17, 0.16]} color="#ffd166" extra={{ emissive: "#ffb703", emissiveIntensity: 0.5 }} />
      <Cyl r={0.08} r2={0.06} h={0.26} pos={[0.12, 0.33, -0.02]} color="#9d0208" seg={8} />
      <mesh position={[0.12, 0.51, -0.02]} material={mat("#6a040f")} castShadow>
        <coneGeometry args={[0.1, 0.12, 8]} />
      </mesh>
      <group position={[0.12, 0.4, 0.07]} rotation={[0, 0, 0.4]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} size={[0.03, 0.22, 0.01]} pos={[0, 0, 0]} rot={[0, 0, (i * Math.PI) / 2]} color="#fefae0" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <group key={`b${i}`} rotation={[0, 0, (i * Math.PI) / 2]}>
            <Box size={[0.05, 0.16, 0.008]} pos={[0, 0.13, 0]} color="#e5e5e5" />
          </group>
        ))}
      </group>
    </group>
  );
}

function Marais() {
  const rainbow = ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"];
  return (
    <group>
      <Building w={0.44} h={0.34} d={0.3} wall="#efe6d2" cols={4} rows={5} roof="#5c677d" position={[-0.06, 0, -0.02]} />
      <Box size={[0.4, 0.07, 0.26]} pos={[-0.06, 0.37, -0.02]} color="#5c677d" />
      <Cyl r={0.008} h={0.42} pos={[0.26, 0.21, 0.12]} color="#adb5bd" seg={6} />
      {rainbow.map((c, i) => (
        <Box key={c} size={[0.16, 0.022, 0.006]} pos={[0.35, 0.4 - i * 0.022, 0.12]} color={c} />
      ))}
    </group>
  );
}

function Supermarket({ a, b }: { a: string; b: string }) {
  return (
    <group>
      <Box size={[0.66, 0.2, 0.36]} pos={[0, 0.1, -0.03]} color="#e9ecef" />
      <Box size={[0.66, 0.05, 0.02]} pos={[0, 0.17, 0.16]} color={a} />
      <Box size={[0.66, 0.03, 0.02]} pos={[0, 0.135, 0.16]} color={b} />
      <Box size={[0.3, 0.1, 0.01]} pos={[0, 0.06, 0.155]} color="#8ecae6" extra={{ roughness: 0.2 }} />
      {/* Caddie */}
      <group position={[0.24, 0, 0.26]} rotation={[0, -0.5, 0]}>
        <Box size={[0.12, 0.07, 0.08]} pos={[0, 0.07, 0]} color="#adb5bd" extra={{ metalness: 0.6, roughness: 0.3 }} />
        <Box size={[0.012, 0.06, 0.08]} pos={[-0.065, 0.11, 0]} color="#d62828" />
        {[-0.045, 0.045].map((x) =>
          [-0.03, 0.03].map((z) => <Ball key={`${x}${z}`} r={0.012} pos={[x, 0.015, z]} color="#212529" />),
        )}
      </group>
    </group>
  );
}

function Pin({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <Cyl r={0.025} r2={0.018} h={0.1} pos={[0, 0.05, 0]} color="#ffffff" seg={8} />
      <Cyl r={0.019} h={0.012} pos={[0, 0.075, 0]} color="#d62828" seg={8} />
      <Ball r={0.022} pos={[0, 0.115, 0]} color="#ffffff" />
    </group>
  );
}

function Bowling() {
  return (
    <group>
      <Box size={[0.24, 0.01, 0.62]} pos={[-0.12, 0.005, 0]} color="#dda15e" />
      {[
        [0, -0.22],
        [-0.04, -0.17],
        [0.04, -0.17],
        [-0.08, -0.12],
        [0, -0.12],
        [0.08, -0.12],
      ].map(([x, z]) => (
        <Pin key={`${x}${z}`} pos={[-0.12 + x!, 0.01, z!]} />
      ))}
      <Ball r={0.065} pos={[-0.12, 0.075, 0.18]} color="#3a0ca3" extra={{ roughness: 0.2 }} />
      <Pin pos={[0.24, 0, 0]} />
      <group position={[0.24, 0, 0]} scale={2.6}>
        <Pin pos={[0, 0, 0]} />
      </group>
    </group>
  );
}

function Cinema() {
  return (
    <group>
      <Box size={[0.62, 0.3, 0.36]} pos={[0, 0.15, -0.03]} color="#9b2226" />
      <Box size={[0.64, 0.08, 0.06]} pos={[0, 0.25, 0.17]} color="#ffd166" extra={{ emissive: "#ffb703", emissiveIntensity: 0.6 }} />
      {[-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27].map((x) => (
        <Ball key={x} r={0.012} pos={[x, 0.2, 0.2]} color="#fff3b0" extra={{ emissive: "#fff3b0", emissiveIntensity: 1 }} />
      ))}
      <Box size={[0.16, 0.005, 0.2]} pos={[0, 0.003, 0.25]} color="#c1121f" />
      <Box size={[0.14, 0.13, 0.01]} pos={[0, 0.07, 0.15]} color="#4a4e69" />
      {/* Clap de cinéma */}
      <group position={[0.18, 0.31, -0.05]} rotation={[0, 0, 0.1]}>
        <Box size={[0.16, 0.1, 0.02]} pos={[0, 0.05, 0]} color="#111111" />
        <Box size={[0.17, 0.03, 0.022]} pos={[0.005, 0.12, 0]} rot={[0, 0, -0.25]} color="#f8f9fa" />
      </group>
    </group>
  );
}

function Casino() {
  const pips: [number, number][] = [
    [-0.05, -0.05],
    [0.05, 0.05],
    [0, 0],
  ];
  return (
    <group>
      <Box size={[0.56, 0.24, 0.32]} pos={[0, 0.12, -0.04]} color="#7b2cbf" />
      <Box size={[0.6, 0.05, 0.36]} pos={[0, 0.265, -0.04]} color="#ffd60a" extra={{ metalness: 0.7, roughness: 0.25 }} />
      <Box size={[0.56, 0.04, 0.02]} pos={[0, 0.2, 0.125]} color="#ffd60a" extra={{ emissive: "#ffb703", emissiveIntensity: 0.6 }} />
      {/* Gros dé */}
      <group position={[0.24, 0.07, 0.24]} rotation={[0.2, 0.6, 0]}>
        <Box size={[0.14, 0.14, 0.14]} pos={[0, 0, 0]} color="#d62828" />
        {pips.map(([x, y]) => (
          <Ball key={`${x}${y}`} r={0.014} pos={[x, y, 0.072]} color="#ffffff" />
        ))}
      </group>
      {/* Jetons */}
      {[0, 1, 2, 3].map((i) => (
        <Cyl key={i} r={0.04} h={0.018} pos={[-0.22, 0.01 + i * 0.02, 0.25]} color={i % 2 ? "#ffffff" : "#2a9d8f"} seg={12} />
      ))}
    </group>
  );
}

function Hlm({ variant }: { variant: "twin" | "mix" | "barre" }) {
  const wallA = "#d6ccc2";
  const wallB = "#c9ada7";
  if (variant === "twin") {
    return (
      <group>
        <Building w={0.24} h={0.62} d={0.24} wall={wallA} cols={3} rows={9} position={[-0.17, 0, -0.04]} />
        <Building w={0.22} h={0.46} d={0.22} wall={wallB} cols={3} rows={7} position={[0.18, 0, 0.06]} />
        <Box size={[0.06, 0.03, 0.06]} pos={[-0.17, 0.635, -0.04]} color="#6c757d" />
      </group>
    );
  }
  if (variant === "mix") {
    return (
      <group>
        <Building w={0.24} h={0.55} d={0.24} wall={wallB} cols={3} rows={8} position={[0.2, 0, -0.06]} />
        <Building w={0.5} h={0.26} d={0.18} wall={wallA} cols={6} rows={4} position={[-0.1, 0, 0.12]} />
        <Cyl r={0.04} h={0.12} pos={[0.2, 0.61, -0.06]} color="#adb5bd" seg={8} />
      </group>
    );
  }
  return (
    <group>
      <Building w={0.82} h={0.36} d={0.2} wall={wallA} cols={9} rows={6} position={[0, 0, -0.06]} />
      <Building w={0.2} h={0.5} d={0.2} wall={wallB} cols={3} rows={8} position={[0.3, 0, 0.2]} />
    </group>
  );
}

function Five() {
  return (
    <group>
      <Box size={[0.8, 0.012, 0.52]} pos={[0, 0.006, 0]} color="#52b788" />
      <Box size={[0.012, 0.004, 0.5]} pos={[0, 0.014, 0]} color="#ffffff" />
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat("#ffffff")}>
        <ringGeometry args={[0.07, 0.08, 20]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.36, 0, 0]}>
          <Box size={[0.012, 0.08, 0.012]} pos={[0, 0.04, -0.07]} color="#ffffff" />
          <Box size={[0.012, 0.08, 0.012]} pos={[0, 0.04, 0.07]} color="#ffffff" />
          <Box size={[0.012, 0.012, 0.15]} pos={[0, 0.08, 0]} color="#ffffff" />
        </group>
      ))}
      {/* Grillage de la cage */}
      {[
        [-0.4, -0.26],
        [0.4, -0.26],
        [-0.4, 0.26],
        [0.4, 0.26],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={0.008} h={0.2} pos={[x!, 0.1, z!]} color="#495057" seg={5} />
      ))}
      <Box size={[0.8, 0.004, 0.004]} pos={[0, 0.2, -0.26]} color="#495057" />
      <Box size={[0.8, 0.004, 0.004]} pos={[0, 0.2, 0.26]} color="#495057" />
      <Ball r={0.03} pos={[0.1, 0.03, 0.05]} color="#ffffff" />
    </group>
  );
}

function Plane({ pos, rot = 0, s = 1 }: { pos: [number, number, number]; rot?: number; s?: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]} scale={s}>
      <Cyl r={0.04} r2={0.035} h={0.5} pos={[0, 0.06, 0]} rot={[Math.PI / 2, 0, 0]} color="#f8f9fa" seg={10} />
      <mesh position={[0, 0.06, -0.27]} rotation={[-Math.PI / 2, 0, 0]} material={mat("#f8f9fa")} castShadow>
        <coneGeometry args={[0.035, 0.06, 10]} />
      </mesh>
      <Box size={[0.52, 0.012, 0.1]} pos={[0, 0.05, 0.02]} color="#dee2e6" />
      <Box size={[0.18, 0.01, 0.05]} pos={[0, 0.07, 0.22]} color="#dee2e6" />
      <Box size={[0.012, 0.1, 0.07]} pos={[0, 0.12, 0.22]} color="#1d3557" />
      {[-0.14, 0.14].map((x) => (
        <Cyl key={x} r={0.02} h={0.06} pos={[x, 0.03, 0]} rot={[Math.PI / 2, 0, 0]} color="#adb5bd" seg={8} />
      ))}
    </group>
  );
}

function Airport({ tower }: { tower?: boolean }) {
  return (
    <group>
      <Box size={[0.2, 0.006, 0.8]} pos={[-0.12, 0.003, 0]} color="#495057" />
      {[-0.3, -0.15, 0, 0.15, 0.3].map((z) => (
        <Box key={z} size={[0.015, 0.002, 0.06]} pos={[-0.12, 0.007, z]} color="#ffffff" />
      ))}
      <Plane pos={[-0.1, 0.02, 0.02]} s={1.25} />
      {tower ? (
        <group position={[0.26, 0, -0.1]}>
          <Cyl r={0.04} r2={0.035} h={0.42} pos={[0, 0.21, 0]} color="#e9ecef" seg={8} />
          <Cyl r={0.08} r2={0.09} h={0.08} pos={[0, 0.46, 0]} color="#48cae4" seg={8} />
          <Cyl r={0.095} h={0.02} pos={[0, 0.51, 0]} color="#6c757d" seg={8} />
        </group>
      ) : (
        <Building w={0.24} h={0.16} d={0.34} wall="#e9ecef" cols={4} rows={2} position={[0.26, 0, -0.08]} />
      )}
    </group>
  );
}

function Rer() {
  return (
    <group scale={0.95}>
      <Box size={[0.02, 0.01, 0.84]} pos={[-0.08, 0.005, 0]} color="#6c757d" />
      <Box size={[0.02, 0.01, 0.84]} pos={[0.08, 0.005, 0]} color="#6c757d" />
      <Box size={[0.24, 0.2, 0.56]} pos={[0, 0.13, 0]} color="#f8f9fa" />
      <Box size={[0.245, 0.05, 0.565]} pos={[0, 0.1, 0]} color="#1d4ed8" />
      <Box size={[0.245, 0.015, 0.565]} pos={[0, 0.135, 0]} color="#d62828" />
      <Box size={[0.25, 0.05, 0.4]} pos={[0, 0.19, 0]} color="#2b3a55" />
      <Box size={[0.2, 0.08, 0.01]} pos={[0, 0.17, 0.285]} color="#2b3a55" />
    </group>
  );
}

function Pylon() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} material={mat("#6c757d", { metalness: 0.5 })} castShadow>
        <cylinderGeometry args={[0.02, 0.1, 0.5, 4]} />
      </mesh>
      <Box size={[0.4, 0.015, 0.015]} pos={[0, 0.42, 0]} color="#6c757d" />
      <Box size={[0.3, 0.015, 0.015]} pos={[0, 0.33, 0]} color="#6c757d" />
      <Ball r={0.05} pos={[0.22, 0.12, 0.18]} color="#ffd166" extra={{ emissive: "#ffb703", emissiveIntensity: 0.6 }} />
    </group>
  );
}

function Pump() {
  return (
    <group>
      <Box size={[0.5, 0.025, 0.3]} pos={[0, 0.34, 0]} color="#e63946" />
      <Cyl r={0.015} h={0.34} pos={[-0.22, 0.17, -0.12]} color="#adb5bd" seg={6} />
      <Cyl r={0.015} h={0.34} pos={[0.22, 0.17, -0.12]} color="#adb5bd" seg={6} />
      <Box size={[0.13, 0.24, 0.1]} pos={[0, 0.12, 0]} color="#f1faee" />
      <Box size={[0.13, 0.05, 0.102]} pos={[0, 0.2, 0]} color="#e63946" />
      <Box size={[0.03, 0.12, 0.03]} pos={[0.085, 0.13, 0.03]} color="#212529" />
    </group>
  );
}

export function Decor({ kind }: { kind: DecorKind }) {
  switch (kind) {
    case "house":
      return <House />;
    case "flowerHouse":
      return <House flowers />;
    case "kebab":
      return (
        <Restaurant awning="#e63946">
          <Kebab />
        </Restaurant>
      );
    case "burger":
      return (
        <Restaurant awning="#f77f00">
          <Burger />
        </Restaurant>
      );
    case "soda":
      return (
        <Restaurant awning="#2a9d8f">
          <Soda />
        </Restaurant>
      );
    case "woods":
      return <Woods />;
    case "windmill":
      return <Windmill />;
    case "marais":
      return <Marais />;
    case "supermarketBlue":
      return <Supermarket a="#1d4ed8" b="#d62828" />;
    case "supermarketOrange":
      return <Supermarket a="#1d4ed8" b="#f77f00" />;
    case "supermarketYellow":
      return <Supermarket a="#0b2a6f" b="#ffbe0b" />;
    case "bowling":
      return <Bowling />;
    case "cinema":
      return <Cinema />;
    case "casino":
      return <Casino />;
    case "hlmTwin":
      return <Hlm variant="twin" />;
    case "hlmMix":
      return <Hlm variant="mix" />;
    case "hlmBarre":
      return <Hlm variant="barre" />;
    case "five":
      return <Five />;
    case "airportTower":
      return <Airport tower />;
    case "airport":
      return <Airport />;
    case "rer":
      return <Rer />;
    case "pylon":
      return <Pylon />;
    case "pump":
      return <Pump />;
  }
}
