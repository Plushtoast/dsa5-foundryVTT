import DSAActiveEffectDataModel from '../activeeffect/dsaeffect.js';

export class DSARegionBehaviorBase extends foundry.data.regionBehaviors.RegionBehaviorType {

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
