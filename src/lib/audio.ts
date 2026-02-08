// ---------------------------------------------------------------------------
//  Scotland Yard – Audio / Sound Effects (Web Audio API, zero assets)
// ---------------------------------------------------------------------------

const WebkitAudioContext = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    const CtxClass = window.AudioContext || WebkitAudioContext;
    if (!CtxClass) throw new Error('AudioContext is not supported in this browser');
    audioCtx = new CtxClass();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  rampDown = true,
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    if (rampDown) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail – audio is nice-to-have
  }
}

function playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', volume = 0.08) {
  freqs.forEach((f) => playTone(f, duration, type, volume));
}

// ──── Public sound effects ────

export const sounds = {
  /** Light click for button presses */
  tap() {
    playTone(800, 0.06, 'sine', 0.08);
  },

  /** Confirming a move */
  confirm() {
    playTone(520, 0.1, 'sine', 0.12);
    setTimeout(() => playTone(780, 0.15, 'sine', 0.12), 80);
  },

  /** Round locked */
  lock() {
    playTone(440, 0.08, 'triangle', 0.1);
    setTimeout(() => playTone(660, 0.08, 'triangle', 0.1), 60);
    setTimeout(() => playTone(880, 0.12, 'triangle', 0.1), 120);
  },

  /** Mr. X reveal round */
  reveal() {
    playChord([523, 659, 784], 0.4, 'sine', 0.1);
  },

  /** Detective captured Mr. X! */
  capture() {
    playChord([523, 659, 784], 0.15, 'triangle', 0.12);
    setTimeout(() => playChord([587, 740, 880], 0.15, 'triangle', 0.12), 150);
    setTimeout(() => playChord([659, 831, 988], 0.4, 'triangle', 0.12), 300);
  },

  /** Mr. X wins (escaped) */
  escape() {
    playTone(440, 0.2, 'sawtooth', 0.06);
    setTimeout(() => playTone(392, 0.2, 'sawtooth', 0.06), 200);
    setTimeout(() => playTone(349, 0.3, 'sawtooth', 0.06), 400);
  },

  /** It's your turn notification */
  turnNotify() {
    playTone(660, 0.12, 'sine', 0.15);
    setTimeout(() => playTone(880, 0.2, 'sine', 0.15), 120);
  },

  /** Error / invalid action */
  error() {
    playTone(200, 0.15, 'square', 0.08);
    setTimeout(() => playTone(160, 0.2, 'square', 0.08), 150);
  },

  /** Player joined the session */
  playerJoined() {
    playTone(600, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(800, 0.15, 'sine', 0.1), 100);
  },

  /** Undo action */
  undo() {
    playTone(600, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(400, 0.15, 'sine', 0.1), 80);
  },
};
