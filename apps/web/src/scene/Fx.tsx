// Rendu 3D des effets (voir fx.ts).

import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FX_LIFE, removeFx, useFx, type Fx } from "../fx";
import { cellLayout } from "../layout";
import { FONTS } from "./Board";

const now = () => performance.now() / 1000;

/** Avancement 0 → 1 de l'effet ; null tant qu'il n'a pas commencé. Supprime l'effet à la fin. */
function useProgress(fx: Fx): React.MutableRefObject<number | null> {
  const k = useRef<number | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    const t = (now() - fx.start) / FX_LIFE[fx.kind];
    k.current = t < 0 ? null : Math.min(1, t);
    if (t >= 1) {
      done.current = true;
      // Retiré au prochain tour de boucle (pas pendant le rendu).
      setTimeout(() => removeFx(fx.id), 0);
    }
    invalidate();
  });
  return k;
}

export function FxLayer() {
  const list = useFx((s) => s.list);
  return (
    <group>
      {list.map((fx) => {
        switch (fx.kind) {
          case "float":
            return <FloatText key={fx.id} fx={fx} />;
          case "coins":
            return <Coins key={fx.id} fx={fx} />;
          case "burst":
            return <Burst key={fx.id} fx={fx} />;
          case "glow":
            return <Glow key={fx.id} fx={fx} />;
          case "cardLift":
            return <CardLift key={fx.id} fx={fx} />;
        }
      })}
    </group>
  );
}

/** « +200 € » / « −150 € » qui s'élève au-dessus du pion. */
function FloatText({ fx }: { fx: Extract<Fx, { kind: "float" }> }) {
  const group = useRef<THREE.Group>(null);
  const text = useRef<THREE.Mesh & { fillOpacity?: number; outlineOpacity?: number }>(null);
  const k = useProgress(fx);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = k.current;
    g.visible = p !== null;
    if (p === null) return;
    const e = 1 - Math.pow(1 - p, 3);
    g.position.set(fx.x, 1.0 + e * 1.3, fx.z);
    const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.5 : p < 0.2 ? 1.1 - ((p - 0.12) / 0.08) * 0.1 : 1;
    g.scale.setScalar(pop);
    const fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    const t = text.current;
    if (t) {
      t.fillOpacity = fade;
      t.outlineOpacity = fade;
    }
  });
  return (
    <group ref={group} visible={false}>
      <Billboard>
        <Text ref={text} font={FONTS.sign} fontSize={0.42} color={fx.color} outlineWidth={0.04} outlineColor="#140f2e" anchorX="center" anchorY="middle">
          {fx.text}
          <meshBasicMaterial toneMapped={false} transparent color={fx.color} />
        </Text>
      </Billboard>
    </group>
  );
}

const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 18);
const coinMat = new THREE.MeshStandardMaterial({ color: "#ffcc4d", metalness: 0.9, roughness: 0.25, emissive: "#7a4a00", emissiveIntensity: 0.6 });

/** Pièces d'or qui volent d'un joueur à l'autre (ou vers la banque). */
function Coins({ fx }: { fx: Extract<Fx, { kind: "coins" }> }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const k = useProgress(fx);
  const seeds = useMemo(() => Array.from({ length: fx.count }, () => ({ spin: 6 + Math.random() * 6, dx: (Math.random() - 0.5) * 0.4, dz: (Math.random() - 0.5) * 0.4 })), [fx.count]);
  useFrame(() => {
    const p = k.current;
    refs.current.forEach((m, i) => {
      if (!m) return;
      if (p === null) {
        m.visible = false;
        return;
      }
      // Chaque pièce part un peu après la précédente.
      const local = Math.min(1, Math.max(0, (p - i * 0.06) / 0.6));
      m.visible = local > 0 && local < 1;
      const s = seeds[i]!;
      const x = fx.from[0] + (fx.to[0] - fx.from[0]) * local + s.dx * Math.sin(local * Math.PI);
      const z = fx.from[1] + (fx.to[1] - fx.from[1]) * local + s.dz * Math.sin(local * Math.PI);
      const y = 0.4 + Math.sin(local * Math.PI) * 1.8;
      m.position.set(x, y, z);
      m.rotation.set(local * s.spin, local * s.spin * 0.7, 0);
    });
  });
  return (
    <group>
      {seeds.map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={coinGeo} material={coinMat} visible={false} castShadow />
      ))}
    </group>
  );
}

