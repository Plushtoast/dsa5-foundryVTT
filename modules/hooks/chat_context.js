import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { localize } from '../system/helpers/localizer.js';
import PostRollBuffs from '../system/rolls/postroll-buffs.js';
import { PostRollBuffPicker } from '../dialog/postroll-buff-picker.js';
const { getProperty } = foundry.utils;

const SPELL_TYPES = ['liturgy', 'ceremony', 'spell', 'ritual', 'magicalsign'];
const ROLLABLE_TYPES = ['skill', 'spell', 'liturgy', 'ritual', 'ceremony'];
const STAT_TYPES = ['LeP', 'KaP', 'AsP'];
const MANA_TYPES = ['ritual', 'spell'];

const getMessageFromLi = (li) => game.messages.get(li.dataset.messageId);

const getActorFromMessage = (message) => {
  return message.speaker?.actor ? game.actors.get(message.speaker.actor) : null;
};

const getActorFromRollMessage = (message) => {
  return DSA5_Utility.getSpeaker(message.speaker) || getActorFromMessage(message);
};

const hasOwnership = (actor) => actor?.isOwner || game.user.isGM;

const updateMessageWithCheckmark = async (message, flagPath, contentPattern, replacement) => {
  const update = {
    [`flags.data.${flagPath}`]: true,
    content: message.content.replace(contentPattern, replacement),
  };

  if (game.user.isGM) {
    await message.update(update);
  } else {
    game.socket.emit('system.dsa5', {
      type: 'updateMsg',
      payload: {
        id: message.id,
        updateData: update,
      },
    });
  }
};

export const applyDamage = async (li, mode, factor = 1) => {
  const message = getMessageFromLi(li);
  const cardData = message.flags.opposeData;
  const defenderSpeaker = cardData?.speakerDefend;
  const actor = DSA5_Utility.getSpeaker(defenderSpeaker);

  if (!actor?.isOwner) {
    return ui.notifications.error('DSAError.DamagePermission', { localize: true });
  }

  await actor.applyDamage(cardData.damage[mode] * factor);

  await updateMessageWithCheckmark(
    message,
    'damageApplied',
    /hideAnchor">/,
    `hideAnchor"><i class="fas fa-check" style="float:right" data-tooltip="${localize('damageApplied')}"></i>`
  );
};

class ConditionChecker {
  static fateAvailable(actor, group) {
    return DSA5_Utility.fateAvailable(actor, group);
  }

  static canHurt(li, prop = 'damage.value') {
    const message = getMessageFromLi(li);
    const cardData = message.flags.opposeData;
    const isOwner = cardData ? DSA5_Utility.getSpeaker(cardData.speakerDefend)?.isOwner : false;

    const hasPermission = (game.user.isGM || isOwner) && li.querySelector('.opposed-card') !== null;
    const hasRoll = li.querySelector('.dice-roll') !== null;
    const hasDamage = (getProperty(cardData, prop) || 0) > 0;

    return (hasPermission || hasRoll) && hasDamage;
  }

  static canHurtSP(li) {
    return ConditionChecker.canHurt(li, 'damage.sp');
  }

  static canCostMana(li) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const sourceType = message.flags.data.preData.source.type;
    const costsMana = getProperty(message.flags.data.preData, 'calculatedSpellModifiers.costsMana');

