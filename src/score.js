// Scoring + zone unlocking + driver rating.

const RATINGS = [
  { min: -Infinity, label: "Reckless" },
  { min: 0, label: "Learner" },
  { min: 50, label: "Cautious" },
  { min: 150, label: "Confident" },
  { min: 300, label: "Skilled" },
  { min: 600, label: "Pro" },
];

export class Score {
  constructor(world, onEvent) {
    this.world = world;
    this.value = 0;
    this.events = onEvent;
    this.unlocked = new Set(["bazaar"]);
    this._cooldown = new Map();
  }

  rating() {
    let last = RATINGS[0].label;
    for (const r of RATINGS) {
      if (this.value >= r.min) last = r.label;
    }
    return last;
  }

  // Light cooldown so a single infraction doesn't tally every frame.
  award(key, delta, msg, type = "good", cooldownSec = 1.2) {
    const now = performance.now() / 1000;
    const last = this._cooldown.get(key) || 0;
    if (now - last < cooldownSec) return;
    this._cooldown.set(key, now);
    this.value += delta;
    this.events(msg, type);
    this._checkUnlocks();
  }

  _checkUnlocks() {
    for (const z of this.world.zones) {
      if (!this.unlocked.has(z.id) && this.value >= z.unlock) {
        this.unlocked.add(z.id);
        this.events(`Unlocked: ${z.name}`, "unlock");
      }
    }
  }

  canEnter(zone) {
    return this.unlocked.has(zone.id);
  }
}
