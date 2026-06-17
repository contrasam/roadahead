// Top-down car with simple arcade physics.
// Heading: 0 = facing right (east). Positive turn = clockwise.

const KMH_PER_UNIT = 2.6; // tuning to make px/s feel like km/h

export class Car {
  constructor(x, y, dir = 0) {
    this.x = x;
    this.y = y;
    this.dir = dir; // radians
    this.vel = 0; // forward speed in px/s
    this.w = 18;
    this.h = 34;
    this.maxFwd = 240;
    this.maxRev = -90;
    this.accel = 160;
    this.brake = 360;
    this.drag = 60;
    this.turn = 2.4; // rad/sec at full speed
    this.horn = 0;
  }

  get speedKmh() {
    return Math.round(Math.abs(this.vel) / KMH_PER_UNIT);
  }

  update(dt, input, world) {
    const accelKey = input.down("arrowup");
    const revKey = input.down("arrowdown");
    const leftKey = input.down("arrowleft");
    const rightKey = input.down("arrowright");
    const brakeKey = input.down(" ");

    if (accelKey) {
      this.vel += this.accel * dt;
    } else if (revKey) {
      this.vel -= this.accel * 0.7 * dt;
    } else {
      // engine drag toward 0
      const sign = Math.sign(this.vel);
      this.vel -= sign * this.drag * dt;
      if (Math.sign(this.vel) !== sign) this.vel = 0;
    }
    if (brakeKey) {
      const sign = Math.sign(this.vel);
      this.vel -= sign * this.brake * dt;
      if (Math.sign(this.vel) !== sign) this.vel = 0;
    }
    this.vel = Math.max(this.maxRev, Math.min(this.maxFwd, this.vel));

    // Steering — speed-sensitive.
    const steer = (leftKey ? -1 : 0) + (rightKey ? 1 : 0);
    const grip = Math.min(1, Math.abs(this.vel) / 60);
    this.dir += steer * this.turn * grip * Math.sign(this.vel || 1) * dt;

    // Apply movement with collision (slide-stop).
    const nx = this.x + Math.cos(this.dir) * this.vel * dt;
    const ny = this.y + Math.sin(this.dir) * this.vel * dt;
    if (!world.isSolid(nx, this.y)) this.x = nx;
    else this.vel *= -0.2;
    if (!world.isSolid(this.x, ny)) this.y = ny;
    else this.vel *= -0.2;

    // Off-road sand drags faster + slows.
    const tileType = world.tileAt(this.x, this.y);
    const onRoad = tileType === 1 || tileType === 2 || tileType === 3;
    if (!onRoad) {
      this.vel *= 1 - 1.6 * dt;
    }

    if (this.horn > 0) this.horn -= dt;
  }

  bbox() {
    // Axis-aligned bounding box approximation around the rotated car.
    const r = Math.max(this.w, this.h) / 2;
    return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }
}
