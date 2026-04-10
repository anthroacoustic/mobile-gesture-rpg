class Enemy {
  constructor(name, hp, atk, strikes) {
    this.name     = name;
    this.maxHp    = hp;
    this.hp       = hp;
    this.atk      = atk;
    this.strikes  = strikes; // array e.g. [2, 3] — random element chosen each turn

    // Bob animation
    this.bobOffset = 0;
    this.bobSpeed  = 0.022;
    this.bobAmp    = 10;

    // Hit effects
    this.shakeTimer     = 0;
    this.shakeIntensity = 9;
    this.flashTimer     = 0;

    // Aura pulse
    this.auraPhase = 0;
    this.auraSpeed = 0.018;

    // Wind-up scale (set externally during enemy attack state)
    this.windUpScale = 1.0;

    // Organic vertex wobble — 6 hex vertices each drift independently
    this.wobbleOffsets = Array.from({ length: 6 }, () => Math.random() * Math.PI * 2);
    this.wobbleSpeeds  = Array.from({ length: 6 }, () => (Math.random() - 0.5) * 0.025);

    // Tentacle phase offsets
    this.tentaclePhases = Array.from({ length: 4 }, (_, i) => i * 1.2);
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

  isAlive()          { return this.hp > 0; }
  hpPercent()        { return this.hp / this.maxHp; }
  setWindUp(scale)   { this.windUpScale = scale; }

  /** Returns a random strike count for this turn. */
  getStrikeCount() {
    return this.strikes[Math.floor(Math.random() * this.strikes.length)];
  }

  update() {
    this.bobOffset += this.bobSpeed;
    this.auraPhase += this.auraSpeed;
    if (this.shakeTimer > 0) this.shakeTimer--;
    if (this.flashTimer > 0) this.flashTimer--;
    for (let i = 0; i < 6; i++) {
      this.wobbleOffsets[i] += this.wobbleSpeeds[i];
    }
    for (let i = 0; i < 4; i++) {
      this.tentaclePhases[i] += 0.018;
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

    this._drawAura(p, drawCx, drawCy, radius);
    this._drawTentacles(p, drawCx, drawCy, radius);
    this._drawBody(p, drawCx, drawCy, radius);
    this._drawEye(p, drawCx, drawCy, radius);

    if (this.flashTimer > 0) {
      const alpha = Math.round((this.flashTimer / 10) * 210);
      p.fill(255, 255, 255, alpha);
      p.noStroke();
      this._hexPath(p, drawCx, drawCy, radius);
      p.endShape(p.CLOSE);
    }
  }

  _drawAura(p, cx, cy, radius) {
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

  _drawBody(p, cx, cy, radius) {
    p.fill(247, 168, 192, 225);
    p.stroke(244, 104, 138, 190);
    p.strokeWeight(2);
    this._hexPath(p, cx, cy, radius);
    p.endShape(p.CLOSE);
  }

  /** Begins a hex shape path — caller must call p.endShape(). */
  _hexPath(p, cx, cy, radius) {
    p.beginShape();
    for (let i = 0; i < 6; i++) {
      const baseAngle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      const wobble    = Math.sin(this.wobbleOffsets[i]) * 7;
      const r         = radius + wobble;
      p.vertex(cx + Math.cos(baseAngle) * r, cy + Math.sin(baseAngle) * r);
    }
  }

  _drawEye(p, cx, cy, radius) {
    const eyeR = radius * 0.21;
    const eyeY = cy - radius * 0.08;

    p.noStroke();
    // Iris (dark)
    p.fill(13, 27, 42, 230);
    p.ellipse(cx, eyeY, eyeR * 2, eyeR * 2);
    // Pupil (light blue glow)
    p.fill(126, 207, 238, 210);
    p.ellipse(cx, eyeY, eyeR * 0.95, eyeR * 0.95);
    // Specular highlight
    p.fill(255, 255, 255, 190);
    p.ellipse(cx - eyeR * 0.28, eyeY - eyeR * 0.22, eyeR * 0.32, eyeR * 0.32);
  }
}
