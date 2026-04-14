const STATES = {
  PLAYER_CHOICE:   'PLAYER_CHOICE',
  GESTURE_ATTACK:  'GESTURE_ATTACK',
  GESTURE_MAGIC:   'GESTURE_MAGIC',
  RESOLVE_PLAYER:  'RESOLVE_PLAYER',
  ENEMY_ATTACK:    'ENEMY_ATTACK',
  RESOLVE_ENEMY:   'RESOLVE_ENEMY',
  ENCOUNTER_CLEAR: 'ENCOUNTER_CLEAR',
  VICTORY:         'VICTORY',
  DEFEAT:          'DEFEAT',
};

const ALL_DIRECTIONS = ['up', 'down', 'left', 'right'];
const MAGIC_COST     = 15;
const MAGIC_DURATION = 2200; // ms for full charge

/**
 * Encounter configs drive both enemy creation and per-round timing difficulty.
 * arrowCount:   number of swipe arrows in an attack combo
 * arrowTimeout: frames the player has per arrow  (90 = ~1.5s, 62 = ~1.0s)
 * tapTimeout:   frames before a block circle vanishes (78 = ~1.3s, 52 = ~0.87s)
 */
const ENCOUNTERS = [
  {
    label:        'Round 1',
    enemyName:    'Void Wraith',
    createEnemy:  () => new Enemy('Void Wraith', 120, 15, [2, 3], 'wraith'),
    arrowCount:   3,
    arrowTimeout: 90,
    tapTimeout:   78,
    bubbleSpeed:  2.2,
    bubbleAccel:  0.04,
  },
  {
    label:        'Round 2',
    enemyName:    'Arc Phantom',
    createEnemy:  () => new Enemy('Arc Phantom', 160, 22, [3, 4], 'phantom'),
    arrowCount:   4,
    arrowTimeout: 62,
    tapTimeout:   52,
    bubbleSpeed:  3.8,
    bubbleAccel:  0.07,
  },
];

class Game {
  constructor(p) {
    this.p = p;
    this.sound = new SoundEngine(); // Created once; survives _init() restarts
    this._init();
  }

