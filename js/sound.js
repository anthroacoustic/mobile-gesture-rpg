/**
 * SoundEngine — procedural FM sound effects via Tone.js.
 *
 * Three synth voices:
 *   fm    (FMSynth)       — otherworldly tones, magic sweeps, victory/defeat stings
 *   metal (MetalSynth)    — attack crunches, wind-up rumbles, damage hits
 *   mem   (MembraneSynth) — satisfying bops for blocks and UI taps
 *
 * IMPORTANT: Tone.start() must be called from inside a user gesture (browser
 * autoplay policy). Call sound.unlock() on the very first button tap.
 * Synths are built lazily after unlock; all methods silently no-op before that.
 */
class SoundEngine {
  constructor() {
    this._unlocked      = false;
    this._magicCharging = false;
    this.fm             = null;
    this.metal          = null;
    this.mem            = null;
  }

  /**
   * Resume the AudioContext. Call from any user-gesture handler.
   * Called on both touchstart and touchend so strict browsers (iOS Safari)
   * have two opportunities to accept the resume.
   * Fire-and-forget async — sounds in the same synchronous handler will be
   * silent on the very first unlock; all later ones play normally.
   */
  async unlock() {
    if (this._unlocked) return;
    await Tone.start();
    this._unlocked = true;
    this._buildSynths();
  }

