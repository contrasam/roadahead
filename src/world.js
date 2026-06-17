// World / city layout. The map is a grid of tiles. Roads are 2-lane.
// Coordinates: world units in pixels. Camera follows the car.

export const TILE = 64;
export const LANE = 28; // half-width of a road lane

export const TILES = {
  grass: 0,
  road_h: 1, // horizontal road
  road_v: 2, // vertical road
  road_x: 3, // 4-way intersection
  building: 4,
  park: 5,
  sand: 6, // off-road dust
  water: 7,
};

// Generate a proper grid city: horizontal road rows, vertical road columns,
// X at intersections. Cells away from roads are buildings/grass/parks/water.
const COLS = 56;
const ROWS = 40;
const H_ROWS = [4, 11, 18, 25, 32, 38];
const V_COLS = [4, 12, 20, 28, 36, 44, 52];
// Riverside water snakes through the bottom-left quadrant.
const WATER = (c, r) =>
  (r >= 21 && r <= 24 && c >= 6 && c <= 11) ||
  (r >= 22 && r <= 23 && c >= 12 && c <= 19);
// Parks: bazaar square, market school-park, riverside garden, highway rest-stop.
const PARK = (c, r) =>
  (c >= 7 && c <= 9 && r >= 6 && r <= 8) ||
  (c >= 30 && c <= 33 && r >= 6 && r <= 9) ||
  (c >= 7 && c <= 9 && r >= 28 && r <= 30) ||
  (c >= 47 && c <= 50 && r >= 21 && r <= 23);

function buildMap() {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    let row = "";
    for (let c = 0; c < COLS; c++) {
      const onH = H_ROWS.includes(r);
      const onV = V_COLS.includes(c);
      if (onH && onV) row += "X";
      else if (onH) row += "H";
      else if (onV) row += "V";
      else if (WATER(c, r)) row += "W";
      else if (PARK(c, r)) row += "P";
      // Cells flanking the road become buildings; further out is grass.
      else {
        const flanksH = H_ROWS.some((hr) => Math.abs(r - hr) === 1);
        const flanksV = V_COLS.some((vc) => Math.abs(c - vc) === 1);
        row += flanksH || flanksV ? "B" : "G";
      }
    }
    out.push(row);
  }
  return out;
}

const MAP = buildMap();

// Map chars -> tile + zone metadata.
function parseChar(ch) {
  switch (ch) {
    case "G": return { t: TILES.grass };
    case "B": return { t: TILES.building };
    case "P": return { t: TILES.park };
    case "H": return { t: TILES.road_h };
    case "V": return { t: TILES.road_v };
    case "X": return { t: TILES.road_x };
    case "W": return { t: TILES.water };
    default: return { t: TILES.grass };
  }
}

export class World {
  constructor() {
    this.cols = MAP[0].length;
    this.rows = MAP.length;
    this.tiles = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = new Array(this.cols);
      for (let c = 0; c < this.cols; c++) {
        this.tiles[r][c] = parseChar(MAP[r][c]);
      }
    }
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;

    // Zones — score-gated quadrants of the map.
    const halfC = 25 * TILE;
    const halfR = 21 * TILE;
    this.zones = [
      { id: "bazaar", name: "Old Bazaar", unlock: 0, x: 0, y: 0, w: halfC, h: halfR },
      { id: "market", name: "Market District", unlock: 50, x: halfC, y: 0, w: this.width - halfC, h: halfR },
      { id: "river", name: "Riverside", unlock: 120, x: 0, y: halfR, w: halfC, h: this.height - halfR },
      { id: "highway", name: "Outer Highway", unlock: 250, x: halfC, y: halfR, w: this.width - halfC, h: this.height - halfR },
    ];

    // Traffic lights at intersection centers. Phase cycles per group.
    this.lights = this._buildLights();

    // Zebra crossings flank each intersection.
    this.zebras = this._buildZebras();

    // Speed-limit and silence-zone signs by region.
    this.signs = this._buildSigns();

    // Pedestrians wander on sidewalks; cross at zebras.
    this.pedestrians = this._buildPedestrians();

