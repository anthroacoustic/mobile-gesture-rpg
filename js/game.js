const STATES = {
  PLAYER_CHOICE:  'PLAYER_CHOICE',
  GESTURE_ATTACK: 'GESTURE_ATTACK',
  GESTURE_MAGIC:  'GESTURE_MAGIC',
  RESOLVE_PLAYER: 'RESOLVE_PLAYER',
  ENEMY_ATTACK:   'ENEMY_ATTACK',
  RESOLVE_ENEMY:  'RESOLVE_ENEMY',
  VICTORY:        'VICTORY',
  DEFEAT:         'DEFEAT',
};

const ALL_DIRECTIONS = ['up', 'down', 'left', 'right'];
const MAGIC_COST     = 15;
const MAGIC_DURATION = 2200; // ms for full charge

class Game {
  constructor(p) {
    this.p = p;
    this.sound = new SoundEngine(); // Created once; survives _init() restarts
    this._init();
  }

  _init() {
    this.player  = new Player('Hero', 100, 50, 20, 10, 30);
    this.enemy   = new Enemy('Void Wraith', 120, 15, [2, 3]);
    this.gestures = new GestureRecognizer();
    this.ui       = new UI(this.p);

    this.damageNumbers  = [];
    this.swipeTrail     = [];
    this.playerFlashTimer = 0;

    // Cached last touch position (iOS touchend has empty touches[])
    this.lastTouchX = 0;
    this.lastTouchY = 0;

    // Per-state working data
    this.gesturePhase = {};
    this.resolvePhase = {};
    this.enemyPhase   = {};

    this._enterState(STATES.PLAYER_CHOICE);
  }

  // ── Core loop ─────────────────────────────────────────────────────────────
  update() {
    this.enemy.update();
    this.ui.updateDamageNumbers(this.damageNumbers);
    if (this.playerFlashTimer > 0) this.playerFlashTimer--;

    switch (this.state) {
      case STATES.GESTURE_ATTACK: this._updateGestureAttack(); break;
      case STATES.GESTURE_MAGIC:  this._updateGestureMagic();  break;
      case STATES.RESOLVE_PLAYER: this._updateResolvePlayer(); break;
      case STATES.ENEMY_ATTACK:   this._updateEnemyAttack();   break;
      case STATES.RESOLVE_ENEMY:  this._updateResolveEnemy();  break;
    }
  }

  draw() {
    this.ui.drawBackground();
    switch (this.state) {
      case STATES.PLAYER_CHOICE:  this._drawPlayerChoice();  break;
      case STATES.GESTURE_ATTACK: this._drawGestureAttack(); break;
      case STATES.GESTURE_MAGIC:  this._drawGestureMagic();  break;
      case STATES.RESOLVE_PLAYER: this._drawBaseBattle();    break;
      case STATES.ENEMY_ATTACK:   this._drawEnemyAttack();   break;
      case STATES.RESOLVE_ENEMY:  this._drawBaseBattle();    break;
      case STATES.VICTORY:        this._drawBaseBattle(); this.ui.drawVictoryScreen(); break;
      case STATES.DEFEAT:         this._drawBaseBattle(); this.ui.drawDefeatScreen();  break;
    }
  }

  // ── Touch routing (called from sketch.js) ────────────────────────────────
  onTouchStart(x, y) {
    this.lastTouchX = x;
    this.lastTouchY = y;

    // Magic charging begins on touch-down
    if (this.state === STATES.GESTURE_MAGIC && !this.gesturePhase.charging) {
      this.gesturePhase.charging    = true;
      this.gesturePhase.chargeStart = this.p.millis();
      this.sound.magicChargeStart();
    }
  }

  onTouchMove(x, y) {
    this.lastTouchX = x;
    this.lastTouchY = y;
  }

  onGesture(gesture) {
    switch (this.state) {
      case STATES.PLAYER_CHOICE:  this._handleChoiceGesture(gesture);  break;
      case STATES.GESTURE_ATTACK: this._handleAttackGesture(gesture);  break;
      case STATES.GESTURE_MAGIC:  this._handleMagicGesture(gesture);   break;
      case STATES.ENEMY_ATTACK:   this._handleEnemyTap(gesture);       break;
      case STATES.VICTORY:
      case STATES.DEFEAT:
        if (gesture.type === 'tap') this._init();
        break;
    }
  }

