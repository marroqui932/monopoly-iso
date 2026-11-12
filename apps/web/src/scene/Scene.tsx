import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { createGame, themeById } from "@monopoly/engine";
import type { GameState } from "@monopoly/engine";
import { Board } from "./Board";
import { CameraIntro, NightLights, Table } from "./World";
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
      dpr={[1, 1.25]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onPointerMissed={() => select(null)}
    >
      <RenderBridge />
      <OrthographicCamera key={`cam-${camKey}`} makeDefault position={camPos(quarter, view)} zoom={zoom} near={-100} far={200} />
      <CameraIntro key={`intro-${view}`} targetZoom={zoom} />
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
      <NightLights shadows={shadows} />
      <Table />
      <Board game={game} />
      <Buildings game={game} />
      <Pawns game={game} />
      <Dice />
    </Canvas>
  );
}

/** Décale le cadrage pour que le plateau apparaisse à gauche, à côté du menu. */
function ShiftView({ ratio }: { ratio: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    if (ratio === 0) cam.clearViewOffset();
    else cam.setViewOffset(size.width, size.height, size.width * ratio, 0, size.width, size.height);
    cam.updateProjectionMatrix();
  }, [camera, size, ratio]);
  return null;
}

/** Plateau qui tourne lentement derrière les menus. */
export function MenuScene() {
  const demo = useMemo(() => {
    const g = createGame(
      themeById(undefined),
      [
        { id: "a", name: "A", color: "#e63946", token: "pawn" },
        { id: "b", name: "B", color: "#3a86ff", token: "hat" },
        { id: "c", name: "C", color: "#ffb703", token: "diamond" },
      ],
      {},
      7,
      0,
    );
    // Quelques maisons pour que le plateau ait l'air vivant.
    for (const [pos, owner, houses] of [
      [37, "a", 0], [39, "a", 0], [26, "b", 2], [27, "b", 2], [29, "b", 3], [11, "c", 5], [13, "c", 4], [14, "c", 4],
    ] as const) {
      g.properties[pos]!.owner = owner;
      g.properties[pos]!.houses = houses;
    }
    g.players[1]!.position = 24;
    g.players[2]!.position = 16;
    return g;
  }, []);
  if (NO_3D) return null;
  return (
    <Canvas frameloop="always" dpr={1} gl={{ antialias: true, alpha: true }} shadows={false}>
      <OrthographicCamera makeDefault position={camPos(0, "iso")} zoom={Math.min(window.innerWidth * 0.62, window.innerHeight) / 14} near={-100} far={200} />
      <OrbitControls autoRotate autoRotateSpeed={0.35} enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0, 0]} />
      <ShiftView ratio={window.innerWidth >= 1100 ? 0.2 : 0} />
      <NightLights shadows={false} />
      <Table />
      <Board game={demo} />
      <Buildings game={demo} />
      <Pawns game={demo} />
    </Canvas>
  );
}
