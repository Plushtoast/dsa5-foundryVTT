import DSA5StatusEffects from '../../status/status_effects.js';
import SpecialabilityRulesDSA5 from './specialability-rules-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
const { getProperty, mergeObject, duplicate, setProperty } = foundry.utils;

export default class RuleChaos {
  static regex2h = /\(2H/;

  static multipleDefenseValue(actor, item) {
    let multipleDefense = -3;

    if (
      (item.type == 'dodge' || getProperty(item, 'system.combatskill.value') == _loc('LocalizedIDs.wrestle')) &&
      SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.masterfulDodge')
    )
      multipleDefense = -2;
    else if (SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.mightyMasterfulParry')) multipleDefense = -1;
    else if (SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.masterfulParry')) multipleDefense = -2;

    if (SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.vinsaltStyle')) multipleDefense -= 1;

    return Math.min(0, multipleDefense);
  }

  static async bleedingMessage(actor) {
    await ChatMessage.create(
      DSA5_Utility.chatDataSetup(
        _loc('CHATNOTIFICATION.applyBleeding', {
          actor: actor.name,
          actorId: actor.id,
          tokenId: actor.token ? actor.token.id : '',
        }),
      ),
    );
  }

  static isShield(item) {
    return _loc('LocalizedIDs.Shields') == getProperty(item, 'system.combatskill.value');
  }

  static _getFunctionData(ev) {
    return {
      data: ev.currentTarget.dataset,
      actor: DSA5_Utility.getSpeaker({
        token: ev.currentTarget.dataset.token,
        actor: ev.currentTarget.dataset.actor,
        scene: canvas.scene ? canvas.scene.id : null,
      }),
    };
  }

  static quantityClick(ev) {
    const quantityFocus = ev.currentTarget.dataset.quantityfocus;
    const target = $(ev.currentTarget);
    if (quantityFocus && !target.is(':focus')) {
      setTimeout(function () {
        target.select(), 100;
      });
      return;
    }
    const val = { val: Number(target.val()) };
    RuleChaos.increment(ev, val, 'val');
    target.val(val.val);
  }

  static schipsFromSetting(settingKey, { imgFull, imgEmpty, namespace = 'dsa5' } = {}) {
    const schipSetting = game.settings
      .get(namespace, settingKey)
      .split('/')
      .map((x) => Number(x));
    const schips = [];
    for (let i = 1; i <= schipSetting[1]; i++) {
      const full = i <= schipSetting[0];
      const schip = {
        value: i,
        cssClass: full ? 'fullSchip' : 'emptySchip',
      };
      if (imgFull || imgEmpty) schip.img = full ? imgFull : imgEmpty;
      schips.push(schip);
    }
    return schips;
  }

  static getGroupSchips() {
    return this.schipsFromSetting('groupschips');
  }

  //todo this should not be necessary
  static ensureNumber(source) {
    source.system.AsPCost.value = Number(source.system.AsPCost.value) || source.system.AsPCost.value;
  }

  static isWieldedTwohanded(item) {
    if (!item || !item.system) return false;
    if (item.type == 'trait') return false;

    const twoHanded = this.regex2h.test(item.name);
    const wrongGrip = item.system.worn.wrongGrip;
    return (twoHanded && !wrongGrip) || (!twoHanded && wrongGrip);
  }

  static obfuscateDropData(item, obfuscations) {
    if (obfuscations) {
      for (const section of obfuscations) mergeObject(item, { system: { obfuscation: { [section]: true } } });
    }
  }

  static _buildDuration(value, units = 'rounds') {
    return {
      duration: { value, units },
      start: ActiveEffect.getEffectStart(),
    };
  }

  static async calcBleeding(ev) {
    const { data, actor } = RuleChaos._getFunctionData(ev);
    if (!actor) return;

    const skill = actor.items.find((i) => i.name == _loc('LocalizedIDs.selfControl') && i.type == 'skill');
    const options = {
      postFunction: {
        functionName: 'game.dsa5.apps.RuleChaos.postCalcBleeding',
        speaker: { actor: actor.id, token: data.token, scene: canvas.scene ? canvas.scene.id : null },
      },
    };
    actor.setupSkill(skill, options, data.token).then(async (setupData) => {
      const result = await actor.basicTest(setupData);
      await RuleChaos.applyBleedingResult(result.result, actor);
    });
  }

  static async applyBleedingResult(rollResult, actor) {
    if (rollResult.successLevel >= 2) {
      const existing = actor.hasCondition('bleeding');
      if (existing) await actor.removeCondition('bleeding');
      return;
    }

    const qs = rollResult.qualityStep || 0;
    let duration = 7;
    if (rollResult.successLevel == 1) {
      duration -= Number(qs);
    } else if (rollResult.successLevel < 1) {
      duration += duration;
    }
    const existing = actor.hasCondition('bleeding');
    const durationUpdate = RuleChaos._buildDuration(duration);

    if (existing) {
      await existing.update(durationUpdate);
    } else {
      const bleeding = duplicate(CONFIG.statusEffects.find((x) => x.id == 'bleeding'));
      mergeObject(bleeding, durationUpdate);
      await DSA5StatusEffects.addCondition(actor, bleeding, 1, false, true);
      await ChatMessage.create(
        DSA5_Utility.chatDataSetup(
          _loc('CHATNOTIFICATION.gotBleeding', { actor: actor.name }),
        ),
      );
    }
  }

  static async postCalcBleeding(postFunction, result) {
    const actor = DSA5_Utility.getSpeaker(postFunction.speaker);
    if (!actor) return;

    await RuleChaos.applyBleedingResult(result.result, actor);
  }

  static increment(ev, item, path, limit = undefined) {
    const factor = ev.ctrlKey ? 10 : 1;
    const sign = ev.button == 2 ? -1 : 1;
    let value = getProperty(item, path) + factor * sign;
    if (limit != undefined) value = Math.max(limit, value);
    setProperty(item, path, value);
    return value;
  }

  static magicalImprovement(actor, creationData) {
    for (const item of actor.items) {
      if (['ritual', 'spell'].includes(item.type)) {
        item.system.talentValue.value += 4;
      }
    }
  }
}
