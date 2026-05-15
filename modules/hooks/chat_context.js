import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MaintainedEffects from '../system/maintenance/maintained-effects.js';

import PostRollBuffs from '../system/rolls/postroll-buffs.js';
import { PostRollBuffPicker } from '../dialog/postroll-buff-picker.js';
const { getProperty } = foundry.utils;

const SPELL_TYPES = ['liturgy', 'ceremony', 'spell', 'ritual', 'magicalsign'];
const ROLLABLE_TYPES = ['skill', 'spell', 'liturgy', 'ritual', 'ceremony'];
const STAT_TYPES = ['LeP', 'KaP', 'AsP'];
const MANA_TYPES = ['ritual', 'spell'];

const getMessageFromLi = (li) => game.messages.get(li?.dataset?.messageId);

const chatMessageAction = (handler) => (_event, li) => handler(li);

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
    `hideAnchor"><i class="fas fa-check" style="float:right" data-tooltip="${_loc('damageApplied')}"></i>`
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

    const schipSkill = _loc(`SCHIPSKILLS.${rollType}${mode}`);
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
    const aptitudeName = `${_loc('LocalizedIDs.aptitude')} (${sourceName})`;

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
      await MaintainedEffects.createForMessage(message.id, actor, maintain, cardData.preData.source.name, payType);
    }

    await updateMessageWithCheckmark(
      message,
      'manaApplied',
      /<span class="costCheck">/,
      '<span class="costCheck"><i class="fas fa-check" style="float:right"></i>'
    );
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
    return _loc(game.combat?.isBrawling ? 'CHATCONTEXT.ApplyDamagePP' : 'CHATCONTEXT.ApplyDamage');
  };

  const baseOptions = [
    {
      label: 'CHATCONTEXT.hideData',
      icon: '<i class="fas fa-eye"></i>',
      visible: (li) => ConditionChecker.canToggleDataVisibility(li, true),
      onClick: chatMessageAction(ActionHandler.showHideData),
    },
    {
      label: 'CHATCONTEXT.showData',
      icon: '<i class="fas fa-eye"></i>',
      visible: (li) => ConditionChecker.canToggleDataVisibility(li, false),
      onClick: chatMessageAction(ActionHandler.showHideData),
    },
    {
      label: 'regenerate',
      icon: '<i class="fas fa-user-plus"></i>',
      visible: ConditionChecker.canHeal,
      onClick: chatMessageAction(ActionHandler.applyHealing),
    },
    {
      label: 'CHATCONTEXT.ApplyMana',
      icon: '<i class="fas fa-user-minus"></i>',
      visible: ConditionChecker.canCostMana,
      onClick: chatMessageAction(ActionHandler.payMana),
    },
    {
      label: applyDamageLabel(),
      icon: '<i class="fas fa-user-minus"></i>',
      visible: ConditionChecker.canHurt,
      onClick: chatMessageAction((li) => applyDamage(li, 'value')),
    },
    {
      label: 'CHATCONTEXT.ApplyDamageSP',
      icon: '<i class="fas fa-user-minus"></i>',
      visible: ConditionChecker.canHurtSP,
      onClick: chatMessageAction((li) => applyDamage(li, 'sp')),
    },
    {
      label: applyDamageLabel(),
      icon: '<i class="fas fa-user-minus"></i>',
      visible: ConditionChecker.canApplyDefaultRolls,
      onClick: chatMessageAction((li) => ActionHandler.applyChatCardDamage(li, 'value')),
    },
    {
      label: 'CHATCONTEXT.ApplyDamageSP',
      icon: '<i class="fas fa-user-minus"></i>',
      visible: ConditionChecker.canApplyDefaultRolls,
      onClick: chatMessageAction((li) => ActionHandler.applyChatCardDamage(li, 'sp')),
    },
    {
      label: 'CHATCONTEXT.Reroll',
      icon: '<i class="fas fa-dice"></i>',
      visible: ConditionChecker.canReroll,
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'reroll')),
    },
    {
      label: 'CHATCONTEXT.RerollGroup',
      icon: '<i class="fas fa-dice"></i>',
      visible: (li) => ConditionChecker.canReroll(li, true),
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'reroll', 1)),
    },
    {
      label: 'CHATCONTEXT.talentedReroll',
      icon: '<i class="fas fa-dice"></i>',
      visible: ConditionChecker.isTalented,
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'isTalented')),
    },
    {
      label: 'CHATCONTEXT.AddQS',
      icon: '<i class="fas fa-plus-square"></i>',
      visible: ConditionChecker.canIncreaseQS,
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'addQS')),
    },
    {
      label: 'CHATCONTEXT.AddQSGroup',
      icon: '<i class="fas fa-plus-square"></i>',
      visible: (li) => ConditionChecker.canIncreaseQS(li, true),
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'addQS', 1)),
    },
    {
      label: 'CHATCONTEXT.rerollDamage',
      icon: '<i class="fas fa-dice"></i>',
      visible: ConditionChecker.canRerollDamage,
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'rerollDamage')),
    },
    {
      label: 'CHATCONTEXT.rerollDamageGroup',
      icon: '<i class="fas fa-dice"></i>',
      visible: (li) => ConditionChecker.canRerollDamage(li, true),
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'rerollDamage', 1)),
    },
    {
      label: 'CHATCONTEXT.improveFate',
      icon: '<i class="fas fa-plus-square"></i>',
      visible: ConditionChecker.canImproveRoll,
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'Improve')),
    },
    {
      label: 'CHATCONTEXT.improveFateGroup',
      icon: '<i class="fas fa-plus-square"></i>',
      visible: (li) => ConditionChecker.canImproveRoll(li, true),
      onClick: chatMessageAction((li) => ActionHandler.useFate(li, 'Improve', 1)),
    },
    {
      label: 'CHATCONTEXT.applyDepletableBuffs',
      icon: '<i class="fas fa-wand-magic-sparkles"></i>',
      visible: ConditionChecker.canApplyDepletableBuffs,
      onClick: chatMessageAction(ActionHandler.applyDepletableBuffs),
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
    label: `${applyDamageLabel()} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    visible: ConditionChecker.canHurt,
    onClick: chatMessageAction((li) => applyDamage(li, 'value', 2)),
  },
  {
    label: `${_loc('CHATCONTEXT.ApplyDamageSP')} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    visible: ConditionChecker.canHurtSP,
    onClick: chatMessageAction((li) => applyDamage(li, 'sp', 2)),
  },
  {
    label: `${applyDamageLabel()} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    visible: ConditionChecker.canApplyDefaultRolls,
    onClick: chatMessageAction((li) => ActionHandler.applyChatCardDamage(li, 'value', 2)),
  },
  {
    label: `${_loc('CHATCONTEXT.ApplyDamageSP')} x2`,
    icon: '<i class="fas fa-user-minus"></i>',
    visible: ConditionChecker.canApplyDefaultRolls,
    onClick: chatMessageAction((li) => ActionHandler.applyChatCardDamage(li, 'sp', 2)),
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
