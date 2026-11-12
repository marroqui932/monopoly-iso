import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactElement, type RefObject } from "react";
import * as THREE from "three";
import type { GameState, Player } from "@monopoly/engine";
import { anim, GLIDE_DURATION, HOP_DURATION, nowSec } from "../anim";
import { CELL_H, localToBoard, pawnSpot } from "../layout";

// ── Maisons et hôtels ────────────────────────────────────────

export function Buildings({ game }: { game: GameState }) {
  const items: ReactElement[] = [];
  for (const [key, prop] of Object.entries(game.properties)) {
    const pos = Number(key);
    if (prop.houses === 0) continue;
    if (prop.houses === 5) {
      const [x, z] = localToBoard(pos, 0, -0.75);
      items.push(<Hotel key={pos} x={x} z={z} rot={rotFor(pos)} />);
    } else {
      for (let i = 0; i < prop.houses; i++) {
        const [x, z] = localToBoard(pos, -0.33 + i * 0.22, -0.75);
        items.push(<House key={`${pos}-${i}`} x={x} z={z} rot={rotFor(pos)} />);
      }
    }
  }
  return <group>{items}</group>;
}

function rotFor(pos: number) {
  return [0, -Math.PI / 2, Math.PI, Math.PI / 2][Math.floor(pos / 10)]!;
}

function House({ x, z, rot }: { x: number; z: number; rot: number }) {
  const ref = useRef<THREE.Group>(null);
  usePop(ref);
  return (
    <group ref={ref} position={[x, CELL_H + 0.03, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.17, 0.14, 0.2]} />
        <meshStandardMaterial color="#38b000" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.19, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.15, 0.11, 4]} />
        <meshStandardMaterial color="#2d6a4f" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Hotel({ x, z, rot }: { x: number; z: number; rot: number }) {
  const ref = useRef<THREE.Group>(null);
  usePop(ref);
  return (
    <group ref={ref} position={[x, CELL_H + 0.03, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.7, 0.24, 0.3]} />
        <meshStandardMaterial color="#d00000" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.12, 0.26]} />
        <meshStandardMaterial color="#9d0208" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Petite animation d'apparition. */
function usePop(ref: RefObject<THREE.Group | null>) {
  const born = useRef(nowSec());
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = Math.min(1, (nowSec() - born.current) / 0.35);
    const s = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 6) : 1;
    g.scale.setScalar(Math.max(0.01, s));
  });
}

// ── Pions ────────────────────────────────────────────────────

export function Pawns({ game }: { game: GameState }) {
  return (
    <group>
      {game.players.map((p, slot) => (p.bankrupt ? null : <Pawn key={p.id} player={p} slot={slot} />))}
    </group>
  );
}

function Pawn({ player, slot }: { player: Player; slot: number }) {
  const ref = useRef<THREE.Group>(null);
  const motion = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    start: number;
    duration: number;
    hop: boolean;
  } | null>(null);
  const init = pawnSpot(player.position, slot, player.inJail);
  const playerRef = useRef(player);
  playerRef.current = player;

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = nowSec();
    const pa = anim.pawns.get(player.id);

    if (!motion.current && pa && pa.queue.length > 0 && t >= pa.startAt) {
      const wp = pa.queue.shift()!;
      const [x, z] = pawnSpot(wp.pos, slot, wp.inJail);
      motion.current = {
        from: g.position.clone(),
        to: new THREE.Vector3(x, 0, z),
        start: t,
        duration: wp.hop ? HOP_DURATION : GLIDE_DURATION,
        hop: wp.hop,
      };
    }

    const m = motion.current;
    if (m) {
      const k = Math.min(1, (t - m.start) / m.duration);
      const e = m.hop ? k : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      g.position.lerpVectors(m.from, m.to, e);
      g.position.y = Math.sin(Math.PI * k) * (m.hop ? 0.35 : 1.2);
      if (k >= 1) {
        motion.current = null;
        g.position.y = 0;
        if (pa && pa.queue.length > 0) pa.startAt = t;
      }
      return;
    }

    // Au repos : rejoindre doucement sa place définitive (chargement, faillite d'un voisin…).
    if (!pa || pa.queue.length === 0) {
      const p = playerRef.current;
      const [x, z] = pawnSpot(p.position, slot, p.inJail);
      g.position.x += (x - g.position.x) * 0.15;
      g.position.z += (z - g.position.z) * 0.15;
      g.position.y = 0;
    }
  });

  return (
    <group ref={ref} position={[init[0], 0, init[1]]}>
      <group position={[0, CELL_H, 0]}>
        <TokenMesh token={player.token} color={player.color} />
      </group>
    </group>
  );
}

