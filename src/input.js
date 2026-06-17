export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "h",
          "r",
        ].includes(k)
      ) {
        e.preventDefault();
      }
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener("blur", () => this.keys.clear());
  }

  down(k) {
    return this.keys.has(k);
  }

  consumePressed(k) {
    if (this.pressed.has(k)) {
      this.pressed.delete(k);
      return true;
    }
    return false;
  }
}
