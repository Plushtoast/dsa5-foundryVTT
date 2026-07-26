import DSAActiveEffectDataModel from '../activeeffect/dsaeffect.js';

export class DSARegionBehaviorBase extends foundry.data.regionBehaviors.RegionBehaviorType {

  /**
   * Build a socket-safe region event payload for advanced effect macros.
   *
   * `trigger` normalizes movement-driven enter/exit events to move-in/move-out so
   * macros can distinguish animated movement from activation or boundary changes.
   *
   * @param {foundry.documents.types.RegionEvent} event
   * @returns {object}
   */
  buildMacroRegionEvent(event) {
    const token = event.data?.token;
    const rawName = event.name ?? null;
    const movement = event.data?.movement;
    const hasMovement = !!movement;

    let trigger = rawName;
    if (hasMovement && rawName === CONST.REGION_EVENTS.TOKEN_ENTER) trigger = CONST.REGION_EVENTS.TOKEN_MOVE_IN;
    else if (hasMovement && rawName === CONST.REGION_EVENTS.TOKEN_EXIT) trigger = CONST.REGION_EVENTS.TOKEN_MOVE_OUT;

    return {
      source: 'region',
      name: rawName,
      trigger,
      hasMovement,
      userId: event.user?.id ?? null,
      regionDeleted: event.data?.regionDeleted ?? false,
      regionUuid: event.region?.uuid ?? this.parent?.parent?.uuid ?? null,
      behaviorUuid: this.parent?.uuid ?? null,
      tokenUuid: token?.uuid ?? null,
      actorUuid: token?.actor?.uuid ?? null,
      combatId: event.data?.combat?.id ?? game.combat?.id ?? null,
      round: event.data?.round ?? game.combat?.round ?? null,
      turn: event.data?.turn ?? game.combat?.turn ?? null,
      movementId: movement?.id ?? movement?._id ?? null,
    };
  }

  /**
   * Remove active effects applied by this behavior from a token.
   * @param {TokenDocument} token
   */
  async removeEffects(token) {
    if (!token.actor) return;
    const toDelete = token.actor.effects
      .filter(e => e.origin === this.parent.uuid)
      .map(e => e.id);
    if (toDelete.length) {
      await token.actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
    }
  }

  /**
   * Check token disposition against a target disposition.
   * @param {TokenDocument} token
   * @param {number} disposition - 0=hostile, 1=friendly, DISPOSITION_ALL=all
   * @returns {boolean}
   */
  validDisposition(token, disposition) {
    return disposition == DSAActiveEffectDataModel.DISPOSITION_ALL || disposition == token.disposition;
  }

  /**
   * Play an associated sound effect.
   * @param {string} sound - File path
   */
  async playSound(sound) {
    sound ??= this.sound;
    if (!sound) return;
    foundry.audio.AudioHelper.play({ src: sound, loop: false }, true);
  }
}
