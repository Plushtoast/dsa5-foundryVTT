export default class EffectDuration {
  static prepareRollString(rollBase) {
    return `${rollBase}`.replaceAll(/[wW]/g, 'd');
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
    if (Number.isFinite(rounds) && rounds > 0) return { seconds: rounds * (CONFIG.time.roundTime || 5) };

    const value = Number(duration.value);
    if (duration.units == 'seconds' && Number.isFinite(value) && value > 0) return { seconds: value };

    return {};
  }
}
