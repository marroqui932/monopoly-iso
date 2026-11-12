import { Text } from "@react-three/drei";
import { useState } from "react";
import type { GameState, Square } from "@monopoly/engine";
import { CELL_H, cellLayout, HALF } from "../layout";
import { useGame } from "../store";
import fontBold from "@fontsource/rubik/files/rubik-latin-700-normal.woff?url";
import fontBlack from "@fontsource/rubik/files/rubik-latin-800-normal.woff?url";
import fontMedium from "@fontsource/rubik/files/rubik-latin-500-normal.woff?url";

export const FONTS = { bold: fontBold, black: fontBlack, medium: fontMedium };

const CELL_COLOR = "#f4efe1";
const CELL_HOVER = "#fff8dc";
const INK = "#2b2b2b";
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export function Board({ game }: { game: GameState }) {
  return (
    <group>
      {/* Socle */}
      <mesh position={[0, -0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[HALF * 2 + 0.6, 0.5, HALF * 2 + 0.6]} />
        <meshStandardMaterial color="#6b4f3a" roughness={0.8} />
      </mesh>
      {/* Centre */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[8.9, 0.02, 8.9]} />
        <meshStandardMaterial color="#cfe8d4" roughness={0.95} />
      </mesh>
      <CenterDecor game={game} />
      {game.theme.squares.map((sq, pos) => (
        <Cell key={pos} pos={pos} sq={sq} game={game} />
      ))}
    </group>
  );
}

function CenterDecor({ game }: { game: GameState }) {
  return (
    <group position={[0, 0.03, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 0.01, 0]} rotation={FLAT}>
        <planeGeometry args={[7.2, 1.5]} />
        <meshStandardMaterial color="#d62828" />
      </mesh>
      <Text font={FONTS.black} fontSize={0.78} position={[0, 0.03, 0]} rotation={FLAT} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.04}>
        MONOPOLY
      </Text>
      <Text font={FONTS.bold} fontSize={0.32} position={[0, 0.03, 1.15]} rotation={FLAT} color="#1d3557" anchorX="center" anchorY="middle">
        entre potes · {game.theme.name}
      </Text>
      {/* Paquets de cartes */}
      <CardPile x={-2.2} z={-2.1} color="#f4a259" label="CHANCE" />
      <CardPile x={2.2} z={-2.1} color="#7fb7e6" label={"CAISSE DE\nCOMMUNAUTÉ"} />
    </group>
  );
}

function CardPile({ x, z, color, label }: { x: number; z: number; color: string; label: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.2, 1.4]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <Text font={FONTS.black} fontSize={0.2} position={[0, 0.21, 0]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle" textAlign="center">
        {label}
      </Text>
    </group>
  );
}

function Cell({ pos, sq, game }: { pos: number; sq: Square; game: GameState }) {
  const layout = cellLayout(pos);
  const [hover, setHover] = useState(false);
  const select = useGame((s) => s.select);
  const selected = useGame((s) => s.selected === pos);
  const prop = game.properties[pos];
  const owner = prop?.owner ? game.players.find((p) => p.id === prop.owner) : undefined;

  return (
    <group position={[layout.x, 0, layout.z]} rotation={[0, layout.rot, 0]}>
      <mesh
        position={[0, CELL_H / 2, 0]}
        receiveShadow
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          select(pos);
        }}
      >
        <boxGeometry args={[layout.width - 0.04, CELL_H, layout.depth - 0.04]} />
        <meshStandardMaterial color={selected ? "#ffe9a8" : hover ? CELL_HOVER : CELL_COLOR} roughness={0.85} />
      </mesh>
      {layout.corner ? <CornerContent sq={sq} /> : <EdgeContent sq={sq} game={game} />}
      {owner && (
        <mesh position={[0, CELL_H + 0.01, 0.9]} castShadow>
          <boxGeometry args={[0.86, 0.04, 0.14]} />
          <meshStandardMaterial color={owner.color} roughness={0.5} />
        </mesh>
      )}
      {prop?.mortgaged && (
        <group>
          <mesh position={[0, CELL_H + 0.02, 0]} rotation={FLAT}>
            <planeGeometry args={[0.94, 1.94]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.35} />
          </mesh>
          <Text font={FONTS.black} fontSize={0.1} position={[0, CELL_H + 0.03, 0.15]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} color="#ffffff" anchorX="center" anchorY="middle">
            HYPOTHÉQUÉ
          </Text>
        </group>
      )}
    </group>
  );
}

