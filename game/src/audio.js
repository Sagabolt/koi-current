// All sound is synthesised with WebAudio: plucks, chimes and thuds from oscillators and a
// little filtered noise for the river. No audio files, no network. The context is only made
// after the player's first gesture (unlock), every call is a no-op without one, and nothing
// here ever throws — the screenshot scenes run headless, with no audio at all.

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let ambience = null;
  let muted = false;

  /** Make the context, if the browser allows it; called from the first key or click. */
  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      const length = context.sampleRate;
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    } catch {
      context = null;
      master = null;
    }
  }

  /** One oscillator note with a quick attack and an exponential fade. */
  function tone(freq, duration, type, volume, slideTo, delay) {
    if (context === null || master === null) return;
    const start = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A burst of noise through a low-pass filter: thuds and splashes. */
  function noise(duration, volume, filterFreq, delay) {
    if (context === null || master === null || noiseBuffer === null) return;
    const start = context.currentTime + (delay || 0);
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    setMuted(next) {
      muted = next;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
    },
    click() {
      tone(660, 0.07, 'triangle', 0.18, 520);
    },
    /** A pearl pluck that climbs the scale as the combo grows. */
    pearl(combo) {
      const steps = [0, 3, 5, 7, 10, 12, 15, 17];
      const semitones = steps[Math.min(combo - 1, steps.length - 1)];
      const freq = 523.25 * 2 ** (semitones / 12);
      tone(freq, 0.22, 'sine', 0.32);
      tone(freq * 2, 0.12, 'sine', 0.1);
    },
    firefly() {
      tone(880, 0.3, 'sine', 0.22, 1320);
      tone(1318, 0.34, 'sine', 0.14, 1760, 0.05);
    },
    nearMiss() {
      tone(1174, 0.1, 'triangle', 0.14, 1568);
    },
    hit() {
      noise(0.28, 0.5, 320);
      tone(160, 0.3, 'sine', 0.5, 55);
    },
    levelUp() {
      tone(523.25, 0.14, 'triangle', 0.22);
      tone(659.25, 0.14, 'triangle', 0.22, undefined, 0.09);
      tone(783.99, 0.22, 'triangle', 0.24, undefined, 0.18);
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (let index = 0; index < notes.length; index += 1) {
        tone(notes[index], 0.34, 'triangle', 0.24, undefined, index * 0.12);
      }
      tone(2093, 0.6, 'sine', 0.1, undefined, 0.6);
    },
    heron() {
      tone(220, 0.16, 'sawtooth', 0.1, 110);
    },
    /** Quiet river ambience: looped noise through a low filter, swaying slowly. */
    startAmbience() {
      if (context === null || master === null || noiseBuffer === null || ambience !== null) return;
      try {
        const source = context.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const gain = context.createGain();
        gain.gain.value = 0.05;
        const lfo = context.createOscillator();
        lfo.frequency.value = 0.11;
        const lfoGain = context.createGain();
        lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        lfo.start();
        ambience = { source, lfo };
      } catch {
        ambience = null;
      }
    },
  };
}
