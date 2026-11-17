// audio.js — every sound is synthesized with WebAudio: no audio files,
// no network. Engine hum, skid, horn, two-tone siren, gunshot, hits,
// pickups, mission stings and a slow ambient pad loop.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    padNodes: null,
    engineNodes: null,
    sirenTimer: 0,
    sirenHigh: false,
    _noiseBuf: null,
  };

  /** Must be called from a user gesture at least once. */
  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // one shared noise buffer for shots, skids and impacts
    const len = audio.ctx.sampleRate;
    audio._noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = audio._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.startPad();
  };

  audio.setMuted = function setMuted(m) {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + delay;
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, delay = 0) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + delay;
    const src = audio.ctx.createBufferSource();
    src.buffer = audio._noiseBuf;
    src.loop = true;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  audio.shot = function shot() {
    noise(0.14, 0.5, 2600);
    tone(160, 0.08, 'square', 0.25, 60);
  };

  audio.hit = function hit() {
    tone(220, 0.1, 'triangle', 0.3, 90);
    noise(0.08, 0.2, 900);
  };

  audio.horn = function horn() {
    tone(370, 0.28, 'sawtooth', 0.16, 370);
    tone(466, 0.28, 'sawtooth', 0.12, 466);
  };

  audio.pickup = function pickup() {
    tone(660, 0.09, 'sine', 0.3, 990);
    tone(990, 0.12, 'sine', 0.25, 1320, 0.07);
  };

  audio.cash = function cash() {
    tone(880, 0.07, 'sine', 0.28, 880);
    tone(1174, 0.1, 'sine', 0.28, 1174, 0.06);
    tone(1568, 0.14, 'sine', 0.22, 1568, 0.12);
  };

  audio.sting = function sting() {
    // mission-complete fanfare: a short rising arpeggio
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, f, i * 0.09));
  };

  audio.fail = function fail() {
    tone(392, 0.25, 'sawtooth', 0.18, 311);
    tone(311, 0.4, 'sawtooth', 0.18, 233, 0.2);
  };

  audio.skid = function skid() {
    noise(0.18, 0.12, 1800);
  };

  audio.crash = function crash() {
    noise(0.3, 0.4, 700);
    tone(90, 0.25, 'sine', 0.4, 40);
  };

  audio.reload = function reload() {
    tone(500, 0.05, 'square', 0.15, 500);
    tone(700, 0.05, 'square', 0.15, 700, 0.12);
  };

  audio.dialogue = function dialogue() {
    tone(587, 0.12, 'sine', 0.22, 587);
    tone(880, 0.16, 'sine', 0.2, 880, 0.1);
  };

  /** Two-tone siren: call every frame while police are near; it flips itself. */
  audio.siren = function siren(dt) {
    if (!audio.ctx || audio.muted) return;
    audio.sirenTimer -= dt;
    if (audio.sirenTimer <= 0) {
      audio.sirenTimer = 0.42;
      audio.sirenHigh = !audio.sirenHigh;
      tone(audio.sirenHigh ? 920 : 700, 0.4, 'sine', 0.07, audio.sirenHigh ? 920 : 700);
    }
  };

  /** Engine hum follows the player's car speed; call every frame. */
  audio.engine = function engine(speed01, on) {
    if (!audio.ctx) return;
    if (!on) {
      if (audio.engineNodes) {
        try { audio.engineNodes.osc.stop(); } catch (e) { /* already stopped */ }
        audio.engineNodes = null;
      }
      return;
    }
    if (!audio.engineNodes) {
      const osc = audio.ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const g = audio.ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(filter);
      filter.connect(g);
      g.connect(audio.master);
      osc.start();
      audio.engineNodes = { osc, g };
    }
    const n = audio.engineNodes;
    n.osc.frequency.value = 55 + speed01 * 130;
    n.g.gain.value = audio.muted ? 0 : 0.04 + speed01 * 0.05;
  };

  /** Slow warm pad loop: two detuned triangles drifting through a chord. */
  audio.startPad = function startPad() {
    if (!audio.ctx || audio.padNodes) return;
    const g = audio.ctx.createGain();
    g.gain.value = 0.035;
    g.connect(audio.master);
    const freqs = [130.81, 164.81, 196.0];
    const oscs = freqs.map((f) => {
      const o = audio.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(g);
      o.start();
      return o;
    });
    audio.padNodes = { oscs, g };
  };

  return audio;
}
