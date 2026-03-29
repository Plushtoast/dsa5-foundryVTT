import { DSARegionBehaviorBase } from './base.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import DSAActiveEffectDataModel from '../activeeffect/dsaeffect.js';

const { BooleanField, StringField, NumberField } = foundry.data.fields;

export class DSAAuraRegionBehavior extends DSARegionBehaviorBase {
  static REGION_TYPE = 'DSAAura';
  static LOCALIZATION_PREFIXES = ['REGIONBEHAVIOR_DSAAura'];

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: this.#onTokenEnter,
    [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#onTokenExit,
  };

  static defineSchema() {
    return {
      effectUuid: new StringField({ required: true }),
      disposition: new NumberField({ initial: DSAActiveEffectDataModel.DISPOSITION_ALL, choices: DSAActiveEffectDataModel.DISPOSITION_CHOICES }),
      ignoreWalls: new BooleanField({ initial: false }),
    };
  }

  static async #onTokenEnter(event) {
    if (!event.user.isSelf) return;
    const { token, movement } = event.data;
    if (!token.actor) return;
    if (!this.validDisposition(token, this.disposition)) return;

    if (token.actor.effects.some(e => e.origin === this.parent.uuid)) return;

    const effect = await fromUuid(this.effectUuid);
    if (!effect) return;

    const data = effect.toObject();
    delete data._id;
    delete data.system?.aura?.isAura;
    data.name = `${effect.name} (Aura)`;

    // Ensure duration.value is a valid integer or null for v14 schema
    if (data.duration) {
      const v = data.duration.value;
      data.duration.value = (v != null && Number.isFinite(Number(v))) ? Math.round(Number(v)) : null;
    }

    const sourceActor = effect.parent;
    const testData = { qualityStep: 0 };

    const resumeMovement = movement ? token.pauseMovement() : undefined;
    await DSAActiveEffectConfig.applyAdvancedFunction(
      token.actor, [data], { name: effect.name }, testData, sourceActor,
      { origin: this.parent.uuid }
    );
    await resumeMovement?.();
  }

  static async #onTokenExit(event) {
    if (!event.user.isSelf) return;
    const { token, movement } = event.data;
    const resumeMovement = movement ? token.pauseMovement() : undefined;
    await this.removeEffects(token);
    await resumeMovement?.();
  }
}
