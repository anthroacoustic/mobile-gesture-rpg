const STATES = {
  PLAYER_TURN:     'PLAYER_TURN',
  ENEMY_ATTACK:    'ENEMY_ATTACK',
  RESOLVE_ENEMY:   'RESOLVE_ENEMY',
  ENCOUNTER_CLEAR: 'ENCOUNTER_CLEAR',
  VICTORY:         'VICTORY',
  DEFEAT:          'DEFEAT',
};

const MAGIC_DURATION     = 2200;  // ms for full charge
const SWIPE_DAMAGE_RATIO = 0.35;  // player.atk × ratio per swipe
const MISSILE_MIN_CHARGE = 0.2;   // minimum charge fraction to fire a missile
const MISSILE_SPEED      = 10;    // px/frame — straight toward enemy

/**
 * Encounter configs drive enemy creation and per-round timing.
 * playerTurnDuration: frames the player has to act (600 = ~10s, 360 = ~6s)
 * tapTimeout:         frames before a block bubble vanishes
 */
const ENCOUNTERS = [
  {
    label:              'Round 1',
    enemyName:          'Void Wraith',
    createEnemy:        () => new Enemy('Void Wraith', 120, 15, [2, 3], 'wraith'),
    playerTurnDuration: 600,
    tapTimeout:         78,
    bubbleSpeed:        2.2,
    bubbleAccel:        0.04,
  },
  {
    label:              'Round 2',
    enemyName:          'Arc Phantom',
    createEnemy:        () => new Enemy('Arc Phantom', 160, 22, [3, 4], 'phantom'),
    playerTurnDuration: 360,
    tapTimeout:         52,
    bubbleSpeed:        3.8,
    bubbleAccel:        0.07,
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
    this.playerPhase  = {};
    this.resolvePhase = {};
    this.enemyPhase   = {};

    this._enterState(STATES.PLAYER_TURN);
  }

  // ── Core loop ─────────────────────────────────────────────────────────────
  update() {
    this.enemy.update();
    this.ui.updateDamageNumbers(this.damageNumbers);
    if (this.playerFlashTimer > 0) this.playerFlashTimer--;

    switch (this.state) {
      case STATES.PLAYER_TURN:     this._updatePlayerTurn();     break;
      case STATES.ENEMY_ATTACK:    this._updateEnemyAttack();    break;
      case STATES.RESOLVE_ENEMY:   this._updateResolveEnemy();   break;
      case STATES.ENCOUNTER_CLEAR: this._updateEncounterClear(); break;
    }
  }

  draw() {
    this.ui.drawBackground();
    switch (this.state) {
      case STATES.PLAYER_TURN:     this._drawPlayerTurn();    break;
      case STATES.ENEMY_ATTACK:    this._drawEnemyAttack();   break;
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

    if (this.state === STATES.PLAYER_TURN) {
      this.sound.unlock();
      const pp = this.playerPhase;
      if (pp.holdStart === null) {
        pp.holdStart = this.p.millis();
        this.sound.magicChargeStart();
      }
    }
  }

  onTouchMove(x, y) {
    this.lastTouchX = x;
    this.lastTouchY = y;
  }

  onGesture(gesture) {
    this.sound.unlock(); // retry on touchend — more reliable on strict browsers
    switch (this.state) {
      case STATES.PLAYER_TURN:  this._handlePlayerTurnGesture(gesture); break;
      case STATES.ENEMY_ATTACK: this._handleEnemyTap(gesture);          break;
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
      case STATES.PLAYER_TURN:     this._setupPlayerTurn();    break;
      case STATES.ENEMY_ATTACK:    this._setupEnemyAttack();   break;
      case STATES.RESOLVE_ENEMY:   this._setupResolveEnemy();  break;
      case STATES.ENCOUNTER_CLEAR: this._setupEncounterClear(); break;
      case STATES.VICTORY:         this.sound.victory();        break;
      case STATES.DEFEAT:          this.sound.defeat();         break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLAYER_TURN — depleting timer; swipe to attack, hold→release to fire missile
  // ══════════════════════════════════════════════════════════════════════════
  _setupPlayerTurn() {
    this.sound.magicAbort(); // silence any lingering FM hold from a previous turn
    this.player.setDefending(false);
    this.enemy.setWindUp(1.0);
    this.playerPhase = {
      timer:        this.encounterConfig.playerTurnDuration,
      holdStart:    null,
      chargeRatio:  0,
      missiles:     [],
      missilePops:  [],
      flashTimer:   0,
      swipeTimer:   0,
      lastSwipeDir: null,
    };
  }

  _updatePlayerTurn() {
    const pp = this.playerPhase;

    // Decrement turn timer
    if (--pp.timer <= 0) {
      pp.holdStart = null;
      this.sound.magicAbort();
      this._enterState(STATES.ENEMY_ATTACK);
      return;
    }

    // Update charge ratio while holding
    if (pp.holdStart !== null) {
      pp.chargeRatio = Math.min(1.0, (this.p.millis() - pp.holdStart) / MAGIC_DURATION);
      this.sound.magicChargeUpdate(pp.chargeRatio);
      if (pp.chargeRatio >= 1.0) {
        this._fireMissile(1.0);
      }
    }

    if (pp.swipeTimer > 0) pp.swipeTimer--;
    if (pp.flashTimer > 0) pp.flashTimer--;

    // Age missile pop bursts
    for (let i = pp.missilePops.length - 1; i >= 0; i--) {
      if (++pp.missilePops[i].age >= pp.missilePops[i].maxAge) pp.missilePops.splice(i, 1);
    }

    // Move missiles toward enemy; detect hits
    for (let i = pp.missiles.length - 1; i >= 0; i--) {
      const m  = pp.missiles[i];
      const dx = this.ui.enemyCenterX - m.x;
      const dy = this.ui.enemyCenterY - m.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist <= MISSILE_SPEED) {
        // Missile reaches enemy this frame
        const dmg = Math.max(1, Math.round(this.player.atk * m.power));
        this.enemy.takeDamage(dmg);
        this.ui.spawnDamageNumber(
          this.damageNumbers,
          this.ui.enemyCenterX + (Math.random() - 0.5) * 44,
          this.ui.enemyCenterY - 72,
          dmg,
          [247, 168, 192]
        );
        pp.missilePops.push({ x: m.x, y: m.y, age: 0, maxAge: 20 });
        pp.missiles.splice(i, 1);
        this.sound.magicCast(m.power);
        if (!this.enemy.isAlive()) {
          const hasNext = this.encounterIdx < ENCOUNTERS.length - 1;
          this._enterState(hasNext ? STATES.ENCOUNTER_CLEAR : STATES.VICTORY);
          return;
        }
      } else {
        m.x += (dx / dist) * MISSILE_SPEED;
        m.y += (dy / dist) * MISSILE_SPEED;
      }
    }
  }

  _drawPlayerTurn() {
    const pp  = this.playerPhase;
    const enc = this.encounterConfig;

    this.ui.drawEnemyArea(this.enemy);
    this.ui.drawEnemyHealthBar(this.enemy);

    // Charge ring overlay while holding
    if (pp.holdStart !== null) {
      this.ui.drawMagicCharge(pp.chargeRatio, 0.6, 0.85);
    }

    // Player avatar
    let avatarMode = 'idle', avatarData = 0;
    if (pp.holdStart !== null) {
      avatarMode = 'magic';
      avatarData = pp.chargeRatio;
    } else if (pp.swipeTimer > 0) {
      avatarMode = 'attack';
      avatarData = pp.swipeTimer / 18;
    }
    this.ui.drawPlayerAvatar(this.player, this.playerFlashTimer, avatarMode, avatarData, pp.lastSwipeDir);
    this.ui.drawPlayerName(this.player);
    this.ui.drawPlayerHealthBar(this.player);

    // Turn timer bar
    this.ui.drawTimerBar(pp.timer / enc.playerTurnDuration);

    // Missiles, swipe trail
    this.ui.drawPlayerMissiles(pp.missiles, pp.missilePops);
    if (pp.holdStart === null) {
      this.ui.drawSwipeTrail(this.swipeTrail);
    }

    // Status hint
    if (pp.holdStart === null) {
      this.ui.drawStatusMessage('SWIPE TO ATTACK  •  HOLD TO CHARGE', this.ui.C.textLight);
    }

    // HIT! flash
    if (pp.flashTimer > 0) {
      this.ui.drawHitMissFlash(true, Math.round((pp.flashTimer / 22) * 220));
    }

    this.ui.drawDamageNumbers(this.damageNumbers);
    if (this.playerFlashTimer > 0) {
      this.ui.drawFlashOverlay(this.playerFlashTimer * 7);
    }
  }

  _handlePlayerTurnGesture(gesture) {
    const pp = this.playerPhase;

    if (gesture.type === 'swipe') {
      // Abort any hold in progress
      pp.holdStart   = null;
      pp.chargeRatio = 0;
      this.sound.magicAbort();

      const dmg = Math.max(1, Math.ceil(this.player.atk * SWIPE_DAMAGE_RATIO));
      this.enemy.takeDamage(dmg);
      this.ui.spawnDamageNumber(
        this.damageNumbers,
        this.ui.enemyCenterX + (Math.random() - 0.5) * 44,
        this.ui.enemyCenterY - 72,
        dmg,
        [126, 207, 238]
      );
      pp.lastSwipeDir = gesture.direction;
      pp.swipeTimer   = 18;
      pp.flashTimer   = 22;
      this.sound.swipeHit();

      if (!this.enemy.isAlive()) {
        const hasNext = this.encounterIdx < ENCOUNTERS.length - 1;
        this._enterState(hasNext ? STATES.ENCOUNTER_CLEAR : STATES.VICTORY);
      }

    } else if (gesture.type === 'hold') {
      const ratio = pp.chargeRatio;
      pp.holdStart   = null;
      pp.chargeRatio = 0;
      if (ratio >= MISSILE_MIN_CHARGE) {
        this._fireMissile(ratio);
      } else {
        this.sound.magicAbort();
      }

    } else {
      // tap or none — just cancel any hold
      pp.holdStart   = null;
      pp.chargeRatio = 0;
      this.sound.magicAbort();
    }
  }

  _fireMissile(power) {
    this.sound.magicAbort(); // stop the charge hum; sting plays on impact
    this.playerPhase.missiles.push({
      x:     this.ui.w / 2,
      y:     this.ui.heroCenterY - 30,
      power: Math.min(1.0, power),
    });
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
        ep.pops.push({ x: t.x, y: t.y, age: 0, maxAge: 20 });
        ep.targets.splice(i, 1);
        ep.unblockedHits++;

        // Immediate per-bubble damage (total enemy.atk split across all strikes)
        const dmg    = Math.round(this.enemy.atk / ep.totalStrikes);
        const actual = this.player.takeDamage(dmg);
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
    // Damage is applied immediately per bubble in _updateEnemyAttack.
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
        this._enterState(STATES.PLAYER_TURN);
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
      this._enterState(STATES.PLAYER_TURN);
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
    this.ui.drawDamageNumbers(this.damageNumbers);
    if (this.playerFlashTimer > 0) {
      this.ui.drawFlashOverlay(this.playerFlashTimer * 7);
    }
  }


}

