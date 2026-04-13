/**
 * UI — all p5.js rendering helpers.
 * Layout is computed from p.width / p.height each draw call so it
 * automatically adapts when the canvas is resized.
 */
class UI {
  constructor(p) {
    this.p = p;
  }

  // ── Palette ─────────────────────────────────────────────────────────────────
  get C() {
    return {
      bg:        [13,  27,  42],
      pink:      [247, 168, 192],
      pinkDark:  [244, 104, 138],
      blue:      [126, 207, 238],
      blueLight: [200, 238, 255],
      textLight: [220, 235, 255],
      white:     [255, 255, 255],
    };
  }

  // ── Layout getters (always fresh from canvas size) ───────────────────────
  get w()             { return this.p.width; }
  get h()             { return this.p.height; }
  get enemyCenterX()  { return this.w / 2; }
  get enemyCenterY()  { return this.h * 0.36; }
  get dividerY()      { return this.h * 0.50; }
  get playerNameY()   { return this.h * 0.74; }
  get hpBarY()        { return this.h * 0.775; }
  get mpBarY()        { return this.h * 0.815; }
  get messageY()      { return this.h * 0.55; }

  // ── Core layout ──────────────────────────────────────────────────────────
  drawBackground() {
    const p = this.p;
    p.background(...this.C.bg);
    p.noStroke();
    // Version stamp
    p.fill(...this.C.textLight, 180);
    p.textAlign(p.RIGHT, p.TOP);
    p.textSize(13);
    p.text('v0.2', this.w - 10, 8);
  }

  drawEnemyArea(enemy) {
    enemy.draw(this.p, this.enemyCenterX, this.enemyCenterY);
  }

  // ── Health / MP bars ─────────────────────────────────────────────────────
  drawEnemyHealthBar(enemy) {
    const p   = this.p;
    const barW = this.w * 0.68;
    const barH = 9;
    const bx   = (this.w - barW) / 2;
    const by   = 18;

    p.noStroke();
    // Track
    p.fill(40, 20, 40, 200);
    this._roundRect(bx, by, barW, barH, 4);
    // Fill
    const pct = enemy.hpPercent();
    if (pct > 0) {
      const r = Math.round(this.C.pinkDark[0] + (this.C.pink[0] - this.C.pinkDark[0]) * pct);
      const g = Math.round(this.C.pinkDark[1] + (this.C.pink[1] - this.C.pinkDark[1]) * pct);
      const b = Math.round(this.C.pinkDark[2] + (this.C.pink[2] - this.C.pinkDark[2]) * pct);
      p.fill(r, g, b, 225);
      this._roundRect(bx, by, barW * pct, barH, 4);
    }
    // Label
    p.fill(...this.C.textLight, 190);
    p.noStroke();
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(11);
    p.text(`${enemy.name}  ${enemy.hp} / ${enemy.maxHp}`, this.w / 2, by + barH + 5);
  }

  drawPlayerHealthBar(player) {
    const p    = this.p;
    const barW = this.w * 0.72;
    const barH = 12;
    const bx   = (this.w - barW) / 2;
    const by   = this.hpBarY;

    p.noStroke();
    p.fill(...this.C.textLight, 150);
    p.textAlign(p.LEFT, p.CENTER);
    p.textSize(11);
    p.text('HP', bx, by - 9);
    p.fill(...this.C.textLight, 160);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text(`${player.hp} / ${player.maxHp}`, bx + barW, by - 9);

    p.fill(20, 40, 65, 200);
    this._roundRect(bx, by, barW, barH, 5);
    if (player.hpPercent() > 0) {
      p.fill(...this.C.blue, 215);
      this._roundRect(bx, by, barW * player.hpPercent(), barH, 5);
    }
  }

  drawPlayerMPBar(player) {
    const p    = this.p;
    const barW = this.w * 0.72;
    const barH = 8;
    const bx   = (this.w - barW) / 2;
    const by   = this.mpBarY;

    p.noStroke();
    p.fill(...this.C.textLight, 120);
    p.textAlign(p.LEFT, p.CENTER);
    p.textSize(11);
    p.text('MP', bx, by - 8);

    p.fill(20, 40, 65, 200);
    this._roundRect(bx, by, barW, barH, 4);
    if (player.mpPercent() > 0) {
      p.fill(...this.C.pink, 195);
      this._roundRect(bx, by, barW * player.mpPercent(), barH, 4);
    }
  }

