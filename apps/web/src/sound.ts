// Sons du jeu, synthétisés à la volée (Web Audio) : aucun fichier à charger.

export type SoundName =
  | "dice"
  | "step"
  | "coinIn"
  | "coinOut"
  | "buy"
  | "card"
  | "jail"
  | "build"
  | "bankrupt"
  | "yourTurn"
  | "trade"
  | "error";

const MUTE_KEY = "monopoly-iso:muet";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Les navigateurs exigent un geste de l'utilisateur avant de jouer du son. */
export function unlockAudio() {
  const a = audio();
  if (a?.state === "suspended") void a.resume();
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio, { capture: true });
  window.addEventListener("keydown", unlockAudio, { capture: true });
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* rien */
  }
}

function tone(a: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(a: AudioContext, t: number, dur: number, vol: number, freq: number) {
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}

/** Joue un son, éventuellement après `delay` secondes. */
export function play(name: SoundName, delay = 0) {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== "running" || !master) return;
  const t = a.currentTime + Math.max(0, delay);
  switch (name) {
    case "dice":
      // Cliquetis des dés qui roulent
      for (let i = 0; i < 9; i++) noise(a, t + i * 0.07 + Math.random() * 0.03, 0.04, 0.5 - i * 0.04, 2500 + Math.random() * 1500);
      break;
    case "step":
      tone(a, t, 520, 0.07, "triangle", 0.12, 380);
      break;
    case "coinIn":
      tone(a, t, 988, 0.08, "square", 0.06);
      tone(a, t + 0.08, 1319, 0.25, "square", 0.06);
      break;
    case "coinOut":
      tone(a, t, 660, 0.1, "triangle", 0.15, 440);
      tone(a, t + 0.1, 440, 0.18, "triangle", 0.12, 300);
      break;
    case "buy":
      [523, 659, 784, 1047].forEach((f, i) => tone(a, t + i * 0.07, f, 0.22, "triangle", 0.14));
      break;
    case "card":
      noise(a, t, 0.12, 0.4, 3000);
      tone(a, t + 0.08, 880, 0.15, "sine", 0.1);
      break;
    case "jail":
      tone(a, t, 196, 0.25, "sawtooth", 0.08);
      tone(a, t + 0.28, 147, 0.5, "sawtooth", 0.08);
      noise(a, t + 0.05, 0.2, 0.3, 400);
      break;
    case "build":
      tone(a, t, 300, 0.08, "square", 0.08, 600);
      noise(a, t, 0.06, 0.3, 1200);
      tone(a, t + 0.09, 800, 0.12, "triangle", 0.1);
      break;
    case "bankrupt":
      [392, 330, 262, 196].forEach((f, i) => tone(a, t + i * 0.18, f, 0.3, "sawtooth", 0.07));
      break;
    case "yourTurn":
      tone(a, t, 784, 0.12, "sine", 0.18);
      tone(a, t + 0.12, 1175, 0.3, "sine", 0.16);
      break;
    case "trade":
      tone(a, t, 660, 0.1, "sine", 0.14);
      tone(a, t + 0.1, 880, 0.1, "sine", 0.14);
      tone(a, t + 0.2, 660, 0.15, "sine", 0.12);
      break;
    case "error":
      tone(a, t, 220, 0.15, "square", 0.05, 180);
      break;
  }
}
