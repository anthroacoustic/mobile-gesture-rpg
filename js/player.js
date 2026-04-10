class Player {
  constructor(name, hp, mp, atk, def, mag) {
    this.name   = name;
    this.maxHp  = hp;
    this.hp     = hp;
    this.maxMp  = mp;
    this.mp     = mp;
    this.atk    = atk;
    this.def    = def;
    this.mag    = mag;
    this.isDefending = false;
  }

  /**
   * Apply raw incoming damage, reduced by DEF and halved if defending.
   * Returns actual damage dealt.
   */
  takeDamage(rawDamage) {
    const defReduction = this.def * 0.3;
    const multiplier   = this.isDefending ? 0.5 : 1.0;
    const actual = Math.max(0, Math.round((rawDamage - defReduction) * multiplier));
    this.hp = Math.max(0, this.hp - actual);
    return actual;
  }

  /** Returns false if not enough MP. */
  useMP(amount) {
    if (this.mp < amount) return false;
    this.mp -= amount;
    return true;
  }

  restoreMP(amount) {
    this.mp = Math.min(this.maxMp, this.mp + amount);
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  setDefending(val) {
    this.isDefending = val;
  }

  isAlive()   { return this.hp > 0; }
  hpPercent() { return this.hp / this.maxHp; }
  mpPercent() { return this.mp / this.maxMp; }
}