const TOP = CELL_H + 0.005;

function Label({ text, z, size = 0.115, color = INK, font = FONTS.bold }: { text: string; z: number; size?: number; color?: string; font?: string }) {
  return (
    <Text
      font={font}
      fontSize={size}
      maxWidth={0.92}
      position={[0, TOP, z]}
      rotation={FLAT}
      color={color}
      anchorX="center"
      anchorY="middle"
      textAlign="center"
      lineHeight={1.05}
    >
      {text}
    </Text>
  );
}

function EdgeContent({ sq, game }: { sq: Square; game: GameState }) {
  const cur = game.theme.currency;
  switch (sq.kind) {
    case "street":
      return (
        <>
          <mesh position={[0, CELL_H + 0.015, -0.75]} castShadow>
            <boxGeometry args={[0.96, 0.03, 0.44]} />
            <meshStandardMaterial color={game.theme.groupColors[sq.group]} roughness={0.6} />
          </mesh>
          <Label text={sq.name.toUpperCase()} z={-0.22} size={0.125} />
          <Label text={`${sq.price} ${cur}`} z={0.7} size={0.15} font={FONTS.medium} />
        </>
      );
    case "railroad":
      return (
        <>
          <Label text={sq.name.toUpperCase()} z={-0.68} size={0.12} />
          <Train />
          <Label text={`${sq.price} ${cur}`} z={0.7} size={0.15} font={FONTS.medium} />
        </>
      );
    case "utility":
      return (
        <>
          <Label text={sq.name.toUpperCase()} z={-0.68} size={0.11} />
          {sq.name.toLowerCase().includes("eau") ? <Drop /> : <Bulb />}
          <Label text={`${sq.price} ${cur}`} z={0.7} size={0.15} font={FONTS.medium} />
        </>
      );
    case "chance":
      return (
        <>
          <Label text="CHANCE" z={-0.7} size={0.15} />
          <Label text="?" z={0.1} size={0.75} color="#e76f51" font={FONTS.black} />
        </>
      );
    case "community":
      return (
        <>
          <Label text={"CAISSE DE\nCOMMUNAUTÉ"} z={-0.68} size={0.11} />
          <Chest />
        </>
      );
    case "tax":
      return (
        <>
          <Label text={sq.name.toUpperCase()} z={-0.6} size={0.12} />
          <Label text={cur} z={0.05} size={0.5} color="#6c757d" font={FONTS.black} />
          <Label text={`Payez ${sq.amount} ${cur}`} z={0.7} size={0.13} font={FONTS.medium} />
        </>
      );
    default:
      return null;
  }
}

