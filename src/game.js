/* RoadAhead — core game loop, world rendering, scoring, event director */
window.RA = window.RA || {};

RA.game = (function () {
  const C = RA.C;
  const spr = RA.spr;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hash = (i) => {
    let x = (i * 2654435761) % 4294967296;
    x = ((x >>> 13) ^ x) * 1274126177 % 4294967296;
    return ((x >>> 16) ^ x) % 1000 / 1000;
  };

  const g = {
    state: 'menu', // menu | run | paused | modal | over
    canvas: null, ctx: null,
    time: 0,
    player: { lane: 1, x: C.LANES[1], speed: 0, targetLane: 1 },
    dist: 0,
    entities: [],

    score: 0, streak: 0, bestStreak: 0,
    licensePts: 12, fines: 0, damage: 0,
    followed: 0, violations: {},
    hornPing: false,
    stopLine: null,

    // effects
    flashT: 0, shakeT: 0, redPulseT: 0,

    // director
    nextEventD: 0, lastEvent: '', quizNextM: 0, phoneT: 0,
    pendingOverReason: null,

    kmh() { return Math.round(this.player.speed * C.KMH); },
    distM() { return this.dist * C.PX2M; },
    sy(d) { return C.PLAYER_Y - (d - this.dist); },

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (this.state === 'run') this.update(dt);
        if (this.state !== 'menu') this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'run') this.togglePause();
      });
    },

    start() {
      this.state = 'run';
      this.time = 0;
      this.player = { lane: 1, x: C.LANES[1], speed: 0, targetLane: 1 };
      this.dist = 0;
      this.entities = [];
      this.score = 0; this.streak = 0; this.bestStreak = 0;
      this.licensePts = 12; this.fines = 0; this.damage = 0;
      this.followed = 0; this.violations = {};
      this.flashT = 0; this.shakeT = 0; this.redPulseT = 0; this.invuln = 0;
      this.nextEventD = 1400;
      this.lastEvent = '';
      this.quizNextM = 350;
      this.phoneT = rnd(35, 55);
      this.pendingOverReason = null;
      this.trafficT = 0;
      RA.audio.stopAll();
      RA.ui.clearOverlays();
      RA.ui.showScreen(null);
      RA.ui.hud(this);
      RA.ui.toast('Drive safe. Earn points. Dodge challans! 🇮🇳', 'info');
    },

    togglePause() {
      if (this.state === 'run') {
        this.state = 'paused';
        RA.audio.stopAll();
        RA.ui.showScreen('pause');
      } else if (this.state === 'paused') {
        this.state = 'run';
        RA.ui.showScreen(null);
        if (this.entities.some(e => e instanceof RA.E.Ambulance && !e.done)) RA.audio.sirenStart();
      }
    },

    /* ---------------- update ---------------- */
    update(dt) {
      this.time += dt;
      const p = this.player;
      const inp = RA.input;

      // lane changes
      const lq = inp.pollLane();
      if (lq) {
        p.targetLane = Math.max(0, Math.min(2, p.targetLane + lq));
        RA.audio.click();
      }
      p.lane = p.targetLane;
      p.x += (C.LANES[p.targetLane] - p.x) * Math.min(1, 9 * dt);

      // speed
      if (inp.gas) p.speed += 175 * dt;
      else if (!inp.brake) p.speed -= 35 * dt;
      if (inp.brake) p.speed -= 430 * dt;
      p.speed = Math.max(0, Math.min(C.MAXSPD, p.speed));
      this.dist += p.speed * dt;

      // horn
      this.hornPing = inp.pollHorn();
      if (this.hornPing) RA.audio.horn();

      // active stop line for AI traffic
      this.stopLine = null;
      for (const e of this.entities) {
        if (e.isStopEvent && !e.done && e.stopActive && e.stopActive()) {
          const d = e.d;
          if (d > this.dist - 100 && (this.stopLine === null || d < this.stopLine)) this.stopLine = d;
        }
      }

      // entities
      for (const e of this.entities) e.update(dt, this);
      // player-vehicle collisions
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.invuln <= 0) {
        for (const e of this.entities) {
          if (!e.isTraffic || e.done) continue;
          const gap = e.d - this.dist;
          if (gap > -76 && gap < e.h && Math.abs(e.x - p.x) < (e.w + 44) / 2 - 6) {
            this.crashInto(e);
            break;
          }
        }
      }
      this.entities = this.entities.filter(e => !e.done);

      // traffic spawning
      this.trafficT -= dt;
      if (this.trafficT <= 0) {
        this.trafficT = 0.7;
        this.spawnTraffic();
      }

      // event director
      if (this.dist > this.nextEventD) {
        this.spawnEvent();
        this.nextEventD = this.dist + rnd(1700, 2600);
      }

      // phone distraction
      this.phoneT -= dt;
      if (this.phoneT <= 0 && !RA.ui.phoneOpen && this.stopLine === null) {
        this.phoneT = rnd(55, 85);
        RA.ui.phone(
          () => this.challan('mobile'),
          () => this.reward('mobile'),
        );
      }

      // sign quiz at distance milestones
      if (this.distM() > this.quizNextM && this.stopLine === null && !RA.ui.phoneOpen) {
        this.quizNextM += 400;
        this.state = 'modal';
        RA.ui.quiz((correct) => {
          if (correct) { this.score += 200; this.streak++; this.followed++; RA.audio.win(); }
          else { this.streak = 0; }
          this.bestStreak = Math.max(this.bestStreak, this.streak);
          this.state = 'run';
        });
      }

      // effects decay
      this.flashT = Math.max(0, this.flashT - dt);
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.redPulseT = Math.max(0, this.redPulseT - dt);

      RA.ui.hud(this);
    },

    /* ---------------- spawning ---------------- */
    laneFree(lane, dFrom, dTo, except) {
      for (const e of this.entities) {
        if (e === except || !e.isTraffic || e.done) continue;
        if (e.lane === lane && e.d + 40 > dFrom && e.d - e.h - 40 < dTo) return false;
      }
      if (lane === this.player.lane && this.dist + 40 > dFrom && this.dist - 116 < dTo) return false;
      return true;
    },

    carAhead(car) {
      let best = null;
      for (const e of this.entities) {
        if (e === car || !e.isTraffic || e.done || e.lane !== car.lane) continue;
        if (e.d > car.d && (!best || e.d < best.d)) best = e;
      }
      return best;
    },

    spawnTraffic() {
      const max = Math.min(8, 4 + Math.floor(this.distM() / 500));
      const count = this.entities.filter(e => e instanceof RA.E.TrafficCar).length;
      if (count >= max) return;
      // keep the approach to stop-line events clear
      if (this.stopLine !== null) return;
      const pending = this.entities.some(e => e.isStopEvent && !e.done && e.d > this.dist);
      if (pending) return;
      const lane = Math.floor(Math.random() * 3);
      const d = this.dist + rnd(850, 1100);
      if (!this.laneFree(lane, d - 260, d + 260)) return;
      this.entities.push(new RA.E.TrafficCar(d, lane));
    },

    spawnEvent() {
      const E = RA.E;
      const base = [
        ['signal', 15], ['zebra', 15], ['ambulance', 12], ['school', 12],
        ['speedcam', 11], ['honk', 10], ['cow', 13], ['rail', 7],
      ];
      if (this.distM() > 800) base.push(['junction', 15]); // next level: signalled crossroads
      const pool = base.filter(([k]) => k !== this.lastEvent);
      let total = pool.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total, kind = pool[0][0];
      for (const [k, w] of pool) { r -= w; if (r <= 0) { kind = k; break; } }
      this.lastEvent = kind;
      const d = this.dist + 980;

      if (kind === 'signal' || kind === 'zebra' || kind === 'rail' || kind === 'junction') {
        // clear traffic near the stop line so the teaching moment is readable
        for (const e of this.entities) {
          if (e.isTraffic && !(e instanceof E.Ambulance) && e.d > d - 300) e.done = true;
        }
      }
      switch (kind) {
        case 'signal': this.entities.push(new E.Signal(d)); break;
        case 'zebra': this.entities.push(new E.Zebra(d)); break;
        case 'ambulance': this.entities.push(new E.Ambulance(this)); break;
        case 'school': this.entities.push(new E.SchoolZone(d)); break;
        case 'speedcam': this.entities.push(new E.SpeedCam(d)); break;
        case 'honk': this.entities.push(new E.HonkZone(d, this)); break;
        case 'cow': this.entities.push(new E.Cow(d)); break;
        case 'rail': this.entities.push(new E.RailCross(d)); break;
        case 'junction': this.entities.push(new E.CrossJunction(d)); break;
      }
    },

    /* ---------------- scoring ---------------- */
    mult() { return 1 + Math.min(8, this.streak) * 0.25; },

    reward(ruleId, pts, label) {
      if (this.state === 'over') return;
      const rule = ruleId ? RA.RULES[ruleId] : null;
      const base = rule ? rule.pts : pts;
      const add = Math.round(base * this.mult());
      this.score += add;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.followed++;
      const txt = rule ? rule.good : label;
      RA.ui.toast(`+${add}  ${txt}${this.streak > 1 ? `  🔥×${this.mult().toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}` : ''}`, 'good');
      if (base >= 200) RA.audio.win(); else RA.audio.ding();
    },

    challan(ruleId) {
      if (this.state === 'over') return;
      const rule = RA.RULES[ruleId];
      this.streak = 0;
      this.fines += rule.fine;
      this.licensePts = Math.max(0, this.licensePts - rule.lp);
      this.violations[ruleId] = (this.violations[ruleId] || 0) + 1;
      this.redPulseT = 1;
      RA.audio.bad();
      this.state = 'modal';
      RA.audio.stopAll();
      RA.ui.challan(rule, () => {
        if (this.licensePts <= 0) this.gameOver('suspended');
        else if (this.damage >= 3) this.gameOver('wrecked');
        else {
          this.state = 'run';
          if (this.entities.some(e => e instanceof RA.E.Ambulance && !e.done)) RA.audio.sirenStart();
        }
      });
      RA.ui.hud(this);
    },

    crashInto(car) {
      const rel = this.player.speed - car.v;
      this.shakeT = 0.5;
      this.invuln = 1.6;
      this.damage++;
      RA.audio.crash();
      this.player.speed = Math.max(0, car.v - 30);
      car.d += 26;
      if (rel > 90) {
        this.challan('rash');
      } else {
        this.streak = 0;
        this.score = Math.max(0, this.score - 50);
        RA.ui.toast('-50  Maintain a safe distance! 💢', 'bad');
        if (this.damage >= 3) this.gameOver('wrecked');
      }
    },

    junctionHit() {
      this.shakeT = 0.6;
      this.invuln = 1.8;
      this.damage++;
      this.streak = 0;
      this.score = Math.max(0, this.score - 100);
      this.player.speed = Math.min(this.player.speed, 30);
      RA.audio.crash();
      RA.ui.toast('-100  T-boned by cross traffic! This is why we stop at red 💥', 'bad');
      if (this.damage >= 3) this.gameOver('wrecked');
    },

    animalHit() {
      this.shakeT = 0.5;
      this.invuln = 1.6;
      this.damage++;
      this.streak = 0;
      this.score = Math.max(0, this.score - 100);
      this.player.speed = Math.min(this.player.speed, 40);
      RA.audio.crash();
      RA.ui.toast('-100  ' + RA.RULES.animal.bad + ' Slow down near strays 🐄', 'bad');
      if (this.damage >= 3) this.gameOver('wrecked');
    },

    cameraFlash() {
      this.flashT = 0.35;
      RA.audio.shutter();
    },

    gameOver(reason) {
      this.state = 'over';
      RA.audio.stopAll();
      RA.ui.clearOverlays();
      const best = Math.max(this.score, +(localStorage.getItem('ra_best') || 0));
      localStorage.setItem('ra_best', best);
      RA.ui.gameOver(this, reason, best);
    },

    endDrive() { this.gameOver('parked'); },

    /* ---------------- draw ---------------- */
    draw() {
      const ctx = this.ctx;
      ctx.save();
      if (this.shakeT > 0) {
        ctx.translate(rnd(-5, 5) * this.shakeT * 2, rnd(-5, 5) * this.shakeT * 2);
      }

      // ground
      ctx.fillStyle = '#b98d4f';
      ctx.fillRect(-8, -8, C.W + 16, C.H + 16);
      // dust patches
      for (let i = Math.floor((this.dist - 200) / 90); i < (this.dist + C.H + 200) / 90; i++) {
        const h1 = hash(i * 3 + 7);
        if (h1 < 0.4) {
          ctx.fillStyle = h1 < 0.2 ? '#ad824a' : '#c29a58';
          const y = this.sy(i * 90);
          ctx.fillRect(hash(i) < 0.5 ? 8 : C.W - 70, y, 55 + h1 * 40, 34);
        }
      }

      // footpaths
      ctx.fillStyle = '#8f8a94';
      ctx.fillRect(C.ROAD_X - 16, -8, 16, C.H + 16);
      ctx.fillRect(C.ROAD_X + C.ROAD_W, -8, 16, C.H + 16);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = Math.floor(this.dist / 40); i < (this.dist + C.H + 60) / 40; i++) {
        const y = this.sy(i * 40);
        ctx.fillRect(C.ROAD_X - 16, y, 16, 2);
        ctx.fillRect(C.ROAD_X + C.ROAD_W, y, 16, 2);
      }

      // road
      ctx.fillStyle = '#413e49';
      ctx.fillRect(C.ROAD_X, -8, C.ROAD_W, C.H + 16);
      // worn patches
      for (let i = Math.floor((this.dist - 100) / 130); i < (this.dist + C.H + 130) / 130; i++) {
        if (hash(i * 5 + 3) < 0.3) {
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          const y = this.sy(i * 130);
          ctx.fillRect(C.ROAD_X + 30 + hash(i) * 200, y, 46, 26);
        }
      }
      // edge lines
      ctx.fillStyle = '#d8d3c8';
      ctx.fillRect(C.ROAD_X + 3, -8, 4, C.H + 16);
      ctx.fillRect(C.ROAD_X + C.ROAD_W - 7, -8, 4, C.H + 16);
      // lane dashes
      for (const lx of [C.ROAD_X + 100, C.ROAD_X + 200]) {
        for (let i = Math.floor(this.dist / 56) - 1; i < (this.dist + C.H + 56) / 56; i++) {
          const y = this.sy(i * 56);
          ctx.fillRect(lx - 2, y, 4, 30);
        }
      }

      // roadside scenery (deterministic per world slot)
      for (let i = Math.floor((this.dist - 150) / 130); i < (this.dist + C.H + 200) / 130; i++) {
        const h1 = hash(i);
        const y = this.sy(i * 130);
        if (y < -60 || y > C.H + 60) continue;
        const left = hash(i + 999) < 0.5;
        const x = left ? rnd0(i, 30, C.ROAD_X - 34) : rnd0(i + 55, C.ROAD_X + C.ROAD_W + 34, C.W - 26);
        if (h1 < 0.4) spr.tree(this.ctx, x, y);
        else if (h1 < 0.5) spr.stall(this.ctx, x, y);
        else if (h1 < 0.62) spr.shop(this.ctx, x, y, ['#b56576', '#6d9dc5', '#87a878'][i % 3]);
        else if (h1 < 0.66) spr.kmStone(this.ctx, x, y, Math.max(0, Math.round(i * 130 * C.PX2M / 100) / 10).toFixed(1));
      }
      function rnd0(seed, a, b) { return a + hash(seed * 13 + 1) * (b - a); }

      // entities: zones & road furniture first, vehicles on top
      const vehicles = [], flat = [];
      for (const e of this.entities) (e.isTraffic ? vehicles : flat).push(e);
      for (const e of flat) e.draw(ctx, this);
      vehicles.sort((a, b) => this.sy(a.d) - this.sy(b.d));
      for (const e of vehicles) e.draw(ctx, this);

      // player
      spr.player(ctx, this.player.x, C.PLAYER_Y, this.invuln > 0);

      ctx.restore();

      // overlays
      if (this.flashT > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashT * 2.4})`;
        ctx.fillRect(0, 0, C.W, C.H);
      }
      if (this.redPulseT > 0) {
        ctx.strokeStyle = `rgba(214,40,40,${this.redPulseT * 0.9})`;
        ctx.lineWidth = 14;
        ctx.strokeRect(0, 0, C.W, C.H);
      }
      // ambulance behind indicator
      const amb = this.entities.find(e => e instanceof RA.E.Ambulance && !e.passed && !e.done);
      if (amb && this.sy(amb.d) > C.H - 20) {
        if (Math.floor(this.time * 3) % 2) {
          ctx.fillStyle = 'rgba(214,40,40,0.92)';
          ctx.beginPath(); ctx.roundRect(C.W / 2 - 118, C.H - 56, 236, 34, 8); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('🚑 AMBULANCE — GIVE WAY!', C.W / 2, C.H - 33);
        }
      }
    },
  };

  return g;
})();