    // Spawn point for the car on row 4 (H road), in the NORTH lane,
    // facing east — that is the LEFT lane for east-bound traffic in India.
    this.spawn = { x: 2 * TILE, y: 4 * TILE + TILE / 2 - LANE / 2, dir: 0 };
  }

  tileAt(x, y) {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return TILES.grass;
    return this.tiles[r][c].t;
  }

  isRoad(x, y) {
    const t = this.tileAt(x, y);
    return t === TILES.road_h || t === TILES.road_v || t === TILES.road_x;
  }

  // Solid obstacles (buildings/water) — used for collision.
  isSolid(x, y) {
    const t = this.tileAt(x, y);
    return t === TILES.building || t === TILES.water;
  }

  zoneAt(x, y) {
    for (const z of this.zones) {
      if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z;
    }
    return this.zones[0];
  }

  _intersections() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c].t === TILES.road_x) {
          out.push({ cx: c * TILE + TILE / 2, cy: r * TILE + TILE / 2, c, r });
        }
      }
    }
    return out;
  }

  _buildLights() {
    // Slow real-time cycle: 18s total — 7s green, 2s yellow, 9s red per
    // direction (NS and EW alternate). Intersections are phase-shifted by
    // half a period so a grid doesn't all flip at once.
    const out = [];
    let i = 0;
    for (const x of this._intersections()) {
      const phase = (i++ % 2) * 9;
      out.push({
        x: x.cx,
        y: x.cy,
        nsGreenAt: phase,
        ewGreenAt: (phase + 9) % 18,
        greenDur: 7,
        yellowDur: 2,
        period: 18,
      });
    }
    return out;
  }

  _buildZebras() {
    const out = [];
    for (const x of this._intersections()) {
      // 4 zebras around each intersection, just outside the junction box.
      const off = TILE / 2 + 6;
      out.push({ x: x.cx, y: x.cy - off, w: TILE - 16, h: 10, axis: "h" });
      out.push({ x: x.cx, y: x.cy + off, w: TILE - 16, h: 10, axis: "h" });
      out.push({ x: x.cx - off, y: x.cy, w: 10, h: TILE - 16, axis: "v" });
      out.push({ x: x.cx + off, y: x.cy, w: 10, h: TILE - 16, axis: "v" });
    }
    return out;
  }

  _buildSigns() {
    return [
      // Silence (school) zone next to the Market District park.
      { kind: "silence", x: 31 * TILE, y: 8 * TILE, r: 260 },
      // Per-zone speed limits — radii are large so the closest sign wins.
      { kind: "limit", x: 2 * TILE, y: 5 * TILE, r: 5000, value: 40, label: "Old Bazaar 40" },
      { kind: "limit", x: 40 * TILE, y: 5 * TILE, r: 5000, value: 50, label: "Market 50" },
      { kind: "limit", x: 6 * TILE, y: 30 * TILE, r: 5000, value: 60, label: "Riverside 60" },
      { kind: "limit", x: 40 * TILE, y: 30 * TILE, r: 5000, value: 80, label: "Highway 80" },
    ];
  }

  _buildPedestrians() {
    // Spread a few pedestrians across the city rather than crowding one
    // intersection. A simple wait/walk state machine reads much calmer than
    // continuous sinusoidal motion.
    const peds = [];
    for (let i = 0; i < this.zebras.length; i += 4) {
      const z = this.zebras[i];
      peds.push({
        baseX: z.x,
        baseY: z.y,
        axis: z.axis,
        x: z.x,
        y: z.y,
        zebra: z,
        radius: 7,
        // State machine: "wait" idle on a curb, "cross" walking the zebra.
        state: "wait",
        // Position along the zebra, -1 (one curb) .. +1 (other curb).
        pos: Math.random() < 0.5 ? -1 : 1,
        target: 0,
        waitFor: 3 + Math.random() * 6,
        crossSpeed: 0.18 + Math.random() * 0.08, // units of `pos` per second
        cooldown: 0,
      });
    }
    return peds;
  }

  // Returns the current state of a light for an approach direction.
  // dir: "N","S","E","W" — the cardinal direction the car is moving.
  lightStateFor(light, dir, time) {
    const t = time % light.period;
    const phase = (dir === "N" || dir === "S") ? light.nsGreenAt : light.ewGreenAt;
    // Normalize elapsed seconds since this approach last turned green.
    const since = (t - phase + light.period) % light.period;
    if (since < light.greenDur) return "green";
    if (since < light.greenDur + light.yellowDur) return "yellow";
    return "red";
  }

  update(dt) {
    const amp = 30;
    for (const p of this.pedestrians) {
      if (p.cooldown > 0) p.cooldown -= dt;
      if (p.state === "wait") {
        p.waitFor -= dt;
        if (p.waitFor <= 0) {
          p.state = "cross";
          p.target = -p.pos;
        }
      } else {
        const step = p.crossSpeed * dt * Math.sign(p.target - p.pos);
        p.pos += step;
        if ((step > 0 && p.pos >= p.target) || (step < 0 && p.pos <= p.target)) {
          p.pos = p.target;
          p.state = "wait";
          p.waitFor = 4 + Math.random() * 8;
        }
      }
      if (p.axis === "h") {
        p.x = p.baseX + p.pos * amp;
        p.y = p.baseY;
      } else {
        p.x = p.baseX;
        p.y = p.baseY + p.pos * amp;
      }
    }
  }
}
