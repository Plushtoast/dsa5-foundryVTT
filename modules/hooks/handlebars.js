import DSA5 from '../config/config-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const { getProperty } = foundry.utils;

function clickableAbilities(a, b) {
  return a
    .split(/\n/g)
    .map((sec) => {
      const data = sec.split(':');
      const isSubsection = data.length > 1;

      return data
        .map((elems, index) => {
          if (index == 0 && isSubsection) return `<b>${elems}</b>`;

          return (
            `<span class="searchableAbility" data-category="${b}">` +
            elems
              .split(',')
              .map((x) => `<a data-action="searchableAbility">${x}</a>`)
              .join(', ') +
            '<span>'
          );
        })
        .join(':');
    })
    .join('<br/>');
}

function clickableActorItems(actor, list, rankPath, maxPath) {
  if (maxPath) {
    return list
      .map((item) => {
        return `<span class="actorEmbeddedAbility" data-actor="${actor.uuid}" data-id="${item._id}"><a>${item.name}${roman(getProperty(item.system, rankPath), getProperty(item.system, maxPath))}</a></span>`;
      })
      .join(', ');
  } else if (rankPath) {
    const res = [];
    for (const item of list) {
      const level = getProperty(item.system, rankPath);
      if (level) {
        res.push(`<span class="actorEmbeddedAbility" data-actor="${actor.uuid}" data-id="${item._id}"><a>${item.name} ${level}</a></span>`);
        continue;
      }
    }
    return res.join(', ');
  } else {
    return list
      .map((item) => {
        return `<span class="actorEmbeddedAbility" data-actor="${actor.uuid}" data-id="${item._id}"><a>${item.name}</a></span>`;
      })
      .join(', ');
  }
}

function clickableSection(actor, section, rankPath, maxPath) {
  const res = [];
  for (const list of Object.values(section)) {
    if (list.length == 0) continue;

    const items = clickableActorItems(actor, list, rankPath, maxPath);
    if (items) res.push(items);
  }
  return res.join(', ');
}

function roman(a, max) {
  if (max != undefined && Number(max) < 2) return '';

  const roman = [' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  return roman[a - 1];
}

export default function () {
  Handlebars.registerHelper({
    concatUp: (a, b) => a + b.toUpperCase(),
    mod: (a, b) => a % b,
    roman: (a, max) => roman(a, max),
    isWEBM: (a) => /.webm$/.test(a),
    itemCategory: (a) => {
      return DSA5_Utility.categoryLocalization(a);
    },
    joinStr: (a, b) => b.join(a),
    itemPrice: (a) => DSA5_Utility.itemPrice(a),
    specAbSubCat: (a) => {
      return _loc(`COMBATSKILLCATEGORY.${a}`);
    },
    attrName: (a) => DSA5_Utility.attributeLocalization(a),
    attrAbbr: (a) => DSA5_Utility.attributeAbbrLocalization(a),
    diceThingsUp: (a, b) => DSA5_Utility.replaceDies(a, false),
    clickableAbilities: (a, b) => clickableAbilities(a, b),
    traitName: (a) => _loc(DSA5.traitCategories[a]),
    consumableQL: (a) => a.system.QLList.split('\n')[Number(a.system.QL) - 1],
    clickableActorItems: (a, b, c, d) => clickableActorItems(a, b, c, d),
    clickableSection: (a, b, c, d) => clickableSection(a, b, c, d),
    flatMods: (item) => {
      const flatMods = [];
      for (const key in item) {
        if (key.endsWith('-flat')) {
          const value = item[key];
          if (value && value.length > 0) {
            flatMods.push(`data-${key}="${value.join(',')}"`);
          }
        }
      }
      return flatMods.join(' ');
    },
    hasLocalization: (a, b) => {
      const val = a.string || a;
      return game.i18n.has(val) ? _loc(val) : b || '';
    },
    successEffect: (a, parent) => {
      const sucEf = a.system?.successEffect;
      if (sucEf == 1) return ` (${_loc('ActiveEffects.onSuccess')})`;
      if (sucEf == 2) return ` (${_loc('ActiveEffects.onFailure')})`;

      const advantageEffect = a.system.equipmentAdvantage;
      if (advantageEffect) return ` (${_loc(`AdvantageRuleItems.${parent?.type}.${advantageEffect}`)})`;

      return '';
    },
    replaceConditions: DSA5_Utility.replaceConditions,
    floor: (a) => Math.floor(Number(a)),
    sum: (a, b) => {
      return a + b;
    },
    br: (a) => a.replace(/\n/g, '<br/>'),
    getAttr: (a, b, c) => {
      return a.system.characteristics[b][c];
    },
    hasElem: (a, b) => a.some((x) => b == x),
    grouped_each: (every, context, options) => {
      let out = '',
        subcontext = [],
        i;
      if (context && context.length > 0) {
        for (i = 0; i < context.length; i++) {
          if (i > 0 && i % every === 0) {
            out += options.fn(subcontext);
            subcontext = [];
          }
          subcontext.push(context[i]);
        }
        out += options.fn(subcontext);
      }
      return out;
    },
    plantify: (a) => {
      return _loc(`PLANT.avLevels.${a || 0}`);
    },
    oddLength: (x) => {
      return x.length % 2 == 1;
    },
    selfObj: (a) => {
      return a.reduce((acc, val) => {
        acc[val] = val;
        return acc;
      }, {});
    },
  });
}
