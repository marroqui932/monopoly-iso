import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type { GameState } from "@monopoly/engine";
import { Board } from "./Board";
import { Buildings, Dice, Pawns } from "./Pieces";
import { useGame } from "../store";

const DIST = 30;

/** Position de caméra isométrique pour un quart de tour donné (0 à 3). */
function camPos(quarter: number): [number, number, number] {
  const a = Math.PI / 4 + (quarter * Math.PI) / 2;
  const h = DIST * 0.8165; // cos(35,26°) : vraie vue isométrique
  return [Math.sin(a) * h, DIST * 0.577, Math.cos(a) * h];
}

function useZoom() {
  const compute = () => Math.min(window.innerWidth, window.innerHeight * 1.25) / 19;
  const [zoom, setZoom] = useState(compute);
  useEffect(() => {
    const onResize = () => setZoom(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return zoom;
}

export function Scene({ game, quarter }: { game: GameState; quarter: number }) {
  const zoom = useZoom();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const select = useGame((s) => s.select);

  // Rotation par quarts de tour (boutons de l'interface).
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const [x, y, z] = camPos(quarter);
    c.object.position.set(x, y, z);
    c.target.set(0, 0, 0);
    c.update();
  }, [quarter]);

  return (
    <Canvas shadows dpr={[1, 2]} onPointerMissed={() => select(null)}>
      <color attach="background" args={["#bfe3f2"]} />
      <OrthographicCamera makeDefault position={camPos(0)} zoom={zoom} near={-100} far={200} />
      <OrbitControls
        ref={controls}
        enableDamping
        minZoom={zoom * 0.6}
        maxZoom={zoom * 3}
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
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