    return SPELL_TYPES.includes(sourceType) || costsMana;
  }

  static canToggleDataVisibility(li, shouldBeHidden) {
    if (!(game.user.isGM && game.settings.get('dsa5', 'hideOpposedDamageSelect'))) {
      return false;
    }

    const message = getMessageFromLi(li);
    const isHidden = !!message.flags?.hideData?.value;

    return shouldBeHidden ? !isHidden : isHidden;
  }

  static canImproveRoll(li, group = false) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const { successLevel } = message.flags.data.postData;
    const { fateImproved } = message.flags.data;

    if (successLevel <= -2 || fateImproved || !ConditionChecker.fateAvailable(actor, group)) {
      return false;
    }

    let rollType = message.flags.data.preData.source.type;
    const mode = message.flags.data.preData.mode || '';

    if (ROLLABLE_TYPES.includes(rollType)) rollType = 'char';

    const schipSkill = localize(`SCHIPSKILLS.${rollType}${mode}`);
    return !!actor.items.getName(schipSkill);
  }

  static canIncreaseQS(li, group = false) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const { successLevel, qualityStep } = message.flags.data.postData;
    const { fatePointAddQSUsed } = message.flags.data;

    return ConditionChecker.fateAvailable(actor, group) &&
      !fatePointAddQSUsed &&
      successLevel > 0 &&
      qualityStep !== undefined;
  }

  static isTalented(li) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const { talentedRerollUsed } = message.flags.data;
    const sourceName = message.flags.data.preData.source.name;
    const aptitudeName = `${localize('LocalizedIDs.aptitude')} (${sourceName})`;

    return !talentedRerollUsed && !!actor.items.find(item => item.name === aptitudeName);
  }

  static canRerollDamage(li, group = false) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const { damageRoll } = message.flags.data.postData;
    const { fatePointDamageRerollUsed } = message.flags.data;

    return ConditionChecker.fateAvailable(actor, group) &&
      damageRoll !== undefined &&
      !fatePointDamageRerollUsed;
  }

  static canReroll(li, group = false) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const { fatePointRerollUsed } = message.flags.data;
    const { rollType } = message.flags.data.postData;

    return ConditionChecker.fateAvailable(actor, group) &&
      !fatePointRerollUsed &&
      rollType !== 'regenerate';
  }

  static canHeal(li) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);

    if (!actor || !hasOwnership(actor) || !message.flags.data) {
      return false;
    }

    const { healApplied } = message.flags.data;
    const hasStats = STAT_TYPES.some(stat =>
      getProperty(message.flags, `data.postData.${stat}`) !== undefined
    );

    return !healApplied && hasStats;
  }

  static canApplyDefaultRolls(li) {
    const message = getMessageFromLi(li);

    return message?.isRoll &&
      message.isContentVisible &&
      canvas.tokens?.controlled.length > 0 &&
      !!li.querySelector('.dice-roll');
  }

  static canApplyDepletableBuffs(li) {
    const message = getMessageFromLi(li);
    const actor = getActorFromRollMessage(message);
    if (!actor || !hasOwnership(actor) || !message?.flags?.data) return false;

    const successLevel = Number(getProperty(message, 'flags.data.postData.successLevel'));
    if (!(successLevel > 0)) return false;

    return PostRollBuffs.getMatches(message, actor).length > 0;
  }
}

class ActionHandler {
  static notification_context_menu_initialized = false;

  static async showHideData(li) {
    if (!game.user.isGM) return;

    const message = getMessageFromLi(li);
    if (!message.flags.hideData) return;

    const newHide = !message.flags.hideData.value;
    const query = $(message.content);

    query.find('.hideAnchor')[newHide ? 'addClass' : 'removeClass']('hideData');

    await message.update({
      content: $('<div></div>').append(query).html(),
      'flags.hideData.value': newHide,
    });
  }

  static useFate(li, mode, fateSource = 0) {
    const message = getMessageFromLi(li);
    const actor = getActorFromMessage(message);
    actor?.useFateOnRoll(message, mode, fateSource);
  }

  static async applyChatCardDamage(li, mode, factor = 1) {
    const message = getMessageFromLi(li);
    const roll = message.rolls[0];

    return Promise.all(
      canvas.tokens.controlled.map(token => {
        const { actor } = token;
        const baseDamage = mode === 'sp' ? roll.total : roll.total - Actordsa5.armorValue(actor).armor;
        const damage = Math.max(0, Math.round(baseDamage * factor));
        return actor.applyDamage(damage);
      })
    );
  }

  static async payMana(li) {
    const message = getMessageFromLi(li);
    const { data: cardData } = message.flags;
    const actor = DSA5_Utility.getSpeaker(message.speaker);

    if (!actor?.isOwner) {
      return ui.notifications.error('DSAError.DamagePermission', { localize: true });
    }

    const { calculatedSpellModifiers } = cardData.preData;
    const maintain = calculatedSpellModifiers.maintainCost?.trim();
    const sourceType = cardData.preData.source.type;
    const costsMana = getProperty(calculatedSpellModifiers, 'costsMana');

    const payType = MANA_TYPES.includes(sourceType) || costsMana ? 'AsP' : 'KaP';
    const manaApplied = await actor.applyMana(calculatedSpellModifiers.finalcost, payType);

    if (maintain && maintain !== '0' && manaApplied && cardData.postData.successLevel > 0) {
      await ActionHandler.handleMaintainEffect(actor, maintain, cardData.preData.source.name, payType);
    }

    await updateMessageWithCheckmark(
      message,
      'manaApplied',
      /<span class="costCheck">/,
      '<span class="costCheck"><i class="fas fa-check" style="float:right"></i>'
    );
  }