export function TokenMesh({ token, color }: { token: string; color: string }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 }), [color]);
  switch (token) {
    case "hat":
      return (
        <group>
          <mesh position={[0, 0.02, 0]} material={mat} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.04, 12]} />
          </mesh>
          <mesh position={[0, 0.17, 0]} material={mat} castShadow>
            <cylinderGeometry args={[0.1, 0.11, 0.26, 12]} />
          </mesh>
        </group>
      );
    case "cube":
      return (
        <mesh position={[0, 0.12, 0]} rotation={[0, Math.PI / 4, 0]} material={mat} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
        </mesh>
      );
    case "diamond":
      return (
        <mesh position={[0, 0.2, 0]} scale={[1, 1.4, 1]} material={mat} castShadow>
          <octahedronGeometry args={[0.14]} />
        </mesh>
      );
    case "ring":
      return (
        <mesh position={[0, 0.17, 0]} material={mat} castShadow>
          <torusGeometry args={[0.13, 0.045, 8, 16]} />
        </mesh>
      );
    case "ball":
      return (
        <mesh position={[0, 0.15, 0]} material={mat} castShadow>
          <icosahedronGeometry args={[0.14, 1]} />
        </mesh>
      );
    default:
      return (
        <group>
          <mesh position={[0, 0.12, 0]} material={mat} castShadow>
            <coneGeometry args={[0.13, 0.26, 12]} />
          </mesh>
          <mesh position={[0, 0.28, 0]} material={mat} castShadow>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
        </group>
      );
  }
}

// ── Dés ──────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

function faceTexture(n: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fdfdfd";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = n === 1 ? "#d62828" : "#1b1b1b";
  for (const [x, y] of PIPS[n]!) {
    ctx.beginPath();
    ctx.arc(x * 128, y * 128, n === 1 ? 16 : 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Faces de BoxGeometry : +x, −x, +y, −y, +z, −z
const FACE_VALUES = [3, 4, 1, 6, 2, 5];

/** Orientation qui montre la valeur v sur le dessus. */
function restEuler(v: number): [number, number, number] {
  switch (v) {
    case 1: return [0, 0, 0];
    case 6: return [Math.PI, 0, 0];
    case 2: return [-Math.PI / 2, 0, 0];
    case 5: return [Math.PI / 2, 0, 0];
    case 3: return [0, 0, Math.PI / 2];
    default: return [0, 0, -Math.PI / 2];
  }
}

export function Dice() {
  const materials = useMemo(
    () => FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: faceTexture(v), roughness: 0.4 })),
    [],
  );
  return (
    <group>
      <Die which="a" materials={materials} />
      <Die which="b" materials={materials} />
    </group>
  );
}

const SIZE = 0.5;

function Die({ which, materials }: { which: "a" | "b"; materials: THREE.Material[] }) {
  const ref = useRef<THREE.Mesh>(null);
  // Posés au centre du plateau, sous le titre, côté caméra.
  const restX = which === "a" ? 1.45 : 2.25;
  const restZ = which === "a" ? 2.25 : 1.45;
  const spin = useMemo(() => ({ x: 0, y: 0, z: 0, yaw: 0, id: -1 }), []);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const d = anim.dice;
    if (spin.id !== d.rollId) {
      spin.id = d.rollId;
      spin.x = (2 + Math.floor(Math.random() * 3)) * Math.PI * 2;
      spin.y = (1 + Math.floor(Math.random() * 2)) * Math.PI * 2;
      spin.z = (1 + Math.floor(Math.random() * 3)) * Math.PI * 2;
      spin.yaw = (Math.random() - 0.5) * 0.8;
    }
    const value = which === "a" ? d.a : d.b;
    const [rx, ry, rz] = restEuler(value);
    const k = Math.min(1, Math.max(0, (nowSec() - d.startedAt) / 0.9));
    const left = Math.pow(1 - k, 2);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx + spin.x * left, ry + spin.y * left, rz + spin.z * left));
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin.yaw + Math.PI / 4);
    m.quaternion.copy(yawQ.multiply(q));
    const bounce = Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 1.4;
    m.position.set(restX - (1 - k) * 2.2, SIZE / 2 + 0.03 + bounce, restZ - (1 - k) * 2.2);
  });

  return (
    <mesh ref={ref} material={materials} castShadow position={[restX, SIZE / 2, restZ]}>
      <boxGeometry args={[SIZE, SIZE, SIZE]} />
    </mesh>
  );
}
