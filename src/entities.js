/* RoadAhead — traffic + rule-scenario entities.
   Coordinates: every entity has a world distance `d` (px along the road, increasing
   ahead of the player). Screen y = g.sy(d). The player's front bumper is at g.dist. */
window.RA = window.RA || {};

(function () {
  const C = RA.C;
  const spr = RA.spr;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------------- regular traffic ---------------- */
  const KINDS = [
    { k: 'hatch', w: 42, h: 70, spd: [120, 200] },
    { k: 'sedan', w: 44, h: 78, spd: [130, 210] },
    { k: 'auto',  w: 36, h: 54, spd: [90, 140] },
    { k: 'truck', w: 52, h: 118, spd: [90, 150] },
    { k: 'bus',   w: 50, h: 132, spd: [100, 150] },
    { k: 'bike',  w: 24, h: 52, spd: [130, 210] },
  ];
  const CAR_COLORS = ['#c8c3b8', '#8e9aaf', '#a4243b', '#3a6b52', '#4f5d75', '#d9822b', '#e0e0da'];
  const TRUCK_COLORS = ['#2e86ab', '#a4243b', '#3a7d44'];

  class TrafficCar {
    constructor(d, lane, opts = {}) {
      const kind = opts.kind ? KINDS.find(x => x.k === opts.kind) : pick(KINDS);
      this.kind = kind.k;
      this.w = kind.w; this.h = kind.h;
      this.d = d;
      this.lane = lane;
      this.x = C.LANES[lane];
      this.base = opts.speed != null ? opts.speed : rnd(kind.spd[0], kind.spd[1]);
      this.v = this.base;
      this.color = this.kind === 'truck' ? pick(TRUCK_COLORS) : pick(CAR_COLORS);
      this.changing = 0; // lane-change cooldown
      this.isTraffic = true;
    }

    update(dt, g) {
      // stop at active stop lines (red signal / zebra / rail)
      let target = this.base;
      const sl = g.stopLine;
      if (sl !== null && this.d < sl - 30 && sl - this.d < 220) target = 0;
      // follow vehicle ahead in the same lane
      const ahead = g.carAhead(this);
      if (ahead && ahead.d - this.d < this.h + 60) target = Math.min(target, ahead.v * 0.9);
      // the player is an obstacle too: brake early enough not to ram them
      if (this.lane === g.player.lane && this.d < g.dist && Math.abs(this.x - g.player.x) < 70) {
        const clear = (g.dist - 76) - this.d; // to the player's rear bumper
        if (clear < 170) target = Math.min(target, clear < 50 ? Math.max(0, g.player.speed - 30) : g.player.speed);
      }
      this.v += Math.max(-460 * dt, Math.min(150 * dt, target - this.v));
      if (this.v < 0) this.v = 0;
      this.d += this.v * dt;
      this.changing = Math.max(0, this.changing - dt);
      this.x += (C.LANES[this.lane] - this.x) * Math.min(1, 6 * dt);

      // respond to the player's horn: slow vehicle directly ahead moves over
      if (g.hornPing && this.lane === g.player.lane && this.d > g.dist &&
          this.d - g.dist < 300 && this.changing <= 0 && !this.pinned) {
        const opts = [this.lane - 1, this.lane + 1].filter(l =>
          l >= 0 && l <= 2 && g.laneFree(l, this.d - 90, this.d + this.h + 90, this));
        if (opts.length) { this.lane = pick(opts); this.changing = 3; }
      }

      // everyone yields to an ambulance closing in from behind in their lane
      const amb = g.amb;
      if (amb && amb.lane === this.lane && this.d > amb.d && this.d - amb.d < 460 && this.changing <= 0) {
        const opts = [this.lane - 1, this.lane + 1].filter(l =>
          l >= 0 && l <= 2 && g.laneFree(l, this.d - 90, this.d + this.h + 90, this));
        if (opts.length) { this.lane = pick(opts); this.changing = 2.5; }
      }

      if (this.d < g.dist - 500 || this.d > g.dist + 1600) this.done = true;
    }

    draw(ctx, g) {
      const y = g.sy(this.d);
      if (y < -170 || y > C.H + 40) return;
      if (this.kind === 'auto') spr.auto(ctx, this.x, y);
      else if (this.kind === 'truck') spr.truck(ctx, this.x, y, this.color);
      else if (this.kind === 'bus') spr.bus(ctx, this.x, y);
      else if (this.kind === 'bike') spr.bike(ctx, this.x, y);
      else spr.car(ctx, this.x, y, this.w, this.h, this.color, { brake: this.v < this.base * 0.5 });
    }
  }

  /* ---------------- traffic signal ---------------- */
  class Signal {
    constructor(d) {
      this.d = d;
      this.state = 'green';
      this.t = 0;
      this.stopT = 0;
      this.crossed = false;
      this.armed = true; // the green->yellow transition fires only once
      this.isStopEvent = true;
    }
    stopActive() { return this.state === 'red'; }
    update(dt, g) {
      const gap = this.d - g.dist;
      this.t += dt;
      if (this.state === 'green' && this.armed && !this.crossed && gap < 560 && gap > 60) {
        this.armed = false;
        this.state = 'yellow'; this.t = 0;
      } else if (this.state === 'yellow' && this.t > 1.2) {
        this.state = 'red'; this.t = 0;
      } else if (this.state === 'red') {
        if (g.player.speed < 10 && gap > 0 && gap < 440) this.stopT += dt;
        if ((this.stopT > 1.6 && this.t > 3) || this.t > 12) {
          this.state = 'green'; RA.audio.ding();
        }
      }
      if (!this.crossed && g.dist >= this.d) {
        this.crossed = true;
        if (this.state === 'red') g.challan('redLight');
        else if (this.stopT > 0.8) g.reward('redLight');
        else g.reward(null, 50, 'Crossed on green');
      }
      if (g.dist - this.d > 500) this.done = true;
    }
    draw(ctx, g) {
      const ySign = g.sy(this.d - 380);
      if (ySign > -40 && ySign < C.H + 40) {
        spr.board(ctx, C.ROAD_X - 26, ySign, (c, x, yy) => spr.signTriangle(c, x, yy, '🚦', 'SIGNAL'));
      }
      const y = g.sy(this.d);
      if (y < -80 || y > C.H + 80) return;
      // stop line
      ctx.fillStyle = '#e8e3d5';
      ctx.fillRect(C.ROAD_X, y - 4, C.ROAD_W, 6);
      spr.signalHead(ctx, C.ROAD_X + C.ROAD_W + 20, y - 6, this.state);
      spr.signalHead(ctx, C.ROAD_X - 20, y - 6, this.state);
    }
  }

  /* ---------------- zebra crossing with pedestrians ---------------- */
  class Zebra {
    constructor(d) {
      this.d = d;
      this.peds = [];
      this.spawned = false;
      this.crossed = false;
      this.stopT = 0;
      this.isStopEvent = true;
    }
    active() {
      return this.peds.some(p => p.x > C.ROAD_X - 14 && p.x < C.ROAD_X + C.ROAD_W + 14);
    }
    stopActive() { return !this.crossed && this.active(); }
    update(dt, g) {
      const gap = this.d - g.dist;
      if (!this.spawned && gap < 640) {
        this.spawned = true;
        const n = 2 + Math.floor(Math.random() * 2);
        const fromLeft = Math.random() < 0.5;
        for (let i = 0; i < n; i++) {
          this.peds.push({
            x: fromLeft ? C.ROAD_X - 30 - i * 22 : C.ROAD_X + C.ROAD_W + 30 + i * 22,
            vx: (fromLeft ? 1 : -1) * rnd(75, 95),
            step: Math.random() * 6,
            shirt: pick(['#e07a5f', '#3d8bfd', '#81b29a', '#f2cc8f', '#b56576']),
            fled: false,
          });
        }
      }
      for (const p of this.peds) {
        p.x += p.vx * dt;
        p.step += dt * 9;
      }
      if (g.player.speed < 10 && gap > 0 && gap < 440 && this.active()) this.stopT += dt;
      if (!this.crossed && g.dist >= this.d) {
        this.crossed = true;
        if (this.active()) {
          // pedestrians scramble back
          for (const p of this.peds) { p.vx *= -1.6; p.fled = true; }
          g.challan('zebra');
        } else if (this.stopT > 0.8) {
          g.reward('zebra');
        }
      }
      if (g.dist - this.d > 500) this.done = true;
    }
    draw(ctx, g) {
      const y = g.sy(this.d);
      if (y < -80 || y > C.H + 80) return;
      ctx.fillStyle = '#e8e3d5';
      for (let i = 0; i < 7; i++) ctx.fillRect(C.ROAD_X + 8 + i * 42, y - 30, 28, 34);
      // advance warning board, well BEFORE the crossing on the approach side
      const ySign = g.sy(this.d - 360);
      if (ySign > -40 && ySign < C.H + 40) {
        spr.board(ctx, C.ROAD_X - 26, ySign, (c, x, yy) => spr.signTriangle(c, x, yy, '🚶', 'CROSSING'));
      }
      for (const p of this.peds) {
        if (p.fled) ctx.font = '10px monospace';
        spr.ped(ctx, p.x, y - 12, p.step, p.shirt);
        if (p.fled) { ctx.fillStyle = '#ff3b30'; ctx.fillText('!', p.x, y - 30); }
      }
    }
  }

  /* ---------------- ambulance from behind ---------------- */
  class Ambulance {
    constructor(g) {
      this.lane = g.player.lane;
      this.x = C.LANES[this.lane];
      this.d = g.dist - 520;
      this.v = 0;
      this.t = 0;
      this.blockT = 0;
      this.violated = false;
      this.passed = false;
      this.isTraffic = true; // participates in collision
      this.w = 48; this.h = 86;
      RA.audio.sirenStart();
    }
    update(dt, g) {
      this.t += dt;
      let target = Math.min(g.player.speed + 150, 420);
      const inMyLane = g.player.lane === this.lane && Math.abs(g.player.x - this.x) < 55;
      const gapToPlayer = g.dist - this.d; // >0 while behind
      if (!this.passed && inMyLane && gapToPlayer < this.h + 40 && gapToPlayer > -20) {
        target = Math.max(0, g.player.speed - 10);
        this.blockT += dt;
        if (this.blockT > 2.4 && !this.violated) {
          this.violated = true;
          g.challan('ambulance');
          // swerve around the player
          const opts = [this.lane - 1, this.lane + 1].filter(l => l >= 0 && l <= 2);
          this.lane = pick(opts);
        }
      }
      // never drive over other vehicles: follow the car ahead in this lane,
      // and weave into a free lane if it doesn't clear out fast enough
      this.carBlockT = this.carBlockT || 0;
      let blockedByCar = false;
      for (const e of g.entities) {
        if (!e.isTraffic || e === this || e.done || e.lane !== this.lane) continue;
        const clear = (e.d - e.h) - this.d; // my front bumper to its rear
        if (clear > -e.h && clear < 90) {
          target = Math.min(target, Math.max(0, e.v - 10));
          blockedByCar = true;
        }
      }
      this.carBlockT = blockedByCar ? this.carBlockT + dt : 0;
      if (this.carBlockT > 1.1) {
        const opts = [this.lane - 1, this.lane + 1].filter(l =>
          l >= 0 && l <= 2 && g.laneFree(l, this.d - 60, this.d + this.h + 120, this) &&
          !(l === g.player.lane && Math.abs(g.dist - this.d) < this.h + 120));
        if (opts.length) { this.lane = pick(opts); this.carBlockT = 0; }
      }
      this.v += Math.max(-500 * dt, Math.min(260 * dt, target - this.v));
      this.d += this.v * dt;
      this.x += (C.LANES[this.lane] - this.x) * Math.min(1, 5 * dt);
      if (!this.passed && this.d > g.dist + 140) {
        this.passed = true;
        if (!this.violated) g.reward('ambulance');
      }
      if (this.d > g.dist + 1000) {
        this.done = true;
        RA.audio.sirenStop();
      }
    }
    draw(ctx, g) {
      const y = g.sy(this.d);
      if (y > C.H + 40 || y < -140) return;
      spr.ambulance(ctx, this.x, y, this.t);
    }
  }

  /* ---------------- school zone ---------------- */
  class SchoolZone {
    constructor(d) {
      this.start = d;
      this.end = d + 950;
      this.violated = false;
      this.exited = false;
      this.overT = 0;
      this.flashAt = 0;
    }
    update(dt, g) {
      const inside = g.dist > this.start && g.dist < this.end;
      if (inside && g.kmh() > 28) {
        this.overT += dt;
        if (this.overT > 0.9 && !this.violated) {
          this.violated = true;
          g.cameraFlash();
          g.challan('schoolzone');
        }
      } else if (inside) {
        this.overT = 0;
      }
      if (!this.exited && g.dist >= this.end) {
        this.exited = true;
        if (!this.violated) g.reward('schoolzone');
      }
      if (g.dist - this.end > 400) this.done = true;
    }
    draw(ctx, g) {
      const y0 = g.sy(this.end), y1 = g.sy(this.start);
      if (y1 < -60 || y0 > C.H + 60) return;
      // yellow zig-zag edge markings inside zone
      ctx.strokeStyle = '#e6b400';
      ctx.lineWidth = 4;
      for (const ex of [C.ROAD_X + 8, C.ROAD_X + C.ROAD_W - 8]) {
        ctx.beginPath();
        const top = Math.max(y0, -20), bot = Math.min(y1, C.H + 20);
        for (let y = top; y <= bot; y += 16) ctx.lineTo(ex + ((y / 16 | 0) % 2 ? 6 : -6), y);
        ctx.stroke();
      }
      spr.school(ctx, C.ROAD_X - 48, g.sy(this.start + 420));
      // kids on the footpath
      for (let i = 0; i < 3; i++) {
        spr.ped(ctx, C.ROAD_X - 18, g.sy(this.start + 180 + i * 200), g.time * 8 + i * 2, '#3d8bfd');
      }
      // advance warning well before the zone, so there is time to slow down
      spr.board(ctx, C.ROAD_X + C.ROAD_W + 26, g.sy(this.start - 400), (c, x, y) => spr.signCircle(c, x, y, '25', 'SCHOOL AHEAD'));
      spr.board(ctx, C.ROAD_X + C.ROAD_W + 26, g.sy(this.start), (c, x, y) => spr.signCircle(c, x, y, '25', 'ZONE STARTS'));
      spr.board(ctx, C.ROAD_X + C.ROAD_W + 26, g.sy(this.end), (c, x, y) => spr.signCircle(c, x, y, '25', 'ZONE ENDS'));
      // painted road markings on the approach: driver reads SLOW, then 25
      ctx.fillStyle = '#e8e3d5';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SLOW', C.ROAD_X + C.ROAD_W / 2, g.sy(this.start - 280));
      ctx.fillText('25', C.ROAD_X + C.ROAD_W / 2, g.sy(this.start - 200));
    }
  }

  /* ---------------- speed camera checkpoint ---------------- */
  class SpeedCam {
    constructor(d) {
      this.d = d;
      this.limit = 50;
      this.crossed = false;
    }
    update(dt, g) {
      if (!this.crossed && g.dist >= this.d) {
        this.crossed = true;
        if (g.kmh() > this.limit + 4) {
          g.cameraFlash();
          g.challan('overspeed');
        } else {
          g.reward('overspeed');
        }
      }
      if (g.dist - this.d > 400) this.done = true;
    }
    draw(ctx, g) {
      const y = g.sy(this.d);
      const ySign = g.sy(this.d - 380);
      if (ySign > -40 && ySign < C.H + 40) {
        spr.board(ctx, C.ROAD_X + C.ROAD_W + 26, ySign, (c, x, yy) => spr.signCircle(c, x, yy, '50', 'CAMERA'));
      }
      if (y < -60 || y > C.H + 60) return;
      // camera pole + housing
      const px = C.ROAD_X - 22;
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(px - 2, y - 40, 4, 44);
      ctx.fillStyle = '#1d1d24';
      ctx.fillRect(px - 8, y - 52, 22, 14);
      ctx.fillStyle = this.crossed ? '#3a3a3f' : '#7dd3fc';
      ctx.fillRect(px + 8, y - 48, 5, 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(C.ROAD_X, y); ctx.lineTo(C.ROAD_X + C.ROAD_W, y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ---------------- hospital silence zone ---------------- */
  class HonkZone {
    constructor(d, g) {
      this.start = d;
      this.end = d + 850;
      this.violated = false;
      this.exited = false;
      // temptation: a slow vehicle planted in the player's lane
      const slow = new TrafficCar(d + 300, g.player.lane, { kind: 'auto', speed: 78 });
      slow.pinned = true; // will not yield to horn
      this.slowCar = slow;
      g.entities.push(slow);
    }
    inside(g) { return g.dist > this.start && g.dist < this.end; }
    update(dt, g) {
      if (this.inside(g) && g.hornPing && !this.violated) {
        this.violated = true;
        g.challan('silence');
      }
      if (!this.exited && g.dist >= this.end) {
        this.exited = true;
        if (!this.violated) g.reward('silence');
        this.slowCar.pinned = false;
        this.slowCar.base = 170; // it speeds up past the hospital
      }
      if (g.dist - this.end > 400) this.done = true;
    }
    draw(ctx, g) {
      const y1 = g.sy(this.start), y0 = g.sy(this.end);
      if (y1 < -80 || y0 > C.H + 120) return;
      spr.hospital(ctx, C.ROAD_X + C.ROAD_W + 48, g.sy(this.start + 400));
      spr.board(ctx, C.ROAD_X - 26, g.sy(this.start - 380), (c, x, yy) => spr.signCircle(c, x, yy, '📯', 'NO HORN AHEAD'));
      spr.board(ctx, C.ROAD_X - 26, g.sy(this.start), (c, x, yy) => spr.signCircle(c, x, yy, '📯', 'SILENCE ZONE'));
      spr.board(ctx, C.ROAD_X - 26, g.sy(this.end), (c, x, yy) => spr.signCircle(c, x, yy, '✓', 'ZONE ENDS'));
    }
  }

  /* ---------------- stray cow ---------------- */
  class Cow {
    constructor(d) {
      this.d = d;
      const fromLeft = Math.random() < 0.5;
      this.x = fromLeft ? C.ROAD_X - 40 : C.ROAD_X + C.ROAD_W + 40;
      this.dir = fromLeft ? 1 : -1;
      this.spd = rnd(26, 42);
      this.pause = 0;
      this.step = 0;
      this.hit = false;
      this.slowOk = false;
      this.judged = false;
    }
    update(dt, g) {
      if (this.pause > 0) {
        this.pause -= dt;
      } else {
        this.x += this.dir * this.spd * dt;
        this.step += dt * 7;
        // cows stop mid-road; it's what they do
        if (Math.random() < 0.006 && this.x > C.ROAD_X + 40 && this.x < C.ROAD_X + C.ROAD_W - 40) {
          this.pause = rnd(0.8, 1.8);
        }
      }
      const gap = this.d - g.dist;
      if (Math.abs(gap) < 300 && g.kmh() < 45) this.slowOk = true;
      // collision
      if (!this.hit && gap < 10 && gap > -78 && Math.abs(this.x - g.player.x) < 44) {
        this.hit = true;
        this.judged = true;
        g.animalHit();
        this.pause = 2;
      }
      if (!this.judged && g.dist - this.d > 120) {
        this.judged = true;
        if (this.slowOk) g.reward('animal');
      }
      if (g.dist - this.d > 500) this.done = true;
    }
    draw(ctx, g) {
      const y = g.sy(this.d);
      if (y < -60 || y > C.H + 60) return;
      spr.cow(ctx, this.x, y, this.dir, this.pause > 0 ? 0 : this.step);
    }
  }

  /* ---------------- signalled cross junction ----------------
     A perpendicular road crosses yours. While your light is red, cross
     traffic flows through the junction — jump the signal and you risk a
     T-bone, not just a challan. this.d is the stop line; the junction
     box spans world [d+20, d+190]. */
  class CrossJunction {
    constructor(d) {
      this.d = d;
      this.state = 'green';
      this.armed = true;
      this.t = 0;
      this.stopT = 0;
      this.crossed = false;
      this.cars = [];
      this.spawnT = 0.3;
      this.isStopEvent = true;
    }
    stopActive() { return this.state === 'red'; }
    update(dt, g) {
      const gap = this.d - g.dist;
      this.t += dt;
      if (this.state === 'green' && this.armed && !this.crossed && gap < 560 && gap > 60) {
        this.armed = false;
        this.state = 'yellow'; this.t = 0;
      } else if (this.state === 'yellow' && this.t > 1.2) {
        this.state = 'red'; this.t = 0;
      } else if (this.state === 'red') {
        if (g.player.speed < 10 && gap > 0 && gap < 440) this.stopT += dt;
        if ((this.stopT > 1.8 && this.t > 3.5) || this.t > 14) {
          this.state = 'green'; RA.audio.ding();
        }
      }
      // cross traffic has green while you have yellow/red
      this.spawnT -= dt;
      if ((this.state === 'red' || this.state === 'yellow') && this.spawnT <= 0 && gap > -100) {
        this.spawnT = rnd(0.6, 1.3);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.cars.push({
          x: dir > 0 ? -90 : C.W + 90,
          dir,
          lane: dir > 0 ? this.d + 60 : this.d + 150, // left-hand traffic: each direction keeps its half
          v: rnd(150, 220),
          color: pick(CAR_COLORS),
        });
      }
      for (const c of this.cars) c.x += c.dir * c.v * dt;
      this.cars = this.cars.filter(c => c.x > -160 && c.x < C.W + 160);
      // judgement at the stop line
      if (!this.crossed && g.dist >= this.d) {
        this.crossed = true;
        if (this.state === 'red') g.challan('redLight');
        else if (this.stopT > 0.8) g.reward('redLight');
        else g.reward(null, 50, 'Crossed the junction on green');
      }
      // T-bone check while the player is inside the junction box
      if (g.invuln <= 0) {
        for (const c of this.cars) {
          const laneGap = c.lane - g.dist; // player body spans world [dist-76, dist]
          if (laneGap > -90 && laneGap < 14 && Math.abs(c.x - g.player.x) < 55) {
            g.junctionHit();
            break;
          }
        }
      }
      if (g.dist - this.d > 600 && this.cars.length === 0) this.done = true;
    }
    draw(ctx, g) {
      const ySign = g.sy(this.d - 380);
      if (ySign > -40 && ySign < C.H + 40) {
        spr.board(ctx, C.ROAD_X - 26, ySign, (c, x, yy) => spr.signTriangle(c, x, yy, '🚦', 'JUNCTION'));
      }
      const y = g.sy(this.d);
      if (y < -300 || y > C.H + 300) return;
      // perpendicular road
      const bandTop = g.sy(this.d + 190);
      ctx.fillStyle = '#413e49';
      ctx.fillRect(0, bandTop, C.W, 170);
      ctx.fillStyle = '#d8d3c8';
      ctx.fillRect(0, bandTop + 2, C.W, 3);
      ctx.fillRect(0, bandTop + 165, C.W, 3);
      // centre dashes of the cross road (broken at your carriageway)
      const yc = g.sy(this.d + 105);
      for (let x = 8; x < C.W; x += 48) {
        if (x + 26 > C.ROAD_X && x < C.ROAD_X + C.ROAD_W) continue;
        ctx.fillRect(x, yc - 2, 26, 4);
      }
      // stop line + signals on both sides
      ctx.fillStyle = '#e8e3d5';
      ctx.fillRect(C.ROAD_X, y - 4, C.ROAD_W, 6);
      spr.signalHead(ctx, C.ROAD_X - 20, y - 6, this.state);
      spr.signalHead(ctx, C.ROAD_X + C.ROAD_W + 20, y - 6, this.state);
      // cross traffic
      for (const c of this.cars) {
        const cy = g.sy(c.lane);
        ctx.save();
        ctx.translate(c.x, cy);
        ctx.rotate(c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        spr.car(ctx, 0, -35, 40, 70, c.color);
        ctx.restore();
      }
    }
  }

  /* ---------------- railway crossing ---------------- */
  class RailCross {
    constructor(d) {
      this.d = d;
      this.phase = 'idle'; // idle -> closing -> closed -> opening -> open
      this.t = 0;
      this.trainX = -420;
      this.crossed = false;
      this.stopT = 0;
      this.isStopEvent = true;
    }
    stopActive() { return this.phase === 'closing' || this.phase === 'closed' || this.phase === 'opening'; }
    gateP() { // 0 = open, 1 = fully closed
      if (this.phase === 'closing') return Math.min(1, this.t / 1.5);
      if (this.phase === 'closed') return 1;
      if (this.phase === 'opening') return 1 - Math.min(1, this.t / 1.5);
      return 0;
    }
    update(dt, g) {
      const gap = this.d - g.dist;
      this.t += dt;
      if (this.phase === 'idle' && gap < 680 && gap > 0) {
        this.phase = 'closing'; this.t = 0;
        RA.audio.bellStart();
      } else if (this.phase === 'closing' && this.t > 1.5) {
        this.phase = 'closed'; this.t = 0;
        this.trainX = -420;
        RA.audio.trainHorn();
      } else if (this.phase === 'closed') {
        this.trainX += 330 * dt;
        if (this.trainX > C.W + 460) { this.phase = 'opening'; this.t = 0; }
      } else if (this.phase === 'opening' && this.t > 1.5) {
        this.phase = 'open';
        RA.audio.bellStop();
        RA.audio.ding();
      }
      if (this.stopActive() && g.player.speed < 10 && gap > 0 && gap < 440) this.stopT += dt;
      if (!this.crossed && g.dist >= this.d) {
        this.crossed = true;
        if (this.stopActive()) g.challan('rail');
        else if (this.stopT > 1) g.reward('rail');
      }
      if (g.dist - this.d > 500) {
        this.done = true;
        RA.audio.bellStop();
      }
    }
    draw(ctx, g) {
      const ySign = g.sy(this.d - 420);
      if (ySign > -40 && ySign < C.H + 40) {
        spr.board(ctx, C.ROAD_X - 26, ySign, (c, x, yy) => spr.signTriangle(c, x, yy, '🚧', 'RAIL XING'));
      }
      const y = g.sy(this.d);
      if (y < -80 || y > C.H + 80) return;
      // track bed crossing the road
      ctx.fillStyle = '#2b2823';
      ctx.fillRect(0, y - 26, C.W, 40);
      ctx.fillStyle = '#5c4632';
      for (let x = 6; x < C.W; x += 26) ctx.fillRect(x, y - 22, 14, 32);
      ctx.fillStyle = '#8d99ae';
      ctx.fillRect(0, y - 18, C.W, 5);
      ctx.fillRect(0, y + 4, C.W, 5);
      // stop line
      ctx.fillStyle = '#e8e3d5';
      ctx.fillRect(C.ROAD_X, y + 34, C.ROAD_W, 6);
      // gates
      const p = this.gateP();
      const armLen = (C.ROAD_W / 2 + 6) * p;
      for (const [gx, dir] of [[C.ROAD_X - 8, 1], [C.ROAD_X + C.ROAD_W + 8, -1]]) {
        ctx.fillStyle = '#3a3a3f';
        ctx.fillRect(gx - 4, y + 40, 8, 14);
        for (let i = 0; i < armLen; i += 16) {
          ctx.fillStyle = (i / 16 | 0) % 2 ? '#fff' : '#c1121f';
          ctx.fillRect(gx + dir * i, y + 42, dir * Math.min(16, armLen - i), 8);
        }
        // warning blinkers
        if (this.stopActive() && Math.floor(g.time * 4) % 2) {
          ctx.fillStyle = '#ff3b30';
          ctx.beginPath(); ctx.arc(gx, y + 36, 5, 0, 7); ctx.fill();
        }
      }
      if (this.phase === 'closed') spr.train(ctx, this.trainX, y - 6, 1);
    }
  }

  RA.E = { TrafficCar, Signal, Zebra, Ambulance, SchoolZone, SpeedCam, HonkZone, Cow, RailCross, CrossJunction };
})();
