/* RoadAhead — boot */
window.addEventListener('DOMContentLoaded', () => {
  RA.ui.init();
  RA.input.init();
  RA.tut.init();
  RA.game.init(document.getElementById('game'));
  RA.ui.showScreen('menu');
});
