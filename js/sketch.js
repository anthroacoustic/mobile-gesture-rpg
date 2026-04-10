/**
 * p5.js entry point — instance mode to avoid polluting the global namespace.
 *
 * Touch routing:
 *   touchStarted / touchMoved / touchEnded → GestureRecognizer → game.onGesture()
 *
 * Mouse events mirror touch events so the game works on desktop for testing.
 *
 * IMPORTANT: all touch handlers return false to call preventDefault(),
 * which prevents the browser from interpreting swipes as page scrolls.
 */
const sketch = (p) => {
  let game;

  p.setup = () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.style('touch-action', 'none');
    p.frameRate(60);
    p.pixelDensity(window.devicePixelRatio || 1);
    p.textFont('sans-serif');
    game = new Game(p);
  };

  p.draw = () => {
    game.update();
    game.draw();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  // ── Touch events (mobile) ────────────────────────────────────────────────
  p.touchStarted = () => {
    const t = p.touches[0];
    if (!t) return false;
    game.gestures.onTouchStart(t.x, t.y, p.millis());
    game.onTouchStart(t.x, t.y);
    game.swipeTrail = [{ x: t.x, y: t.y }];
    return false;
  };

  p.touchMoved = () => {
    const t = p.touches[0];
    if (!t) return false;
    game.gestures.onTouchMove(t.x, t.y);
    game.onTouchMove(t.x, t.y);
    game.swipeTrail.push({ x: t.x, y: t.y });
    if (game.swipeTrail.length > 22) game.swipeTrail.shift();
    return false;
  };

  p.touchEnded = () => {
    // iOS Safari clears touches[] on touchend — use the cached last position.
    const x       = game.lastTouchX;
    const y       = game.lastTouchY;
    const gesture = game.gestures.onTouchEnd(x, y, p.millis());
    game.onGesture(gesture);
    game.swipeTrail = [];
    return false;
  };

  // ── Mouse fallback (desktop testing) ────────────────────────────────────
  p.mousePressed = () => {
    if (p.touches && p.touches.length > 0) return; // don't double-fire on mobile
    game.gestures.onTouchStart(p.mouseX, p.mouseY, p.millis());
    game.onTouchStart(p.mouseX, p.mouseY);
    game.swipeTrail = [{ x: p.mouseX, y: p.mouseY }];
  };

  p.mouseDragged = () => {
    if (p.touches && p.touches.length > 0) return;
    game.gestures.onTouchMove(p.mouseX, p.mouseY);
    game.onTouchMove(p.mouseX, p.mouseY);
    game.swipeTrail.push({ x: p.mouseX, y: p.mouseY });
    if (game.swipeTrail.length > 22) game.swipeTrail.shift();
  };

  p.mouseReleased = () => {
    if (p.touches && p.touches.length > 0) return;
    const gesture = game.gestures.onTouchEnd(p.mouseX, p.mouseY, p.millis());
    game.onGesture(gesture);
    game.swipeTrail = [];
  };
};

new p5(sketch);
