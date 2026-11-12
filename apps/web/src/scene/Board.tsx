import { Text } from "@react-three/drei";
import { memo, useEffect, useState } from "react";
import * as THREE from "three";
import { useMedia } from "../media";
import type { GameState, Square } from "@monopoly/engine";
import { CELL_H, cellLayout, HALF, JAIL_CELL } from "../layout";
import { useGame } from "../store";
import { DECOR, DECOR_SCALE, Decor } from "./Decor";
import { useSettings } from "../settings";
import fontBold from "@fontsource/rubik/files/rubik-latin-700-normal.woff?url";
import fontBlack from "@fontsource/rubik/files/rubik-latin-800-normal.woff?url";
import fontMedium from "@fontsource/rubik/files/rubik-latin-500-normal.woff?url";
import fontSign from "@fontsource/bungee/files/bungee-latin-400-normal.woff?url";
import { RoundedBox } from "@react-three/drei";
import { NIGHT } from "./World";

export const FONTS = { bold: fontBold, black: fontBlack, medium: fontMedium, sign: fontSign };

const CELL_COLOR = "#f3ecdc";
const CELL_HOVER = "#fff6dd";
const INK = "#2b2b2b";
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Le plateau ne se redessine que si les propriétés changent (pas à chaque lancer de dés). */
export const Board = memo(BoardImpl, (a, b) => a.game.theme === b.game.theme && boardKey(a.game) === boardKey(b.game));

function boardKey(g: GameState) {
  return `${g.theme.id}|${JSON.stringify(g.properties)}|${g.players.map((p) => p.color).join()}`;
}

function BoardImpl({ game }: { game: GameState }) {
  return (
    <group>
      {/* Socle et cadre doré */}
      <RoundedBox args={[HALF * 2 + 0.9, 0.5, HALF * 2 + 0.9]} radius={0.18} smoothness={3} position={[0, -0.25, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={NIGHT.frame} roughness={0.55} />
      </RoundedBox>
      {[
        [0, HALF + 0.2, HALF * 2 + 0.5, 0.06],
        [0, -HALF - 0.2, HALF * 2 + 0.5, 0.06],
        [HALF + 0.2, 0, 0.06, HALF * 2 + 0.5],
        [-HALF - 0.2, 0, 0.06, HALF * 2 + 0.5],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x!, 0.02, z!]}>
          <boxGeometry args={[w!, 0.04, d!]} />
          <meshStandardMaterial color={NIGHT.gold} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {/* Centre : feutrine bleu nuit */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[8.9, 0.02, 8.9]} />
        <meshStandardMaterial color="#26306a" roughness={0.95} />
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
      {/* Plaque du logo */}
      <RoundedBox args={[7.6, 0.14, 2.5]} radius={0.06} smoothness={3} position={[0, 0.07, 0.15]} castShadow receiveShadow>
        <meshStandardMaterial color="#11143a" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.145, 0.15]} rotation={FLAT}>
        <planeGeometry args={[7.3, 2.2]} />
        <meshStandardMaterial color="#c8102e" roughness={0.5} />
      </mesh>
      <Text
        font={FONTS.sign}
        fontSize={0.92}
        position={[0, 0.16, -0.12]}
        rotation={FLAT}
        color="#fff6e5"
        outlineWidth={0.035}
        outlineColor="#5c0a17"
        anchorX="center"
        anchorY="middle"
      >
        MONOPOLY
      </Text>
      <Text font={FONTS.sign} fontSize={0.36} position={[0, 0.16, 0.85]} rotation={FLAT} anchorX="center" anchorY="middle">
        {game.theme.name}
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </Text>
      <CardPile x={-2.3} z={-2.35} color="#ff8a3d" symbol="?" label="Chance" />
      <CardPile x={2.3} z={-2.35} color="#4aa3ff" symbol="€" label="Caisse de communauté" />
    </group>
  );
}

