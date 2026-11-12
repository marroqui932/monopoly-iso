import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useState } from "react";
import type { GameState } from "@monopoly/engine";
import { Board } from "./Board";
import { Buildings, Dice, Pawns } from "./Pieces";
import { useGame } from "../store";
import { setInvalidate } from "../anim";
import { useSettings } from "../settings";

const DIST = 30;

/** Position de caméra pour un quart de tour donné (0 à 3). */
function camPos(quarter: number, view: "iso" | "top"): [number, number, number] {
  if (view === "top") {
    // Vue de dessus : la case Départ en bas à droite, comme sur un vrai plateau.
    const a = (quarter * Math.PI) / 2;
    return [Math.sin(a) * 0.01, DIST, Math.cos(a) * 0.01];
  }
  const a = Math.PI / 4 + (quarter * Math.PI) / 2;
  const h = DIST * 0.8165; // cos(35,26°) : vraie vue isométrique
  return [Math.sin(a) * h, DIST * 0.577, Math.cos(a) * h];
}

function useZoom(view: "iso" | "top") {
  const compute = () =>
    view === "top" ? Math.min(window.innerWidth, window.innerHeight) / 16.5 : Math.min(window.innerWidth, window.innerHeight * 1.25) / 19;
  const [zoom, setZoom] = useState(compute);
  useEffect(() => {
    setZoom(compute());
    const onResize = () => setZoom(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  return zoom;
}

/** Permet au reste de l'appli de demander une nouvelle image (rendu à la demande). */
function RenderBridge() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setInvalidate(invalidate);
    return () => setInvalidate(null);
  }, [invalidate]);
  return null;
}

/** `?lite` : graphismes allégés (sans ombres) pour les machines modestes. */
/** `?sans3d` : aucun rendu 3D (tests automatiques de l'interface et du réseau). */
const NO_3D = new URLSearchParams(window.location.search).has("sans3d");

export function Scene({ game, quarter }: { game: GameState; quarter: number }) {
  const view = useSettings((s) => s.view);
  const shadows = useSettings((s) => s.shadows);
  const zoom = useZoom(view);
  const select = useGame((s) => s.select);
  const top = view === "top";
  // Changer de vue ou tourner le plateau recrée la caméra à la bonne place.
  const camKey = `${view}-${quarter}-${zoom}`;

  if (NO_3D) return <div style={{ position: "absolute", inset: 0 }} onClick={() => select(null)} />;

  return (
    <Canvas
      key={shadows ? "ombres" : "sans-ombres"}
      frameloop="demand"
      shadows={shadows}
      dpr={shadows ? [1, 1.5] : 1}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => select(null)}
    >
      <RenderBridge />
      <color attach="background" args={["#bfe3f2"]} />
      <OrthographicCamera key={`cam-${camKey}`} makeDefault position={camPos(quarter, view)} zoom={zoom} near={-100} far={200} />
      <OrbitControls
        key={`ctl-${camKey}`}
        enableDamping
        enableRotate={!top}
        minZoom={zoom * 0.6}
        maxZoom={zoom * 3}
        minPolarAngle={top ? 0 : 0.35}
        maxPolarAngle={top ? 0.001 : 1.2}
        target={[0, 0, 0]}
      />
      <hemisphereLight args={["#ffffff", "#8d7b68", 1.1]} />
      <directionalLight
        position={[8, 16, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      <Board game={game} />
      <Buildings game={game} />
      <Pawns game={game} />
      <Dice />
    </Canvas>
  );
}
