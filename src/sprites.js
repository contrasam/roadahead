// Pixel-art rendering. Everything is drawn procedurally on the canvas
// at integer offsets and the canvas is scaled with image-rendering:pixelated
// for crisp pixels.

import { TILE, TILES, LANE } from "./world.js";

const COLORS = {
  grass1: "#3f7a3a",
  grass2: "#356a31",
  grassDot: "#65a85a",
  road: "#2a2d36",
  roadShade: "#23262e",
  laneLine: "#f1e0a3",
  curb: "#9a9a9a",
  bldgWall: ["#a85a3b", "#b86a4b", "#86462f", "#5d6c8c", "#7886a8"],
  bldgRoof: "#1c1f28",
  bldgWindow: "#ffe49b",
  park: "#4a8a3c",
  parkTree: "#225a25",
  water: "#3a73a3",
  waterShine: "#7fb4d9",
  sand: "#c1ad77",
  carBody: "#ffcf3a",
  carDark: "#a8852b",
  carWindow: "#1a2c44",
  zebra: "#f7f7f7",
  signRed: "#d8423f",
  signWhite: "#f6f6f6",
  signBack: "#22252b",
  pedSkin: "#e3b18a",
  pedShirt: ["#e8554d", "#3a8fd0", "#7ac46a", "#c66bb4"],
  pedPants: "#2a2f43",
  lightRed: "#ff4040",
  lightYel: "#ffcf3a",
  lightGrn: "#5cd66b",
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.cam = { x: 0, y: 0 };
    this._tileCache = new Map();
  }

  setCamera(x, y) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.cam.x = Math.floor(x - w / 2);
    this.cam.y = Math.floor(y - h / 2);
  }

  worldToScreen(x, y) {
    return [Math.floor(x - this.cam.x), Math.floor(y - this.cam.y)];
  }

  clear() {
    this.ctx.fillStyle = "#0a1126";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawWorld(world, time) {
    const { ctx, cam } = this;
    const cols = world.cols;
    const rows = world.rows;
    const startC = Math.max(0, Math.floor(cam.x / TILE));
    const startR = Math.max(0, Math.floor(cam.y / TILE));
    const endC = Math.min(cols, Math.ceil((cam.x + this.canvas.width) / TILE) + 1);
    const endR = Math.min(rows, Math.ceil((cam.y + this.canvas.height) / TILE) + 1);

    for (let r = startR; r < endR; r++) {
      for (let c = startC; c < endC; c++) {
        const t = world.tiles[r][c].t;
        const x = c * TILE - cam.x;
        const y = r * TILE - cam.y;
        this._drawTile(t, x, y, c, r);
      }
    }

    // Zebra crossings on top of roads.
    for (const z of world.zebras) {
      this._drawZebra(z);
    }

    // Signs.
    for (const s of world.signs) {
      this._drawSign(s);
    }

    // Traffic lights at intersections.
    for (const l of world.lights) {
      this._drawLight(l, world, time);
    }

    // Pedestrians.
    for (const p of world.pedestrians) {
      this._drawPed(p);
    }
  }

  _drawTile(t, x, y, c, r) {
    const ctx = this.ctx;
    switch (t) {
      case TILES.grass:
        ctx.fillStyle = (c + r) % 2 === 0 ? COLORS.grass1 : COLORS.grass2;
        ctx.fillRect(x, y, TILE, TILE);
        // grass tufts
        ctx.fillStyle = COLORS.grassDot;
        const seed = (c * 73856093) ^ (r * 19349663);
        for (let i = 0; i < 5; i++) {
          const sx = x + ((seed * (i + 1) * 12) & 63);
          const sy = y + ((seed * (i + 3) * 7) & 63);
          ctx.fillRect(sx, sy, 2, 2);
        }
        break;
      case TILES.road_h:
        this._drawRoadH(x, y);
        break;
      case TILES.road_v:
        this._drawRoadV(x, y);
        break;
      case TILES.road_x:
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(x, y, TILE, TILE);
        break;
      case TILES.building:
        this._drawBuilding(x, y, c, r);
        break;
      case TILES.park:
        ctx.fillStyle = COLORS.park;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.parkTree;
        ctx.fillRect(x + 14, y + 14, 12, 12);
        ctx.fillRect(x + 38, y + 30, 14, 14);
        ctx.fillRect(x + 22, y + 42, 10, 10);
        break;
      case TILES.water:
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.waterShine;
        const ws = ((c * 13 + r * 7) & 7) * 6;
        ctx.fillRect(x + 8 + ws, y + 18, 14, 2);
        ctx.fillRect(x + 26, y + 40, 18, 2);
        break;
      default:
        ctx.fillStyle = COLORS.sand;
        ctx.fillRect(x, y, TILE, TILE);
    }
  }

  _drawRoadH(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.grass1;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = COLORS.road;
    const top = y + TILE / 2 - LANE;
    ctx.fillRect(x, top, TILE, LANE * 2);
    // curbs
    ctx.fillStyle = COLORS.curb;
    ctx.fillRect(x, top - 2, TILE, 2);
    ctx.fillRect(x, top + LANE * 2, TILE, 2);
    // dashed center line
    ctx.fillStyle = COLORS.laneLine;
    const cy = y + TILE / 2 - 1;
    for (let i = 0; i < TILE; i += 12) {
      ctx.fillRect(x + i, cy, 8, 2);
    }
  }

  _drawRoadV(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.grass1;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = COLORS.road;
    const left = x + TILE / 2 - LANE;
    ctx.fillRect(left, y, LANE * 2, TILE);
    ctx.fillStyle = COLORS.curb;
    ctx.fillRect(left - 2, y, 2, TILE);
    ctx.fillRect(left + LANE * 2, y, 2, TILE);
    ctx.fillStyle = COLORS.laneLine;
    const cx = x + TILE / 2 - 1;
    for (let i = 0; i < TILE; i += 12) {
      ctx.fillRect(cx, y + i, 2, 8);
    }
  }

  _drawBuilding(x, y, c, r) {
    const ctx = this.ctx;
    const palette = COLORS.bldgWall;
    const wall = palette[(c * 31 + r * 17) % palette.length];
    ctx.fillStyle = COLORS.grass1;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = wall;
    ctx.fillRect(x + 4, y + 8, TILE - 8, TILE - 12);
    ctx.fillStyle = COLORS.bldgRoof;
    ctx.fillRect(x + 4, y + 4, TILE - 8, 6);
    ctx.fillStyle = COLORS.bldgWindow;
    for (let wy = 0; wy < 3; wy++) {
      for (let wx = 0; wx < 3; wx++) {
        if (((c + r + wx + wy) & 3) === 0) continue;
        ctx.fillRect(x + 10 + wx * 14, y + 16 + wy * 14, 8, 8);
      }
    }
    // doorway
    ctx.fillStyle = "#1d1a16";
    ctx.fillRect(x + 28, y + TILE - 14, 8, 10);
  }

  _drawZebra(z) {
    const [sx, sy] = this.worldToScreen(z.x - z.w / 2, z.y - z.h / 2);
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.zebra;
    if (z.axis === "h") {
      for (let i = 0; i < z.w; i += 6) {
        ctx.fillRect(sx + i, sy, 4, z.h);
      }
    } else {
      for (let i = 0; i < z.h; i += 6) {
        ctx.fillRect(sx, sy + i, z.w, 4);
      }
    }
  }

  _drawSign(s) {
    const [sx, sy] = this.worldToScreen(s.x, s.y);
    const ctx = this.ctx;
    // post
    ctx.fillStyle = "#444";
    ctx.fillRect(sx + 5, sy + 6, 2, 14);
    if (s.kind === "limit") {
      ctx.fillStyle = COLORS.signRed;
      ctx.fillRect(sx - 4, sy - 6, 20, 16);
      ctx.fillStyle = COLORS.signWhite;
      ctx.fillRect(sx - 2, sy - 4, 16, 12);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 9px monospace";
      ctx.fillText(String(s.value), sx - 1, sy + 5);
    } else {
      // silence / school
      ctx.fillStyle = "#1f1f1f";
      ctx.fillRect(sx - 4, sy - 6, 20, 16);
      ctx.fillStyle = "#ffcf3a";
      ctx.font = "bold 8px monospace";
      ctx.fillText("SILENT", sx - 3, sy + 4);
    }
  }

  _drawLight(l, world, time) {
    const ctx = this.ctx;
    const positions = [
      { x: l.x - 18, y: l.y - 38, dir: "N" }, // for southbound traffic
      { x: l.x + 18, y: l.y + 38, dir: "S" },
      { x: l.x - 38, y: l.y + 18, dir: "W" },
      { x: l.x + 38, y: l.y - 18, dir: "E" },
    ];
    for (const p of positions) {
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      ctx.fillStyle = "#181b22";
      ctx.fillRect(sx - 4, sy - 12, 10, 22);
      ctx.fillStyle = "#2a2f3a";
      ctx.fillRect(sx - 3, sy - 11, 8, 20);
      const state = world.lightStateFor(l, p.dir, time);
      const red = state === "red";
      const yel = state === "yellow";
      const grn = state === "green";
      ctx.fillStyle = red ? COLORS.lightRed : "#3a1e1e";
      ctx.fillRect(sx - 1, sy - 9, 4, 4);
      ctx.fillStyle = yel ? COLORS.lightYel : "#3a321e";
      ctx.fillRect(sx - 1, sy - 3, 4, 4);
      ctx.fillStyle = grn ? COLORS.lightGrn : "#1e3a23";
      ctx.fillRect(sx - 1, sy + 3, 4, 4);
    }
  }

  _drawPed(p) {
    const [sx, sy] = this.worldToScreen(p.x - 4, p.y - 8);
    const ctx = this.ctx;
    const shirt = COLORS.pedShirt[(Math.floor(p.baseX + p.baseY) >> 4) % COLORS.pedShirt.length];
    ctx.fillStyle = COLORS.pedSkin;
    ctx.fillRect(sx + 1, sy, 6, 5); // head
    ctx.fillStyle = shirt;
    ctx.fillRect(sx, sy + 5, 8, 6);
    ctx.fillStyle = COLORS.pedPants;
    ctx.fillRect(sx + 1, sy + 11, 3, 4);
    ctx.fillRect(sx + 4, sy + 11, 3, 4);
  }

  drawCar(car) {
    const ctx = this.ctx;
    const [sx, sy] = this.worldToScreen(car.x, car.y);
    ctx.save();
    ctx.translate(sx, sy);
    // car is drawn pointing right (east) when dir=0, then rotated.
    ctx.rotate(car.dir);
    const w = car.h; // along travel
    const h = car.w; // across
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    // body
    ctx.fillStyle = COLORS.carBody;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // darker outline
    ctx.fillStyle = COLORS.carDark;
    ctx.fillRect(-w / 2, -h / 2, w, 2);
    ctx.fillRect(-w / 2, h / 2 - 2, w, 2);
    ctx.fillRect(-w / 2, -h / 2, 2, h);
    ctx.fillRect(w / 2 - 2, -h / 2, 2, h);
    // windshield
    ctx.fillStyle = COLORS.carWindow;
    ctx.fillRect(w / 2 - 12, -h / 2 + 2, 6, h - 4);
    // rear window
    ctx.fillRect(-w / 2 + 6, -h / 2 + 2, 4, h - 4);
    // headlights
    ctx.fillStyle = "#fff7c2";
    ctx.fillRect(w / 2 - 2, -h / 2 + 1, 2, 3);
    ctx.fillRect(w / 2 - 2, h / 2 - 4, 2, 3);
    // taillights
    ctx.fillStyle = "#ff4040";
    ctx.fillRect(-w / 2, -h / 2 + 1, 2, 3);
    ctx.fillRect(-w / 2, h / 2 - 4, 2, 3);
    ctx.restore();

    if (car.horn > 0) {
      ctx.strokeStyle = "rgba(255,207,58,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 20 + (1 - car.horn) * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
