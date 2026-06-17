// Simple grid-following traffic. Vehicles ride in the left lane for their
// cardinal direction, brake for red lights, vehicles ahead and pedestrians,
// and pick a new direction when they enter an intersection.

import { TILE, TILES, LANE } from "./world.js";

const DIR_VEC = {
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
};
const HEADING = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
const STRAIGHT = { E: "E", W: "W", N: "N", S: "S" };
const LEFT_TURN = { E: "N", N: "W", W: "S", S: "E" };
const RIGHT_TURN = { E: "S", S: "W", W: "N", N: "E" };

const TYPES = [
  { kind: "car", w: 30, h: 16, max: 130, accel: 80, color: "#4d7cff", trim: "#27437f" },
  { kind: "car", w: 30, h: 16, max: 130, accel: 80, color: "#e85e3f", trim: "#7b2e1d" },
  { kind: "car", w: 30, h: 16, max: 130, accel: 80, color: "#7ac46a", trim: "#3a6f30" },
  { kind: "car", w: 30, h: 16, max: 130, accel: 80, color: "#c66bb4", trim: "#6f2e62" },
  { kind: "auto", w: 22, h: 16, max: 100, accel: 70, color: "#ffd23f", trim: "#1f1f1f" },
  { kind: "auto", w: 22, h: 16, max: 100, accel: 70, color: "#1f1f1f", trim: "#ffd23f" },
  { kind: "truck", w: 38, h: 18, max: 90, accel: 50, color: "#a06a3a", trim: "#3a2618" },
];

export class Traffic {
  constructor(world, count = 20) {
    this.world = world;
    this.vehicles = [];
    for (let i = 0; i < count; i++) {
      const v = this._spawnRandom();
      if (v) this.vehicles.push(v);
    }
  }

  _spawnRandom() {
    // Pick a random road row or column and a tile along it.
    const tries = 40;
    for (let n = 0; n < tries; n++) {
      const horizontal = Math.random() < 0.5;
      if (horizontal) {
        const r = this.world.rows
          ? Math.floor(Math.random() * this.world.rows)
          : 0;
        const c = Math.floor(Math.random() * this.world.cols);
        if (this.world.tiles[r][c].t !== TILES.road_h) continue;
        const dir = Math.random() < 0.5 ? "E" : "W";
        const cx = c * TILE + Math.random() * TILE;
        const cy = r * TILE + TILE / 2 + (dir === "E" ? -LANE / 2 : LANE / 2);
        return this._makeVehicle(cx, cy, dir);
      } else {
        const r = Math.floor(Math.random() * this.world.rows);
        const c = Math.floor(Math.random() * this.world.cols);
        if (this.world.tiles[r][c].t !== TILES.road_v) continue;
        const dir = Math.random() < 0.5 ? "S" : "N";
        const cx = c * TILE + TILE / 2 + (dir === "S" ? LANE / 2 : -LANE / 2);
        const cy = r * TILE + Math.random() * TILE;
        return this._makeVehicle(cx, cy, dir);
      }
    }
    return null;
  }

  _makeVehicle(x, y, dir) {
    const proto = TYPES[Math.floor(Math.random() * TYPES.length)];
    return {
      ...proto,
      x,
      y,
      dir,
      speed: proto.max * 0.6,
      decided: false,
      // After picking a turn at an intersection, stay decided until we exit it.
      lastTileKey: null,
      brakeHint: 0, // frames showing brake lights
    };
  }

  update(dt, time, car) {
    for (const v of this.vehicles) {
      this._stepVehicle(v, dt, time, car);
    }
  }