  _buildSynths() {
    // Shared effects chain: distortion → reverb → output
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.20 }).toDestination();
    const dist   = new Tone.Distortion(0.28).connect(reverb);

    // ── FM synth — alien tones, magic, stings ──
    this.fm = new Tone.FMSynth({
      harmonicity:        3.01,
      modulationIndex:    14,
      oscillator:         { type: 'triangle' },
      envelope:           { attack: 0.01, decay: 0.4, sustain: 0.15, release: 1.4 },
      modulation:         { type: 'square' },
      modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0.2, release: 1.0 },
    }).connect(reverb);
    this.fm.volume.value = -7;

    // ── Metal synth — crunches, impacts ──
    this.metal = new Tone.MetalSynth({
      frequency:       200,
      envelope:        { attack: 0.001, decay: 0.12, release: 0.12 },
      harmonicity:     5.1,
      modulationIndex: 32,
      resonance:       3000,
      octaves:         1.5,
    }).connect(dist);
    this.metal.volume.value = -9;

    // ── Membrane synth — bops, taps ──
    this.mem = new Tone.MembraneSynth({
      pitchDecay:  0.045,
      octaves:     8,
      oscillator:  { type: 'sine' },
      envelope:    { attack: 0.001, decay: 0.18, sustain: 0.0, release: 0.22 },
    }).toDestination();
    this.mem.volume.value = -5;
  }

  /** Returns false if synths aren't ready yet — all methods check this. */
  _ready() {
    return this._unlocked && this.fm !== null;
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  /** Soft bop on any action button tap. */
  uiTap() {
    if (!this._ready()) return;
    this.mem.triggerAttackRelease('C3', '32n');
  }

  // ── Attack swipe gesture ─────────────────────────────────────────────────

  /** Metallic crack on a correct swipe direction. */
  swipeHit() {
    if (!this._ready()) return;
    this.metal.frequency.value = 340;
    this.metal.triggerAttackRelease('16n');
  }

  /** Dull thud on a wrong or timed-out swipe. */
  swipeMiss() {
    if (!this._ready()) return;
    this.mem.triggerAttackRelease('A1', '8n');
  }

  /**
   * Called when all arrows in a combo sequence are resolved.
   * @param {number} hits   correct swipes
   * @param {number} total  total arrows
   */
  comboComplete(hits, total) {
    if (!this._ready()) return;
    if (hits === total) {
      // Perfect combo — bright rising FM arpeggio
      const now = Tone.now() + 0.02;
      ['C4', 'E4', 'G4'].forEach((note, i) => {
        this.fm.triggerAttackRelease(note, '8n', now + i * 0.11);
      });
    } else if (hits > 0) {
      // Partial — single mid note
      this.fm.triggerAttackRelease('D3', '8n');
    }
    // 0 hits → already covered by individual swipeMiss() calls
  }

  // ── Magic charge gesture ──────────────────────────────────────────────────

  /**
   * Begin a sustained FM swell the moment the player touches down in
   * the magic state. The note holds until magicCast() releases it.
   */
  magicChargeStart() {
    if (!this._ready() || this._magicCharging) return;
    this._magicCharging = true;
    this.fm.modulationIndex.value = 4;
    this.fm.frequency.value       = 55;
    this.fm.triggerAttack('C2');
  }

  /**
   * Called every frame while charging. Ramps pitch and modulation depth
   * upward so the swell evolves as the ring fills.
   * @param {number} ratio  0..1
   */
  magicChargeUpdate(ratio) {
    if (!this._ready() || !this._magicCharging) return;
    this.fm.frequency.rampTo(55 + ratio * 165, 0.06);
    this.fm.modulationIndex.rampTo(4 + ratio * 22, 0.06);
  }

  /**
   * Release the held note and play a resolution sting.
   * @param {number} power  0..1  (1 = perfect, <1 = partial)
   */
  magicCast(power) {
    if (!this._ready()) return;
    this._magicCharging = false;
    this.fm.triggerRelease();

    const now  = Tone.now() + 0.06;
    const note = power >= 0.9 ? 'A4' : (power >= 0.5 ? 'E4' : 'C3');
    const dur  = power >= 0.9 ? '4n' : '8n';
    // Briefly punch up the modulation for the sting
    this.fm.modulationIndex.rampTo(8 + power * 18, 0.05);
    this.fm.triggerAttackRelease(note, dur, now);
  }

  /** Safety valve — silences any held FM note when leaving the magic state. */
  magicAbort() {
    if (!this._ready() || !this._magicCharging) return;
    this._magicCharging = false;
    this.fm.triggerRelease();
  }

  // ── Enemy attack phase ────────────────────────────────────────────────────

  /**
   * Single metallic pulse during the enemy wind-up animation.
   * Call at increasing frequency as progress → 1.
   * @param {number} progress  0..1
   */
  windUpPulse(progress) {
    if (!this._ready()) return;
    this.metal.frequency.value = 70 + progress * 180;
    this.metal.triggerAttackRelease('32n');
  }

  /** Snappy bop when the player successfully taps a block circle. */
  block() {
    if (!this._ready()) return;
    this.mem.triggerAttackRelease('D4', '32n');
  }

  /** Short FM ping when the enemy fires a bubble toward the player. */
  bubbleFire() {
    if (!this._ready()) return;
    this.fm.modulationIndex.value = 16;
    this.fm.triggerAttackRelease('B4', '32n');
  }

  /** Low crunch when an unblocked enemy hit lands on the player. */
  playerHit() {
    if (!this._ready()) return;
    this.metal.frequency.value = 85;
    this.metal.triggerAttackRelease('8n');
  }

  // ── Round progression ─────────────────────────────────────────────────────

  /**
   * Plays between rounds — a shorter, brighter sting than the final victory
   * fanfare. Uses a quick two-octave jump to signal "keep going!".
   */
  roundClear() {
    if (!this._ready()) return;
    this.fm.modulationIndex.value = 8;
    const now = Tone.now() + 0.05;
    ['G4', 'B4', 'D5'].forEach((note, i) => {
      this.fm.triggerAttackRelease(note, '16n', now + i * 0.09);
    });
    // Accent note
    this.mem.triggerAttackRelease('G3', '8n', now + 0.3);
  }

  // ── End screens ───────────────────────────────────────────────────────────

  /** Ascending FM arpeggio on final victory. */
  victory() {
    if (!this._ready()) return;
    this.fm.modulationIndex.value = 10;
    const now = Tone.now() + 0.05;
    ['C4', 'E4', 'G4', 'C5'].forEach((note, i) => {
      this.fm.triggerAttackRelease(note, '8n', now + i * 0.17);
    });
  }

  /** Descending FM glide on defeat. */
  defeat() {
    if (!this._ready()) return;
    this.fm.modulationIndex.value = 5;
    const now = Tone.now() + 0.05;
    ['G3', 'Eb3', 'C3', 'Ab2'].forEach((note, i) => {
      this.fm.triggerAttackRelease(note, '4n', now + i * 0.28);
    });
  }
}
