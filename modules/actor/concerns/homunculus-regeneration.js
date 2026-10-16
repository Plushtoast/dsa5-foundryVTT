import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

export class HomunculusRegeneration {
  static BLOOD_COST = 6;

  static isHomunculus(actor) {
    if (!actor?.items) return false;
    const traitName = _loc('COMPANIONS.HomunculusCreation');
    return actor.items.some((item) => item.type === 'trait' && item.name === traitName);
  }

  static hasBlutkonserve(actor) {
    return SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.bloodReserve');
  }

  static async listOwnerHomunculi(owner) {
    const companions = Object.values(owner?.system?.companions || {});
    const result = [];

    for (const entry of companions) {
      if (!entry?.uuid) continue;
      const actor = await fromUuid(entry.uuid);
      if (!actor || this.isHomunculus(actor) === false) continue;
      result.push({
        uuid: actor.uuid,
        id: actor.id,
        name: actor.name,
        hasBlutkonserve: this.hasBlutkonserve(actor),
        bathTooltip: _loc('TT.bloodBath', { name: actor.name, cost: this.BLOOD_COST }),
        reserveTooltip: _loc('TT.bloodReserve', { name: actor.name }),
      });
    }

    return result;
  }

  static selectedBaths(testData) {
    return Array.isArray(testData?.homunculusBloodBath) ? testData.homunculusBloodBath : [];
  }

  static collectChoices(html) {
    const baths = [];
    html.find('[data-homunculus-blood-bath]').each((_, el) => {
      if (!el.checked) return;
      const { uuid, companionId, name } = el.dataset;
      const reserve = html.find(`[data-homunculus-blood-reserve][data-companion-id="${companionId}"]`);
      baths.push({
        uuid,
        id: companionId,
        name,
        usedBloodReserve: !!reserve.prop('checked') && !reserve.prop('disabled'),
      });
    });
    return { homunculusBloodBath: baths };
  }

  static bindDialog(root) {
    const element = root?.jquery ? root[0] : root;
    if (!element) return;

    const sync = (bathInput) => {
      const id = bathInput.dataset.companionId;
      const reserve = element.querySelector(`[data-homunculus-blood-reserve][data-companion-id="${id}"]`);
      if (!reserve) return;
      reserve.disabled = !bathInput.checked;
      if (!bathInput.checked) reserve.checked = false;
    };

    element.querySelectorAll('[data-homunculus-blood-bath]').forEach((input) => {
      sync(input);
      input.addEventListener('change', () => sync(input));
    });
  }

  static unpaidCost(baths = []) {
    return baths.filter((bath) => !bath.usedBloodReserve).length * this.BLOOD_COST;
  }

  static async resolveBaths(baths = []) {
    const resolved = [];
    for (const bath of baths) {
      const actor = bath?.uuid ? await fromUuid(bath.uuid) : null;
      resolved.push({ bath, actor });
    }
    return resolved;
  }
}
