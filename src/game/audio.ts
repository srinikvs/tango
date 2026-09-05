type Buses = {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
};

let buses: Buses | null = null;
let muted = false;

function getBuses(): Buses | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!buses) {
    const ctx = new AC({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    sfx.gain.value = 0.7;
    master.gain.value = muted ? 0 : 0.8;
    sfx.connect(master);
    master.connect(ctx.destination);
    buses = { ctx, master, sfx };
  }
  return buses;
}

export function unlockAudio() {
  const b = getBuses();
  if (!b) return;
  if (b.ctx.state === "suspended") void b.ctx.resume();
}

export function setMuted(next: boolean) {
  muted = next;
  const b = buses;
  if (!b) return;
  b.master.gain.setTargetAtTime(next ? 0 : 0.8, b.ctx.currentTime, 0.02);
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.05, slide?: number) {
  const b = getBuses();
  if (!b || muted) return;
  const { ctx, sfx } = b;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
  o.connect(g);
  g.connect(sfx);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

export function playPlace(bit: 0 | 1) {
  unlockAudio();
  if (bit === 0) tone(523.25, 0.07, "triangle", 0.035);
  else tone(392.0, 0.08, "sine", 0.04);
}

export function playClear() {
  unlockAudio();
  tone(220, 0.05, "sine", 0.02, 160);
}

export function playError() {
  unlockAudio();
  tone(140, 0.12, "square", 0.03, 90);
}

export function playHint() {
  unlockAudio();
  tone(660, 0.09, "triangle", 0.03);
  setTimeout(() => tone(880, 0.1, "triangle", 0.025), 70);
}

export function playWin() {
  unlockAudio();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    setTimeout(() => tone(f, 0.22, "sine", 0.04), i * 110);
  });
}

export function playUndo() {
  unlockAudio();
  tone(330, 0.06, "sine", 0.02);
}
