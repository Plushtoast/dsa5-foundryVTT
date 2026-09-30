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

  /**
   * Compact hover tooltip for the owning region, shown to GMs while moving tokens.
   * @param {{ isGM?: boolean }} [options]
   * @returns {{ name: string, typeLabel: string, icon: string, status: object|null, lines: object[], description?: string }}
   */
  getHoverTooltip({ isGM = game.user.isGM } = {}) {
    return this.buildHoverTooltip({ isGM });
  }

  /**
   * @param {{ isGM?: boolean }} [options]
   * @returns {{ name: string, typeLabel: string, icon: string, status: object|null, lines: object[], description?: string }}
   */
  buildHoverTooltip({ isGM = game.user.isGM } = {}) {
    const behavior = this.parent;
    const region = behavior?.parent;
    const type = behavior?.type ?? this.constructor.REGION_TYPE;
    return {
      name: region?.name || behavior?.name || '',
      typeLabel: isGM ? _loc(`TYPES.RegionBehavior.${type}`) : '',
      icon: CONFIG.RegionBehavior.typeIcons?.[type] || 'fas fa-map-location-dot',
      status: isGM ? this.hoverTooltipStatus() : null,
      lines: isGM ? this.hoverTooltipLines() : [],
    };
  }

  hoverTooltipStatus() {
    if (this.parent?.disabled) {
      return { key: 'disabled', label: _loc('DSAREGION.TOOLTIP.disabled') };
    }
    return { key: 'active', label: _loc('DSAREGION.TOOLTIP.active') };
  }

  hoverTooltipLines() {
    return [];
  }

  localizedChoice(fieldName, value) {
    const field = this.schema?.fields?.[fieldName] ?? this.schema?.getField?.(fieldName);
    const choices = field?.choices;
    const key = choices?.[value] ?? choices?.[String(value)];
    return key ? _loc(key) : String(value ?? '');
  }

  static tooltipLine(label, value) {
    if (value === undefined || value === null || value === '') return null;
    return { label, value: String(value) };
  }

  static signedValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value;
    if (number > 0) return `+${number}`;
    return String(number);
  }

  static plainText(html, limit = 160) {
    if (!html) return '';
    const text = (foundry.utils.stripHTML?.(String(html)) || String(html).replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }
}
