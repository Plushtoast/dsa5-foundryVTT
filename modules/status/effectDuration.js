export default class EffectDuration {
  static MAX_COMBAT_ROUND_CONVERSION = 60;

  static prepareRollString(rollBase) {
    return `${rollBase}`.replaceAll(/[wW]/g, 'd');
  }

  static roundTime() {
    return CONFIG.time.roundTime || 5;
  }

  static async finalizeEffect(effect) {
    if (effect.duration?.value) {
      effect.duration.value = (await new Roll(this.prepareRollString(`${effect.duration.value}`)).evaluate()).total;
    } else if (effect.duration?.seconds) {
      effect.duration.value = (await new Roll(this.prepareRollString(`${effect.duration.seconds}`)).evaluate()).total;
      effect.duration.units = 'seconds';
      delete effect.duration.seconds;
    } else if (effect.duration?.rounds) {
      effect.duration.value = (await new Roll(this.prepareRollString(`${effect.duration.rounds}`)).evaluate()).total;
      effect.duration.units = 'rounds';
      delete effect.duration.rounds;
    } else if (effect.duration?.turns) {
      effect.duration.value = (await new Roll(this.prepareRollString(`${effect.duration.turns}`)).evaluate()).total;
      effect.duration.units = 'turns';
      delete effect.duration.turns;
    }

    if (!effect.img) effect.img = 'icons/svg/aura.svg';
  }

  static durationInSeconds(duration = {}) {
    const seconds = Number(duration.seconds);
    if (Number.isFinite(seconds) && seconds > 0) return { seconds };

    const rounds = Number(duration.rounds);
    if (Number.isFinite(rounds) && rounds > 0) return { seconds: rounds * this.roundTime() };

    const value = Number(duration.value);
    if (!Number.isFinite(value) || value <= 0) return {};
    if (duration.units !== 'seconds') return {};
    return { seconds: value };
  }

  static #secondsFromDuration(duration = {}) {
    const fromPublic = this.durationInSeconds(duration).seconds;
    if (fromPublic > 0) return fromPublic;

    const value = Number(duration.value);
    if (!Number.isFinite(value) || value <= 0) return 0;

    switch (duration.units) {
      case 'minutes': return value * 60;
      case 'hours': return value * 3600;
      case 'days': return value * 3600 * 24;
      default: return 0;
    }
  }

  /**
   * Convert a short wall-clock duration to combat rounds for live actor effects.
   * Returns null when no conversion should happen (already rounds/turns, empty, or longer than 30 KR).
   * @param {object} [duration]
   * @param {object} [options]
   * @param {number} [options.remainingSeconds]
   * @returns {{ value: number, units: 'rounds' } | null}
   */
  static toCombatRounds(duration = {}, { remainingSeconds } = {}) {
    if (!duration || duration.units === 'rounds' || duration.units === 'turns') return null;

    const seconds = Number.isFinite(remainingSeconds) && remainingSeconds > 0
      ? remainingSeconds
      : this.#secondsFromDuration(duration);
    if (!(seconds > 0)) return null;

    const roundTime = this.roundTime();
    if (seconds > this.MAX_COMBAT_ROUND_CONVERSION * roundTime) return null;

    return {
      value: Math.max(1, Math.round(seconds / roundTime)),
      units: 'rounds',
    };
  }
}