  static async handleMaintainEffect(actor, maintain, name, payType) {
    try {
      const cost = maintain.match(/^\d{1,3}/)?.[0];
      if (!cost) return;

      let duration = maintain.replace(/^\d{1,3}/, '').match(/\d{1,3}/);
      duration = duration ? Number(duration[0]) || 1 : 1;

      const effect = ActionHandler.createMaintainEffect(name, maintain, cost, payType);
      const seconds = ActionHandler.calculateDuration(maintain, duration);

      if (seconds) {
        effect.duration.seconds = seconds;
        effect.duration.rounds = seconds / 5;
      }

      await actor.addCondition(effect);
    } catch (error) {
      console.error(`Could not parse duration '${maintain}' of '${name}'`, error);
    }
  }

  static createMaintainEffect(name, maintain, cost, payType) {
    return {
      name: `${name} (${localize('maintainCost')})`,
      img: 'icons/svg/daze.svg',
      flags: {
        dsa5: {
          description: maintain,
          maintain: cost,
          payType,
        },
      },
      changes: [],
      duration: {},
    };
  }

  static calculateDuration(maintain, duration) {
    const timeUnits = [
      { key: 'DSAREGEXmaintain.seconds', seconds: 1 },
      { key: 'DSAREGEXmaintain.combatRounds', seconds: 5 },
      { key: 'DSAREGEXmaintain.minutes', seconds: 60 },
      { key: 'DSAREGEXmaintain.hours', seconds: 3600 },
      { key: 'DSAREGEXmaintain.days', seconds: 3600 * 24 },
      { key: 'DSAREGEXmaintain.weeks', seconds: 3600 * 24 * 7 },
      { key: 'DSAREGEXmaintain.months', seconds: 3600 * 24 * 30 },
      { key: 'DSAREGEXmaintain.years', seconds: 3600 * 24 * 350 },
    ];

    for (const unit of timeUnits) {
      const regex = new RegExp(localize(unit.key), 'gi');
      if (regex.test(maintain)) {
        return duration * unit.seconds;
      }
    }

    return null;
  }

  static async applyHealing(li) {
    const message = getMessageFromLi(li);
    const actor = DSA5_Utility.getSpeaker(message.speaker);

    if (!actor?.isOwner) {
      return ui.notifications.error('DSAError.DamagePermission', { localize: true });
    }

    await updateMessageWithCheckmark(
      message,
      'healApplied',
      /<\/div>$/,
      '<i class="fas fa-check" style="float:right"></i></div>'
    );

    const { postData } = message.flags.data;
    await actor.applyRegeneration(postData.LeP, postData.AsP, postData.KaP);
  }

  static async applyDepletableBuffs(li) {
    const message = getMessageFromLi(li);
    const actor = getActorFromRollMessage(message);
    if (!actor || !hasOwnership(actor) || !message?.flags?.data) return;

    const matches = PostRollBuffs.getMatches(message, actor);
    if (matches.length === 0) return;

    new PostRollBuffPicker(message, matches, async (chosen) => {
      await PostRollBuffs.applyMatches(message, chosen);
    }).render(true);
  }
}