function CardPile({ x, z, color, symbol, label }: { x: number; z: number; color: string; symbol: string; label: string }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => (
        <RoundedBox
          key={i}
          args={[2.0, 0.05, 1.3]}
          radius={0.025}
          smoothness={2}
          position={[i * 0.02 - 0.03, 0.03 + i * 0.055, -i * 0.015]}
          rotation={[0, (i - 1.5) * 0.04, 0]}
          castShadow
        >
          <meshStandardMaterial color={i === 3 ? color : "#f6f0e2"} roughness={0.6} />
        </RoundedBox>
      ))}
      <Text font={FONTS.black} fontSize={0.66} position={[0.03, 0.26, -0.18]} rotation={FLAT} color="#ffffff" outlineWidth={0.03} outlineColor="#00000055" anchorX="center" anchorY="middle">
        {symbol}
      </Text>
      <Text font={FONTS.bold} fontSize={0.15} position={[0.03, 0.26, 0.38]} rotation={FLAT} color="#ffffff" anchorX="center" anchorY="middle">
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
      {layout.corner ? <CornerContent sq={sq} /> : <EdgeContent sq={sq} game={game} pos={pos} />}
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

const PHOTO_W = 0.84;
const PHOTO_H = 0.6;

/** Votre photo posée sur la case, comme un tirage avec un bord blanc (recadrée au centre). */
function CellPhoto({ url, z }: { url: string; z: number }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (!alive) return;
        t.colorSpace = THREE.SRGBColorSpace;
        const img = t.image as { width: number; height: number };
        const target = PHOTO_W / PHOTO_H;
        const ratio = img.width / img.height;
        if (ratio > target) {
          t.repeat.set(target / ratio, 1);
          t.offset.set((1 - target / ratio) / 2, 0);
        } else {
          t.repeat.set(1, ratio / target);
          t.offset.set(0, (1 - ratio / target) / 2);
        }
        t.anisotropy = 4;
        setTex(t);
      },
      undefined,
      () => console.warn(`[images] impossible de charger ${url}`),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  if (!tex) return null;
  return (
    <group position={[0, TOP + 0.012, z]}>
      <mesh rotation={FLAT} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[PHOTO_W + 0.06, PHOTO_H + 0.06]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.003, 0]}>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
    </group>
  );
}

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

