import { Game } from "./game.js";

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start");

const game = new Game(canvas);

startBtn.addEventListener("click", () => {
  overlay.classList.remove("show");
  game.start();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && overlay.classList.contains("show")) {
    startBtn.click();
  }
});
