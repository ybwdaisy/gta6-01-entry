// WebAudio synth only: every sound is generated, no audio files.
// Engine hum, skid, horn, two-tone siren, gunshot, hit, pickup,
// mission sting and a soft ambient pad loop. M mutes.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let padNodes = null;
  let sirenTimer = null;
  let sirenOn = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startPad();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass', when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  function startPad() {
    // Warm two-note pad loop, very quiet, keeps the city feeling alive.
    const freqs = [110, 164.81, 220];
    padNodes = freqs.map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.018;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + f * 0.0002;
      const lg = ctx.createGain(); lg.gain.value = 0.008;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(master);
      o.start(); lfo.start();
      return { o, lfo };
    });
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    gunshot() { noise(0.12, 0.5, 1800, 'highpass'); tone(180, 0.08, 'square', 0.25, 60); },
    hit() { noise(0.08, 0.3, 900); tone(320, 0.06, 'triangle', 0.2, 140); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, null, 0.08); },
    cash() { tone(880, 0.08, 'sine', 0.22); tone(1174, 0.08, 'sine', 0.22, null, 0.07); tone(1568, 0.16, 'sine', 0.22, null, 0.14); },
    sting() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.22, null, i * 0.09));
    },
    fail() { tone(220, 0.3, 'sawtooth', 0.18, 110); tone(165, 0.4, 'sawtooth', 0.18, 82, 0.18); },
    horn() { tone(370, 0.22, 'square', 0.16); tone(466, 0.22, 'square', 0.14); },
    skid() { noise(0.25, 0.12, 2600, 'bandpass'); },
    crash() { noise(0.3, 0.45, 500); tone(90, 0.25, 'sawtooth', 0.3, 40); },
    reload() { tone(500, 0.05, 'square', 0.15); tone(700, 0.05, 'square', 0.15, null, 0.12); },
    empty() { tone(1400, 0.04, 'square', 0.12); },
    busted() { tone(392, 0.2, 'sine', 0.25); tone(311, 0.35, 'sine', 0.25, null, 0.2); },
    setEngine(on, speed01) {
      if (!ctx) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 420;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = on ? 0.045 + speed01 * 0.05 : 0.0;
      }
      if (!on && engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null; engineGain = null;
      }
    },
    setSiren(on) {
      if (!ctx) return;
      if (on && !sirenTimer) {
        sirenOn = false;
        sirenTimer = setInterval(() => {
          if (muted) return;
          sirenOn = !sirenOn;
          tone(sirenOn ? 740 : 590, 0.42, 'sine', 0.05);
        }, 430);
      } else if (!on && sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
  };
}