  drawPlayerName(player) {
    const p = this.p;
    p.noStroke();
    p.fill(...this.C.textLight, 210);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(14);
    p.textStyle(p.BOLD);
    p.text(player.name, this.w / 2, this.playerNameY);
    p.textStyle(p.NORMAL);
  }

  // ── Radial action menu ───────────────────────────────────────────────────
  /**
   * Three 120° sectors centred on the touch origin.
   * Sectors: attack (up), defend (down-right), magic (down-left).
   * @param {number}      ox            touch origin x
   * @param {number}      oy            touch origin y
   * @param {string|null} hoveredSector 'attack'|'defend'|'magic'|null
   * @param {boolean}     mpOk          whether magic is available
   */
  drawRadialMenu(ox, oy, hoveredSector, mpOk) {
    const p          = this.p;
    const innerR     = 52;
    const outerR     = 145;
    const GAP        = 0.07; // radians gap between sectors

    const sectors = [
      {
        id:     'attack',
        start:  -5 * Math.PI / 6 + GAP,
        stop:   -Math.PI / 6     - GAP,
        mid:    -Math.PI / 2,
        icon:   '\u2694',
        label:  'Attack',
        color:  this.C.blue,
      },
      {
        id:     'defend',
        start:  -Math.PI / 6     + GAP,
        stop:    Math.PI / 2     - GAP,
        mid:     Math.PI / 6,
        icon:   '\uD83D\uDEE1',
        label:  'Defend',
        color:  this.C.blue,
      },
      {
        id:     'magic',
        start:   Math.PI / 2     + GAP,
        stop:    7 * Math.PI / 6 - GAP,
        mid:     5 * Math.PI / 6,
        icon:   '\u2726',
        label:  'Magic',
        color:  this.C.pink,
      },
    ];

    // Draw filled sector wedges
    p.noStroke();
    for (const s of sectors) {
      const hovered  = hoveredSector === s.id;
      const disabled = s.id === 'magic' && !mpOk;
      if (disabled) {
        p.fill(50, 50, 70, 130);
      } else if (hovered) {
        p.fill(...s.color, 220);
      } else {
        p.fill(40, 20, 60, 200);
      }
      p.arc(ox, oy, outerR * 2, outerR * 2, s.start, s.stop, p.PIE);
    }

    // Sector borders
    for (const s of sectors) {
      const hovered  = hoveredSector === s.id;
      const disabled = s.id === 'magic' && !mpOk;
      if (!disabled) {
        p.noFill();
        p.stroke(...s.color, hovered ? 255 : 130);
        p.strokeWeight(1.5);
        p.arc(ox, oy, outerR * 2, outerR * 2, s.start, s.stop, p.PIE);
      }
    }

    // Donut cutout — background circle erases wedge centres
    p.noStroke();
    p.fill(...this.C.bg);
    p.ellipse(ox, oy, innerR * 2, innerR * 2);

    // Centre hint
    p.fill(...this.C.textLight, 90);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(10);
    p.text('drag', ox, oy);

    // Icons + labels at mid-radius of each sector
    const midR = (innerR + outerR) / 2;
    for (const s of sectors) {
      const hovered  = hoveredSector === s.id;
      const disabled = s.id === 'magic' && !mpOk;
      const ix = ox + Math.cos(s.mid) * midR;
      const iy = oy + Math.sin(s.mid) * midR;

      p.fill(...(disabled ? [80, 80, 100] : (hovered ? this.C.bg : s.color)),
             disabled ? 100 : 230);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(22);
      p.text(s.icon, ix, iy - 9);
      p.textSize(11);
      p.text(s.label, ix, iy + 13);
    }

    p.noStroke();
  }

