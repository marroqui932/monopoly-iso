// Décor autour du plateau : la table, la lumière de nuit, l'entrée de caméra.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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
        shadow-mapSize={[1024, 1024]}
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
