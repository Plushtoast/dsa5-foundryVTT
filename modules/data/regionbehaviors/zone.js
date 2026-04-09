import { DSARegionBehaviorBase } from './base.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export class DSAZoneRegionBehavior extends DSARegionBehaviorBase {
  static REGION_TYPE = 'DSAZone';
  static LOCALIZATION_PREFIXES = ['REGIONBEHAVIOR_DSAZone'];

  static MODE_WHILE_IN_ZONE = 0;
  static MODE_ONCE = 1;
  static MODE_RECURRING = 2;

  static defineSchema() {
    return {
      messageId: new StringField({ required: true }),
      mode: new NumberField({
        initial: 2,
        choices: {
          [DSAZoneRegionBehavior.MODE_WHILE_IN_ZONE]: 'REGIONBEHAVIOR_DSAZone.MODES.whileInZone',
          [DSAZoneRegionBehavior.MODE_ONCE]: 'REGIONBEHAVIOR_DSAZone.MODES.once',
          [DSAZoneRegionBehavior.MODE_RECURRING]: 'REGIONBEHAVIOR_DSAZone.MODES.recurring',
        },
      }),
      removeOnExit: new BooleanField({ initial: false }),
      events: foundry.data.regionBehaviors.RegionBehaviorType._createEventsField({
        events: [
          CONST.REGION_EVENTS.TOKEN_ENTER,
          CONST.REGION_EVENTS.TOKEN_EXIT,
          CONST.REGION_EVENTS.TOKEN_ROUND_START,
        ],
        initial: [
          CONST.REGION_EVENTS.TOKEN_ENTER,
          CONST.REGION_EVENTS.TOKEN_EXIT,
          CONST.REGION_EVENTS.TOKEN_ROUND_START,
        ],
      }),
    };
  }

  #hasExistingEffect(token) {
    return token.actor?.effects.some((e) => e.origin === this.parent.uuid);
  }

  async _handleRegionEvent(event) {
    const { token } = event.data;
    if (!token?.actor) return;

    switch (event.name) {
      case CONST.REGION_EVENTS.TOKEN_ENTER:
        await this.#onEnter(event);
        break;
      case CONST.REGION_EVENTS.TOKEN_EXIT:
        await this.#onExit(event);
        break;
      case CONST.REGION_EVENTS.TOKEN_ROUND_START:
        if (this.mode === DSAZoneRegionBehavior.MODE_RECURRING && DSA5_Utility.isActiveGM()) {
          await this.#applyZoneEffect(token);
        }
        break;
    }
  }

  async #onEnter(event) {
    const { token, movement } = event.data;

    if (this.mode === DSAZoneRegionBehavior.MODE_WHILE_IN_ZONE) {
      if (!event.user.isSelf) return;
      if (this.#hasExistingEffect(token)) return;

      const resumeMovement = movement ? token.pauseMovement() : undefined;
      await this.#applyZoneEffect(token);
      await resumeMovement?.();
    } else {
      if (!DSA5_Utility.isActiveGM()) return;
      if (this.mode === DSAZoneRegionBehavior.MODE_ONCE && this.#hasExistingEffect(token)) return;

      await this.#applyZoneEffect(token);
    }
  }

  async #onExit(event) {
    const { token, movement } = event.data;
    const shouldRemove = this.mode === DSAZoneRegionBehavior.MODE_WHILE_IN_ZONE || this.removeOnExit;
    if (!shouldRemove) return;

    if (!event.user.isSelf) return;

    const resumeMovement = movement ? token.pauseMovement() : undefined;
    await this.removeEffects(token);
    await resumeMovement?.();
  }

  async #applyZoneEffect(token) {
    const messageId = this.messageId;
    if (!messageId) return;

    const message = game.messages.get(messageId);
    if (!message) return;

    await DSAActiveEffectConfig.applyEffect(
      messageId,
      'target',
      [{ token: token.id, actor: token.actor.id, scene: canvas.scene.id }],
      { origin: this.parent.uuid },
    );
  }
}
