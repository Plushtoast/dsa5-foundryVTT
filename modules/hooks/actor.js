import DSAActiveEffectConfig from '../status/active_effect_config.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MaintainedEffects from '../system/maintenance/maintained-effects.js';
import Riding from '../system/automation/riding.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import { DSAAura } from '../system/automation/aura.js';

const { getProperty, hasProperty, mergeObject } = foundry.utils;

export default function () {
  Hooks.on('preDeleteActiveEffect', (effect, options, user_id) => {
    if (options.noHook) return;

    const actor = effect.parent;
    if (actor && actor.documentName == 'Actor') {
      if (MaintainedEffects.isMaintained(effect)) {
        void MaintainedEffects.promptDelete(effect);
        return false;
      }
    }
  });

  Hooks.on('updateActor', (actor, updates) => {
    if (!game.user.isGM && actor.limited && hasProperty(updates, 'system.merchant.hidePlayer')) ui.sidebar.render(true);
  });

  Hooks.on('deleteActiveEffect', (effect, options) => {
    if (!DSA5_Utility.isActiveGM()) return;
    if (options.noHook && options.butOnRemove) {
      const actor = effect.parent;
      if (actor && actor.documentName == 'Actor') {
        DSAActiveEffectConfig.onEffectRemove(actor, effect);
      }
    }

    // Delete associated region when a zone-tracking AE expires
    const regionId = effect.flags?.dsa5?.regionId;
    const sceneId = effect.flags?.dsa5?.sceneId;
    if (regionId && !options.fromRegionDelete) {
      const scene = game.scenes.get(sceneId) || canvas.scene;
      scene?.deleteEmbeddedDocuments('Region', [regionId]).catch(() => {});
    }

    if (options.noHook) return;

    const actor = effect.parent;
    notifyFadingEffect(effect, options);

    if (actor && actor.documentName == 'Actor') {
      if (effect.statuses.has('bloodrush')) {
        actor.addCondition('stunned', 2, false, false);
      } else if ((effect.statuses.has('dead') || effect.statuses.has('defeated')) && game.combat) {
        actor.markDead(false);
      }
      DSAActiveEffectConfig.onEffectRemove(actor, effect);
    }
  });

  // Reverse cleanup: delete tracking AE when a region is deleted by GM
  Hooks.on('deleteRegion', (region, options) => {
    if (!DSA5_Utility.isActiveGM()) return;
    const actorId = region.flags?.dsa5?.trackingActorId;
    const aeId = region.flags?.dsa5?.trackingAEId;
    if (actorId && aeId) {
      const actor = game.actors.get(actorId);
      if (actor?.effects.has(aeId)) {
        actor.deleteEmbeddedDocuments('ActiveEffect', [aeId], { fromRegionDelete: true }).catch(() => {});
      }
    }
  });

  Hooks.on('preDeleteActiveEffect', (effect, options, userid) => {
    const shouldSkip = !DSA5_Utility.isActiveGM() || options.noHook

    const actor = effect.parent;

    if (actor && actor.documentName == 'Actor') {
      if (!shouldSkip && DSAActiveEffectConfig.onDelayedEffect(actor, effect) === false) return false;

      if (Hooks.call('deleteActorActiveEffect', actor, effect) === false) return false;
    }
  });

  Hooks.on('dropActorSheetData', (actor, sheet, data) => {
    switch (data.data?.type) {
      case 'condition':
        actor.addCondition(data.data.payload.id, 1, false, false);
        return false;
      case 'lookup':
        sheet._handleLookup(data.data);
        return false;
      case 'fullpack':
        sheet._addFullPack(data.data);
        return false;
    }
  });

  Hooks.on('createActiveEffect', (effect, options, user) => {
    if (!DSA5_Utility.isActiveGM()) return;

    checkIniChange(effect);
    createEffects(effect);
  });

  Hooks.on('deleteActiveEffect', (effect, options, user) => {
    if (!DSA5_Utility.isActiveGM()) return;

    checkIniChange(effect);
  });

  Hooks.on('updateActiveEffect', (effect, options, user) => {
    if (!DSA5_Utility.isActiveGM()) return;

    checkIniChange(effect);
    countableDependentEffects(effect);
  });

  function checkIniChange(effect) {
    if (game.combat && effect.system.changes.some((x) => /(system\.status\.initiative|system\.characteristics.mu|system\.characteristics\.ge)/.test(x.key))) {
      const actorId = effect.parent.id;
      const combatant = game.combat.combatants.find((x) => x.actor.id == actorId);
      if (combatant) combatant.recalcInitiative();
    }
  }

  const notifyFadingEffect = async (effect, options) => {
    if (!effect.parent) return;

    const target = effect.system.removeMessage;

    if (!((game.settings.get('dsa5', 'notifyOnFadingEffects') && effect.parent.documentName == 'Actor') || target)) return;

    let forceWhisperIDs = [];
    switch (target) {
      case 'player':
        forceWhisperIDs = game.users.filter((u) => !u.isGM && effect.parent.testUserPermission(u, 'OWNER'));
        break;
      case 'playergm':
        forceWhisperIDs = game.users.filter((u) => effect.parent.testUserPermission(u, 'OWNER'));
        break;
      case 'players':
        forceWhisperIDs = undefined;
        break;
      default:
        forceWhisperIDs = game.users.filter((x) => x.isGM);
    }

    forceWhisperIDs = forceWhisperIDs?.map((x) => x.id);

    ChatMessage.create(
      DSA5_Utility.chatDataSetup(
        _loc('CHATNOTIFICATION.fadingEffect', {
          effect: effect.name,
          actor: effect.parent.link,
        }),
        undefined,
        undefined,
        forceWhisperIDs,
      ),
    );
  };

  const createEffects = async (effect) => {
    const actor = effect.parent;
    if (!actor) return;

    await countableDependentEffects(effect, {}, actor);

    if ((effect.statuses.has('dead') || effect.statuses.has('defeated')) && game.combat) await actor.markDead(true);
    if (effect.statuses.has('unconscious')) await actor.addCondition('prone');
  };

  const countableDependentEffects = async (effect, toCheck = {}, actor) => {
    if (!actor) actor = effect.parent;
    if (!actor || actor.documentName != 'Actor') return;

    const efKeys = /^system\.condition\./;
    for (const ef of effect.system?.changes || []) {
      if (efKeys.test(ef.key) && ef.type === 'add') {
        toCheck[ef.key.split('.')[2]] = Number(ef.value);
      }
    }

    for (const key of Object.keys(toCheck)) {
      if (actor.system.condition[key] >= 4) {
        if (key == 'inpain') await actor.initResistPainRoll(effect);
        else if (['encumbered', 'stunned', 'feared', 'confused', 'trance'].includes(key)) await actor.addCondition('incapacitated');
        else if (key == 'paralysed') await actor.addCondition('rooted');
        else if (['drunken', 'exhaustion'].includes(key)) {
          await actor.addCondition('stunned');
          await actor.removeCondition(key);
        }
      }
      if (
        (Number(toCheck.inpain) || 0) > 0 &&
        !actor.hasCondition('bloodrush') &&
        actor.system.condition.inpain > 0 &&
        AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.frenzy')
      ) {
        await actor.addCondition('bloodrush');
        const msg = DSA5_Utility.replaceConditions(
          `${_loc('CHATNOTIFICATION.gainsBloodrush', {
            character: '<b>' + actor.name + '</b>',
          })}`,
        );
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
      }
    }
  };

  const askForName = async (tokenObject, setting) => {
    if (game.canvas.scene.askForNameTemporaryDisabled) return;

    const dialogConstructor = game.dsa5.apps.AskForNameDialog || AskForNameDialog;
    dialogConstructor.getDialog(tokenObject, setting);
  };

  const randomWeaponSelection = async (token) => {
    if (!DSA5_Utility.isActiveGM()) return;

    if (game.settings.get('dsa5', 'randomWeaponSelection') && !['character', 'vehicle', 'group'].includes(token.actor.type)) {
      const meleeweapons = [];
      const shields = [];
      const rangeweapons = [];
      for (const itm of token.actor.items) {
        if (itm.type == 'meleeweapon' && itm.system.worn.value) RuleChaos.isShield(itm) ? shields.push(itm) : meleeweapons.push(itm);
        else if (itm.type == 'rangeweapon' && itm.system.worn.value) rangeweapons.push(itm);
      }
      const updates = [];
      if (meleeweapons.length) {
        const weapon = meleeweapons[Math.floor(Math.random() * meleeweapons.length)];
        const wornId = weapon._id;
        let shieldId;
        if (!RuleChaos.regex2h.test(weapon.name) && shields.length) {
          shieldId = shields[Math.floor(Math.random() * shields.length)]._id;
        }
        for (const itm of meleeweapons) {
          if (itm._id == wornId) continue;

          updates.push({ _id: itm._id, system: { worn: { value: false } } });
        }
        for (const itm of shields) {
          if (itm._id == shieldId) continue;

          updates.push({ _id: itm._id, system: { worn: { value: false } } });
        }
      }
      if (rangeweapons.length) {
        const weaponid = rangeweapons[Math.floor(Math.random() * rangeweapons.length)]._id;
        for (const itm of rangeweapons) {
          if (itm._id == weaponid) continue;

          updates.push({ _id: itm._id, system: { worn: { value: false } } });
        }
      }

      if (updates.length) token.actor.updateEmbeddedDocuments('Item', updates);
    }
  };

  const obfuscateName = async (token, update) => {
    if (!DSA5_Utility.isActiveGM()) return;

    const actor = token.actor;
    if (actor.hasPlayerOwner) return;

    const setting = Number(game.settings.get('dsa5', 'obfuscateTokenNames'));
    if (setting == 0 || getProperty(actor, 'merchant.merchantType') == 'loot') return;

    const sameActorTokens = canvas.scene.tokens.filter((x) => x.actor && x.actor.id === actor.id);
    let name = _loc('unknown');
    if ([2, 4].includes(setting)) {
      const tokenId = token.id || token._id;
      if (!tokenId) return;

      askForName(token, setting);
      return;
    }

    if (sameActorTokens.length > 0 && setting < 3) {
      let max = sameActorTokens.length;
      for (const x of sameActorTokens) {
        const match = x.name.match(/\d+$/);
        if (match && Number(match[0]) > max) max = Number(match[0]);
      }
      name = `${sameActorTokens[0].name.replace(/ \d{1,}$/, '')} ${max + 1}`;
    }
    update['name'] = name;
  };

  Hooks.on('updateToken', (token, data, options) => {
    if (!token.rendered) return;
    if (!DSA5_Utility.isActiveGM()) return;

    const prePosition = {
      center: token.object.center,
      elevation: token.elevation,
    };
    Riding.updateTokenHook(token, data, options);

    const movementAnimationPromise = token.object?.movementAnimationPromise || Promise.resolve();

    movementAnimationPromise.then(() => {
      if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.onTokenMove(token, data, options, prePosition);
    });
  });

  Hooks.on('deleteToken', (token) => {
    Riding.deleteTokenHook(token);
    TokenHoverHud.hide(token);
  });

  Hooks.on('canvasReady', (canvas) => {
    game.canvas.scene.askForNameTemporaryDisabled = false;
  });

  Hooks.on('preCreateToken', (token, data, options, userId) => {
    const actor = token.actor;
    if (!actor) return;

    const modify = {};
    if (getProperty(actor, 'system.merchant.merchantType') == 'loot') {
      mergeObject(modify, { displayBars: 0 });
    } else if (getProperty(actor, 'system.config.autoBar')) {
      mergeObject(modify, { bar1: { attribute: 'status.wounds' } });

      if (actor.system.isMage) {
        mergeObject(modify, { bar2: { attribute: 'status.astralenergy' } });
      } else if (actor.system.isPriest) {
        mergeObject(modify, { bar2: { attribute: 'status.karmaenergy' } });
      } else {
        mergeObject(modify, { bar2: { attribute: 'tbd' } });
      }
    }

    if (getProperty(actor, 'system.config.autoSize')) {
      DSA5_Utility.calcTokenSize(actor, modify);
    }

    obfuscateName(token, modify);
    token.updateSource(modify);
  });

  Hooks.on('createToken', (token, options, id) => {
    if (options.noHook) return;

    obfuscateName(token, {});
    randomWeaponSelection(token);
    Riding.createTokenHook(token, options, id);
    if (token.object) DSAAura.ensureEmanations(token.object);
  });

  Hooks.on('hoverToken', (token, hovered) => {
    if (!game.settings.get('dsa5', 'showWeaponsOnHover')) return;

    if (hovered) {
      TokenHoverHud.show(token);
    } else {
      TokenHoverHud.hide(token);
    }
  });
}

