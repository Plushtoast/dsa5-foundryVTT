const FLAG_KEY = 'isKapTracker';
const HISTORY_FLAG = 'kapHistory';

export class RaptureTracker {
  static KAP_WINDOW = 86400;
  static KAP_PER_LEVEL = 10;
  static MAX_RAPTURE = 4;

  static findTracker(actor) {
    return actor.effects.find((e) => e.getFlag('dsa5', FLAG_KEY));
  }

  static accumulate(actor, kapSpent) {
    queueMicrotask(async () => {
      if (!actor.system.isPriest) return;

      const now = game.time.worldTime;
      const cutoff = now - this.KAP_WINDOW;

      let tracker = this.findTracker(actor);

      if (!tracker) {
        const history = [{ time: now, amount: kapSpent }];
        await actor.createEmbeddedDocuments('ActiveEffect', [
          {
            name: game.i18n.localize('RAPTURE.kapTracker'),
            description: game.i18n.localize('RAPTURE.kapTrackerDescription'),
            img: 'icons/svg/ice-aura.svg',
            start: { time: now },
            duration: { value: this.KAP_WINDOW, units: 'seconds' },
            flags: { dsa5: { [FLAG_KEY]: true, [HISTORY_FLAG]: history } },
          },
        ]);
        tracker = this.findTracker(actor);
      } else {
        const history = (tracker.getFlag('dsa5', HISTORY_FLAG) ?? [])
          .filter((e) => e.time > cutoff)
          .concat({ time: now, amount: kapSpent });

        const oldest = Math.min(...history.map((e) => e.time));
        const expiresIn = Math.max(1, oldest + this.KAP_WINDOW - now);

        await tracker.update({
          'start.time': now,
          'duration.value': expiresIn,
          'duration.units': 'seconds',
          [`flags.dsa5.${HISTORY_FLAG}`]: history,
        });
      }

      if (!tracker) return;

      const history = (tracker.getFlag('dsa5', HISTORY_FLAG) ?? []).filter((e) => e.time > cutoff);
      const windowTotal = history.reduce((sum, e) => sum + e.amount, 0);
      const targetLevel = Math.min(this.MAX_RAPTURE, Math.floor(windowTotal / this.KAP_PER_LEVEL));
      const currentRapture = actor.system.condition?.raptured ?? 0;

      if (targetLevel > currentRapture) {
        await actor.addCondition('raptured', targetLevel - currentRapture, false, true);
      }
    });
  }

  static async pruneTracker(actor, effect) {
    const now = game.time.worldTime;
    const cutoff = now - this.KAP_WINDOW;
    const history = (effect.getFlag('dsa5', HISTORY_FLAG) ?? []).filter((e) => e.time > cutoff);

    if (history.length === 0) {
      await actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
      return;
    }

    const oldest = Math.min(...history.map((e) => e.time));
    const expiresIn = Math.max(1, oldest + this.KAP_WINDOW - now);

    await effect.update({
      'start.time': now,
      'duration.value': expiresIn,
      'duration.units': 'seconds',
      [`flags.dsa5.${HISTORY_FLAG}`]: history,
    });
  }

  static isTracker(effect) {
    return effect.getFlag('dsa5', FLAG_KEY) === true;
  }
}
