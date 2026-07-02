/* RoadAhead — synthesized sound effects (WebAudio, no assets) */
window.RA = window.RA || {};

RA.audio = {
  ctx: null,
  muted: localStorage.getItem('ra_muted') === '1',
  _siren: null,
  _bell: null,

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('ra_muted', this.muted ? '1' : '0');
    if (this.muted) { this.sirenStop(); this.bellStop(); }
    return this.muted;
  },

  tone(freq, dur = 0.15, type = 'square', vol = 0.08, delay = 0) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(dur = 0.3, vol = 0.2) {
    if (this.muted || !this.ensure()) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  },

  click()   { this.tone(700, 0.05, 'square', 0.05); },
  ding()    { this.tone(880, 0.1, 'sine', 0.09); this.tone(1320, 0.18, 'sine', 0.07, 0.08); },
  win()     { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, i * 0.09)); },
  bad()     { this.tone(220, 0.25, 'sawtooth', 0.1); this.tone(180, 0.3, 'sawtooth', 0.1, 0.18); },
  wrong()   { this.tone(200, 0.2, 'square', 0.08); },
  horn()    { this.tone(440, 0.28, 'square', 0.12); this.tone(554, 0.28, 'square', 0.12); },
  crash()   { this.noise(0.4, 0.3); this.tone(90, 0.35, 'sawtooth', 0.15); },
  shutter() { this.tone(1400, 0.04, 'square', 0.1); this.tone(900, 0.05, 'square', 0.08, 0.05); },
  trainHorn(){ this.tone(311, 0.9, 'sawtooth', 0.09); this.tone(370, 0.9, 'sawtooth', 0.09); },

  sirenStart() {
    if (this.muted || !this.ensure() || this._siren) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 660;
    g.gain.value = 0.055;
    o.connect(g).connect(this.ctx.destination);
    o.start();
    let hi = true;
    const iv = setInterval(() => {
      hi = !hi;
      if (this._siren) o.frequency.setTargetAtTime(hi ? 660 : 880, this.ctx.currentTime, 0.03);
    }, 380);
    this._siren = { o, g, iv };
  },

  sirenStop() {
    if (!this._siren) return;
    clearInterval(this._siren.iv);
    try { this._siren.o.stop(); } catch (e) {}
    this._siren = null;
  },

  bellStart() {
    if (this.muted || !this.ensure() || this._bell) return;
    this._bell = setInterval(() => this.tone(1000, 0.1, 'square', 0.05), 450);
    this.tone(1000, 0.1, 'square', 0.05);
  },

  bellStop() {
    if (!this._bell) return;
    clearInterval(this._bell);
    this._bell = null;
  },

  stopAll() { this.sirenStop(); this.bellStop(); },
};
