export default class MagicAnalysisDefaults {
  static magiekundeSkill() {
    return _loc('LocalizedIDs.magicalLore');
  }

  static async generate(item) {
    const enchantments = item?.getFlag?.('dsa5', 'enchantments') || [];
    const primary = enchantments[0];
    const fw = primary?.fw ?? 0;

    return {
      qs1: this._qs1(fw) || this._genericQs(1),
      qs2: this._qs2(fw) || this._genericQs(2),
      qs3: this._qs3(primary, enchantments) || this._genericQs(3),
      qs4: (await this._qs4(primary)) || this._genericQs(4),
      qs5: (await this._qs5(enchantments)) || this._genericQs(5),
      qs6: this._genericQs(6),
      crit: this._genericCrit(),
      botch: this._genericBotch(),
      fail: this._genericFail(),
      skill: this.magiekundeSkill(),
      modifier: 0,
    };
  }

  static _genericQs(level) {
    return `<p>${_loc(`MAGICANALYSIS.defaultQsGeneric.${level}`)}</p>`;
  }

  static _genericCrit() {
    return `<p>${_loc('MAGICANALYSIS.defaultCrit')}</p>`;
  }

  static _genericBotch() {
    return `<p>${_loc('MAGICANALYSIS.defaultBotch')}</p>`;
  }

  static _genericFail() {
    return `<p>${_loc('MAGICANALYSIS.defaultFail')}</p>`;
  }

  static _qs1(fw) {
    if (!fw) return '';
    const key = fw >= 10 ? 'moreThan10' : 'lessThan10';
    return `<p>${_loc(`MAGICANALYSIS.defaultQs1.${key}`, { fw })}</p>`;
  }

  static _qs2(fw) {
    if (!fw) return '';
    const min = Math.max(0, fw - 3);
    const max = fw + 3;
    return `<p>${_loc('MAGICANALYSIS.defaultQs2', { min, max, fw })}</p>`;
  }

  static _qs3(primary, enchantments) {
    if (!primary) return '';
    if (primary.talisman) return `<p>${_loc('MAGICANALYSIS.defaultQs3.talisman')}</p>`;
    if (primary.permanent) return `<p>${_loc('MAGICANALYSIS.defaultQs3.permanent')}</p>`;
    if (enchantments.length > 1 || !primary.charged) {
      return `<p>${_loc('MAGICANALYSIS.defaultQs3.storage')}</p>`;
    }
    return `<p>${_loc('MAGICANALYSIS.defaultQs3.selfCharging')}</p>`;
  }

  static async _qs4(primary) {
    if (!primary?.actorId) return '';
    const actor = game.actors.get(primary.actorId);
    if (!actor) return '';
    const tradition = actor.system?.details?.tradition?.value || actor.system?.tradition?.value;
    if (!tradition) return `<p>${_loc('MAGICANALYSIS.defaultQs4.unknown')}</p>`;
    return `<p>${_loc('MAGICANALYSIS.defaultQs4.tradition', { tradition })}</p>`;
  }

  static async _qs5(enchantments) {
    const parts = [];
    for (const ench of enchantments) {
      const spell = await this.getEnchantmentDocument(ench);
      if (spell) {
        parts.push(`<p><b>${spell.name}</b></p>${spell.system?.description?.value || ''}`);
      } else if (ench.name) {
        parts.push(`<p><b>${ench.name}</b></p>`);
      }
    }
    return parts.join('');
  }

  static async getEnchantmentDocument(enchantment) {
    const pack = game.packs.get(enchantment.pack);
    if (!pack) return null;

    let doc = await pack.getDocument(enchantment.itemId);
    if (!doc) {
      const idx = pack.index.getName(enchantment.name);
      if (idx) doc = await pack.getDocument(idx._id);
    }
    return doc;
  }
}