const createContextOptions = () => {
  const applyDamageLabel = () => {
    return localize(game.combat?.isBrawling ? 'CHATCONTEXT.ApplyDamagePP' : 'CHATCONTEXT.ApplyDamage');
  };

  const baseOptions = [
    {
      name: 'CHATCONTEXT.hideData',
      icon: '<i class="fas fa-eye"></i>',
      condition: (li) => ConditionChecker.canToggleDataVisibility(li, true),
      callback: ActionHandler.showHideData,
    },
    {
      name: 'CHATCONTEXT.showData',
      icon: '<i class="fas fa-eye"></i>',
      condition: (li) => ConditionChecker.canToggleDataVisibility(li, false),
      callback: ActionHandler.showHideData,
    },
    {
      name: 'regenerate',
      icon: '<i class="fas fa-user-plus"></i>',
      condition: ConditionChecker.canHeal,
      callback: ActionHandler.applyHealing,
    },
    {
      name: 'CHATCONTEXT.ApplyMana',
      icon: '<i class="fas fa-user-minus"></i>',
      condition: ConditionChecker.canCostMana,
      callback: ActionHandler.payMana,
    },
    {
      name: applyDamageLabel(),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: ConditionChecker.canHurt,
      callback: (li) => applyDamage(li, 'value'),
    },
    {
      name: 'CHATCONTEXT.ApplyDamageSP',
      icon: '<i class="fas fa-user-minus"></i>',
      condition: ConditionChecker.canHurtSP,
      callback: (li) => applyDamage(li, 'sp'),
    },
    {
      name: applyDamageLabel(),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: ConditionChecker.canApplyDefaultRolls,
      callback: (li) => ActionHandler.applyChatCardDamage(li, 'value'),
    },
    {
      name: 'CHATCONTEXT.ApplyDamageSP',
      icon: '<i class="fas fa-user-minus"></i>',
      condition: ConditionChecker.canApplyDefaultRolls,
      callback: (li) => ActionHandler.applyChatCardDamage(li, 'sp'),
    },
    {
      name: 'CHATCONTEXT.Reroll',
      icon: '<i class="fas fa-dice"></i>',
      condition: ConditionChecker.canReroll,
      callback: (li) => ActionHandler.useFate(li, 'reroll'),
    },
    {
      name: 'CHATCONTEXT.RerollGroup',
      icon: '<i class="fas fa-dice"></i>',
      condition: (li) => ConditionChecker.canReroll(li, true),
      callback: (li) => ActionHandler.useFate(li, 'reroll', 1),
    },
    {
      name: 'CHATCONTEXT.talentedReroll',
      icon: '<i class="fas fa-dice"></i>',
      condition: ConditionChecker.isTalented,
      callback: (li) => ActionHandler.useFate(li, 'isTalented'),
    },
    {
      name: 'CHATCONTEXT.AddQS',
      icon: '<i class="fas fa-plus-square"></i>',
      condition: ConditionChecker.canIncreaseQS,
      callback: (li) => ActionHandler.useFate(li, 'addQS'),
    },
    {
      name: 'CHATCONTEXT.AddQSGroup',
      icon: '<i class="fas fa-plus-square"></i>',
      condition: (li) => ConditionChecker.canIncreaseQS(li, true),
      callback: (li) => ActionHandler.useFate(li, 'addQS', 1),
    },
    {
      name: 'CHATCONTEXT.rerollDamage',
      icon: '<i class="fas fa-dice"></i>',
      condition: ConditionChecker.canRerollDamage,
      callback: (li) => ActionHandler.useFate(li, 'rerollDamage'),
    },
    {
      name: 'CHATCONTEXT.rerollDamageGroup',
      icon: '<i class="fas fa-dice"></i>',
      condition: (li) => ConditionChecker.canRerollDamage(li, true),
      callback: (li) => ActionHandler.useFate(li, 'rerollDamage', 1),
    },
    {
      name: 'CHATCONTEXT.improveFate',
      icon: '<i class="fas fa-plus-square"></i>',
      condition: ConditionChecker.canImproveRoll,
      callback: (li) => ActionHandler.useFate(li, 'Improve'),
    },
    {
      name: 'CHATCONTEXT.improveFateGroup',
      icon: '<i class="fas fa-plus-square"></i>',
      condition: (li) => ConditionChecker.canImproveRoll(li, true),
      callback: (li) => ActionHandler.useFate(li, 'Improve', 1),
    },
    {
      name: 'CHATCONTEXT.applyDepletableBuffs',
      icon: '<i class="fas fa-wand-magic-sparkles"></i>',
      condition: ConditionChecker.canApplyDepletableBuffs,
      callback: ActionHandler.applyDepletableBuffs,
    },
  ];

  if (game.settings.get('dsa5', 'doubleDamageOptions')) {
    baseOptions.push(
      ...createDoubleDamageOptions(applyDamageLabel)
    );
  }

  return baseOptions;
};

const createDoubleDamageOptions = (applyDamageLabel) => [
  {
    name: `${applyDamageLabel()} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    condition: ConditionChecker.canHurt,
    callback: (li) => applyDamage(li, 'value', 2),
  },
  {
    name: `${localize('CHATCONTEXT.ApplyDamageSP')} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    condition: ConditionChecker.canHurtSP,
    callback: (li) => applyDamage(li, 'sp', 2),
  },
  {
    name: `${applyDamageLabel()} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    condition: ConditionChecker.canApplyDefaultRolls,
    callback: (li) => ActionHandler.applyChatCardDamage(li, 'value', 2),
  },
  {
    name: `${localize('CHATCONTEXT.ApplyDamageSP')} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    condition: ConditionChecker.canApplyDefaultRolls,
    callback: (li) => ActionHandler.applyChatCardDamage(li, 'sp', 2),
  },
];

export function chatContext() {
  Hooks.once('getNotificationChatMessageContextOptions', (app, options, c) => {
    options.push(...createContextOptions());
  });
  
  Hooks.on('getChatMessageContextOptions', (app, options, c) => {
    options.push(...createContextOptions());

    if(ActionHandler.notification_context_menu_initialized) return;
      
    ActionHandler.notification_context_menu_initialized = true;    
    app._createContextMenu(app._getEntryContextOptions, ".message[data-message-id]", {
      hookName: "getNotificationChatMessageContextOptions",
      container: document.querySelector('#chat-notifications'),
      parentClassHooks: false,
      fixed: true
    });
  });
}