  _stepVehicle(v, dt, time, player) {
    const vec = DIR_VEC[v.dir];

    // Decide whether we should slow down: red light ahead, vehicle/pedestrian/
    // player in front, or the player tangled in our lane (wrong-side congestion).
    let targetSpeed = v.max;
    const reasons = [];

    const lightAhead = this._redOrYellowAhead(v, time);
    if (lightAhead != null) {
      // Smooth approach: slow proportional to remaining distance.
      targetSpeed = Math.min(targetSpeed, Math.max(0, lightAhead * 1.6));
      if (lightAhead < 8) targetSpeed = 0;
      reasons.push("light");
    }

    const vehAhead = this._vehicleAhead(v);
    if (vehAhead != null) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, (vehAhead.dist - 22) * 2));
      reasons.push("car");
    }

    if (this._pedAhead(v)) {
      targetSpeed = Math.min(targetSpeed, 0);
      reasons.push("ped");
    }

    if (this._playerInPath(v, player)) {
      targetSpeed = Math.min(targetSpeed, 0);
      reasons.push("player");
    }

    // Accelerate / brake toward target.
    if (v.speed < targetSpeed) {
      v.speed = Math.min(targetSpeed, v.speed + v.accel * dt);
      v.brakeHint = 0;
    } else if (v.speed > targetSpeed) {
      v.speed = Math.max(targetSpeed, v.speed - v.accel * 2 * dt);
      v.brakeHint = 0.4;
    }

    // Move.
    v.x += vec.x * v.speed * dt;
    v.y += vec.y * v.speed * dt;
    if (v.brakeHint > 0) v.brakeHint -= dt;

    // Lane keeping + intersection logic.
    const tileC = Math.floor(v.x / TILE);
    const tileR = Math.floor(v.y / TILE);
    const tileKey = tileC + "," + tileR;
    const tile =
      tileR >= 0 && tileR < this.world.rows && tileC >= 0 && tileC < this.world.cols
        ? this.world.tiles[tileR][tileC].t
        : TILES.grass;

    if (tile === TILES.road_x) {
      // Just arrived at a new intersection — pick a turn.
      if (!v.decided || v.lastTileKey !== tileKey) {
        v.dir = this._pickTurn(v.dir, tileC, tileR);
        v.decided = true;
        v.lastTileKey = tileKey;
      }
    } else if (tile === TILES.road_h || tile === TILES.road_v) {
      v.decided = false;
      // Snap perpendicular coordinate gently toward lane center for the current
      // direction. This corrects drift after a turn without snapping visually.
      if (tile === TILES.road_h) {
        const centerY = tileR * TILE + TILE / 2;
        const targetY = centerY + (v.dir === "E" ? -LANE / 2 : LANE / 2);
        v.y += (targetY - v.y) * Math.min(1, dt * 6);
      } else {
        const centerX = tileC * TILE + TILE / 2;
        const targetX = centerX + (v.dir === "S" ? LANE / 2 : -LANE / 2);
        v.x += (targetX - v.x) * Math.min(1, dt * 6);
      }
    } else {
      // Off-road (drove past the map edge somehow) — kill it.
      v.speed = 0;
    }

    // Wrap or respawn if it drives off the map.
    if (
      v.x < -TILE ||
      v.y < -TILE ||
      v.x > this.world.width + TILE ||
      v.y > this.world.height + TILE
    ) {
      const next = this._spawnRandom();
      if (next) Object.assign(v, next);
    }
  }

  _pickTurn(dir, c, r) {
    // Prefer straight, allow left/right when an outgoing road exists.
    const candidates = [];
    const checks = [
      [STRAIGHT[dir], 5],
      [LEFT_TURN[dir], 2],
      [RIGHT_TURN[dir], 2],
    ];
    for (const [d, weight] of checks) {
      if (this._roadExitsFrom(c, r, d)) {
        for (let i = 0; i < weight; i++) candidates.push(d);
      }
    }
    if (!candidates.length) return STRAIGHT[dir];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  _roadExitsFrom(c, r, dir) {
    const dc = dir === "E" ? 1 : dir === "W" ? -1 : 0;
    const dr = dir === "S" ? 1 : dir === "N" ? -1 : 0;
    const nc = c + dc;
    const nr = r + dr;
    if (nr < 0 || nr >= this.world.rows || nc < 0 || nc >= this.world.cols) return false;
    const t = this.world.tiles[nr][nc].t;
    if (dc !== 0) return t === TILES.road_h || t === TILES.road_x;
    return t === TILES.road_v || t === TILES.road_x;
  }

  // Distance to the stop line of the next signal we're approaching, only if
  // the light is currently red/yellow. Returns null if green or none ahead.
  _redOrYellowAhead(v, time) {
    let best = null;
    for (const l of this.world.lights) {
      const dx = l.x - v.x;
      const dy = l.y - v.y;
      // Same axis only.
      if (v.dir === "E" || v.dir === "W") {
        if (Math.abs(dy) > TILE / 2) continue;
      } else {
        if (Math.abs(dx) > TILE / 2) continue;
      }
      // Stop line is half-a-tile shy of the intersection center, on our side.
      const stopOffset = TILE / 2 + 4;
      let dist;
      if (v.dir === "E") dist = l.x - stopOffset - v.x;
      else if (v.dir === "W") dist = v.x - (l.x + stopOffset);
      else if (v.dir === "S") dist = l.y - stopOffset - v.y;
      else dist = v.y - (l.y + stopOffset);
      if (dist < -8 || dist > 90) continue;
      const state = this.world.lightStateFor(l, v.dir, time);
      if (state === "green") continue;
      if (best == null || dist < best) best = dist;
    }
    return best;
  }

  _vehicleAhead(v) {
    let best = null;
    for (const o of this.vehicles) {
      if (o === v) continue;
      const dx = o.x - v.x;
      const dy = o.y - v.y;
      const dot = dx * DIR_VEC[v.dir].x + dy * DIR_VEC[v.dir].y;
      if (dot < 0 || dot > 70) continue;
      const lat = v.dir === "E" || v.dir === "W" ? Math.abs(dy) : Math.abs(dx);
      if (lat > 14) continue;
      if (best == null || dot < best.dist) best = { v: o, dist: dot };
    }
    return best;
  }

  _pedAhead(v) {
    for (const p of this.world.pedestrians) {
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const dot = dx * DIR_VEC[v.dir].x + dy * DIR_VEC[v.dir].y;
      if (dot < 0 || dot > 30) continue;
      const lat = v.dir === "E" || v.dir === "W" ? Math.abs(dy) : Math.abs(dx);
      if (lat < 18) return true;
    }
    return false;
  }

  _playerInPath(v, car) {
    if (!car) return false;
    const dx = car.x - v.x;
    const dy = car.y - v.y;
    const dot = dx * DIR_VEC[v.dir].x + dy * DIR_VEC[v.dir].y;
    if (dot < 0 || dot > 60) return false;
    const lat = v.dir === "E" || v.dir === "W" ? Math.abs(dy) : Math.abs(dx);
    return lat < 16;
  }

  heading(v) {
    return HEADING[v.dir];
  }
}