export class TokenHoverHud {
  static show(token) {
    if (!game.combat || canvas.hud?.token?.rendered || !token.actor) return;

    const weapons = token.actor.items.filter((x) => {
      if (x.type == 'meleeweapon' || x.type == 'rangeweapon') {
        return x.system.worn.value;
      }
      return false;
    });

    if (weapons.length) {
      const icons = weapons.map((x) => `<img src="${x.img}" class="tinyHudIcons" data-tooltip="${x.name}"/>`).join(' ');

      const elem = $(`<div id="hoverhud_${token.id}" class="flexrow" style="position:absolute;">${icons}</div>`);
      $('#hud').append(elem);
      this.position(elem, token, weapons.length);
    }
  }

  static position(elem, token, count) {
    const td = token.document;
    const ratio = canvas.dimensions.size / 100;

    const width = count * 43;
    const position = {
      width,
      height: 42,
      left: token.center.x - (width / 2) * ratio,
      top: token.y + td.height * canvas.dimensions.size + 32,
    };
    if (ratio !== 1) position.transform = `scale(${ratio})`;

    elem.css(position);
  }

  static hide(token) {
    $(`#hoverhud_${token.id}`).remove();
  }
}

class AskForNameDialog extends foundry.applications.api.DialogV2 {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'DSASETTINGS.obfuscateTokenNames',
    },
  };

  static async getDialog(tokenObject, setting) {
    new AskForNameDialog({
      content: `<div class="form-group"><label for="name">${_loc('DSASETTINGS.rename')}</label><div class="form-fields"><input name="name" type="text" value="${tokenObject.actor.name}"/></div></div>`,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'yes',
          default: true,
          callback: async (event, button, dialog) => {
            const tokenId = tokenObject.id || tokenObject._id;
            let name = button.form.elements.name.value;
            if (setting == 2) {
              const sameActorTokens = canvas.scene.tokens.filter((x) => x.name === name);
              if (sameActorTokens.length > 0) {
                let max = sameActorTokens.length;
                for (const x of sameActorTokens) {
                  const match = x.name.match(/\d+$/);
                  if (match && Number(match[0]) > max) max = Number(match[0]);
                }
                name = `${sameActorTokens[0].name.replace(/ \d{1,}$/, '')} ${max + 1}`;
              }
            }
            const token = canvas.scene.tokens.get(tokenId);
            await token.update({ name });
          },
        },
        {
          action: 'unknown',
          icon: 'fa fa-question',
          label: 'unknown',
          callback: async () => {
            const tokenId = tokenObject.id || tokenObject._id;
            const token = canvas.scene.tokens.get(tokenId);
            await token.update({ name: _loc('unknown') });
          },
        },
        {
          action: 'temporaryOff',
          icon: 'fa fa-question',
          label: 'DIALOG.temporaryOff',
          callback: async () => {
            game.canvas.scene.askForNameTemporaryDisabled = true
          },
        },
      ],
    }).render(true);
  }
}