  // ── Swipe attack gesture ──────────────────────────────────────────────────
  /**
   * @param {string}  direction   'up' | 'down' | 'left' | 'right'
   * @param {number}  opacity     0-255
   * @param {number}  doneCount   arrows already completed
   * @param {number}  total       total arrows in sequence
   * @param {number}  timerRatio  remaining time 0..1 (for urgency tint)
   */
  drawArrowPrompt(direction, opacity, doneCount, total, timerRatio) {
    const p  = this.p;
    const cx = this.w / 2;
    const cy = this.h * 0.43;

    const rot = { up: -p.HALF_PI, down: p.HALF_PI, left: p.PI, right: 0 }[direction] ?? 0;

    // Glow halo
    p.push();
    p.translate(cx, cy);
    p.rotate(rot);
    this._arrowShape(p, 0, 0, 95, [...this.C.blue, opacity * 0.22]);
    this._arrowShape(p, 0, 0, 72, [...this.C.blue, opacity]);
    p.pop();

    // Direction label — in the shared message zone
    p.fill(...this.C.blueLight, Math.round(opacity * 0.85));
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(13);
    p.text('SWIPE  ' + direction.toUpperCase(), cx, this.messageY);

    // Progress dots just below the label
    const dotGap    = 22;
    const dotsStart = cx - ((total - 1) * dotGap) / 2;
    for (let i = 0; i < total; i++) {
      if (i < doneCount) {
        p.fill(...this.C.blue, 210);
      } else if (i === doneCount) {
        p.fill(...this.C.blueLight, 255);
      } else {
        p.fill(70, 80, 100, 160);
      }
      p.ellipse(dotsStart + i * dotGap, this.messageY + 22, 9, 9);
    }
  }

  _arrowShape(p, x, y, size, col) {
    // Arrow pointing right; caller rotates to desired direction
    p.fill(...col);
    p.noStroke();
    const hw = size * 0.56;
    const hh = size * 0.27;
    const nk = size * 0.12; // notch offset
    p.beginShape();
    p.vertex(x + hw,        y);
    p.vertex(x,             y - hh);
    p.vertex(x + nk,        y - hh * 0.52);
    p.vertex(x - hw * 0.52, y - hh * 0.52);
    p.vertex(x - hw * 0.52, y + hh * 0.52);
    p.vertex(x + nk,        y + hh * 0.52);
    p.vertex(x,             y + hh);
    p.endShape(p.CLOSE);
  }

  drawSwipeTrail(points) {
    const p = this.p;
    if (points.length < 2) return;
    p.noFill();
    for (let i = 1; i < points.length; i++) {
      const t = i / points.length;
      p.stroke(...this.C.blue, Math.round(t * 200));
      p.strokeWeight(t * 5);
      p.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
    p.noStroke();
  }

  drawHitMissFlash(isHit, opacity) {
    const p   = this.p;
    const cx  = this.w / 2;
    const cy  = this.h * 0.34;
    const col = isHit ? this.C.blue : this.C.pinkDark;
    p.noStroke();
    p.fill(...col, opacity);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(36);
    p.textStyle(p.BOLD);
    p.text(isHit ? 'HIT!' : 'MISS', cx, cy);
    p.textStyle(p.NORMAL);
  }

  // ── Magic charge gesture ──────────────────────────────────────────────────
  /**
   * @param {number} chargeRatio  0..1 how far charged
   * @param {number} targetMin    target band minimum (0..1)
   * @param {number} targetMax    target band maximum (0..1)
   */
  drawMagicCharge(chargeRatio, targetMin, targetMax) {
    const p         = this.p;
    const cx        = this.w / 2;
    const cy        = this.h * 0.42;
    const maxRadius = Math.min(this.w, this.h) * 0.21;

    // Full overlay
    p.fill(0, 0, 15, 175);
    p.noStroke();
    p.rect(0, 0, this.w, this.h);

    const minR = targetMin * maxRadius;
    const maxR = targetMax * maxRadius;

    // Target band fill
    p.fill(...this.C.blue, 30);
    p.noStroke();
    p.ellipse(cx, cy, maxR * 2, maxR * 2);
    p.fill(0, 0, 15, 175);
    p.ellipse(cx, cy, minR * 2, minR * 2);

    // Dashed target rings
    p.drawingContext.save();
    p.drawingContext.setLineDash([5, 9]);
    p.noFill();
    p.stroke(...this.C.blueLight, 175);
    p.strokeWeight(2);
    p.ellipse(cx, cy, minR * 2, minR * 2);
    p.ellipse(cx, cy, maxR * 2, maxR * 2);
    p.drawingContext.restore();
    p.noStroke();

    // Charging circle
    const chargeR   = chargeRatio * maxRadius;
    const inTarget  = chargeRatio >= targetMin && chargeRatio <= targetMax;
    const circleCol = inTarget ? this.C.pink : this.C.blue;

    // Glow
    p.fill(...circleCol, 35);
    p.ellipse(cx, cy, chargeR * 2.5, chargeR * 2.5);
    // Main fill
    p.fill(...circleCol, 200);
    p.ellipse(cx, cy, chargeR * 2, chargeR * 2);
    // Centre dot
    p.fill(255, 255, 255, 210);
    p.ellipse(cx, cy, 10, 10);

    // Instructions
    p.fill(...this.C.textLight, 200);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(14);
    p.textStyle(p.BOLD);
    p.text(inTarget ? 'RELEASE NOW!' : 'HOLD & RELEASE', cx, cy + maxRadius + 32);
    p.textStyle(p.NORMAL);
    p.textSize(11);
    p.fill(...this.C.textLight, 130);
    p.text('Release inside the ring for full power', cx, cy + maxRadius + 54);
  }

  // ── Enemy wind-up ─────────────────────────────────────────────────────────
  /** @param {number} progress  0..1 */
  drawWindUp(progress) {
    const p     = this.p;
    const cx    = this.enemyCenterX;
    const cy    = this.enemyCenterY;
    const count = 6;

    p.noFill();
    p.strokeWeight(2);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + this.p.frameCount * 0.045;
      const len   = 28 + progress * 42;
      const startR = 92;
      p.stroke(...this.C.pinkDark, progress * 160);
      p.line(
        cx + Math.cos(angle) * startR,
        cy + Math.sin(angle) * startR,
        cx + Math.cos(angle) * (startR + len),
        cy + Math.sin(angle) * (startR + len)
      );
    }
    p.noStroke();

    if (progress > 0.45) {
      const alpha = Math.round((progress - 0.45) / 0.55 * 215);
      p.fill(...this.C.pinkDark, alpha);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(17);
      p.textStyle(p.BOLD);
      p.text('INCOMING!', cx, this.messageY);
      p.textStyle(p.NORMAL);
    }
  }