function CornerContent({ sq }: { sq: Square }) {
  switch (sq.kind) {
    case "go":
      return (
        <group>
          <Text font={FONTS.black} fontSize={0.36} position={[0, TOP, -0.2]} rotation={FLAT} color="#d62828" anchorX="center" anchorY="middle">
            DÉPART
          </Text>
          <Text font={FONTS.medium} fontSize={0.11} maxWidth={1.5} position={[0, TOP, 0.2]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle" textAlign="center">
            Recevez votre salaire en passant
          </Text>
          <mesh position={[0.1, TOP + 0.02, 0.62]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <coneGeometry args={[0.18, 0.4, 3]} />
            <meshStandardMaterial color="#d62828" />
          </mesh>
          <mesh position={[-0.35, TOP + 0.02, 0.62]} castShadow>
            <boxGeometry args={[0.6, 0.04, 0.12]} />
            <meshStandardMaterial color="#d62828" />
          </mesh>
        </group>
      );
    case "jail":
      return <JailCorner />;
    case "freeParking":
      return (
        <group>
          <Text font={FONTS.black} fontSize={0.26} position={[0, TOP, -0.45]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle" textAlign="center" maxWidth={1.6}>
            PARC GRATUIT
          </Text>
          <Car />
        </group>
      );
    case "goToJail":
      return (
        <group>
          <Text font={FONTS.black} fontSize={0.22} position={[0, TOP, -0.45]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle" textAlign="center" maxWidth={1.6}>
            ALLEZ EN PRISON
          </Text>
          <mesh position={[0, TOP + 0.15, 0.25]} castShadow>
            <cylinderGeometry args={[0.28, 0.32, 0.3, 8]} />
            <meshStandardMaterial color="#1d3557" />
          </mesh>
          <mesh position={[0, TOP + 0.02, 0.38]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.04, 8]} />
            <meshStandardMaterial color="#14213d" />
          </mesh>
          <mesh position={[0, TOP + 0.24, 0.53]} castShadow>
            <boxGeometry args={[0.14, 0.12, 0.03]} />
            <meshStandardMaterial color="#ffd166" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

/** Coin prison : le coin est en repère « bas-gauche » ; la cellule est côté centre. */
function JailCorner() {
  // Groupe tourné de −π/4 dans Cell : on revient à un repère aligné sur le plateau.
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0.4, TOP + 0.01, -0.4]} receiveShadow>
        <boxGeometry args={[1.15, 0.02, 1.15]} />
        <meshStandardMaterial color="#f4a259" />
      </mesh>
      {[-0.1, 0.12, 0.34, 0.56, 0.78].map((x) => (
        <mesh key={x} position={[x + 0.02, TOP + 0.25, 0.17]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
          <meshStandardMaterial color="#495057" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0.4, TOP + 0.5, 0.17]} castShadow>
        <boxGeometry args={[1.0, 0.04, 0.05]} />
        <meshStandardMaterial color="#495057" metalness={0.6} roughness={0.4} />
      </mesh>
      <Text font={FONTS.black} fontSize={0.17} position={[0.4, TOP + 0.04, -0.75]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle">
        PRISON
      </Text>
      <Text font={FONTS.bold} fontSize={0.13} position={[-0.15, TOP, 0.72]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle">
        SIMPLE VISITE
      </Text>
    </group>
  );
}

function Train() {
  return (
    <group position={[0, TOP, 0]} scale={0.9}>
      <mesh position={[0, 0.12, 0.05]} castShadow>
        <boxGeometry args={[0.36, 0.18, 0.5]} />
        <meshStandardMaterial color="#343a40" />
      </mesh>
      <mesh position={[0, 0.2, 0.22]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.18]} />
        <meshStandardMaterial color="#212529" />
      </mesh>
      <mesh position={[0, 0.26, -0.12]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.16, 8]} />
        <meshStandardMaterial color="#212529" />
      </mesh>
      {[-0.12, 0.12, 0.3].map((z) =>
        [-0.2, 0.2].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.05, z - 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 10]} />
            <meshStandardMaterial color="#c1121f" />
          </mesh>
        )),
      )}
    </group>
  );
}

function Bulb() {
  return (
    <group position={[0, TOP, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.14, 8]} />
        <meshStandardMaterial color="#adb5bd" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Drop() {
  return (
    <group position={[0, TOP, 0]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <icosahedronGeometry args={[0.16, 1]} />
        <meshStandardMaterial color="#4cc9f0" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <coneGeometry args={[0.13, 0.26, 10]} />
        <meshStandardMaterial color="#4cc9f0" roughness={0.2} />
      </mesh>
    </group>
  );
}

function Chest() {
  return (
    <group position={[0, TOP, 0.25]}>
      <mesh position={[0, 0.11, 0]} castShadow>
        <boxGeometry args={[0.46, 0.22, 0.32]} />
        <meshStandardMaterial color="#9c6644" />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.46, 8, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#7f5539" />
      </mesh>
      <mesh position={[0, 0.2, 0.165]}>
        <boxGeometry args={[0.08, 0.1, 0.02]} />
        <meshStandardMaterial color="#ffd166" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Car() {
  return (
    <group position={[0, TOP, 0.3]} rotation={[0, -0.4, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.8, 0.16, 0.4]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      <mesh position={[-0.05, 0.26, 0]} castShadow>
        <boxGeometry args={[0.42, 0.14, 0.36]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {[-0.26, 0.26].map((x) =>
        [-0.2, 0.2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
            <meshStandardMaterial color="#212529" />
          </mesh>
        )),
      )}
    </group>
  );
}
