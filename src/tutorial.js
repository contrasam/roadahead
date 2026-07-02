/* RoadAhead — Driving School: animated lessons for crossroads & roundabouts.
   Each lesson is a set of looping animated scenes (cars follow Catmull-Rom paths
   on a timeline) followed by quick knowledge-check questions. */
window.RA = window.RA || {};

RA.tut = (function () {
  const PI = Math.PI;
  const W = 480, H = 360, CX = 240, CY = 180;
  const RING = 72; // roundabout circulating radius

  /* ---------- path helpers ---------- */
  function sample(pts, u) {
    const n = pts.length - 1;
    const t = Math.min(0.9999, Math.max(0, u)) * n;
    const i = Math.floor(t), s = t - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(n, i + 1)], p3 = pts[Math.min(n, i + 2)];
    const cr = (a, b, c, d) =>
      0.5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
    return { x: cr(p0[0], p1[0], p2[0], p3[0]), y: cr(p0[1], p1[1], p2[1], p3[1]) };
  }
  function pose(pts, u) {
    const a = sample(pts, u), b = sample(pts, Math.min(1, u + 0.006));
    return { x: a.x, y: a.y, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  function ku(keys, t) { // piecewise-linear u(t)
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, u0] = keys[i], [t1, u1] = keys[i + 1];
      if (t <= t1) return u0 + (u1 - u0) * ((t - t0) / (t1 - t0));
    }
    return keys[keys.length - 1][1];
  }
  const ring = (a0, a1, n = 10) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = a0 + (a1 - a0) * i / n;
      pts.push([CX + RING * Math.cos(th), CY + RING * Math.sin(th)]);
    }
    return pts;
  };

  /* ---------- drawing ---------- */
  function drawCar(ctx, x, y, ang, color, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + PI / 2);
    ctx.fillStyle = '#15151a';
    ctx.fillRect(-13, -13, 4, 8); ctx.fillRect(9, -13, 4, 8);
    ctx.fillRect(-13, 6, 4, 8); ctx.fillRect(9, 6, 4, 8);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-11, -19, 22, 38, 5); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,40,0.85)';
    ctx.fillRect(-8, -13, 16, 7);
    ctx.fillRect(-8, 8, 16, 5);
    if (opts.blinkOn) {
      ctx.fillStyle = '#ff9f1c';
      const bx = opts.blink === 'left' ? -11 : 11;
      ctx.beginPath(); ctx.arc(bx, -16, 3.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, 16, 3.4, 0, 7); ctx.fill();
    }
    if (opts.brake) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-9, 17, 6, 3); ctx.fillRect(3, 17, 6, 3);
    }
    ctx.restore();
    if (opts.you) {
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', x, y - 26);
    }
    if (opts.cross) {
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 14); ctx.lineTo(x + 14, y + 14);
      ctx.moveTo(x + 14, y - 14); ctx.lineTo(x - 14, y + 14);
      ctx.stroke();
    }
  }

  function zebraH(ctx, x0, x1, y) { // horizontal band of vertical stripes
    ctx.fillStyle = '#e8e3d5';
    for (let x = x0; x < x1 - 6; x += 18) ctx.fillRect(x, y, 10, 16);
  }
  function zebraV(ctx, y0, y1, x) {
    ctx.fillStyle = '#e8e3d5';
    for (let y = y0; y < y1 - 6; y += 18) ctx.fillRect(x, y, 16, 10);
  }

  function roadsBase(ctx) {
    ctx.fillStyle = '#b98d4f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9c7a45';
    for (const [x, y, w, h] of [[20, 30, 60, 40], [400, 60, 60, 30], [30, 300, 70, 36], [390, 290, 66, 44]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#413e49';
    ctx.fillRect(180, 0, 120, H); // vertical road
    ctx.fillRect(0, 120, W, 120); // horizontal road
    ctx.fillStyle = '#d8d3c8';
    // edge lines (stop at the junction box)
    for (const [x0, y0, x1, y1] of [
      [182, 0, 185, 118], [295, 0, 298, 118], [182, 242, 185, H], [295, 242, 298, H],
      [0, 122, 178, 125], [0, 235, 178, 238], [302, 122, W, 125], [302, 235, W, 238],
    ]) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  function dashes(ctx, pts) {
    ctx.strokeStyle = '#d8d3c8';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function crossBg(ctx) {
    roadsBase(ctx);
    dashes(ctx, [[240, 0], [240, 96]]);
    dashes(ctx, [[240, 266], [240, H]]);
    dashes(ctx, [[0, 180], [96, 180]]);
    dashes(ctx, [[326, 180], [W, 180]]);
    zebraH(ctx, 186, 296, 246); // south
    zebraH(ctx, 186, 296, 98);  // north
    zebraV(ctx, 126, 236, 98);  // west
    zebraV(ctx, 126, 236, 326); // east
    // stop lines (approach side of each zebra, left half of each carriageway)
    ctx.fillStyle = '#e8e3d5';
    ctx.fillRect(182, 268, 58, 4);  // northbound
    ctx.fillRect(240, 90, 58, 4);   // southbound
    ctx.fillRect(92, 122, 4, 58);   // eastbound
    ctx.fillRect(326, 180, 4, 58);  // westbound
  }

  function roundBg(ctx) {
    roadsBase(ctx);
    ctx.fillStyle = '#413e49';
    ctx.beginPath(); ctx.arc(CX, CY, 106, 0, 7); ctx.fill();
    // central island
    ctx.fillStyle = '#d8d3c8';
    ctx.beginPath(); ctx.arc(CX, CY, 44, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath(); ctx.arc(CX, CY, 39, 0, 7); ctx.fill();
    ctx.fillStyle = '#54964d';
    ctx.beginPath(); ctx.arc(CX - 10, CY - 8, 14, 0, 7); ctx.fill();
    // clockwise arrows on the carriageway
    ctx.fillStyle = 'rgba(232,227,213,0.85)';
    for (const th of [0.25 * PI, 0.75 * PI, 1.25 * PI, 1.75 * PI]) {
      const x = CX + RING * Math.cos(th), y = CY + RING * Math.sin(th);
      const dir = th + PI / 2; // increasing θ = clockwise on screen
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(dir);
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // give-way dashed lines at each entry
    ctx.strokeStyle = '#e8e3d5';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(182, 288); ctx.lineTo(240, 288); // south entry (northbound half)
    ctx.moveTo(240, 72); ctx.lineTo(298, 72);   // north entry
    ctx.moveTo(132, 122); ctx.lineTo(132, 180); // west entry (eastbound half)
    ctx.moveTo(348, 180); ctx.lineTo(348, 238); // east entry
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function boxJunction(ctx) {
    ctx.strokeStyle = '#e6b400';
    ctx.lineWidth = 3;
    ctx.strokeRect(184, 124, 112, 112);
    ctx.beginPath();
    for (let i = -112; i < 112; i += 16) {
      ctx.moveTo(184 + Math.max(0, i), 124 + Math.max(0, -i));
      ctx.lineTo(184 + Math.min(112, i + 112), 124 + Math.min(112, -i + 112));
    }
    ctx.stroke();
  }
  function signal(ctx, x, y, state) {
    ctx.fillStyle = '#1d1d24';
    ctx.beginPath(); ctx.roundRect(x - 8, y - 26, 16, 36, 4); ctx.fill();
    const col = { red: ['#ff3b30', -18], yellow: ['#ffd23f', -8], green: ['#2ecc71', 2] };
    for (const k in col) {
      ctx.fillStyle = state === k ? col[k][0] : '#3a3a3f';
      ctx.beginPath(); ctx.arc(x, y + col[k][1], 5, 0, 7); ctx.fill();
    }
  }

  /* ---------- lesson data ---------- */
  const YOU = '#2f7bd9';
  const entryS = [[210, 380], [210, 330], [210, 300]]; // south approach, northbound

  const CROSS = {
    id: 'cross', icon: '➕', title: 'Crossroads',
    blurb: 'Right of way, turning left & right, and never blocking the box.',
    bg: crossBg,
    steps: [
      {
        dur: 6.5,
        text: 'Slow down as you approach any crossing. Stop behind the stop line — the zebra belongs to pedestrians.',
        cars: [{ path: [[210, 380], [210, 340], [210, 292]], keys: [[0, 0], [2.2, 1]], color: YOU, you: true, brakeT: [1.2, 99] }],
        peds: [{ from: [166, 254], to: [314, 254], t0: 2.6, t1: 6 }],
      },
      {
        dur: 7,
        text: 'No signals? Rule of the road: GIVE WAY to traffic approaching from your RIGHT. Let them pass, then go.',
        cars: [
          { path: [[210, 380], [210, 292], [210, 200], [210, -40]], keys: [[0, 0], [1.2, 0.28], [4.2, 0.28], [7, 1]], color: YOU, you: true, brakeT: [1, 4.2] },
          { path: [[520, 210], [340, 210], [140, 210], [-60, 210]], keys: [[0.6, 0], [4, 1]], color: '#a4243b' },
        ],
      },
      {
        dur: 6,
        text: 'Turning LEFT: signal left early, keep to the left lane, and take the corner tight. Watch the zebra as you turn.',
        cars: [{
          path: [[210, 380], [210, 300], [210, 268], [202, 240], [178, 218], [140, 210], [60, 210], [-40, 210]],
          keys: [[0, 0], [5.4, 1]], color: YOU, you: true, blink: 'left', blinkT: [0, 5], showPath: true,
        }],
      },
      {
        dur: 8,
        text: 'Turning RIGHT: signal right, move to the lane nearest the centre line, YIELD to oncoming traffic, then turn past the centre of the crossing.',
        cars: [
          {
            path: [[232, 380], [232, 310], [232, 288], [234, 250], [244, 216], [262, 190], [292, 168], [340, 152], [420, 150], [520, 150]],
            keys: [[0, 0], [1.6, 0.24], [4.4, 0.24], [7.6, 1]], color: YOU, you: true, blink: 'right', blinkT: [0, 7], brakeT: [1.4, 4.4], showPath: true,
          },
          { path: [[270, -40], [270, 120], [270, 260], [270, 420]], keys: [[0.6, 0], [4.2, 1]], color: '#3a6b52' },
        ],
      },
      {
        dur: 7,
        text: 'Yellow box = keep it CLEAR. Even on green, enter the crossing only if your exit is free. Blocking the box jams the whole junction.',
        extra: (ctx) => { boxJunction(ctx); signal(ctx, 316, 262, 'green'); },
        cars: [
          { path: [[210, 380], [210, 340], [210, 292]], keys: [[0, 0], [2, 1]], color: YOU, you: true, brakeT: [1, 99] },
          { path: [[210, 96], [210, 92]], keys: [[0, 0], [7, 1]], color: '#4f5d75', brakeT: [0, 99] },
          { path: [[210, 52], [210, 50]], keys: [[0, 0], [7, 1]], color: '#d9822b', brakeT: [0, 99] },
        ],
      },
      {
        quiz: {
          q: 'At an uncontrolled crossroads, who gets priority?',
          opts: ['Traffic approaching from your right', 'Whoever honks first', 'The bigger vehicle'],
          ans: 0,
        },
      },
      {
        quiz: {
          q: 'Before turning right at a crossing, you should…',
          opts: ['Cut across quickly from the left lane', 'Move near the centre line, signal right, and yield to oncoming traffic', 'Stop mid-junction and wave others through'],
          ans: 1,
        },
      },
    ],
  };

  // roundabout entry: south approach joins the ring just past the bottom (θ = 0.62π)
  const joinS = ring(0.62 * PI, 0.62 * PI)[0];
  const ROUND = {
    id: 'round', icon: '🔄', title: 'Roundabout',
    blurb: 'Clockwise only, yield to circulating traffic, signal your exit.',
    bg: roundBg,
    steps: [
      {
        dur: 7,
        text: 'A roundabout has NO signals — it runs on one rule: traffic already circulating has right of way. Slow down and look RIGHT before entering.',
        cars: [
          { path: [...entryS, [212, 296]], keys: [[0, 0], [1.6, 1]], color: YOU, you: true, brakeT: [1, 99] },
          { path: ring(0.1 * PI, 2.1 * PI, 24), keys: [[0, 0], [7, 1]], color: '#a4243b' },
        ],
      },
      {
        dur: 6.5,
        text: 'Turning LEFT (1st exit)? Signal LEFT on approach, stay in the outer lane, and peel off at the first exit.',
        cars: [{
          path: [...entryS, joinS, ...ring(0.68 * PI, 0.88 * PI, 4), [150, 214], [80, 210], [-40, 210]],
          keys: [[0, 0], [6, 1]], color: YOU, you: true, blink: 'left', blinkT: [0, 6], showPath: true,
        }],
      },
      {
        dur: 7.5,
        text: 'Going STRAIGHT? No signal on entry. Circulate clockwise past the first exit, then signal LEFT just before yours.',
        cars: [{
          path: [...entryS, joinS, ...ring(0.68 * PI, 1.32 * PI, 8), [206, 108], [210, 60], [210, -40]],
          keys: [[0, 0], [7, 1]], color: YOU, you: true, blink: 'left', blinkT: [4.6, 7], showPath: true,
        }],
      },
      {
        dur: 8.5,
        text: 'Turning RIGHT (3rd exit)? Signal RIGHT on approach, keep closer to the island, go three-quarters around, then signal LEFT to exit.',
        cars: [{
          path: [...entryS, joinS, ...ring(0.68 * PI, 1.78 * PI, 12), [310, 142], [360, 150], [520, 150]],
          keys: [[0, 0], [8, 1]], color: YOU, you: true, blink: 'right', blinkT: [0, 4.5], blink2: 'left', blink2T: [5.8, 8], showPath: true,
        }],
      },
      {
        dur: 6,
        text: 'NEVER cut anti-clockwise for a shortcut — it puts you head-on with everyone. Clockwise, always, with the island on your RIGHT.',
        cars: [
          { path: ring(0.35 * PI, 2.35 * PI, 24), keys: [[0, 0], [6, 1]], color: '#3a6b52' },
          { path: ring(1.15 * PI, -0.85 * PI, 24), keys: [[0, 0], [6, 1]], color: '#8e2f2f', cross: true },
        ],
      },
      {
        quiz: {
          q: 'Who has right of way at a roundabout?',
          opts: ['Vehicles entering the roundabout', 'The fastest vehicle', 'Traffic already circulating — coming from your right'],
          ans: 2,
        },
      },
      {
        quiz: {
          q: 'Which way do you go around a roundabout in India?',
          opts: ['Clockwise, keeping the island on your right', 'Anti-clockwise', 'Whichever side looks emptier'],
          ans: 0,
        },
      },
    ],
  };

  const LESSONS = { cross: CROSS, round: ROUND };

  /* ---------- engine ---------- */
  const T = { cv: null, ctx: null, lesson: null, step: 0, t: 0, raf: 0, last: 0 };
  const $ = (id) => document.getElementById(id);

  function drawStep(step, t) {
    const ctx = T.ctx;
    T.lesson.bg(ctx);
    if (step.extra) step.extra(ctx, t);
    for (const c of step.cars || []) {
      if (c.showPath) {
        ctx.strokeStyle = 'rgba(125,211,252,0.55)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        for (let u = 0; u <= 1.001; u += 0.02) {
          const p = sample(c.path, u);
          u === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for (const c of step.cars || []) {
      const u = ku(c.keys, t);
      const p = pose(c.path, u);
      let blink = null;
      if (c.blink && t >= c.blinkT[0] && t <= c.blinkT[1]) blink = c.blink;
      if (c.blink2 && t >= c.blink2T[0] && t <= c.blink2T[1]) blink = c.blink2;
      drawCar(ctx, p.x, p.y, p.ang, c.color, {
        you: c.you,
        blink,
        blinkOn: blink && Math.floor(t * 4) % 2 === 0,
        brake: c.brakeT && t >= c.brakeT[0] && t <= c.brakeT[1],
        cross: c.cross,
      });
    }
    for (const pd of step.peds || []) {
      if (t < pd.t0 || t > pd.t1) continue;
      const k = (t - pd.t0) / (pd.t1 - pd.t0);
      const x = pd.from[0] + (pd.to[0] - pd.from[0]) * k;
      const y = pd.from[1] + (pd.to[1] - pd.from[1]) * k;
      RA.spr.ped(ctx, x, y, t * 9, '#e07a5f');
    }
    // loop progress bar
    ctx.fillStyle = 'rgba(232,227,213,0.25)';
    ctx.fillRect(0, H - 4, W, 4);
    ctx.fillStyle = 'rgba(125,211,252,0.8)';
    ctx.fillRect(0, H - 4, W * (t / step.dur), 4);
  }

  function loop(now) {
    T.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - T.last) / 1000);
    T.last = now;
    const step = T.lesson.steps[T.step];
    if (!step || step.quiz) return;
    T.t = (T.t + dt) % step.dur;
    drawStep(step, T.t);
  }

  function showStep() {
    const step = T.lesson.steps[T.step];
    const animSteps = T.lesson.steps.filter(s => !s.quiz).length;
    $('lesson-title').textContent = `${T.lesson.icon} ${T.lesson.title}`;
    $('lesson-dots').innerHTML = T.lesson.steps
      .map((s, i) => `<span class="dot ${i === T.step ? 'on' : ''} ${s.quiz ? 'q' : ''}"></span>`).join('');
    $('lesson-prev').disabled = T.step === 0;
    $('lesson-next').textContent = T.step === T.lesson.steps.length - 1 ? '✅ Finish' : 'Next ▶';
    const quizBox = $('lesson-quiz');
    if (step.quiz) {
      T.cv.style.display = 'none';
      $('lesson-text').textContent = '';
      quizBox.innerHTML = `
        <div class="tut-q">🛑 Quick check: <b>${step.quiz.q}</b></div>
        ${step.quiz.opts.map((o, i) => `<button class="btn opt" data-i="${i}">${o}</button>`).join('')}
        <div class="quiz-result"></div>`;
      quizBox.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = +b.dataset.i === step.quiz.ans;
        quizBox.querySelectorAll('.opt').forEach((bb, i) => {
          bb.disabled = true;
          if (i === step.quiz.ans) bb.classList.add('right');
        });
        if (!ok) b.classList.add('wrongpick');
        quizBox.querySelector('.quiz-result').innerHTML = ok
          ? '<span class="good">✅ Correct!</span>'
          : '<span class="bad">❌ The highlighted answer is the safe one.</span>';
        RA.audio.ensure();
        ok ? RA.audio.win() : RA.audio.wrong();
      });
    } else {
      T.cv.style.display = 'block';
      quizBox.innerHTML = '';
      const idx = T.lesson.steps.slice(0, T.step + 1).filter(s => !s.quiz).length;
      $('lesson-text').innerHTML = `<b>Step ${idx}/${animSteps}:</b> ${step.text}`;
      T.t = 0;
    }
  }

  function openLesson(id) {
    T.lesson = LESSONS[id];
    T.step = 0;
    $('school-pick').hidden = true;
    $('lesson-view').hidden = false;
    showStep();
    if (!T.raf) { T.last = performance.now(); T.raf = requestAnimationFrame(loop); }
  }

  function closeLesson() {
    $('lesson-view').hidden = true;
    $('school-pick').hidden = false;
    if (T.raf) { cancelAnimationFrame(T.raf); T.raf = 0; }
    T.lesson = null;
    refreshBadges();
  }

  function finishLesson() {
    localStorage.setItem('ra_tut_' + T.lesson.id, '1');
    RA.ui.toast(`🎓 ${T.lesson.title} lesson complete!`, 'good');
    closeLesson();
  }

  function refreshBadges() {
    document.querySelectorAll('.lesson-card').forEach(el => {
      const done = localStorage.getItem('ra_tut_' + el.dataset.l) === '1';
      el.querySelector('.lc-done').textContent = done ? '✅ Completed' : '▶ Start lesson';
      el.classList.toggle('done', done);
    });
  }

  return {
    init() {
      T.cv = $('tut-canvas');
      T.ctx = T.cv.getContext('2d');
      $('btn-school').onclick = () => { RA.audio.click(); refreshBadges(); RA.ui.showScreen('school'); };
      $('school-back').onclick = () => {
        RA.audio.click();
        if (T.lesson) closeLesson();
        else RA.ui.showScreen('menu');
      };
      document.querySelectorAll('.lesson-card').forEach(el =>
        el.onclick = () => { RA.audio.ensure(); RA.audio.click(); openLesson(el.dataset.l); });
      $('lesson-prev').onclick = () => { RA.audio.click(); if (T.step > 0) { T.step--; showStep(); } };
      $('lesson-next').onclick = () => {
        RA.audio.click();
        if (T.step >= T.lesson.steps.length - 1) finishLesson();
        else { T.step++; showStep(); }
      };
      refreshBadges();
    },
  };
})();