  /** Draws a line of text in the shared message zone. */
  drawStatusMessage(text, color, alpha = 190) {
    const p = this.p;
    p.noStroke();
    p.fill(...color, alpha);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(14);
    p.text(text, this.w / 2, this.messageY);
  }

  // ── Tap-to-block targets ──────────────────────────────────────────────────
  drawTapTargets(targets) {
    const p = this.p;
    for (const t of targets) {
      const ratio = t.radius / t.maxRadius;
      // Shift blue → pink as ring shrinks
      const r  = Math.round(this.C.blue[0] + (this.C.pinkDark[0] - this.C.blue[0]) * (1 - ratio));
      const g  = Math.round(this.C.blue[1] + (this.C.pinkDark[1] - this.C.blue[1]) * (1 - ratio));
      const b  = Math.round(this.C.blue[2] + (this.C.pinkDark[2] - this.C.blue[2]) * (1 - ratio));

      p.noFill();
      p.stroke(r, g, b, t.alpha);
      p.strokeWeight(3);
      p.ellipse(t.x, t.y, t.radius * 2, t.radius * 2);

      p.stroke(r, g, b, t.alpha * 0.45);
      p.strokeWeight(1.5);
      p.ellipse(t.x, t.y, t.radius * 1.45, t.radius * 1.45);

      p.fill(r, g, b, t.alpha * 0.85);
      p.noStroke();
      p.ellipse(t.x, t.y, 11, 11);
    }
  }

  // ── Floating damage numbers ───────────────────────────────────────────────
  spawnDamageNumber(numbers, x, y, value, color) {
    numbers.push({
      x, y,
      value,
      color:  color || this.C.blue,
      alpha:  255,
      vy:     2.8,
      size:   Math.min(42, 24 + value * 0.4),
    });
  }

