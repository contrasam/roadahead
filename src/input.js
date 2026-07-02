/* RoadAhead — keyboard + touch input */
window.RA = window.RA || {};

RA.input = {
  gas: false,
  brake: false,
  _laneQ: 0,
  _hornQ: false,

  pollLane() { const v = this._laneQ; this._laneQ = 0; return v; },
  pollHorn() { const v = this._hornQ; this._hornQ = false; return v; },

  init() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this._laneQ -= 1; break;
        case 'ArrowRight': case 'KeyD': this._laneQ += 1; break;
        case 'ArrowUp': case 'KeyW': this.gas = true; break;
        case 'ArrowDown': case 'KeyS': this.brake = true; break;
        case 'KeyH': case 'Space': this._hornQ = true; e.preventDefault(); break;
        case 'KeyP': case 'Escape': if (RA.game) RA.game.togglePause(); break;
        case 'KeyM': if (RA.ui) RA.ui.toggleMute(); break;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': this.gas = false; break;
        case 'ArrowDown': case 'KeyS': this.brake = false; break;
      }
    });

    // touch controls
    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => { e.preventDefault(); on(); el.classList.add('held'); };
      const end = (e) => { e.preventDefault(); if (off) off(); el.classList.remove('held'); };
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointerleave', end);
      el.addEventListener('pointercancel', end);
    };
    hold('t-left', () => { this._laneQ -= 1; });
    hold('t-right', () => { this._laneQ += 1; });
    hold('t-gas', () => { this.gas = true; }, () => { this.gas = false; });
    hold('t-brake', () => { this.brake = true; }, () => { this.brake = false; });
    hold('t-horn', () => { this._hornQ = true; });

    // swipe on canvas for lane changes
    const cv = document.getElementById('game');
    let sx = null, sy = null;
    cv.addEventListener('touchstart', (e) => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    cv.addEventListener('touchend', (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) this._laneQ += dx > 0 ? 1 : -1;
      sx = sy = null;
    });
  },
};
