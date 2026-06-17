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
const COLS = 30;
const ROWS = 20;
const H_ROWS = [4, 10, 16];
const V_COLS = [4, 13, 22, 28];
// Water region marks a slice of the riverside zone.
const WATER = (c, r) => r >= 12 && r <= 14 && c >= 16 && c <= 21;
const PARK = (c, r) =>
  (c >= 7 && c <= 9 && r >= 6 && r <= 8) || (c >= 24 && c <= 26 && r >= 6 && r <= 8);

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

    // Zones — score-gated regions of the map.
    this.zones = [
      { id: "bazaar", name: "Old Bazaar", unlock: 0, x: 0, y: 0, w: 13 * TILE, h: 10 * TILE },
      { id: "market", name: "Market District", unlock: 50, x: 13 * TILE, y: 0, w: 17 * TILE, h: 10 * TILE },
      { id: "river", name: "Riverside", unlock: 120, x: 0, y: 10 * TILE, w: 13 * TILE, h: 10 * TILE },
      { id: "highway", name: "Outer Highway", unlock: 250, x: 13 * TILE, y: 10 * TILE, w: 17 * TILE, h: 10 * TILE },
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
    const out = [];
    let i = 0;
    for (const x of this._intersections()) {
      // Two perpendicular light groups: NS and EW. Phases offset per intersection.
      const phase = (i++ % 2) * 4;
      out.push({
        x: x.cx,
        y: x.cy,
        // The "stop line" for southbound traffic sits north of the intersection, etc.
        // Stored as the four approach stop-lines with a current state.
        nsGreenAt: phase,
        ewGreenAt: phase + 4,
        period: 8, // seconds per phase
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
      // Silence (school) zone near the park in Market District.
      { kind: "silence", x: 25 * TILE, y: 7 * TILE, r: 220 },
      // Per-zone speed limits — radii are large so the closest sign wins.
      { kind: "limit", x: 2 * TILE, y: 5 * TILE, r: 1000, value: 40, label: "Old Bazaar 40" },
      { kind: "limit", x: 20 * TILE, y: 5 * TILE, r: 1000, value: 50, label: "Market 50" },
      { kind: "limit", x: 6 * TILE, y: 13 * TILE, r: 1000, value: 60, label: "Riverside 60" },
      { kind: "limit", x: 24 * TILE, y: 16 * TILE, r: 1200, value: 80, label: "Highway 80" },
    ];
  }

  _buildPedestrians() {
    const peds = [];
    // Two pedestrians who path back and forth across a zebra each.
    for (const z of this.zebras.slice(0, 8)) {
      peds.push({
        x: z.x,
        y: z.y,
        baseX: z.x,
        baseY: z.y,
        axis: z.axis,
        t: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.5,
        radius: 7,
        zebra: z,
        cooldown: 0, // grace period after being yielded to
      });
    }
    return peds;
  }

  // Returns the current state of a light for an approach direction.
  // dir: "N" (car moving N, approaching from south), "S","E","W".
  lightStateFor(light, dir, time) {
    const t = time % light.period;
    const nsGreen = t >= light.nsGreenAt && t < light.nsGreenAt + 3.2;
    const nsYellow = t >= light.nsGreenAt + 3.2 && t < light.nsGreenAt + 4;
    const ewGreen = t >= light.ewGreenAt % light.period && t < (light.ewGreenAt % light.period) + 3.2;
    const ewYellow = t >= (light.ewGreenAt % light.period) + 3.2 && t < (light.ewGreenAt % light.period) + 4;
    if (dir === "N" || dir === "S") {
      if (nsGreen) return "green";
      if (nsYellow) return "yellow";
      return "red";
    }
    if (ewGreen) return "green";
    if (ewYellow) return "yellow";
    return "red";
  }

  update(dt) {
    for (const p of this.pedestrians) {
      p.t += dt * p.speed;
      if (p.cooldown > 0) p.cooldown -= dt;
      const amp = 26;
      if (p.axis === "h") {
        // pedestrian crosses horizontally across an H zebra
        p.x = p.baseX + Math.sin(p.t) * amp;
        p.y = p.baseY;
      } else {
        p.x = p.baseX;
        p.y = p.baseY + Math.sin(p.t) * amp;
      }
    }
  }
}
