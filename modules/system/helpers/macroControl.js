import DSA5ChatListeners from '../sidebar/chat_listeners.js';
import GroupCheck from '../rolls/group-check.js';
import RollRequestService from '../queries/roll-request.js';
import DSA5_Utility from './utility-dsa5.js';

export default class MacroDSA5 {
  static weaponLessMacro(char) {
    const { actor, tokenId } = DSA5_Utility.resolveChatSpeakerActor();
    if (!actor) return;
    this.runWeaponless(actor, char, tokenId);
  }

  static weaponLessMacroId(char, actorId) {
    const actor = game.actors.get(actorId);
    this.runWeaponless(actor, char);
  }

  static requestRoll(skill, modifier = 0) {
    RollRequestService.requestRoll(skill, modifier);
  }

  static requestGC(skill, modifier = 0, options = {}) {
    GroupCheck.showGCMessage(skill, modifier, options);
  }

  static rollCh(skill, options = {}) {
    DSA5ChatListeners.check3D20(undefined, skill, options);
  }

  static itemMacroById(actorId, itemName, itemType, bypassData) {
    const actor = game.actors.get(actorId);
    const item = actor ? actor.items.find((i) => i.name === itemName && i.type == itemType) : null;
    this.runItem(actor, item, itemName, bypassData);
  }

  static itemMacro(itemName, itemType, bypassData) {
    const { actor, tokenId } = DSA5_Utility.resolveChatSpeakerActor();
    if (!actor) return;
    const item = actor.items.find((i) => i.name === itemName && i.type == itemType) || null;
    this.runItem(actor, item, itemName, bypassData, tokenId);
  }

  static charMacroById(char, actorId) {
    const actor = game.actors.get(actorId);
    this.runChar(actor, char);
  }

  static charMacro(char) {
    const { actor, tokenId } = DSA5_Utility.resolveChatSpeakerActor();
    if (!actor) return;
    this.runChar(actor, char, tokenId);
  }

  static runWeaponless(actor, char, tokenId) {
    if (!actor) return ui.notifications.error('DSAError.MacroItemMissing', { localize: true, format: { item: char } });
    const characteristic = char.split('Weaponless')[0];
    actor.setupWeaponless(characteristic, {}, tokenId).then((setupData) => {
      actor.basicTest(setupData);
    });
  }

  static runChar(actor, char, tokenId) {
    if (!actor) return ui.notifications.error('DSAError.MacroItemMissing', { localize: true, format: { item: char } });

    actor.setupDodge({}, tokenId).then((setupData) => {
      actor.basicTest(setupData);
    });
  }

  static runItem(actor, item, itemName, bypassData, tokenId) {
    if (!actor) return ui.notifications.error('DSAError.MacroItemMissing', { localize: true, format: { item: itemName } });

    switch (item.type) {
      case 'combatskill':
      case 'trait':
      case 'meleeweapon':
        return actor.setupWeapon(item, bypassData.mod, bypassData, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      case 'rangeweapon':
        return actor.setupWeapon(item, 'attack', bypassData, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      case 'skill':
        return actor.setupSkill(item, bypassData, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      case 'ceremony':
      case 'ritual':
      case 'spell':
      case 'liturgy':
        return actor.setupSpell(item, bypassData, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
    }
  }
}
