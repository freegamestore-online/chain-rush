/*
 * Chain sounds, made with the Web Audio API so there are no audio files. They are gated on the
 * platform mute setting, and the AudioContext is only created once the player has tried to sound
 * something, which keeps the first pointer-down a user gesture that mobile browsers accept.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** Call from a pointer-down. Resumes a suspended context, since browsers only allow audio after a gesture. */
export function primeAudio(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

/**
 * Pitch of the nth link in a chain. Each link rises two semitones, from C4, so a long chain climbs
 * an audible scale. It tops out after twelve links so it stays in a comfortable range.
 */
export function linkFrequency(link: number): number {
  const steps = Math.min(Math.max(link, 0), 12) * 2;
  return 262 * 2 ** (steps / 12);
}

export function playLinkTone(link: number, enabled: boolean): void {
  playTone(linkFrequency(link), 120, enabled, "triangle");
}

export function playRejectTone(enabled: boolean): void {
  playTone(147, 90, enabled, "square");
}

function playTone(frequency: number, durationMs: number, enabled: boolean, type: OscillatorType): void {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  const end = now + durationMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(end + 0.02);
}
