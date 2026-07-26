import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import ZoneAttackConsequences from './zone-attack-consequences.js';

export default class ZoneAttack {
  static #registered = false;

  static registerHooks() {
    if (this.#registered) return;
    this.#registered = true;
    DSA5.asyncHooks.postProcessOpposedResult.push(ZoneAttackConsequences.postProcessOpposedResult.bind(ZoneAttackConsequences));
  }

  static async resolve({
    sourceItem,
    sourceActor,
    region,
    behavior,
    targetToken,
    tableResult,
    attackName,
    attackValue,
    damageFormula,
    attackType = 'meleeAttack',
    defenseMalus = 0,
    traits = [],
    regionEvent,
    messageMode,
    consequence,
  } = {}) {
    const token = this.#tokenObject(targetToken);
    if (!token?.actor) return null;

    const actor = sourceActor || DSA5_Utility.getSpeaker({ actor: sourceItem?.parent?.id }) || token.actor;
    if (!actor) return null;

    const previousTargets = this.#setOnlyTarget(token);

    try {
      const weapon = this.#buildAttackItem({ attackName, attackValue, damageFormula, attackType, traits, sourceItem });
      const sourceTokenId = actor.getActiveTokens?.()[0]?.id;
      const setupData = await game.dsa5.entities.Itemdsa5.getSubClass(weapon.type).setupDialog(
        null,
        { mode: 'attack', bypass: true, messageMode },
        weapon,
        actor,
        sourceTokenId,
      );
      if (!setupData) return null;

      setupData.testData.situationalModifiers = [];
      if (defenseMalus) {
        setupData.testData.situationalModifiers.push({
          name: _loc('MODS.defenseMalus'),
          value: defenseMalus,
          type: 'defenseMalus',
          selected: true,
        });
      }
      setupData.testData.zoneAttack = {
        sourceItemUuid: sourceItem?.uuid ?? null,
        regionUuid: region?.uuid ?? regionEvent?.regionUuid ?? null,
        behaviorUuid: behavior?.uuid ?? regionEvent?.behaviorUuid ?? null,
        targetTokenUuid: token.document.uuid,
        tableResult,
        consequence,
        regionEvent,
      };

      const result = await actor.basicTest(setupData);
      const message = game.messages.get(result?.result?.messageId);
      if (message) await message.update({ 'flags.dsa5.zoneAttack': setupData.testData.zoneAttack });

      return result;
    } finally {
      this.#restoreTargets(previousTargets);
    }
  }

  static async damageOnly({ targetToken, damageFormula, message } = {}) {
    const token = this.#tokenObject(targetToken);
    if (!token?.actor || !damageFormula) return null;

    await token.actor.applyDamage(damageFormula, message ? { msg: message } : {});
  }

  static #buildAttackItem({ attackName, attackValue, damageFormula, attackType, traits, sourceItem }) {
    const isMelee = attackType !== 'rangeAttack';
    return new game.dsa5.entities.Itemdsa5({
      name: attackName,
      type: 'trait',
      img: sourceItem?.img || 'icons/svg/aura.svg',
      system: {
        traitType: { value: isMelee ? 'meleeAttack' : 'rangeAttack' },
        at: { value: attackValue },
        pa: 0,
        damage: { value: damageFormula },
        reach: { value: 'short' },
        effect: { value: '', attributes: traits.join(',') },
      },
      effects: [],
      flags: {
        dsa5: {
          zoneAttackSource: sourceItem?.uuid ?? null,
        },
      },
    });
  }

  static #tokenObject(token) {
    if (!token) return null;
    if (token.documentName === 'Token') return token.object;
    if (token.object?.documentName === 'Token') return token.object;
    if (token.actor && token.document) return token;
    return canvas.tokens.get(token.id);
  }

  static #setOnlyTarget(token) {
    const previousTargets = Array.from(game.user.targets).map((target) => target.id);
    game.user._onUpdateTokenTargets([token.id]);
    return previousTargets;
  }

  static #restoreTargets(previousTargets) {
    game.user._onUpdateTokenTargets(previousTargets.filter((id) => canvas.tokens.get(id)));
  }
}