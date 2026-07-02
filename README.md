# 🚦 RoadAhead — Drive Smart India 🇮🇳

An HTML5 arcade game that teaches **Indian road rules** the fun way: drive through a
busy Indian street, earn **Safety Points** for doing the right thing, and get slapped
with realistic **e-challans** (fines + license points) when you don't.

No build step, no dependencies — pure HTML5 canvas + vanilla JS.

## ▶️ Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works on desktop (keyboard) and mobile (touch buttons + swipe).

## 🎮 Controls

| Action | Keys | Touch |
|---|---|---|
| Change lane | ← → / A D | ◀ ▶ buttons or swipe |
| Accelerate / brake | ↑ ↓ / W S | GAS / BRAKE pedals |
| Horn (nudges slow traffic aside) | H / Space | 📯 |
| Pause / Mute | P / M | ⏸ 🔊 |

## 🧠 What it teaches

Every scenario is a real Indian road rule, with real MV Act fine amounts:

- 🚦 **Red lights** — stop behind the line, wait for green (₹5,000, Sec 184)
- 🚸 **Zebra crossings** — pedestrians have right of way (₹500)
- 🚑 **Ambulances** — hear the siren, change lanes, give way (₹10,000, Sec 194E)
- 🏫 **School zones** — under 25 km/h or the camera flashes (₹2,000)
- 📸 **Speed cameras** — respect posted limits (₹2,000, Sec 183)
- 🔇 **Hospital silence zones** — no honking, even at that slow auto (₹1,000, Sec 194F)
- 🚂 **Railway gates** — wait, always (₹10,000)
- 📱 **Phone calls while driving** — decline them (₹5,000, Sec 184)
- 🐄 **Stray cattle** — slow down, pass with care
- 💥 **Safe distance** — tailgating and crashes cost you

Plus **road-sign quizzes** every 400 m (Indian sign conventions: red circles =
prohibition, red triangles = caution, blue = information) and a full **Rule Book**
from the menu.

## 🏆 Scoring

- Correct behaviour earns points, boosted by a 🔥 **streak multiplier** (up to ×3).
- Violations issue an **e-challan**: money gone, **license points** gone (start with 12),
  streak reset — and a tip explaining the rule.
- Lose all 12 license points → **license suspended**. Crash 3 times → wrecked.
- Finish grades range from 🛺 *Learner* to 🏆 *Road Guru*.

## 🗂 Structure

```
index.html      shell + HUD + screens
styles.css      Indian-flag themed UI
src/rules.js    rule data, fines, SVG road signs, constants
src/sprites.js  canvas sprites (cars, trucks, autos, cow, train…)
src/audio.js    WebAudio SFX (siren, horn, bell, crash — no assets)
src/input.js    keyboard, touch buttons, swipe
src/entities.js traffic + rule scenarios (signal, zebra, ambulance…)
src/game.js     game loop, world render, scoring, event director
src/ui.js       HUD, toasts, challan cards, quiz, screens
src/main.js     boot
```