  _init() {
    this.encounterIdx    = 0;
    this.encounterConfig = ENCOUNTERS[0];
    this.player   = new Player('Hero', 100, 50, 20, 10, 30);
    this.enemy    = this.encounterConfig.createEnemy();
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
      case STATES.GESTURE_ATTACK:  this._updateGestureAttack();  break;
      case STATES.GESTURE_MAGIC:   this._updateGestureMagic();   break;
      case STATES.RESOLVE_PLAYER:  this._updateResolvePlayer();  break;
      case STATES.ENEMY_ATTACK:    this._updateEnemyAttack();    break;
      case STATES.RESOLVE_ENEMY:   this._updateResolveEnemy();   break;
      case STATES.ENCOUNTER_CLEAR: this._updateEncounterClear(); break;
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
      case STATES.RESOLVE_ENEMY:   this._drawBaseBattle();    break;
      case STATES.ENCOUNTER_CLEAR: this._drawEncounterClear(); break;
      case STATES.VICTORY:         this._drawBaseBattle(); this.ui.drawVictoryScreen(this.enemy.name); break;
      case STATES.DEFEAT:          this._drawBaseBattle(); this.ui.drawDefeatScreen(this.enemy.name);  break;
    }
  }

  // ── Touch routing (called from sketch.js) ────────────────────────────────
  onTouchStart(x, y) {
    this.lastTouchX = x;
    this.lastTouchY = y;

    // Radial menu — show on touch-down during player choice
    if (this.state === STATES.PLAYER_CHOICE) {
      this.sound.unlock();
      this.gesturePhase.showRadial   = true;
      this.gesturePhase.radialOrigin = { x, y };
      this.gesturePhase.radialHover  = null;
    }

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

    // Update radial hover sector
    if (this.state === STATES.PLAYER_CHOICE && this.gesturePhase.showRadial) {
      const { x: ox, y: oy } = this.gesturePhase.radialOrigin;
      const dist = Math.hypot(x - ox, y - oy);
      this.gesturePhase.radialHover = dist >= 44
        ? this._radialSector(Math.atan2(y - oy, x - ox))
        : null;
    }
  }

  onGesture(gesture) {
    this.sound.unlock(); // retry on touchend — more reliable on strict browsers
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
      case STATES.ENEMY_ATTACK:    this._setupEnemyAttack();    break;
      case STATES.RESOLVE_ENEMY:   this._setupResolveEnemy();   break;
      case STATES.ENCOUNTER_CLEAR: this._setupEncounterClear(); break;
      case STATES.VICTORY:         this.sound.victory();        break;
      case STATES.DEFEAT:          this.sound.defeat();         break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLAYER_CHOICE
  // ══════════════════════════════════════════════════════════════════════════
  _setupPlayerChoice() {
    this.player.setDefending(false);
    this.enemy.setWindUp(1.0);
    this.gesturePhase = { showRadial: false, radialOrigin: null, radialHover: null };
    // Restore a small amount of MP each turn
    this.player.restoreMP(7);
  }

  _drawPlayerChoice() {
    this._drawBaseBattle();
    const gp = this.gesturePhase;
    if (gp.showRadial && gp.radialOrigin) {
      this.ui.drawRadialMenu(
        gp.radialOrigin.x,
        gp.radialOrigin.y,
        gp.radialHover,
        this.player.mp >= MAGIC_COST
      );
    } else {
      this.ui.drawStatusMessage('YOUR TURN  —  PRESS TO OPEN MENU', this.ui.C.textLight);
    }
  }

  _handleChoiceGesture(gesture) {
    const gp  = this.gesturePhase;
    gp.showRadial = false;
    const action  = gp.radialHover;
    if (!action) return;
    this.sound.uiTap();
    if (action === 'attack') {
      this._enterState(STATES.GESTURE_ATTACK);
    } else if (action === 'magic') {
      if (this.player.mp >= MAGIC_COST) this._enterState(STATES.GESTURE_MAGIC);
    } else if (action === 'defend') {
      this.player.setDefending(true);
      this._enterState(STATES.ENEMY_ATTACK);
    }
  }

  _radialSector(angle) {
    // atan2 returns -PI..+PI; sector boundaries at -5π/6, -π/6, +π/2
    const PI = Math.PI;
    if (angle >= -5 * PI / 6 && angle < -PI / 6) return 'attack';  // upward
    if (angle >= -PI / 6     && angle <  PI / 2) return 'defend';  // down-right
    return 'magic';                                                   // down-left
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GESTURE_ATTACK — swipe 3 directional arrows in sequence
  // ══════════════════════════════════════════════════════════════════════════
  _setupGestureAttack() {
    const { arrowCount: total, arrowTimeout } = this.encounterConfig;
    this.gesturePhase = {
      sequence:    this._randomDirections(total),
      total,
      currentIdx:  0,
      hits:        0,
      arrowTimer:   arrowTimeout,
      arrowTimeout,
      showResult:  false,
      resultIsHit: false,
      resultTimer: 0,
      done:        false,
      lastSwipeDir: null,
      swipeTimer:   0,
    };
  }

  _updateGestureAttack() {
    const gp = this.gesturePhase;
    if (gp.swipeTimer > 0) gp.swipeTimer--;
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

    this.ui.drawPlayerAvatar(this.player, 0, 'attack', gp.swipeTimer / 18, gp.lastSwipeDir);
    this.ui.drawDamageNumbers(this.damageNumbers);
  }

  _handleAttackGesture(gesture) {
    const gp = this.gesturePhase;
    if (gp.done || gp.showResult || gesture.type !== 'swipe') return;

    const correct = gesture.direction === gp.sequence[gp.currentIdx];
    gp.lastSwipeDir = gesture.direction;
    gp.swipeTimer   = 18;
    if (correct) {
      gp.hits++;
      this.sound.swipeHit();
      // Immediate per-swipe damage
      const swipeDmg = Math.round(this.player.atk / gp.total);
      this.enemy.takeDamage(swipeDmg);
      this.ui.spawnDamageNumber(
        this.damageNumbers,
        this.ui.enemyCenterX + (Math.random() - 0.5) * 44,
        this.ui.enemyCenterY - 72,
        swipeDmg,
        [126, 207, 238]
      );
    } else {
      this.sound.swipeMiss();
    }
    gp.showResult  = true;
    gp.resultIsHit = correct;
    gp.resultTimer = 22;
  }

  _resolveAttack() {
    const gp = this.gesturePhase;
    // Damage was already applied per-swipe; just play combo sound and transition
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
    this.ui.drawPlayerAvatar(this.player, 0, 'magic', gp.chargeRatio);
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
        const hasNext = this.encounterIdx < ENCOUNTERS.length - 1;
        this._enterState(hasNext ? STATES.ENCOUNTER_CLEAR : STATES.VICTORY);
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
      targets:       [],       // active bubbles
      pops:          [],       // pop burst animations
      unblockedHits: 0,
      tapTimeout:    this.encounterConfig.tapTimeout,
      strikeDelay:   48,       // frames between strikes
      strikeDelayTimer: 0,
      allDone:       false,
    };
    this.enemy.setWindUp(1.0);
  }

  _updateEnemyAttack() {
    const ep = this.enemyPhase;

    // Age pop bursts — runs even when allDone so the last pop finishes animating
    for (let i = ep.pops.length - 1; i >= 0; i--) {
      if (++ep.pops[i].age >= ep.pops[i].maxAge) ep.pops.splice(i, 1);
    }

    if (ep.allDone) {
      if (ep.pops.length === 0) this._enterState(STATES.RESOLVE_ENEMY);
      return;
    }

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

    // Move bubbles with oscillating (spiral) path; check for hero collision
    const heroR = 42;
    for (let i = ep.targets.length - 1; i >= 0; i--) {
      const t   = ep.targets[i];
      const dhx = this.ui.enemyCenterX - t.x;
      const dhy = this.ui.heroCenterY  - t.y;
      const dd  = Math.hypot(dhx, dhy) || 1;

      // Perpendicular direction (90° CCW of toward-hero)
      const pvx = -dhy / dd;
      const pvy =  dhx / dd;

      t.spiralPhase += 0.12;
      const perp = Math.sin(t.spiralPhase) * 0.8;

      t.x += (dhx / dd + pvx * perp) * t.speed;
      t.y += (dhy / dd + pvy * perp) * t.speed;
      t.speed += t.accel;

      if (Math.hypot(t.x - this.ui.enemyCenterX, t.y - this.ui.heroCenterY) < heroR) {
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
    const ep = this.enemyPhase;
    const ex = this.ui.enemyCenterX + (Math.random() - 0.5) * 80;
    const ey = this.ui.enemyCenterY + 75;
    ep.targets.push({
      x: ex, y: ey,
      speed:       this.encounterConfig.bubbleSpeed,
      accel:       this.encounterConfig.bubbleAccel,
      radius:      28,
      hitRadius:   44,
      spiralPhase: Math.random() * Math.PI * 2,
    });
    this.sound.bubbleFire();
  }

  _advanceStrike() {
    const ep = this.enemyPhase;
    ep.currentStrike++;
    if (ep.currentStrike >= ep.totalStrikes) {
      ep.allDone = true;
      // Transition to RESOLVE_ENEMY is deferred to _updateEnemyAttack
      // so any pending pop animation has time to render.
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

    this.ui.drawPlayerAvatar(this.player, this.playerFlashTimer);
    this.ui.drawPlayerName(this.player);
    this.ui.drawPlayerHealthBar(this.player);
    this.ui.drawPlayerMPBar(this.player);

    if (ep.windUpDone) {
      this.ui.drawBubbles(ep.targets, ep.pops);
      this.ui.drawStatusMessage('TAP BUBBLES TO BLOCK!', this.ui.C.blueLight);
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
      if (Math.sqrt(dx * dx + dy * dy) <= t.hitRadius) {
        ep.pops.push({ x: t.x, y: t.y, age: 0, maxAge: 20 });
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
      if (!this.player.isAlive()) {
        this._enterState(STATES.DEFEAT);
      } else if (!this.enemy.isAlive()) {
        const hasNext = this.encounterIdx < ENCOUNTERS.length - 1;
        this._enterState(hasNext ? STATES.ENCOUNTER_CLEAR : STATES.VICTORY);
      } else {
        this._enterState(STATES.PLAYER_CHOICE);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENCOUNTER_CLEAR — celebrate round win, then start next encounter
  // ══════════════════════════════════════════════════════════════════════════
  _setupEncounterClear() {
    this.resolvePhase = { timer: 200 }; // ~3.3s
    this.sound.roundClear();
  }

  _updateEncounterClear() {
    if (--this.resolvePhase.timer <= 0) {
      // Advance to next encounter
      this.encounterIdx++;
      this.encounterConfig = ENCOUNTERS[this.encounterIdx];
      this.enemy = this.encounterConfig.createEnemy();
      // Partial heal between rounds
      this.player.heal(25);
      this.player.restoreMP(20);
      this._enterState(STATES.PLAYER_CHOICE);
    }
  }

  _drawEncounterClear() {
    this._drawBaseBattle();
    const nextEnc = ENCOUNTERS[this.encounterIdx + 1];
    this.ui.drawEncounterClearScreen(
      this.encounterConfig.label,
      nextEnc ? nextEnc.enemyName : null,
      this.resolvePhase.timer
    );
  }

  // ── Shared render helpers ─────────────────────────────────────────────────
  _drawBaseBattle() {
    this.ui.drawEnemyArea(this.enemy);
    this.ui.drawEnemyHealthBar(this.enemy);
    this.ui.drawPlayerAvatar(this.player, this.playerFlashTimer);
    this.ui.drawPlayerName(this.player);
    this.ui.drawPlayerHealthBar(this.player);
    this.ui.drawPlayerMPBar(this.player);
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

}

