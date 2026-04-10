/**
 * GestureRecognizer — classifies raw touch events into game gestures.
 * Stateless between gestures; tracks one in-flight touch at a time.
 *
 * Produces:
 *   { type: 'swipe', direction: 'up'|'down'|'left'|'right', speed }
 *   { type: 'tap', x, y }
 *   { type: 'hold', duration }
 *   { type: 'none' }
 */
class GestureRecognizer {
  constructor() {
    this.touchStart   = null;
    this.touchCurrent = null;

    this.SWIPE_THRESHOLD    = 40;   // px min movement to be a swipe
    this.SWIPE_MIN_SPEED    = 80;   // px/s min speed to be a swipe
    this.TAP_MAX_MOVEMENT   = 22;   // px max movement to count as tap
    this.TAP_MAX_DURATION   = 320;  // ms
    this.HOLD_MIN_DURATION  = 350;  // ms
  }

  onTouchStart(x, y, time) {
    this.touchStart   = { x, y, time };
    this.touchCurrent = { x, y };
  }

  onTouchMove(x, y) {
    this.touchCurrent = { x, y };
  }

  /** Returns a gesture object. Call this from touchEnded / mouseReleased. */
  onTouchEnd(x, y, time) {
    if (!this.touchStart) return { type: 'none' };

    const dx       = x - this.touchStart.x;
    const dy       = y - this.touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = time - this.touchStart.time;
    const result   = this._classify(dx, dy, distance, duration, x, y);

    this.touchStart   = null;
    this.touchCurrent = null;
    return result;
  }

  _classify(dx, dy, distance, duration, endX, endY) {
    const speed = duration > 0 ? (distance / duration) * 1000 : 9999;

    if (distance > this.SWIPE_THRESHOLD && speed > this.SWIPE_MIN_SPEED) {
      return { type: 'swipe', direction: this._swipeDir(dx, dy), speed };
    }

    if (distance < this.TAP_MAX_MOVEMENT && duration < this.TAP_MAX_DURATION) {
      return { type: 'tap', x: endX, y: endY };
    }

    if (duration >= this.HOLD_MIN_DURATION) {
      return { type: 'hold', duration };
    }

    return { type: 'none' };
  }

  _swipeDir(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }
}