/** Éclat : anneau qui s'élargit et étincelles projetées. */
function Burst({ fx }: { fx: Extract<Fx, { kind: "burst" }> }) {
  const ring = useRef<THREE.Mesh>(null);
  const sparks = useRef<(THREE.Mesh | null)[]>([]);
  const k = useProgress(fx);
  const dirs = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
        return { x: Math.cos(a), z: Math.sin(a), up: 2 + Math.random() * 2, speed: 1 + Math.random() * 0.8 };
      }),
    [],
  );
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: fx.color, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }),
    [fx.color],
  );
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: fx.color, transparent: true, toneMapped: false }), [fx.color]);
  useFrame(() => {
    const p = k.current;
    const r = ring.current;
    if (r) {
      r.visible = p !== null;
      if (p !== null) {
        const e = 1 - Math.pow(1 - p, 2);
        r.scale.setScalar(0.2 + e * fx.size * 1.6);
        ringMat.opacity = 1 - p;
      }
    }
    sparkMat.opacity = p === null ? 0 : 1 - p;
    sparks.current.forEach((m, i) => {
      if (!m) return;
      m.visible = p !== null;
      if (p === null) return;
      const d = dirs[i]!;
      const dist = p * d.speed * fx.size;
      m.position.set(fx.x + d.x * dist, 0.2 + d.up * p - 4 * p * p, fx.z + d.z * dist);
      m.scale.setScalar(1 - p * 0.7);
    });
  });
  return (
    <group>
      <mesh ref={ring} position={[fx.x, 0.2, fx.z]} rotation={[-Math.PI / 2, 0, 0]} material={ringMat} visible={false}>
        <ringGeometry args={[0.85, 1, 40]} />
      </mesh>
      {dirs.map((_, i) => (
        <mesh key={i} ref={(el) => (sparks.current[i] = el)} material={sparkMat} visible={false}>
          <octahedronGeometry args={[0.06]} />
        </mesh>
      ))}
    </group>
  );
}

/** Colonne de lumière à la couleur du nouveau propriétaire. */
function Glow({ fx }: { fx: Extract<Fx, { kind: "glow" }> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const k = useProgress(fx);
  const c = cellLayout(fx.pos);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: fx.color, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [fx.color],
  );
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const p = k.current;
    m.visible = p !== null;
    if (p === null) return;
    const rise = Math.min(1, p / 0.25);
    m.scale.set(1, 0.1 + rise * 0.9, 1);
    m.position.y = 0.13 + (m.scale.y * 1.6) / 2;
    mat.opacity = 0.55 * (p < 0.25 ? 1 : 1 - (p - 0.25) / 0.75);
  });
  return (
    <mesh ref={mesh} position={[c.x, 0.9, c.z]} rotation={[0, c.rot, 0]} material={mat} visible={false}>
      <boxGeometry args={[c.width - 0.08, 1.6, c.depth - 0.08]} />
    </mesh>
  );
}

// Position des paquets de cartes au centre du plateau (repère tourné de 45°).
const PILES = {
  chance: new THREE.Vector3(-2.3, 0, -2.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
  community: new THREE.Vector3(2.3, 0, -2.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
};

/** La carte du dessus se soulève et se retourne avant d'apparaître à l'écran. */
function CardLift({ fx }: { fx: Extract<Fx, { kind: "cardLift" }> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const k = useProgress(fx);
  const pile = PILES[fx.deck];
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: fx.deck === "chance" ? "#ff8a3d" : "#4aa3ff", transparent: true, roughness: 0.5 }),
    [fx.deck],
  );
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const p = k.current;
    m.visible = p !== null;
    if (p === null) return;
    const e = 1 - Math.pow(1 - p, 3);
    m.position.set(pile.x, 0.35 + e * 2.2, pile.z);
    m.rotation.set(e * Math.PI, Math.PI / 4, e * 0.4);
    mat.opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
  });
  return (
    <mesh ref={mesh} material={mat} visible={false} castShadow>
      <boxGeometry args={[2.0, 0.05, 1.3]} />
    </mesh>
  );
}
