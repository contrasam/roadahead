/* RoadAhead — DOM UI: HUD, toasts, challan cards, quiz, phone, screens */
window.RA = window.RA || {};

RA.ui = (function () {
  const $ = (id) => document.getElementById(id);
  const ui = { phoneOpen: false };
  let els = {};

  ui.init = function () {
    els = {
      score: $('hud-score'), streak: $('hud-streak'), lic: $('hud-lic'),
      fines: $('hud-fines'), dist: $('hud-dist'), dmg: $('hud-dmg'),
      speed: $('speed-val'), speedo: $('speedo'),
      toasts: $('toasts'),
      screens: ['menu', 'howto', 'rulebook', 'gameover', 'pause'].reduce((o, k) => (o[k] = $(k), o), {}),
    };

    $('btn-start').onclick = () => { RA.audio.ensure(); RA.audio.click(); RA.game.start(); };
    $('btn-howto').onclick = () => { RA.audio.click(); ui.showScreen('howto'); };
    $('btn-rules').onclick = () => { RA.audio.click(); ui.buildRulebook(); ui.showScreen('rulebook'); };
    for (const b of document.querySelectorAll('.btn-back')) b.onclick = () => { RA.audio.click(); ui.showScreen('menu'); };
    $('btn-again').onclick = () => { RA.audio.click(); RA.game.start(); };
    $('btn-go-menu').onclick = () => { RA.audio.click(); RA.game.state = 'menu'; ui.showScreen('menu'); };
    $('btn-resume').onclick = () => RA.game.togglePause();
    $('btn-end-drive').onclick = () => { ui.showScreen(null); RA.game.endDrive(); };
    $('btn-mute').onclick = () => ui.toggleMute();
    $('btn-pause').onclick = () => RA.game.togglePause();
    ui.syncMute();

    const best = localStorage.getItem('ra_best');
    if (best) $('menu-best').textContent = `Best Safety Score: ${(+best).toLocaleString('en-IN')}`;
  };

  ui.clearOverlays = function () {
    document.querySelectorAll('.dyn').forEach(el => el.remove());
    ui.phoneOpen = false;
  };

  ui.toggleMute = function () {
    RA.audio.ensure();
    RA.audio.toggleMute();
    ui.syncMute();
  };
  ui.syncMute = function () {
    $('btn-mute').textContent = RA.audio.muted ? '🔇' : '🔊';
  };

  ui.showScreen = function (name) {
    for (const k in els.screens) els.screens[k].classList.toggle('show', k === name);
    document.body.classList.toggle('in-game', !name);
  };

  /* ---------------- HUD ---------------- */
  let lastHud = '';
  ui.hud = function (g) {
    const kmh = g.kmh();
    const key = `${g.score}|${g.streak}|${g.licensePts}|${g.fines}|${kmh}|${g.damage}|${Math.floor(g.distM() / 10)}`;
    if (key === lastHud) return;
    lastHud = key;
    els.score.textContent = g.score.toLocaleString('en-IN');
    els.streak.textContent = g.streak > 1 ? `🔥 ×${g.mult().toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}` : '';
    els.lic.textContent = `🪪 ${g.licensePts}`;
    els.lic.classList.toggle('danger', g.licensePts <= 4);
    els.fines.textContent = g.fines ? RA.fmtINR(g.fines) : '₹0';
    els.dist.textContent = (g.distM() / 1000).toFixed(1) + ' km';
    els.dmg.textContent = '❤️'.repeat(Math.max(0, 3 - g.damage)) + '🖤'.repeat(Math.min(3, g.damage));
    els.speed.textContent = kmh;
    els.speedo.classList.toggle('fast', kmh > 60);
  };

  /* ---------------- toasts ---------------- */
  ui.toast = function (text, cls) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = text;
    els.toasts.appendChild(el);
    while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2400);
  };

  /* ---------------- challan card ---------------- */
  ui.challan = function (rule, onClose) {
    const wrap = document.createElement('div');
    wrap.className = 'modal show challan-modal dyn';
    wrap.innerHTML = `
      <div class="card challan">
        <div class="challan-head">🚔 E-CHALLAN ISSUED</div>
        <div class="challan-emoji">${rule.emoji}</div>
        <h3>${rule.title}</h3>
        <p class="challan-bad">${rule.bad}</p>
        <div class="challan-fine">FINE: <b>${RA.fmtINR(rule.fine)}</b> · ${rule.sec}</div>
        <div class="challan-lp">−${rule.lp} license points</div>
        <p class="tip">💡 ${rule.tip}</p>
        <button class="btn primary">Pay & Drive On 😅</button>
      </div>`;
    document.getElementById('wrap').appendChild(wrap);
    wrap.querySelector('button').onclick = () => {
      RA.audio.click();
      wrap.remove();
      onClose();
    };
  };

  /* ---------------- phone distraction ---------------- */
  ui.phone = function (onAnswer, onIgnore) {
    ui.phoneOpen = true;
    const wrap = document.createElement('div');
    wrap.className = 'phone-pop dyn';
    wrap.innerHTML = `
      <div class="phone-card">
        <div class="phone-ring">📱</div>
        <div>
          <b>Incoming call…</b><br><span class="phone-who">Mummy ❤️</span>
        </div>
        <div class="phone-btns">
          <button class="btn tiny green" data-a="1">Answer</button>
          <button class="btn tiny red" data-a="0">Decline</button>
        </div>
      </div>`;
    document.getElementById('wrap').appendChild(wrap);
    const close = () => { ui.phoneOpen = false; wrap.remove(); clearTimeout(tm); };
    const tm = setTimeout(() => { close(); onIgnore(); }, 5000);
    wrap.querySelectorAll('button').forEach(b => b.onclick = () => {
      const answered = b.dataset.a === '1';
      close();
      if (answered) onAnswer(); else onIgnore();
    });
  };

  /* ---------------- sign quiz ---------------- */
  let quizIdx = -1;
  ui.quiz = function (done) {
    const signs = RA.SIGNS;
    quizIdx = (quizIdx + 1 + Math.floor(Math.random() * (signs.length - 1))) % signs.length;
    const sign = signs[quizIdx];
    const opts = [sign.name, ...sign.wrong].map((v, i) => ({ v, ok: i === 0 }))
      .sort(() => Math.random() - 0.5);
    const wrap = document.createElement('div');
    wrap.className = 'modal show dyn';
    wrap.innerHTML = `
      <div class="card quiz">
        <div class="quiz-head">🛑 SIGN CHECK — what does this mean?</div>
        <div class="quiz-sign">${sign.svg}</div>
        <div class="quiz-opts">
          ${opts.map((o, i) => `<button class="btn opt" data-i="${i}">${o.v}</button>`).join('')}
        </div>
        <div class="quiz-result"></div>
      </div>`;
    document.getElementById('wrap').appendChild(wrap);
    const res = wrap.querySelector('.quiz-result');
    wrap.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const o = opts[+b.dataset.i];
      wrap.querySelectorAll('.opt').forEach((bb, i) => {
        bb.disabled = true;
        if (opts[i].ok) bb.classList.add('right');
      });
      if (o.ok) {
        RA.audio.win();
        res.innerHTML = `<span class="good">✅ Correct! +200 — "${sign.name}"</span>`;
      } else {
        RA.audio.wrong();
        b.classList.add('wrongpick');
        res.innerHTML = `<span class="bad">❌ It means "${sign.name}". Remember it!</span>`;
      }
      setTimeout(() => { wrap.remove(); done(o.ok); }, 1600);
    });
  };

  /* ---------------- rule book ---------------- */
  ui.buildRulebook = function () {
    const list = $('rulebook-list');
    if (list.dataset.built) return;
    list.dataset.built = '1';
    let html = '<h3>⚖️ Fines you\'ll want to avoid</h3>';
    for (const id in RA.RULES) {
      const r = RA.RULES[id];
      html += `
        <div class="rb-rule">
          <div class="rb-emoji">${r.emoji}</div>
          <div>
            <b>${r.title}</b> <span class="rb-fine">${r.fine ? RA.fmtINR(r.fine) : 'Safety first'}</span>
            <small>${r.sec}</small>
            <p>${r.tip}</p>
          </div>
        </div>`;
    }
    html += '<h3>🪧 Know your signs</h3><div class="rb-signs">';
    for (const s of RA.SIGNS) {
      html += `<div class="rb-sign">${s.svg}<span>${s.name}</span></div>`;
    }
    html += '</div>';
    list.innerHTML = html;
  };

  /* ---------------- game over ---------------- */
  ui.gameOver = function (g, reason, best) {
    const grade = RA.gradeFor(g.score);
    const titles = {
      suspended: ['🚫 LICENSE SUSPENDED', 'You ran out of license points. Time for driving school!'],
      wrecked: ['💥 VEHICLE WRECKED', 'Three crashes and your ride gave up. Drive gently!'],
      parked: ['🅿️ PARKED SAFELY', 'You ended the drive on your own terms. Very sensible.'],
    };
    const [title, sub] = titles[reason] || titles.parked;
    $('go-title').textContent = title;
    $('go-sub').textContent = sub;
    $('go-grade').innerHTML = `<span class="go-badge">${grade.badge}</span><b>${grade.name}</b><small>${grade.line}</small>`;
    $('go-stats').innerHTML = `
      <div><span>Safety Score</span><b>${g.score.toLocaleString('en-IN')}</b></div>
      <div><span>Distance</span><b>${(g.distM() / 1000).toFixed(1)} km</b></div>
      <div><span>Rules followed</span><b>${g.followed}</b></div>
      <div><span>Best streak</span><b>🔥 ${g.bestStreak}</b></div>
      <div><span>Challans paid</span><b class="${g.fines ? 'bad' : 'good'}">${RA.fmtINR(g.fines)}</b></div>
      <div><span>Best score</span><b>${best.toLocaleString('en-IN')}</b></div>`;
    const vids = Object.keys(g.violations);
    $('go-lessons').innerHTML = vids.length
      ? '<h4>📚 Revise before your next drive:</h4>' + vids.map(id => {
          const r = RA.RULES[id];
          return `<div class="go-lesson">${r.emoji} <b>${r.title}</b> ×${g.violations[id]} — ${r.tip}</div>`;
        }).join('')
      : '<div class="go-lesson perfect">🌟 ZERO violations. You are the driver India needs!</div>';
    ui.showScreen('gameover');
  };

  return ui;
})();
