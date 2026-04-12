class Enemy {
  /**
   * @param {string} name
   * @param {number} hp
   * @param {number} atk
   * @param {number[]} strikes  array of possible strike counts per turn
   * @param {'wraith'|'phantom'} style  visual style
   */
  constructor(name, hp, atk, strikes, style = 'wraith') {
    this.name    = name;
    this.maxHp   = hp;
    this.hp      = hp;
    this.atk     = atk;
    this.strikes = strikes;
    this.style   = style;

    // Bob animation
    this.bobOffset = 0;
    this.bobSpeed  = style === 'phantom' ? 0.032 : 0.022; // phantom bobs faster
    this.bobAmp    = 10;

    // Hit effects
    this.shakeTimer     = 0;
    this.shakeIntensity = 9;
    this.flashTimer     = 0;

    // Aura / arc pulse
    this.auraPhase = 0;
    this.auraSpeed = style === 'phantom' ? 0.03 : 0.018;

    // Wind-up scale
    this.windUpScale = 1.0;

    // Wraith: organic vertex wobble (6 hex vertices)
    this.wobbleOffsets = Array.from({ length: 6 }, () => Math.random() * Math.PI * 2);
    this.wobbleSpeeds  = Array.from({ length: 6 }, () => (Math.random() - 0.5) * 0.025);

    // Wraith: tentacle phases
    this.tentaclePhases = Array.from({ length: 4 }, (_, i) => i * 1.2);

    // Phantom: rotation angle (the star slowly spins)
    this.spinAngle = 0;
    this.spinSpeed = 0.008;

    // Phantom: blade oscillation phases
    this.bladePhases = Array.from({ length: 5 }, (_, i) => i * (Math.PI * 2 / 5));

    // Phantom: arc spark positions (regenerated each frame)
    this._sparks = [];
  }

  takeDamage(amount) {
    const actual = Math.max(0, Math.round(amount));
    this.hp = Math.max(0, this.hp - actual);
    this.triggerHitEffect();
    return actual;
  }

  triggerHitEffect() {
    this.shakeTimer = 22;
    this.flashTimer = 10;
  }

  isAlive()        { return this.hp > 0; }
  hpPercent()      { return this.hp / this.maxHp; }
  setWindUp(scale) { this.windUpScale = scale; }

  getStrikeCount() {
    return this.strikes[Math.floor(Math.random() * this.strikes.length)];
  }

  update() {
    this.bobOffset += this.bobSpeed;
    this.auraPhase += this.auraSpeed;
    if (this.shakeTimer > 0) this.shakeTimer--;
    if (this.flashTimer > 0) this.flashTimer--;

    if (this.style === 'wraith') {
      for (let i = 0; i < 6; i++) this.wobbleOffsets[i] += this.wobbleSpeeds[i];
      for (let i = 0; i < 4; i++) this.tentaclePhases[i] += 0.018;
    } else {
      this.spinAngle += this.spinSpeed;
      for (let i = 0; i < 5; i++) this.bladePhases[i] += 0.022;
    }
  }

  draw(p, cx, cy) {
    const bobY   = Math.sin(this.bobOffset) * this.bobAmp;
    let   drawCx = cx;
    let   drawCy = cy + bobY;

    if (this.shakeTimer > 0) {
      drawCx += (Math.random() - 0.5) * 2 * this.shakeIntensity;
      drawCy += (Math.random() - 0.5) * this.shakeIntensity * 0.4;
    }

    const scale  = this.windUpScale;
    const radius = 62 * scale;

    if (this.style === 'wraith') {
      this._drawWraithAura(p, drawCx, drawCy, radius);
      this._drawTentacles(p, drawCx, drawCy, radius);
      this._drawWraithBody(p, drawCx, drawCy, radius);
      this._drawWraithEye(p, drawCx, drawCy, radius);
      if (this.flashTimer > 0) {
        p.fill(255, 255, 255, Math.round((this.flashTimer / 10) * 210));
        p.noStroke();
        this._hexPath(p, drawCx, drawCy, radius);
        p.endShape(p.CLOSE);
      }
    } else {
      this._drawPhantomAura(p, drawCx, drawCy, radius);
      this._drawBlades(p, drawCx, drawCy, radius);
      this._drawPhantomBody(p, drawCx, drawCy, radius);
      this._drawPhantomEye(p, drawCx, drawCy, radius);
      if (this.flashTimer > 0) {
        p.fill(255, 255, 255, Math.round((this.flashTimer / 10) * 210));
        p.noStroke();
        this._starPath(p, drawCx, drawCy, radius, radius * 0.52);
        p.endShape(p.CLOSE);
      }
    }
  }

  // ── Void Wraith (style: 'wraith') ──────────────────────────────────────────

  _drawWraithAura(p, cx, cy, radius) {
    p.noStroke();
    for (let i = 3; i >= 1; i--) {
      const r     = radius + i * 20 + Math.sin(this.auraPhase + i * 1.1) * 7;
      const alpha = 22 - i * 5;
      p.fill(247, 168, 192, alpha);
      p.ellipse(cx, cy, r * 2, r * 1.85);
    }
  }

  _drawTentacles(p, cx, cy, radius) {
    const baseAngles = [0.4, 1.15, 2.1, 3.6];
    p.noFill();
    p.strokeWeight(3);
    for (let i = 0; i < 4; i++) {
      const angle  = baseAngles[i] + Math.sin(this.tentaclePhases[i]) * 0.18;
      const len    = 52 + i * 9;
      const startX = cx + Math.cos(angle) * radius * 0.82;
      const startY = cy + Math.sin(angle) * radius * 0.82;
      const c1x = startX + Math.cos(angle + 0.55) * len * 0.4;
      const c1y = startY + Math.sin(angle + 0.55) * len * 0.4;
      const c2x = startX + Math.cos(angle + 0.15) * len * 0.75;
      const c2y = startY + Math.sin(angle - 0.28) * len * 0.75;
      const ex  = startX + Math.cos(angle - 0.08) * len;
      const ey  = startY + Math.sin(angle + 0.42) * len;
      p.stroke(244, 104, 138, 170 - i * 18);
      p.beginShape();
      p.vertex(startX, startY);
      p.bezierVertex(c1x, c1y, c2x, c2y, ex, ey);
      p.endShape();
    }
    p.noStroke();
  }

  _drawWraithBody(p, cx, cy, radius) {
    p.fill(247, 168, 192, 225);
    p.stroke(244, 104, 138, 190);
    p.strokeWeight(2);
    this._hexPath(p, cx, cy, radius);
    p.endShape(p.CLOSE);
  }

  _hexPath(p, cx, cy, radius) {
    p.beginShape();
    for (let i = 0; i < 6; i++) {
      const angle  = (Math.PI * 2 / 6) * i - Math.PI / 2;
      const wobble = Math.sin(this.wobbleOffsets[i]) * 7;
      p.vertex(cx + Math.cos(angle) * (radius + wobble),
               cy + Math.sin(angle) * (radius + wobble));
    }
  }

  _drawWraithEye(p, cx, cy, radius) {
    const eyeR = radius * 0.21;
    const eyeY = cy - radius * 0.08;
    p.noStroke();
    p.fill(13, 27, 42, 230);
    p.ellipse(cx, eyeY, eyeR * 2, eyeR * 2);
    p.fill(126, 207, 238, 210);
    p.ellipse(cx, eyeY, eyeR * 0.95, eyeR * 0.95);
    p.fill(255, 255, 255, 190);
    p.ellipse(cx - eyeR * 0.28, eyeY - eyeR * 0.22, eyeR * 0.32, eyeR * 0.32);
  }

  // ── Arc Phantom (style: 'phantom') ─────────────────────────────────────────

  _drawPhantomAura(p, cx, cy, radius) {
    // Pulsing cyan rings
    p.noStroke();
    for (let i = 3; i >= 1; i--) {
      const r     = radius + i * 22 + Math.sin(this.auraPhase * 1.4 + i * 0.9) * 9;
      const alpha = 18 - i * 4;
      p.fill(46, 232, 255, alpha);
      p.ellipse(cx, cy, r * 2, r * 1.9);
    }
    // Electric arc sparks — short lines near the body edge
    p.stroke(46, 232, 255, 160);
    p.strokeWeight(1.5);
    for (let i = 0; i < 6; i++) {
      const angle = this.auraPhase * 2 + i * (Math.PI * 2 / 6);
      const r1    = radius + 4 + Math.random() * 8;
      const r2    = r1 + 10 + Math.random() * 14;
      p.line(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1,
             cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    }
    p.noStroke();
  }

  _drawBlades(p, cx, cy, radius) {
    // 5 rigid triangular blades radiating from the body, oscillating slightly
    p.noStroke();
    for (let i = 0; i < 5; i++) {
      const baseAngle = (Math.PI * 2 / 5) * i + this.spinAngle;
      const sway      = Math.sin(this.bladePhases[i]) * 0.08;
      const angle     = baseAngle + sway;
      const len       = 52 + Math.sin(this.bladePhases[i] * 0.7) * 8;
      const halfW     = 7;

      const tipX  = cx + Math.cos(angle) * (radius * 0.9 + len);
      const tipY  = cy + Math.sin(angle) * (radius * 0.9 + len);
      const lbX   = cx + Math.cos(angle + 0.4) * radius * 0.75;
      const lbY   = cy + Math.sin(angle + 0.4) * radius * 0.75;
      const rbX   = cx + Math.cos(angle - 0.4) * radius * 0.75;
      const rbY   = cy + Math.sin(angle - 0.4) * radius * 0.75;

      // Glow pass
      p.fill(46, 232, 255, 40);
      p.beginShape();
      p.vertex(tipX + Math.cos(angle + Math.PI / 2) * halfW * 1.8,
               tipY + Math.sin(angle + Math.PI / 2) * halfW * 1.8);
      p.vertex(lbX, lbY);
      p.vertex(rbX, rbY);
      p.endShape(p.CLOSE);

      // Solid blade
      p.fill(46, 232, 255, 200);
      p.beginShape();
      p.vertex(tipX, tipY);
      p.vertex(lbX,  lbY);
      p.vertex(rbX,  rbY);
      p.endShape(p.CLOSE);
    }
  }

  _drawPhantomBody(p, cx, cy, radius) {
    // Spinning 8-pointed star (alternating long/short radii)
    p.fill(13, 200, 230, 215);
    p.stroke(46, 232, 255, 200);
    p.strokeWeight(1.5);
    this._starPath(p, cx, cy, radius, radius * 0.52);
    p.endShape(p.CLOSE);
  }

  /** 8-pointed star path — outer radius r1, inner radius r2, spins with this.spinAngle */
  _starPath(p, cx, cy, r1, r2) {
    const points = 8;
    p.beginShape();
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI * 2 / (points * 2)) * i + this.spinAngle;
      const r     = i % 2 === 0 ? r1 : r2;
      p.vertex(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
  }

  _drawPhantomEye(p, cx, cy, radius) {
    // Horizontal almond-shaped slit eye with magenta glow
    const ew = radius * 0.46;
    const eh = radius * 0.13;
    const eyeY = cy - radius * 0.06;

    p.noStroke();
    // Outer glow
    p.fill(247, 80, 180, 80);
    p.ellipse(cx, eyeY, ew * 1.4, eh * 2.2);
    // Dark iris
    p.fill(10, 20, 35, 240);
    p.ellipse(cx, eyeY, ew, eh);
    // Magenta slit
    p.fill(255, 80, 200, 230);
    p.ellipse(cx, eyeY, ew * 0.85, eh * 0.55);
    // Bright centre spark
    p.fill(255, 200, 255, 240);
    p.ellipse(cx, eyeY, ew * 0.2, eh * 0.3);
  }
}
