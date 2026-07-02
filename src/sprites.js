/* RoadAhead — canvas sprite drawing (top-down, pixel-art flavour) */
window.RA = window.RA || {};

RA.spr = (function () {
  const S = {};

  function wheel(ctx, x, y, w, h) {
    ctx.fillStyle = '#15151a';
    ctx.fillRect(x, y, w, h);
  }

  /* Generic car, x = centre, y = front bumper (top). */
  S.car = function (ctx, x, y, w, h, color, opts = {}) {
    const l = x - w / 2;
    wheel(ctx, l - 3, y + 8, 6, 14);
    wheel(ctx, l + w - 3, y + 8, 6, 14);
    wheel(ctx, l - 3, y + h - 22, 6, 14);
    wheel(ctx, l + w - 3, y + h - 22, 6, 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(l, y, w, h, 8);
    ctx.fill();
    // windshield + rear glass
    ctx.fillStyle = 'rgba(20,26,40,0.85)';
    ctx.fillRect(l + 5, y + 12, w - 10, 12);
    ctx.fillRect(l + 5, y + h - 20, w - 10, 9);
    // roof
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(l + 6, y + 28, w - 12, h - 52);
    if (opts.plate) {
      ctx.fillStyle = '#f2f2e6';
      ctx.fillRect(x - 9, y + h - 8, 18, 7);
      ctx.fillStyle = '#c1121f';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(opts.plate, x, y + h - 2);
    }
    if (opts.brake) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(l + 3, y + h - 4, 8, 4);
      ctx.fillRect(l + w - 11, y + h - 4, 8, 4);
    }
  };

  S.player = function (ctx, x, y, blink) {
    if (blink && Math.floor(performance.now() / 90) % 2) return; // invulnerable flicker
    S.car(ctx, x, y, 44, 76, '#2f7bd9', { plate: 'L', brake: false });
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(x - 16, y + 2, 8, 5);
    ctx.fillRect(x + 8, y + 2, 8, 5);
  };

  S.auto = function (ctx, x, y) { // auto-rickshaw
    const w = 36, h = 54, l = x - w / 2;
    wheel(ctx, x - 4, y - 2, 8, 10);
    wheel(ctx, l - 2, y + h - 14, 6, 12);
    wheel(ctx, l + w - 4, y + h - 14, 6, 12);
    ctx.fillStyle = '#f7c531';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(l + w, y + 18);
    ctx.lineTo(l + w, y + h);
    ctx.lineTo(l, y + h);
    ctx.lineTo(l, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1f4d2e'; // green canopy
    ctx.fillRect(l + 3, y + 20, w - 6, h - 26);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(l + 6, y + 24, w - 12, 8);
  };

  S.truck = function (ctx, x, y, color) {
    const w = 52, h = 118, l = x - w / 2;
    wheel(ctx, l - 3, y + 10, 6, 14);
    wheel(ctx, l + w - 3, y + 10, 6, 14);
    wheel(ctx, l - 3, y + h - 40, 6, 14);
    wheel(ctx, l + w - 3, y + h - 40, 6, 14);
    wheel(ctx, l - 3, y + h - 20, 6, 14);
    wheel(ctx, l + w - 3, y + h - 20, 6, 14);
    // cab
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(l + 2, y, w - 4, 30, 6); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,40,0.85)';
    ctx.fillRect(l + 7, y + 8, w - 14, 10);
    // cargo box, Indian truck-art style
    ctx.fillStyle = '#d9822b';
    ctx.fillRect(l, y + 34, w, h - 34);
    ctx.strokeStyle = '#7a3b12';
    ctx.lineWidth = 3;
    ctx.strokeRect(l + 2.5, y + 36.5, w - 5, h - 39);
    ctx.fillStyle = '#2e7d46';
    ctx.fillRect(l + 6, y + 42, w - 12, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HORN OK', x, y + h - 16);
    ctx.fillText('PLEASE', x, y + h - 8);
  };

  S.bus = function (ctx, x, y) {
    const w = 50, h = 132, l = x - w / 2;
    for (const wy of [10, h / 2 - 7, h - 24]) {
      wheel(ctx, l - 3, y + wy, 6, 14);
      wheel(ctx, l + w - 3, y + wy, 6, 14);
    }
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.roundRect(l, y, w, h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,40,0.85)';
    ctx.fillRect(l + 5, y + 8, w - 10, 12);
    ctx.fillStyle = '#e8e3d5';
    ctx.fillRect(l + 5, y + 26, w - 10, h - 44);
    ctx.fillStyle = 'rgba(20,26,40,0.5)';
    for (let i = 0; i < 5; i++) ctx.fillRect(l + 8, y + 32 + i * 18, w - 16, 8);
  };

  S.bike = function (ctx, x, y) {
    ctx.fillStyle = '#15151a';
    ctx.fillRect(x - 3, y, 6, 12);
    ctx.fillRect(x - 3, y + 40, 6, 12);
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(x - 6, y + 10, 12, 32);
    ctx.fillStyle = '#f4d1ae'; // rider
    ctx.beginPath(); ctx.arc(x, y + 22, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; // helmet!
    ctx.beginPath(); ctx.arc(x, y + 22, 7, Math.PI, 0); ctx.fill();
  };

  S.ambulance = function (ctx, x, y, t) {
    const w = 48, h = 86, l = x - w / 2;
    wheel(ctx, l - 3, y + 10, 6, 14);
    wheel(ctx, l + w - 3, y + 10, 6, 14);
    wheel(ctx, l - 3, y + h - 24, 6, 14);
    wheel(ctx, l + w - 3, y + h - 24, 6, 14);
    ctx.fillStyle = '#f4f4ef';
    ctx.beginPath(); ctx.roundRect(l, y, w, h, 7); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,40,0.85)';
    ctx.fillRect(l + 5, y + 10, w - 10, 11);
    ctx.fillStyle = '#c1121f'; // red cross
    ctx.fillRect(x - 4, y + 34, 8, 26);
    ctx.fillRect(x - 13, y + 43, 26, 8);
    // flashing light bar
    const on = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(l + 8, y + 3, 14, 6);
    ctx.fillStyle = on ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(l + w - 22, y + 3, 14, 6);
  };

  S.cow = function (ctx, x, y, dir, step) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);
    const bob = Math.sin(step) * 1.5;
    ctx.fillStyle = '#15151a'; // legs
    ctx.fillRect(-18, -14 + bob, 5, 8);
    ctx.fillRect(10, -14 - bob, 5, 8);
    ctx.fillRect(-18, 7 + bob, 5, 8);
    ctx.fillRect(10, 7 - bob, 5, 8);
    ctx.fillStyle = '#efe6d8'; // body
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#a9743f';
    ctx.beginPath(); ctx.ellipse(-6, -3, 8, 6, 0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, 5, 6, 4, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#efe6d8'; // head
    ctx.beginPath(); ctx.ellipse(26, 0, 9, 7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d8d3c8'; // horns
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(28, -6); ctx.quadraticCurveTo(34, -12, 30, -14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, 6); ctx.quadraticCurveTo(34, 12, 30, 14); ctx.stroke();
    ctx.fillStyle = '#15151a';
    ctx.fillRect(30, -2, 3, 3);
    ctx.restore();
  };

  S.ped = function (ctx, x, y, step, shirt) {
    const sw = Math.sin(step) * 4;
    ctx.fillStyle = '#3b2c22'; // legs
    ctx.fillRect(x - 5 + sw / 2, y + 4, 4, 7);
    ctx.fillRect(x + 1 - sw / 2, y + 4, 4, 7);
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.ellipse(x, y, 8, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#20140d';
    ctx.beginPath(); ctx.arc(x, y - 2, 4.5, 0, 7); ctx.fill();
  };

  /* --- roadside scenery --- */
  S.tree = function (ctx, x, y) {
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x - 3, y - 4, 6, 10);
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath(); ctx.arc(x, y - 10, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#54964d';
    ctx.beginPath(); ctx.arc(x - 6, y - 14, 9, 0, 7); ctx.fill();
  };

  S.stall = function (ctx, x, y) { // chai stall
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x - 16, y - 8, 32, 20);
    ctx.fillStyle = '#c1121f';
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#c1121f' : '#f2e8cf';
      ctx.fillRect(x - 18 + i * 9, y - 14, 9, 7);
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHAI', x, y + 4);
  };

  S.shop = function (ctx, x, y, hue) {
    ctx.fillStyle = hue;
    ctx.fillRect(x - 20, y - 16, 40, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 14, y - 4, 12, 16);
    ctx.fillRect(x + 3, y - 4, 12, 16);
    ctx.fillStyle = '#f2e8cf';
    ctx.fillRect(x - 20, y - 22, 40, 8);
  };

  S.hospital = function (ctx, x, y) {
    ctx.fillStyle = '#e8e3d5';
    ctx.fillRect(x - 30, y - 30, 60, 56);
    ctx.fillStyle = '#9db4c0';
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        ctx.fillRect(x - 24 + c * 18, y - 24 + r * 16, 12, 9);
    ctx.fillStyle = '#c1121f';
    ctx.fillRect(x - 4, y - 44, 8, 18);
    ctx.fillRect(x - 9, y - 39, 18, 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 12, y - 47, 24, 22);
    ctx.fillStyle = '#c1121f';
    ctx.fillRect(x - 3, y - 43, 6, 14);
    ctx.fillRect(x - 7, y - 39, 14, 6);
  };

  S.school = function (ctx, x, y) {
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x - 32, y - 24, 64, 50);
    ctx.fillStyle = '#a4243b';
    ctx.beginPath();
    ctx.moveTo(x - 36, y - 24); ctx.lineTo(x, y - 42); ctx.lineTo(x + 36, y - 24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c4632';
    ctx.fillRect(x - 7, y + 6, 14, 20);
    ctx.fillStyle = '#9db4c0';
    ctx.fillRect(x - 26, y - 14, 12, 12);
    ctx.fillRect(x + 14, y - 14, 12, 12);
    ctx.fillStyle = '#1d1d24';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCHOOL', x, y - 28);
  };

  /* roadside sign board on a pole; kind drawn small */
  S.board = function (ctx, x, y, draw) {
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x - 2, y - 18, 4, 26);
    draw(ctx, x, y - 30);
  };

  S.signCircle = function (ctx, x, y, text, sub) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c1121f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
    ctx.fillStyle = '#1d1d24';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 4);
    if (sub) {
      ctx.fillStyle = '#f2e8cf';
      ctx.fillRect(x - 22, y + 17, 44, 12);
      ctx.fillStyle = '#1d1d24';
      ctx.font = 'bold 7px monospace';
      ctx.fillText(sub, x, y + 26);
    }
  };

  S.signTriangle = function (ctx, x, y, emoji, sub) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#c1121f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 15); ctx.lineTo(x + 15, y + 11); ctx.lineTo(x - 15, y + 11);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = '11px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, x, y + 8);
    if (sub) {
      ctx.fillStyle = '#f2e8cf';
      ctx.fillRect(x - 26, y + 15, 52, 12);
      ctx.fillStyle = '#1d1d24';
      ctx.font = 'bold 7px monospace';
      ctx.fillText(sub, x, y + 24);
    }
  };

  S.kmStone = function (ctx, x, y, km) {
    ctx.fillStyle = '#f2e8cf';
    ctx.beginPath(); ctx.roundRect(x - 9, y - 14, 18, 20, [8, 8, 2, 2]); ctx.fill();
    ctx.fillStyle = '#e6b400';
    ctx.beginPath(); ctx.roundRect(x - 9, y - 14, 18, 8, [8, 8, 0, 0]); ctx.fill();
    ctx.fillStyle = '#1d1d24';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(km, x, y + 2);
  };

  /* traffic signal: pole + head beside road, overhead stop line handled by caller */
  S.signalHead = function (ctx, x, y, state) {
    ctx.fillStyle = '#3a3a3f';
    ctx.fillRect(x - 3, y, 6, 40);
    ctx.fillStyle = '#1d1d24';
    ctx.beginPath(); ctx.roundRect(x - 10, y - 44, 20, 48, 5); ctx.fill();
    const lamps = [['red', '#ff3b30', -32], ['yellow', '#ffd23f', -18], ['green', '#2ecc71', -4]];
    for (const [name, col, dy] of lamps) {
      ctx.fillStyle = state === name ? col : '#3a3a3f';
      ctx.beginPath(); ctx.arc(x, y + dy - 2, 6, 0, 7); ctx.fill();
      if (state === name) {
        ctx.fillStyle = col + '44';
        ctx.beginPath(); ctx.arc(x, y + dy - 2, 10, 0, 7); ctx.fill();
      }
    }
  };

  S.train = function (ctx, x, y, dir) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);
    // engine + 3 coaches moving right
    const coach = (cx, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(cx, -16, 92, 32, 5); ctx.fill();
      ctx.fillStyle = '#f2e8cf';
      for (let i = 0; i < 4; i++) ctx.fillRect(cx + 10 + i * 20, -8, 12, 10);
    };
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.roundRect(0, -16, 70, 32, [16, 5, 5, 16]); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(4, -6, 8, 12);
    coach(-98, '#1f5fa8');
    coach(-196, '#1f5fa8');
    coach(-294, '#a4243b');
    ctx.restore();
  };

  return S;
})();
