/** Small synthesized sound effects (Web Audio, no audio files needed). */

type Wave = OscillatorType;

let context: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
    enabled = on;
}

export function isSoundEnabled(): boolean {
    return enabled;
}

function audio(): AudioContext | null {
    if (!enabled) return null;
    try {
        if (!context) {
            const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) return null;
            context = new Ctor();
        }
        if (context.state === "suspended") context.resume();
        return context;
    } catch {
        return null;
    }
}

interface ToneOptions {
    at?: number;
    duration?: number;
    type?: Wave;
    gain?: number;
    slideTo?: number;
    attack?: number;
}

function tone(ctx: AudioContext, frequency: number, options: ToneOptions = {}) {
    const start = ctx.currentTime + (options.at || 0);
    const duration = options.duration || 0.15;
    const peak = options.gain || 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(frequency, start);
    if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + (options.attack || 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
}

/** a short filtered noise burst, like a tile touching the table */
function knock(ctx: AudioContext, at = 0, gainValue = 0.25) {
    const start = ctx.currentTime + at;
    const length = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
}

const NOTE = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

export const sfx = {
    pick() {
        const ctx = audio();
        if (!ctx) return;
        tone(ctx, 880, { duration: 0.06, type: "triangle", gain: 0.05, slideTo: 1100 });
    },
    drop() {
        const ctx = audio();
        if (!ctx) return;
        knock(ctx, 0, 0.35);
        tone(ctx, 300, { duration: 0.08, type: "sine", gain: 0.08, slideTo: 220 });
    },
    deny() {
        const ctx = audio();
        if (!ctx) return;
        tone(ctx, 196, { duration: 0.12, type: "square", gain: 0.04 });
        tone(ctx, 156, { at: 0.1, duration: 0.16, type: "square", gain: 0.04 });
    },
    validSet() {
        const ctx = audio();
        if (!ctx) return;
        tone(ctx, NOTE(7), { duration: 0.12, type: "triangle", gain: 0.06 });
        tone(ctx, NOTE(12), { at: 0.07, duration: 0.18, type: "triangle", gain: 0.06 });
    },
    /** the arrangement is invalid */
    fail() {
        const ctx = audio();
        if (!ctx) return;
        tone(ctx, NOTE(-5), { duration: 0.25, type: "sawtooth", gain: 0.05, slideTo: NOTE(-7) });
        tone(ctx, NOTE(-8), { at: 0.22, duration: 0.45, type: "sawtooth", gain: 0.05, slideTo: NOTE(-14) });
    },
    /** valid, but a better solution exists */
    partial() {
        const ctx = audio();
        if (!ctx) return;
        [0, 4, 2].forEach((n, i) => tone(ctx, NOTE(3 + n), { at: i * 0.12, duration: 0.22, type: "triangle", gain: 0.08 }));
    },
    /** optimal solution found */
    success() {
        const ctx = audio();
        if (!ctx) return;
        const notes = [3, 7, 10, 15, 19];
        notes.forEach((n, i) => tone(ctx, NOTE(n), { at: i * 0.08, duration: 0.3, type: "triangle", gain: 0.09 }));
        [15, 19, 22, 27].forEach(n => tone(ctx, NOTE(n), { at: 0.45, duration: 0.9, type: "sine", gain: 0.05, attack: 0.03 }));
        [34, 39, 36, 41].forEach((n, i) => tone(ctx, NOTE(n), { at: 0.5 + i * 0.07, duration: 0.12, type: "sine", gain: 0.025 }));
    },
    deal(count: number) {
        const ctx = audio();
        if (!ctx) return;
        for (let i = 0; i < Math.min(count, 10); i++) knock(ctx, i * 0.045, 0.12);
    },
};
