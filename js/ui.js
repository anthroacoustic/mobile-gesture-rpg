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
  get playerNameY()   { return this.h * 0.815; }
  get hpBarY()        { return this.h * 0.845; }
  get mpBarY()        { return this.h * 0.885; }
  get messageY()      { return this.h * 0.55; }
  get heroCenterY()   { return this.h * 0.735; }

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

  // ── Player turn timer bar ────────────────────────────────────────────────
  /** @param {number} ratio  remaining time 0..1 */
  drawTimerBar(ratio) {
    const p    = this.p;
    const barW = this.w * 0.72;
    const barH = 10;
    const bx   = (this.w - barW) / 2;
    const by   = this.hpBarY - 30;

    // Track
    p.noStroke();
    p.fill(50, 20, 20, 200);
    this._roundRect(bx, by, barW, barH, 4);

    // Fill — gradient orange → red as time runs low
    if (ratio > 0) {
      const urgency = Math.max(0, 1 - ratio * 2.5);
      const r = Math.round(220 + urgency * 35);
      const g = Math.round(140 - urgency * 110);
      p.fill(r, g, 40, 220);
      this._roundRect(bx, by, barW * ratio, barH, 4);
    }

    // Pulsing border when low on time
    if (ratio < 0.25) {
      const pulse = (Math.sin(this.p.frameCount * 0.2) + 1) / 2;
      p.noFill();
      p.stroke(255, 80, 80, Math.round(pulse * 200));
      p.strokeWeight(1.5);
      this._roundRect(bx, by, barW, barH, 4);
      p.noStroke();
    }

    p.noStroke();
    p.fill(...this.C.textLight, 160);
    p.textAlign(p.LEFT, p.CENTER);
    p.textSize(11);
    p.text('YOUR TURN', bx, by - 9);
  }

  // ── Player missiles (pink orbs flying toward enemy) ──────────────────────
  drawPlayerMissiles(missiles, pops) {
    const p = this.p;

    for (const m of missiles) {
      const r = 10 + Math.round(m.power * 6);
      // Outer glow
      p.noStroke();
      p.fill(...this.C.pink, 30);
      p.ellipse(m.x, m.y, r * 3.2, r * 3.2);
      // Main orb
      p.fill(...this.C.pink, Math.round(180 + m.power * 60));
      p.ellipse(m.x, m.y, r * 2, r * 2);
      // Bright centre dot
      p.fill(...this.C.white, 220);
      p.ellipse(m.x, m.y, 7, 7);
    }

    // Pop burst animations (pink)
    for (const pop of pops) {
      const ratio = pop.age / pop.maxAge;
      const alpha = Math.round(255 * (1 - ratio));

      p.noFill();
      p.stroke(...this.C.pink, Math.round(alpha * 0.85));
      p.strokeWeight(2);
      p.ellipse(pop.x, pop.y, (16 + ratio * 50) * 2, (16 + ratio * 50) * 2);

      p.stroke(...this.C.pinkDark, Math.round(alpha * 0.45));
      p.strokeWeight(1);
      p.ellipse(pop.x, pop.y, (16 + ratio * 80) * 2, (16 + ratio * 80) * 2);

      p.noStroke();
      const dotSize = Math.max(0, 5 * (1 - ratio));
      p.fill(...this.C.pink, alpha);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const r = 16 + ratio * 45;
        p.ellipse(pop.x + Math.cos(a) * r, pop.y + Math.sin(a) * r, dotSize, dotSize);
      }
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

  // ── Hero avatar ──────────────────────────────────────────────────────────
  /**
   * Pentagon hero avatar at the bottom of the screen.
   * @param {Player} player
   * @param {number} flashTimer   >0 while taking damage (white flash)
   * @param {string} mode         'idle' | 'attack' | 'magic'
   * @param {number} modeData     attack: hit intensity 0..1 | magic: chargeRatio 0..1
   */
  drawPlayerAvatar(player, flashTimer, mode = 'idle', modeData = 0, swipeDir = null) {
    const p      = this.p;
    const radius = 36;
    const points = 5;

    // In attack mode, lean the hero body toward the swipe direction
    let cxOff = 0, cyOff = 0;
    if (mode === 'attack') {
      if      (swipeDir === 'left')  { cxOff = -12; cyOff = -4; }
      else if (swipeDir === 'right') { cxOff =  12; cyOff = -4; }
      else if (swipeDir === 'down')  { cxOff =   0; cyOff =  6; }
      else                           { cxOff =   0; cyOff = -12; } // up or null = lean up
    }
    const cx = this.w / 2 + cxOff;
    const cy = this.heroCenterY + cyOff;

    // ── Mode-specific aura ──────────────────────────────────────────────────

    if (mode === 'magic') {
      // Expanding charged aura — grows and shifts colour with chargeRatio
      const inTarget = modeData >= 0.6 && modeData <= 0.85;
      const auraCol  = inTarget ? this.C.pink : this.C.blue;
      p.noStroke();
      for (let i = 3; i >= 1; i--) {
        const r = radius + i * 18 * (0.4 + modeData * 0.9) +
                  Math.sin(p.frameCount * 0.07 + i) * 6;
        p.fill(...auraCol, (inTarget ? 28 : 16) - i * 4);
        p.ellipse(cx, cy, r * 2, r * 2);
      }
      // Orbiting spark dots
      for (let i = 0; i < 5; i++) {
        const a = p.frameCount * 0.06 + (i * Math.PI * 2 / 5);
        const r = radius + 22 + modeData * 28;
        p.fill(...auraCol, 170 * modeData);
        p.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, 5);
      }
    } else if (mode === 'attack') {
      // Pulsing energy rings
      p.noStroke();
      const pulse = (Math.sin(p.frameCount * 0.18) + 1) / 2;
      for (let i = 2; i >= 1; i--) {
        const r = radius + i * 16 + pulse * 10;
        p.fill(...this.C.blue, 20 - i * 6);
        p.ellipse(cx, cy, r * 2, r * 1.7);
      }
      // Directional energy slash — bright right after a swipe, fades over 18 frames
      const slashAngle = { up: -Math.PI/2, down: Math.PI/2, left: Math.PI, right: 0 }[swipeDir] ?? -Math.PI/2;
      const slashAlpha = Math.round(modeData * 220);
      p.noFill();
      if (slashAlpha > 8) {
        p.stroke(...this.C.blue, slashAlpha);
        p.strokeWeight(2.5);
        for (let i = 0; i < 3; i++) {
          const a  = slashAngle + (i - 1) * 0.28;
          const r1 = radius + 8;
          const r2 = radius + 40 + modeData * 20;
          p.line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
                 cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        }
      } else {
        // Idle "ready" slashes at low alpha when no recent swipe
        p.stroke(...this.C.blue, 50 + pulse * 40);
        p.strokeWeight(1.5);
        for (let i = 0; i < 3; i++) {
          const a  = -Math.PI / 2 + (i - 1) * 0.3;
          const r1 = radius + 8;
          const r2 = radius + 28 + pulse * 10;
          p.line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
                 cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        }
      }
      p.noStroke();
    } else {
      // Idle aura
      p.noStroke();
      for (let i = 2; i >= 1; i--) {
        const r = radius + i * 14 + Math.sin(p.frameCount * 0.03 + i) * 4;
        p.fill(...this.C.blue, 14 - i * 4);
        p.ellipse(cx, cy, r * 2, r * 1.9);
      }
    }

    // ── Pentagon body ───────────────────────────────────────────────────────

    // Body colour shifts blue → pink when magic is charged into target band
    let bodyR = this.C.blue[0], bodyG = this.C.blue[1], bodyB = this.C.blue[2];
    if (mode === 'magic' && modeData > 0) {
      const t = Math.min(1, modeData / 0.6);
      bodyR = Math.round(bodyR + (this.C.pink[0] - bodyR) * t);
      bodyG = Math.round(bodyG + (this.C.pink[1] - bodyG) * t);
      bodyB = Math.round(bodyB + (this.C.pink[2] - bodyB) * t);
    }
    // Attack: wobble faster and more intensely
    const wobbleSpeed = mode === 'attack' ? 0.14 : 0.04;
    const wobbleAmp   = mode === 'attack' ? 7    : 4;

    p.fill(bodyR, bodyG, bodyB, 210);
    p.stroke(...this.C.blueLight, 180);
    p.strokeWeight(2);
    p.beginShape();
    for (let i = 0; i < points; i++) {
      const angle  = (Math.PI * 2 / points) * i - Math.PI / 2;
      const wobble = Math.sin(p.frameCount * wobbleSpeed + i * 1.3) * wobbleAmp;
      p.vertex(cx + Math.cos(angle) * (radius + wobble),
               cy + Math.sin(angle) * (radius + wobble));
    }
    p.endShape(p.CLOSE);

    // Crest — small upward spike
    const tx = cx;
    const ty = cy - radius;
    p.fill(...this.C.blueLight, 200);
    p.noStroke();
    p.triangle(tx, ty - 14, tx - 6, ty, tx + 6, ty);

    // Eye — thin horizontal slit (narrows when attacking)
    const eyeW = mode === 'attack' ? radius * 0.52 : radius * 0.52;
    const eyeH = mode === 'attack' ? radius * 0.06 : radius * 0.10;
    const eyeY = cy - radius * 0.08;
    p.fill(255, 255, 255, 210);
    p.noStroke();
    p.ellipse(cx, eyeY, eyeW, eyeH);

    // ── Hit flash overlay ───────────────────────────────────────────────────
    if (flashTimer > 0) {
      p.fill(255, 255, 255, Math.round((flashTimer / 22) * 200));
      p.noStroke();
      p.beginShape();
      for (let i = 0; i < points; i++) {
        const angle = (Math.PI * 2 / points) * i - Math.PI / 2;
        p.vertex(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
      p.endShape(p.CLOSE);
    }

    p.noStroke();
  }

  // ── Attack bubbles ────────────────────────────────────────────────────────
  /** Draws moving enemy projectile bubbles and pop burst animations. */
  drawBubbles(bubbles, pops = []) {
    const p = this.p;
    for (const b of bubbles) {
      // Outer glow
      p.noStroke();
      p.fill(...this.C.blue, 28);
      p.ellipse(b.x, b.y, b.radius * 3.2, b.radius * 3.2);

      // Main ring
      p.noFill();
      p.stroke(...this.C.blue, 210);
      p.strokeWeight(2.5);
      p.ellipse(b.x, b.y, b.radius * 2, b.radius * 2);

      // Inner ring
      p.stroke(...this.C.blueLight, 140);
      p.strokeWeight(1);
      p.ellipse(b.x, b.y, b.radius * 1.2, b.radius * 1.2);

      // Centre dot
      p.noStroke();
      p.fill(...this.C.blueLight, 230);
      p.ellipse(b.x, b.y, 8, 8);
    }

    // Pop burst animations
    for (const pop of pops) {
      const ratio = pop.age / pop.maxAge;
      const alpha = Math.round(255 * (1 - ratio));

      // Inner expanding ring
      p.noFill();
      p.stroke(...this.C.blue, Math.round(alpha * 0.85));
      p.strokeWeight(2);
      p.ellipse(pop.x, pop.y, (28 + ratio * 60) * 2, (28 + ratio * 60) * 2);

      // Outer expanding ring
      p.stroke(...this.C.blueLight, Math.round(alpha * 0.45));
      p.strokeWeight(1);
      p.ellipse(pop.x, pop.y, (28 + ratio * 90) * 2, (28 + ratio * 90) * 2);

      // Six outward particles
      p.noStroke();
      const dotSize = Math.max(0, 5 * (1 - ratio));
      p.fill(...this.C.blueLight, alpha);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const r = 28 + ratio * 55;
        p.ellipse(pop.x + Math.cos(a) * r, pop.y + Math.sin(a) * r, dotSize, dotSize);
      }
    }

    p.noStroke();
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
    p.text('+25 HP restored', this.w / 2, this.h / 2 + 4);

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
