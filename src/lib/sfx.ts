// Tiny synthesized sound kit (WebAudio, no assets). Every sound is a few
// enveloped oscillators; the context is created lazily on the first sound,
// which always follows a user gesture.

const LS_MUTED = 'waxle-sound-muted';

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
let muted = (() => {
    try { return localStorage.getItem(LS_MUTED) === '1'; } catch { return false; }
})();

function audio(): AudioContext | null {
    if (muted || typeof window === 'undefined') return null;
    if (!ctx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
        if (!C) return null;
        try { ctx = new C(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    return ctx;
}

type ToneOpts = {
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    slideTo?: number;
};

function tone(freq: number, { dur = 0.12, type = 'sine', gain = 0.07, delay = 0, slideTo }: ToneOpts = {}) {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    // Fast attack, exponential release: clicky-soft, never harsh
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

// Major pentatonic from C5: any run of selections sounds musical
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const note = (i: number) => PENTA[Math.min(i, PENTA.length - 1)];

export const sfx = {
    get muted() {
        return muted;
    },
    setMuted(m: boolean) {
        muted = m;
        try { localStorage.setItem(LS_MUTED, m ? '1' : '0'); } catch { /* non-fatal */ }
    },
    // Each tile in a path rises one step up the scale
    select(index: number) {
        tone(note(index), { dur: 0.09, type: 'triangle', gain: 0.06 });
    },
    deselect() {
        tone(392, { dur: 0.07, type: 'triangle', gain: 0.04 });
    },
    // A word lights up: a quiet sparkle so the player hears it's real
    valid() {
        tone(1567.98, { dur: 0.08, type: 'sine', gain: 0.03 });
    },
    // Submitted word: an arpeggio as long as the word, capped
    word(len: number, gems: number) {
        const steps = Math.min(len, 7);
        for (let i = 0; i < steps; i++) {
            tone(note(i + 1), { dur: 0.16, type: 'triangle', gain: 0.055, delay: i * 0.045 });
        }
        for (let g = 0; g < gems; g++) {
            tone(2093, { dur: 0.25, type: 'sine', gain: 0.04, delay: steps * 0.045 + g * 0.08 });
            tone(2637, { dur: 0.25, type: 'sine', gain: 0.03, delay: steps * 0.045 + g * 0.08 + 0.04 });
        }
    },
    spinTick() {
        tone(1400, { dur: 0.025, type: 'square', gain: 0.015 });
    },
    spinLock(free: boolean) {
        tone(660, { dur: 0.08, type: 'triangle', gain: 0.05 });
        tone(free ? 990 : 523.25, { dur: 0.1, type: 'triangle', gain: 0.05, delay: 0.06 });
    },
    // The wave lands: a soft low thump
    land(delay = 0) {
        tone(140, { dur: 0.18, type: 'sine', gain: 0.09, delay, slideTo: 70 });
    },
    pass() {
        tone(330, { dur: 0.14, type: 'sine', gain: 0.05, slideTo: 247 });
    },
    undo() {
        tone(880, { dur: 0.1, type: 'triangle', gain: 0.04, slideTo: 587 });
    },
    danger() {
        tone(196, { dur: 0.22, type: 'sawtooth', gain: 0.025 });
        tone(185, { dur: 0.22, type: 'sawtooth', gain: 0.025, delay: 0.18 });
    },
    gameOver() {
        [523.25, 440, 349.23, 261.63].forEach((f, i) =>
            tone(f, { dur: 0.32, type: 'triangle', gain: 0.06, delay: i * 0.16 })
        );
    },
};
