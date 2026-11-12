// Décor autour du plateau : la table, et la ville de nuit (tours aux fenêtres allumées).

import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export const NIGHT = {
  fog: "#1d1b45",
  table: "#3a2618",
  frame: "#1a1f4e",
  gold: "#d9a640",
  sodium: "#ffb347",
  neon: "#ff4f8b",
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Façade de nuit : texture de couleur + carte d'émission (fenêtres allumées). */
function nightFacade(seed: number) {
  const r = rng(seed);
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1b1d38";
  ctx.fillRect(0, 0, 64, 256);
  const cols = 5;
  const rows = 22;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = r();
      ctx.fillStyle = v < 0.28 ? (v < 0.06 ? "#9fd3ff" : "#ffcf7a") : "#0c0d1c";
      ctx.fillRect(x * 12.8 + 3, y * 11.6 + 3, 7, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** La ville tout autour : des tours et des barres, comme vues depuis une table près d'une fenêtre. */
export const Skyline = memo(function Skyline() {
  const { towers, towerMats } = useMemo(() => {
    const facades = [11, 23, 37].map(nightFacade);
    const materials = facades.map(
      (tex) =>
        new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: new THREE.Color("#ffffff"),
          emissiveIntensity: 1.1,
          roughness: 0.9,
        }),
    );
    const roof = new THREE.MeshStandardMaterial({ color: "#14152b", roughness: 1 });
    const r = rng(7);
    const towers: { x: number; z: number; w: number; d: number; h: number; m: number; rot: number }[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + r() * 0.05;
      const dist = 24 + r() * 14;
      const barre = r() < 0.3;
      towers.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        w: barre ? 6 + r() * 4 : 2 + r() * 1.5,
        d: 2 + r() * 1.2,
        h: barre ? 4 + r() * 3 : 7 + r() * 11,
        m: Math.floor(r() * 3),
        rot: -a + Math.PI / 2,
      });
    }
    const towerMats = towers.map((t) => {
      const side = materials[t.m]!.clone();
      side.map = side.map!.clone();
      side.map.repeat.set(Math.max(1, Math.round(t.w / 2.2)), Math.max(1, t.h / 9));
      side.map.needsUpdate = true;
      side.emissiveMap = side.map;
      return [side, side, roof, roof, side, side];
    });
    return { towers, towerMats };
  }, []);

  return (
    <group position={[0, -0.5, 0]}>
      {towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]} rotation={[0, t.rot, 0]} material={towerMats[i]}>
          <boxGeometry args={[t.w, t.h, t.d]} />
        </mesh>
      ))}
    </group>
  );
});

function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = NIGHT.table;
  ctx.fillRect(0, 0, 512, 512);
  const r = rng(3);
  for (let i = 0; i < 140; i++) {
    const y = r() * 512;
    ctx.strokeStyle = `rgba(${r() < 0.5 ? "20,10,5" : "90,60,40"},${0.15 + r() * 0.25})`;
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/** La table sur laquelle est posé le plateau. */
export function Table() {
  const tex = useMemo(woodTexture, []);
  return (
    <mesh position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[22, 64]} />
      <meshStandardMaterial map={tex} roughness={0.7} />
    </mesh>
  );
}

export function NightLights({ shadows }: { shadows: boolean }) {
  return (
    <>
      <fog attach="fog" args={[NIGHT.fog, 42, 85]} />
      <hemisphereLight args={["#b9c2ff", "#2c2640", 1.05]} />
      <directionalLight
        position={[7, 18, 10]}
        intensity={2.1}
        color="#ffe2b8"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-bias={-0.0005}
      />
      {/* Contre-jour bleu nuit et lueur orangée de réverbère */}
      <directionalLight position={[-12, 8, -10]} intensity={0.7} color="#6f7dff" />
      <pointLight position={[-10, 6, 10]} intensity={0.5} decay={0} color={NIGHT.sodium} />
    </>
  );
}

/** Entrée en scène : la caméra arrive en zoomant doucement sur le plateau. */
export function CameraIntro({ targetZoom }: { targetZoom: number }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  const start = useRef<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    start.current = null;
    done.current = false;
    invalidate();
  }, [invalidate]);
  useFrame(() => {
    if (done.current) return;
    const now = performance.now() / 1000;
    if (start.current === null) start.current = now;
    const k = Math.min(1, (now - start.current) / 1.6);
    const e = 1 - Math.pow(1 - k, 3);
    camera.zoom = targetZoom * (0.45 + 0.55 * e);
    camera.updateProjectionMatrix();
    if (k < 1) invalidate();
    else done.current = true;
  });
  return null;
}
