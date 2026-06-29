import DSA5_Utility from '../helpers/utility-dsa5.js';

export default class ZoneAttackConsequences {
  static async postProcessOpposedResult(attacker, defender, opposedResult) {
    const zoneAttack = attacker?.testResult?.zoneAttack || foundry.utils.getProperty(game.messages.get(attacker?.messageId), 'flags.dsa5.zoneAttack');
    if (!zoneAttack?.consequence) return;
    if (opposedResult.winner !== 'attacker') return;
    if (defender?.messageId) return;

    switch (zoneAttack.consequence) {
      case 'pandaemoniumTentacleFixated':
        await this.#applyPandaemoniumTentacle(defender, zoneAttack);
        break;
    }
  }

  static async #applyPandaemoniumTentacle(defender, zoneAttack) {
    const targetActor = DSA5_Utility.getSpeaker(defender?.speaker) || defender?.testResult?.actor;
    if (!targetActor) return;

    await targetActor.addTimedCondition('fixated', 1, false, false, {
      duration: { value: 2, units: 'rounds' },
      origin: zoneAttack.behaviorUuid || zoneAttack.regionUuid,
    });
  }
}