  updateDamageNumbers(numbers) {
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.y    -= n.vy;
      n.vy   *= 0.96;
      n.alpha -= 3.5;
      if (n.alpha <= 0) numbers.splice(i, 1);
    }
  }

  drawDamageNumbers(numbers) {
    const p = this.p;
    p.noStroke();
    for (const n of numbers) {
      p.fill(...n.color, Math.round(n.alpha));
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(n.size);
      p.textStyle(p.BOLD);
      p.text(n.value > 0 ? `-${n.value}` : '0', n.x, n.y);
      p.textStyle(p.NORMAL);
    }
  }

  // ── End screens ───────────────────────────────────────────────────────────
  /**
   * @param {string}      roundLabel  e.g. "Round 1"
   * @param {string|null} nextName    name of next enemy, or null if final
   * @param {number}      timer       remaining frames (used for progress bar)
   */
  drawEncounterClearScreen(roundLabel, nextName, timer) {
    const p         = this.p;
    const totalTime = 200;
    const progress  = 1 - timer / totalTime; // 0..1

    // Overlay
    p.fill(0, 0, 0, 175);
    p.noStroke();
    p.rect(0, 0, this.w, this.h);

    // Round clear heading
    p.fill(...this.C.blue, 255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(44);
    p.textStyle(p.BOLD);
    p.text(`${roundLabel} CLEAR!`, this.w / 2, this.h / 2 - 50);
    p.textStyle(p.NORMAL);

    // HP restored note
    p.fill(...this.C.pink, 200);
    p.textSize(15);
    p.text('+25 HP  +20 MP restored', this.w / 2, this.h / 2 + 4);

    // Next enemy preview
    if (nextName) {
      p.fill(...this.C.textLight, 190);
      p.textSize(15);
      p.text(`Next: ${nextName}`, this.w / 2, this.h / 2 + 40);
    }

    // Auto-advance progress bar
    const barW = this.w * 0.55;
    const barH = 5;
    const bx   = (this.w - barW) / 2;
    const by   = this.h / 2 + 72;
    p.fill(40, 50, 70, 200);
    this._roundRect(bx, by, barW, barH, 3);
    p.fill(...this.C.blue, 200);
    this._roundRect(bx, by, barW * progress, barH, 3);
  }

  drawVictoryScreen(enemyName) {
    const p = this.p;
    p.fill(0, 0, 0, 185);
    p.noStroke();
    p.rect(0, 0, this.w, this.h);

    p.fill(...this.C.pink, 255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(52);
    p.textStyle(p.BOLD);
    p.text('VICTORY!', this.w / 2, this.h / 2 - 34);
    p.textStyle(p.NORMAL);

    p.fill(...this.C.blueLight, 200);
    p.textSize(18);
    p.text(`${enemyName} defeated!`, this.w / 2, this.h / 2 + 22);

    p.fill(...this.C.textLight, 150);
    p.textSize(14);
    p.text('Tap to play again', this.w / 2, this.h / 2 + 65);
  }

  drawDefeatScreen(enemyName) {
    const p = this.p;
    p.fill(0, 0, 0, 200);
    p.noStroke();
    p.rect(0, 0, this.w, this.h);

    p.fill(...this.C.pinkDark, 255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(52);
    p.textStyle(p.BOLD);
    p.text('DEFEATED', this.w / 2, this.h / 2 - 34);
    p.textStyle(p.NORMAL);

    p.fill(...this.C.blue, 180);
    p.textSize(18);
    p.text(`The ${enemyName} prevails\u2026`, this.w / 2, this.h / 2 + 22);

    p.fill(...this.C.textLight, 150);
    p.textSize(14);
    p.text('Tap to try again', this.w / 2, this.h / 2 + 65);
  }

  // ── Flash overlay ─────────────────────────────────────────────────────────
  /** Pink flash when player takes damage. */
  drawFlashOverlay(alpha) {
    const p = this.p;
    p.fill(...this.C.pinkDark, Math.min(160, alpha));
    p.noStroke();
    p.rect(0, 0, this.w, this.h);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────
  _roundRect(x, y, w, h, r) {
    const p = this.p;
    p.beginShape();
    p.vertex(x + r, y);
    p.vertex(x + w - r, y);
    p.quadraticVertex(x + w, y,     x + w, y + r);
    p.vertex(x + w, y + h - r);
    p.quadraticVertex(x + w, y + h, x + w - r, y + h);
    p.vertex(x + r, y + h);
    p.quadraticVertex(x, y + h,     x, y + h - r);
    p.vertex(x, y + r);
    p.quadraticVertex(x, y,         x + r, y);
    p.endShape(p.CLOSE);
  }
}
