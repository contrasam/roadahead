import { World, TILE, TILES, LANE } from "./world.js";
import { Car } from "./car.js";
import { Renderer } from "./sprites.js";
import { Input } from "./input.js";
import { Score } from "./score.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input();
    this.world = new World();
    this.renderer = new Renderer(canvas);
    this.car = new Car(this.world.spawn.x, this.world.spawn.y, this.world.spawn.dir);
    this.score = new Score(this.world, (msg, type) => this._flash(msg, type));
    this.time = 0;
    this.running = false;
    this.last = 0;

    // Per-frame rule state for de-duplicating ticker events.
    this._lastApproach = null;
    this._enteredOnRedAt = null;

    this._setupHud();
    this._setupObjective();
  }

  start() {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
    this._flash("Drive! Stay on the LEFT side of the road.", "info");
  }

  _setupHud() {
    this.$score = document.getElementById("score");
    this.$speed = document.getElementById("speed");
    this.$limit = document.getElementById("limit");
    this.$rating = document.getElementById("rating");
    this.$zone = document.getElementById("zone");
    this.$ticker = document.getElementById("ticker");
    this.$objective = document.getElementById("objective");
  }

  _setupObjective() {
    this.objectives = [
      { id: "explore", text: "Explore Old Bazaar — obey signals, stay left" },
      { id: "market", text: "Reach Market District (50 pts to unlock)" },
      { id: "river", text: "Reach Riverside (120 pts)" },
      { id: "highway", text: "Reach the Outer Highway (250 pts)" },
    ];
    this._renderObjective();
  }

  _renderObjective() {
    const next = this.objectives.find((o) => {
      if (o.id === "explore") return this.score.value < 50;
      if (o.id === "market") return !this.score.unlocked.has("market");
      if (o.id === "river") return !this.score.unlocked.has("river");
      if (o.id === "highway") return !this.score.unlocked.has("highway");
      return false;
    });
    this.$objective.innerHTML = next
      ? `<div class="obj">Objective: ${next.text}</div>`
      : `<div class="obj">All zones unlocked — drive safely for a Pro rating.</div>`;
  }

  _flash(msg, type = "info") {
    const el = document.createElement("div");
    el.className = "flash " + type;
    el.textContent = msg;
    this.$ticker.appendChild(el);
    setTimeout(() => el.remove(), 2400);
    if (type === "unlock") this._renderObjective();
  }

  _loop(t) {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;

    this._tick(dt);
    this._draw();

    requestAnimationFrame((tt) => this._loop(tt));
  }

  _tick(dt) {
    // Restart drive.
    if (this.input.consumePressed("r")) {
      this.car.x = this.world.spawn.x;
      this.car.y = this.world.spawn.y;
      this.car.dir = this.world.spawn.dir;
      this.car.vel = 0;
      this._flash("Drive reset.", "info");
    }
    if (this.input.consumePressed("h")) {
      this.car.horn = 1;
      // Silence-zone penalty.
      for (const s of this.world.signs) {
        if (s.kind !== "silence") continue;
        const dx = this.car.x - s.x;
        const dy = this.car.y - s.y;
        if (dx * dx + dy * dy < s.r * s.r) {
          this.score.award("honk-silence", -5, "−5 Honked in silence zone", "bad", 1.5);
          break;
        }
      }
    }

    this.car.update(dt, this.input, this.world);
    this.world.update(dt);

    this._enforceRules(dt);
    this._updateHud();
  }

  _enforceRules(dt) {
    const car = this.car;
    const speed = car.speedKmh;

    // Speed limit by zone.
    const limit = this._currentSpeedLimit();
    if (speed > limit + 5) {
      this.score.award("overspeed", -10, `−10 Over speed limit (${speed} > ${limit})`, "bad", 2.0);
    }

    // Drive on the LEFT (India). Facing east, "left" is north — east-bound
    // belongs in the NORTH lane. Facing south, "left" is east — south-bound
    // belongs in the EAST lane. Intersections (road_x) are exempt.
    const tile = this.world.tileAt(car.x, car.y);
    const cardinal = this._cardinalDir(car.dir);
    if (Math.abs(car.vel) > 30) {
      if (tile === TILES.road_h) {
        const tileR = Math.floor(car.y / TILE);
        const centerY = tileR * TILE + TILE / 2;
        const south = car.y > centerY;
        if ((cardinal === "E" && south) || (cardinal === "W" && !south)) {
          this.score.award("wrong-side", -10, "−10 Wrong side of road", "bad", 2.5);
        }
      } else if (tile === TILES.road_v) {
        const tileC = Math.floor(car.x / TILE);
        const centerX = tileC * TILE + TILE / 2;
        const west = car.x < centerX;
        if ((cardinal === "S" && west) || (cardinal === "N" && !west)) {
          this.score.award("wrong-side", -10, "−10 Wrong side of road", "bad", 2.5);
        }
      }
    }

    // Off-road penalty (light).
    if (!this.world.isRoad(car.x, car.y) && Math.abs(car.vel) > 20) {
      this.score.award("offroad", -2, "−2 Off road", "bad", 3.0);
    }

    // Traffic-light enforcement.
    let nearestLight = null;
    let nearestD = Infinity;
    for (const l of this.world.lights) {
      const d = Math.hypot(l.x - car.x, l.y - car.y);
      if (d < nearestD) {
        nearestD = d;
        nearestLight = l;
      }
    }
    if (nearestLight && nearestD < 60) {
      const dir = this._cardinalDir(car.dir);
      const state = this.world.lightStateFor(nearestLight, dir, this.time);

      // Stop-line proximity by approach direction.
      const stopLineDist = this._stopLineDistance(car, nearestLight, dir);
      const stoppedHere =
        Math.abs(car.vel) < 15 && stopLineDist > -10 && stopLineDist < 24;
      const crossedOnRed =
        state === "red" && stopLineDist < -6 && stopLineDist > -28 && Math.abs(car.vel) > 30;

      if (state === "red" && stoppedHere) {
        this.score.award(`stop-${nearestLight.x}-${nearestLight.y}`, 10, "+10 Stopped at red", "good", 6);
      }
      if (crossedOnRed) {
        this.score.award(`run-${nearestLight.x}-${nearestLight.y}`, -25, "−25 Ran red light!", "bad", 3);
      }
    }

    // Pedestrian / zebra enforcement.
    for (const p of this.world.pedestrians) {
      const d = Math.hypot(p.x - car.x, p.y - car.y);
      if (d < 16) {
        this.score.award("hit-ped", -15, "−15 Hit pedestrian!", "bad", 2.5);
        // bounce
        car.vel *= -0.4;
      }
      // Yielded: pedestrian on zebra within X, car nearly stopped within Y.
      const onZebra = Math.abs(p.x - p.zebra.x) < p.zebra.w / 2 && Math.abs(p.y - p.zebra.y) < p.zebra.h / 2 + 6;
      if (onZebra && d < 70 && Math.abs(car.vel) < 18 && p.cooldown <= 0) {
        this.score.award("yield-ped", 5, "+5 Gave way to pedestrian", "good", 5);
        p.cooldown = 6;
      }
    }
  }

  _currentSpeedLimit() {
    // Take the sign whose region contains the car (smallest radius wins).
    let limit = 40;
    let best = Infinity;
    for (const s of this.world.signs) {
      if (s.kind !== "limit") continue;
      const d = Math.hypot(s.x - this.car.x, s.y - this.car.y);
      if (d < s.r && d < best) {
        best = d;
        limit = s.value;
      }
    }
    return limit;
  }

  _cardinalDir(rad) {
    // 0 = east, pi/2 = south, pi = west, -pi/2 = north
    const a = ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (a < Math.PI / 4 || a >= (7 * Math.PI) / 4) return "E";
    if (a < (3 * Math.PI) / 4) return "S";
    if (a < (5 * Math.PI) / 4) return "W";
    return "N";
  }

  // Positive = stop line is ahead of car (approaching). Negative = passed.
  _stopLineDistance(car, light, dir) {
    const stopOffset = TILE / 2 + 4;
    if (dir === "E") return (light.x - stopOffset) - car.x;
    if (dir === "W") return car.x - (light.x + stopOffset);
    if (dir === "S") return (light.y - stopOffset) - car.y;
    if (dir === "N") return car.y - (light.y + stopOffset);
    return Infinity;
  }

  _updateHud() {
    this.$score.textContent = String(this.score.value);
    this.$speed.textContent = String(this.car.speedKmh);
    this.$limit.textContent = String(this._currentSpeedLimit());
    this.$rating.textContent = this.score.rating();
    const z = this.world.zoneAt(this.car.x, this.car.y);
    this.$zone.textContent = z.name + (this.score.unlocked.has(z.id) ? "" : " (locked)");
  }

  _draw() {
    this.renderer.clear();
    this.renderer.setCamera(this.car.x, this.car.y);
    this.renderer.drawWorld(this.world, this.time);
    this._drawLockedOverlay();
    this.renderer.drawCar(this.car);
  }

  _drawLockedOverlay() {
    // Tint zones that are still locked, so the player can see where to go.
    const ctx = this.renderer.ctx;
    for (const z of this.world.zones) {
      if (this.score.unlocked.has(z.id)) continue;
      const x = z.x - this.renderer.cam.x;
      const y = z.y - this.renderer.cam.y;
      ctx.fillStyle = "rgba(8, 12, 32, 0.55)";
      ctx.fillRect(x, y, z.w, z.h);
      ctx.fillStyle = "#ffcf3a";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`${z.name} — ${z.unlock} pts`, x + 12, y + 24);
    }
  }
}
