import DSA5 from '../../config/config-dsa5.js';
import ItemRulesDSA5 from './item-rules-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

export default class TraitRulesDSA5 extends ItemRulesDSA5 {
  static async traitAdded(actor, item) {
    if (DSA5.addTraitRules[item.name]) await DSA5.addTraitRules[item.name](actor, item);
  }

  static hasTrait(actor, talent, localize = true) {
    if(localize) talent = _loc(talent);
    return super.hasItem(actor, talent, ['trait']);
  }
}

Hooks.on('setup', () => {
  const familiar = _loc('LocalizedIDs.familiar');
  DSA5.addTraitRules[familiar] = async (actor, item) => {
    if (item.effects.length == 0) {
      item.effects = [
        {
          changes: [
            { key: 'system.status.wounds.gearmodifier', type: 'add', value: 10 },
            { key: 'system.status.soulpower.gearmodifier', type: 'add', value: 1 },
            { key: 'system.status.toughness.gearmodifier', type: 'add', value: 1 },
            {
              key: 'system.status.astralenergy.gearmodifier',
              type: 'add',
              value: 15,
            },
            {
              key: 'system.characteristics.mu.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.kl.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.in.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.ch.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.ff.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.ge.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.ko.gearmodifier',
              type: 'add',
              value: 1,
            },
            {
              key: 'system.characteristics.kk.gearmodifier',
              type: 'add',
              value: 1,
            },
            { key: 'system.totalArmor', type: 'add', value: 1 },
          ],
          duration: {},
          icon: 'icons/svg/aura.svg',
          name: familiar,
          transfer: true,
          flags: {
            dsa5: {
              description: familiar,
              hideOnToken: true,
              hidePlayers: false,
            },
          },
        },
      ];
    }
    const witchSenseName = _loc('LocalizedIDs.witchSense');
    if (!ItemRulesDSA5.hasItem(actor, witchSenseName, ['trait'])) {
      const witchSense = await DSA5_Utility.findAnyItem([{ name: witchSenseName, type: 'trait' }]);
      await actor.createEmbeddedDocuments('Item', witchSense);
    }
  };
});