  // ── State entry ───────────────────────────────────────────────────────────
  _enterState(next) {
    this.state = next;
    switch (next) {
      case STATES.PLAYER_CHOICE:  this._setupPlayerChoice();  break;
      case STATES.GESTURE_ATTACK: this._setupGestureAttack(); break;
      case STATES.GESTURE_MAGIC:  this._setupGestureMagic();  break;
      case STATES.RESOLVE_PLAYER: this._setupResolvePlayer(); break;
      case STATES.ENEMY_ATTACK:   this._setupEnemyAttack();   break;
      case STATES.RESOLVE_ENEMY:  this._setupResolveEnemy();  break;
      case STATES.VICTORY:        this.sound.victory();       break;
      case STATES.DEFEAT:         this.sound.defeat();        break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLAYER_CHOICE
  // ══════════════════════════════════════════════════════════════════════════
  _setupPlayerChoice() {
    this.player.setDefending(false);
    this.enemy.setWindUp(1.0);
    this.gesturePhase = {};
    // Restore a small amount of MP each turn
    this.player.restoreMP(7);
  }

  _drawPlayerChoice() {
    this._drawBaseBattle();
  }

  _handleChoiceGesture(gesture) {
    if (gesture.type !== 'tap') return;
    this.sound.unlock(); // No-op if already unlocked; resumes AudioContext on first gesture
    const rects = this.ui.getButtonRects();
    for (const btn of rects) {
      if (this._hitTest(gesture.x, gesture.y, btn)) {
        this.sound.uiTap();
        if (btn.action === 'attack') {
          this._enterState(STATES.GESTURE_ATTACK);
        } else if (btn.action === 'magic') {
          if (this.player.mp >= MAGIC_COST) {
            this._enterState(STATES.GESTURE_MAGIC);
          }
        } else if (btn.action === 'defend') {
          this.player.setDefending(true);
          this._enterState(STATES.ENEMY_ATTACK);
        }
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GESTURE_ATTACK — swipe 3 directional arrows in sequence
  // ══════════════════════════════════════════════════════════════════════════
  _setupGestureAttack() {
    const total = 3;
    this.gesturePhase = {
      sequence:    this._randomDirections(total),
      total,
      currentIdx:  0,
      hits:        0,
      arrowTimer:  90,   // frames per arrow (~1.5s at 60fps)
      arrowTimeout: 90,
      showResult:  false,
      resultIsHit: false,
      resultTimer: 0,
      done:        false,
    };
  }

  _updateGestureAttack() {
    const gp = this.gesturePhase;
    if (gp.done) return;

    if (gp.showResult) {
      if (--gp.resultTimer <= 0) {
        gp.showResult = false;
        if (++gp.currentIdx >= gp.total) {
          gp.done = true;
          this._resolveAttack();
        } else {
          gp.arrowTimer = gp.arrowTimeout;
        }
      }
      return;
    }

    if (--gp.arrowTimer <= 0) {
      // Timed out → miss
      gp.showResult   = true;
      gp.resultIsHit  = false;
      gp.resultTimer  = 22;
    }
  }

  _drawGestureAttack() {
    const gp = this.gesturePhase;
    this.ui.drawEnemyArea(this.enemy);
    this.ui.drawEnemyHealthBar(this.enemy);

    if (!gp.done && !gp.showResult && gp.currentIdx < gp.total) {
      const timerRatio = gp.arrowTimer / gp.arrowTimeout;
      this.ui.drawArrowPrompt(
        gp.sequence[gp.currentIdx],
        Math.min(255, timerRatio * 310),
        gp.currentIdx,
        gp.total,
        timerRatio
      );
      this.ui.drawSwipeTrail(this.swipeTrail);
    }

    if (gp.showResult) {
      this.ui.drawHitMissFlash(gp.resultIsHit, Math.round((gp.resultTimer / 22) * 220));
    }

    this.ui.drawDamageNumbers(this.damageNumbers);
  }

  _handleAttackGesture(gesture) {
    const gp = this.gesturePhase;
    if (gp.done || gp.showResult || gesture.type !== 'swipe') return;

    const correct = gesture.direction === gp.sequence[gp.currentIdx];
    if (correct) {
      gp.hits++;
      this.sound.swipeHit();
    } else {
      this.sound.swipeMiss();
    }
    gp.showResult  = true;
    gp.resultIsHit = correct;
    gp.resultTimer = 22;
  }

  _resolveAttack() {
    const gp  = this.gesturePhase;
    const dmg = Math.round(this.player.atk * (0.5 + 0.5 * (gp.hits / gp.total)));
    this.enemy.takeDamage(dmg);
    this.ui.spawnDamageNumber(
      this.damageNumbers,
      this.ui.enemyCenterX + (Math.random() - 0.5) * 44,
      this.ui.enemyCenterY - 72,
      dmg,
      [126, 207, 238]
    );
    this.sound.comboComplete(gp.hits, gp.total);
    this._enterState(STATES.RESOLVE_PLAYER);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GESTURE_MAGIC — hold to charge, release in target ring
  // ══════════════════════════════════════════════════════════════════════════
  _setupGestureMagic() {
    this.gesturePhase = {
      charging:    false,
      chargeStart: 0,
      chargeRatio: 0,
      targetMin:   0.6,
      targetMax:   0.85,
      released:    false,
      resultRatio: 0,
      _resolved:   false,
    };
  }

  _updateGestureMagic() {
    const gp = this.gesturePhase;

    if (gp.charging && !gp.released) {
      gp.chargeRatio = Math.min(1.0, (this.p.millis() - gp.chargeStart) / MAGIC_DURATION);
      this.sound.magicChargeUpdate(gp.chargeRatio);
      if (gp.chargeRatio >= 1.0) {
        // Auto-release at max charge
        gp.released    = true;
        gp.resultRatio = 1.0;
      }
    }

    if (gp.released && !gp._resolved) {
      gp._resolved = true;
      this._resolveMagic();
    }
  }

  _drawGestureMagic() {
    const gp = this.gesturePhase;
    this.ui.drawEnemyArea(this.enemy);
    this.ui.drawEnemyHealthBar(this.enemy);
    this.ui.drawMagicCharge(gp.chargeRatio, gp.targetMin, gp.targetMax);
  }

  /** Any touchEnd while charging triggers the release. */
  _handleMagicGesture(gesture) {
    const gp = this.gesturePhase;
    if (gp.released || !gp.charging) return;
    gp.released    = true;
    gp.resultRatio = gp.chargeRatio;
  }

  _resolveMagic() {
    const gp = this.gesturePhase;
    const r  = gp.resultRatio;
    const inTarget = r >= gp.targetMin && r <= gp.targetMax;
    let power;
    if (inTarget) {
      power = 1.0;
    } else {
      const dist = Math.min(
        Math.abs(r - gp.targetMin),
        Math.abs(r - gp.targetMax)
      );
      power = Math.max(0.25, 1.0 - dist / 0.45);
    }

    const dmg = Math.round(this.player.mag * power);
    this.player.useMP(MAGIC_COST);
    this.enemy.takeDamage(dmg);
    this.ui.spawnDamageNumber(
      this.damageNumbers,
      this.ui.enemyCenterX + (Math.random() - 0.5) * 44,
      this.ui.enemyCenterY - 72,
      dmg,
      [247, 168, 192]
    );
    this.sound.magicCast(power);
    this._enterState(STATES.RESOLVE_PLAYER);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESOLVE_PLAYER — brief pause after player acts
  // ══════════════════════════════════════════════════════════════════════════
  _setupResolvePlayer() {
    this.resolvePhase = { timer: 80 };
  }

  _updateResolvePlayer() {
    if (--this.resolvePhase.timer <= 0) {
      if (!this.enemy.isAlive()) {
        this._enterState(STATES.VICTORY);
      } else {
        this._enterState(STATES.ENEMY_ATTACK);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENEMY_ATTACK — wind-up, then tap-to-block strike circles
  // ══════════════════════════════════════════════════════════════════════════
  _setupEnemyAttack() {
    this.enemyPhase = {
      windUpTimer:   90,
      windUpDone:    false,
      totalStrikes:  this.enemy.getStrikeCount(),
      currentStrike: 0,
      targets:       [],       // active tap circles
      unblockedHits: 0,
      tapTimeout:    78,       // frames before circle vanishes (≈1.3s)
      strikeDelay:   48,       // frames between strikes
      strikeDelayTimer: 0,
      allDone:       false,
    };
    this.enemy.setWindUp(1.0);
  }

  _updateEnemyAttack() {
    const ep = this.enemyPhase;
    if (ep.allDone) return;

    // Wind-up phase
    if (!ep.windUpDone) {
      ep.windUpTimer--;
      const progress = 1 - ep.windUpTimer / 90;
      this.enemy.setWindUp(1.0 + progress * 0.28);
      // Metallic pulses that get more frequent as the wind-up builds
      const interval = Math.max(8, Math.round(28 - progress * 20));
      if (ep.windUpTimer % interval === 0) {
        this.sound.windUpPulse(progress);
      }
      if (ep.windUpTimer <= 0) {
        ep.windUpDone = true;
        this.enemy.setWindUp(1.0);
        this._spawnStrike();
      }
      return;
    }

    // Shrink active targets
    for (let i = ep.targets.length - 1; i >= 0; i--) {
      const t = ep.targets[i];
      t.radius -= t.shrinkRate;
      t.alpha   = Math.round((t.radius / t.maxRadius) * 255);
      if (t.radius <= 0) {
        ep.targets.splice(i, 1);
        ep.unblockedHits++;
        this._advanceStrike();
      }
    }

    // Inter-strike delay
    if (ep.strikeDelayTimer > 0) {
      ep.strikeDelayTimer--;
      if (ep.strikeDelayTimer <= 0 &&
          ep.targets.length === 0   &&
          ep.currentStrike < ep.totalStrikes) {
        this._spawnStrike();
      }
    }
  }

  _spawnStrike() {
    const ep     = this.enemyPhase;
    const margin = 70;
    const maxR   = 52;
    const minY   = this.ui.h * 0.56;
    const maxY   = this.ui.h * 0.87;

    ep.targets.push({
      x:          margin + maxR + Math.random() * (this.ui.w - margin * 2 - maxR * 2),
      y:          minY + Math.random() * (maxY - minY),
      maxRadius:  maxR,
      radius:     maxR,
      alpha:      255,
      shrinkRate: maxR / ep.tapTimeout,
    });
  }

  _advanceStrike() {
    const ep = this.enemyPhase;
    ep.currentStrike++;
    if (ep.currentStrike >= ep.totalStrikes) {
      ep.allDone = true;
      this._enterState(STATES.RESOLVE_ENEMY);
    } else {
      ep.strikeDelayTimer = ep.strikeDelay;
    }
  }

  _drawEnemyAttack() {
    const ep       = this.enemyPhase;
    const progress = ep.windUpDone ? 1 : 1 - ep.windUpTimer / 90;

    this.ui.drawEnemyArea(this.enemy);
    this.ui.drawEnemyHealthBar(this.enemy);

    if (!ep.windUpDone) {
      this.ui.drawWindUp(progress);
    }

    this.ui.drawPlayerName(this.player);
    this.ui.drawPlayerHealthBar(this.player);
    this.ui.drawPlayerMPBar(this.player);

    if (ep.windUpDone) {
      this.ui.drawTapTargets(ep.targets);
      const p = this.p;
      p.noStroke();
      p.fill(...this.ui.C.blueLight, 155);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(13);
      p.text('TAP the circles to block!', this.ui.w / 2, this.ui.h * 0.92);
    }

    this.ui.drawDamageNumbers(this.damageNumbers);
    if (this.playerFlashTimer > 0) {
      this.ui.drawFlashOverlay(this.playerFlashTimer * 7);
    }
  }

  _handleEnemyTap(gesture) {
    if (gesture.type !== 'tap') return;
    const ep = this.enemyPhase;
    if (!ep.windUpDone || ep.allDone) return;

    for (let i = ep.targets.length - 1; i >= 0; i--) {
      const t  = ep.targets[i];
      const dx = gesture.x - t.x;
      const dy = gesture.y - t.y;
      if (Math.sqrt(dx * dx + dy * dy) <= t.maxRadius) {
        ep.targets.splice(i, 1);
        this.sound.block();
        this._advanceStrike();
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESOLVE_ENEMY — apply unblocked hit damage, then transition
  // ══════════════════════════════════════════════════════════════════════════
  _setupResolveEnemy() {
    const ep   = this.enemyPhase;
    const hits = ep.unblockedHits || 0;

    if (hits > 0) {
      const actual = this.player.takeDamage(this.enemy.atk * hits);
      if (actual > 0) {
        this.playerFlashTimer = 22;
        this.sound.playerHit();
        this.ui.spawnDamageNumber(
          this.damageNumbers,
          this.ui.w / 2 + (Math.random() - 0.5) * 60,
          this.ui.hpBarY - 22,
          actual,
          [244, 104, 138]
        );
      }
    }
    this.resolvePhase = { timer: 80 };
  }

  _updateResolveEnemy() {
    if (--this.resolvePhase.timer <= 0) {
      if (!this.player.isAlive())  this._enterState(STATES.DEFEAT);
      else if (!this.enemy.isAlive()) this._enterState(STATES.VICTORY);
      else                          this._enterState(STATES.PLAYER_CHOICE);
    }
  }

  // ── Shared render helpers ─────────────────────────────────────────────────
  _drawBaseBattle() {
    this.ui.drawEnemyArea(this.enemy);
    this.ui.drawEnemyHealthBar(this.enemy);
    this.ui.drawPlayerName(this.player);
    this.ui.drawPlayerHealthBar(this.player);
    this.ui.drawPlayerMPBar(this.player);
    this.ui.drawActionButtons(-1, this.player.mp >= MAGIC_COST);
    this.ui.drawDamageNumbers(this.damageNumbers);
    if (this.playerFlashTimer > 0) {
      this.ui.drawFlashOverlay(this.playerFlashTimer * 7);
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  _randomDirections(count) {
    return Array.from({ length: count }, () =>
      ALL_DIRECTIONS[Math.floor(Math.random() * ALL_DIRECTIONS.length)]
    );
  }

  _hitTest(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w &&
           y >= rect.y && y <= rect.y + rect.h;
  }
}