function EdgeContent({ sq, game, pos }: { sq: Square; game: GameState; pos: number }) {
  const cur = game.theme.currency;
  const showDecor = useSettings((s) => s.decor);
  const showPhotos = useSettings((s) => s.photos);
  const photo = useMedia((m) => (showPhotos ? m.squareImages[pos] : undefined));
  const decor = showDecor ? DECOR[game.theme.id]?.[pos] : undefined;
  if ((photo || decor) && (sq.kind === "street" || sq.kind === "railroad" || sq.kind === "utility")) {
    const street = sq.kind === "street";
    return (
      <>
        {street && (
          <mesh position={[0, CELL_H + 0.015, -0.75]} castShadow>
            <boxGeometry args={[0.96, 0.03, 0.44]} />
            <meshStandardMaterial color={game.theme.groupColors[sq.group]} roughness={0.6} />
          </mesh>
        )}
        <Label text={sq.name.toUpperCase()} z={street ? -0.43 : -0.74} size={0.1} />
        {photo ? (
          <CellPhoto url={photo} z={street ? 0.33 : 0.25} />
        ) : (
          <group position={[0, TOP, street ? 0.38 : 0.3]} scale={DECOR_SCALE[decor!] ?? 1.1}>
            <Decor kind={decor!} />
          </group>
        )}
        <Label text={`${sq.price} ${cur}`} z={0.81} size={0.12} font={FONTS.medium} />
      </>
    );
  }
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
          {/total|essence|gaz|station/i.test(sq.name) ? <Pump /> : /eau/i.test(sq.name) ? <Drop /> : <Bulb />}
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

/** Coins : repère diagonal (−z vers le centre). Titre en haut, icône au milieu, pions en bas. */
function CornerContent({ sq }: { sq: Square }) {
  const title = (text: string, size: number, color = INK) => (
    <Text font={FONTS.black} fontSize={size} maxWidth={1.25} position={[0, TOP, -0.68]} rotation={FLAT} color={color} anchorX="center" anchorY="middle" textAlign="center" lineHeight={1}>
      {text}
    </Text>
  );
  switch (sq.kind) {
    case "go":
      return (
        <group>
          {title(sq.name.toUpperCase(), 0.3, "#d62828")}
          <Text font={FONTS.medium} fontSize={0.11} position={[0, TOP, -0.46]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle">
            Recevez votre salaire en passant
          </Text>
          <group position={[0, TOP + 0.02, -0.06]} rotation={[0, Math.PI / 2, 0]}>
            <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <coneGeometry args={[0.13, 0.26, 3]} />
              <meshStandardMaterial color="#d62828" />
            </mesh>
            <mesh position={[0, 0, -0.05]} castShadow>
              <boxGeometry args={[0.1, 0.04, 0.5]} />
              <meshStandardMaterial color="#d62828" />
            </mesh>
          </group>
        </group>
      );
    case "jail":
      return <JailCorner />;
    case "freeParking":
      return (
        <group>
          {title(sq.name.toUpperCase(), 0.22)}
          <group position={[0, 0, -0.2]} scale={0.85}>
            <Car />
          </group>
        </group>
      );
    case "goToJail":
      return (
        <group>
          {title(sq.name.toUpperCase(), 0.2)}
          <group position={[0, TOP, -0.2]}>
            <mesh position={[0, 0.15, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.23, 0.24, 8]} />
              <meshStandardMaterial color="#1d3557" />
            </mesh>
            <mesh position={[0, 0.02, 0.06]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 0.04, 8]} />
              <meshStandardMaterial color="#14213d" />
            </mesh>
            <mesh position={[0, 0.2, 0.2]} castShadow>
              <boxGeometry args={[0.1, 0.09, 0.03]} />
              <meshStandardMaterial color="#ffd166" metalness={0.5} roughness={0.3} />
            </mesh>
          </group>
        </group>
      );
    default:
      return null;
  }
}

/** Coin prison, repère aligné sur le plateau : cellule côté centre (x > −0,3, z < 0,3), « simple visite » autour. */
function JailCorner() {
  const { x0, z1 } = JAIL_CELL;
  const w = 1 - x0;
  const d = z1 + 1;
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[(x0 + 1) / 2, TOP + 0.01, (z1 - 1) / 2]} receiveShadow>
        <boxGeometry args={[w - 0.04, 0.02, d - 0.04]} />
        <meshStandardMaterial color="#f4a259" />
      </mesh>
      {/* Barreaux sur les deux côtés donnant sur la « simple visite » */}
      {Array.from({ length: 7 }, (_, i) => x0 + 0.08 + (i * (w - 0.16)) / 6).map((x) => (
        <mesh key={`h${x}`} position={[x, TOP + 0.2, z1]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.38, 6]} />
          <meshStandardMaterial color="#495057" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => -0.92 + (i * (d - 0.16)) / 6).map((z) => (
        <mesh key={`v${z}`} position={[x0, TOP + 0.2, z]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.38, 6]} />
          <meshStandardMaterial color="#495057" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[(x0 + 1) / 2, TOP + 0.39, z1]} castShadow>
        <boxGeometry args={[w, 0.03, 0.04]} />
        <meshStandardMaterial color="#495057" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[x0, TOP + 0.39, (z1 - 1) / 2]} castShadow>
        <boxGeometry args={[0.04, 0.03, d]} />
        <meshStandardMaterial color="#495057" metalness={0.6} roughness={0.4} />
      </mesh>
      <Text font={FONTS.black} fontSize={0.15} position={[(x0 + 1) / 2, TOP + 0.03, -0.88]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle">
        PRISON
      </Text>
      <Text font={FONTS.bold} fontSize={0.15} position={[0.1, TOP, 0.66]} rotation={FLAT} color={INK} anchorX="center" anchorY="middle">
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

function Pump() {
  return (
    <group position={[0, TOP, 0.05]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.26, 0.4, 0.18]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      <mesh position={[0, 0.3, 0.095]}>
        <boxGeometry args={[0.16, 0.1, 0.01]} />
        <meshStandardMaterial color="#f1faee" />
      </mesh>
      <mesh position={[0.17, 0.25, 0]} castShadow>
        <boxGeometry args={[0.05, 0.22, 0.05]} />
        <meshStandardMaterial color="#212529" />
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
    <group position={[0, TOP, 0]} rotation={[0, -0.4, 0]}>
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
