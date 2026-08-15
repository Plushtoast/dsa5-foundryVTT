import Riding from '../system/automation/riding.js';
import { SummoningFlow } from '../wizards/summoning/summoning_flow.js';
import CompanionHandler from './companions/companion-handler-class.js';

/**
 * Chooser when a creature actor is dropped onto a character sheet
 * (companion / shapeshift / mount / summoning favorite).
 */
export default class CreatureDropDialog {
  /**
   * @param {ActorSheet} sheet
   * @param {Actor} creature
   */
  static show(sheet, creature) {
    const onCompanionTab = sheet.tabGroups?.sheet === CompanionHandler.COMPANION_TAB_ID;
    const canSummon = SummoningFlow.hasConjurationSkills(sheet.actor);

    const buttons = [
      {
        action: 'companion',
        icon: 'fas fa-handshake',
        label: 'SHEET.AnimalCompanion',
        callback: () => CompanionHandler.setCompanion(sheet, creature.uuid),
      },
      {
        action: 'shapeshift',
        icon: 'fas fa-paw',
        label: 'CONDITION.shapeshift',
        callback: () => game.dsa5.apps.ShapeshiftingAPI.open({
          sourceActor: sheet.actor,
          targetActor: creature,
        }),
      },
      {
        action: 'horse',
        icon: 'fas fa-horse',
        label: 'RIDING.horse',
        default: !onCompanionTab || !canSummon,
        callback: () => Riding.setHorse(sheet.actor, creature, sheet.token),
      },
    ];

    if (onCompanionTab && canSummon) {
      buttons.unshift({
        action: 'conjurationFavorite',
        icon: 'fas fa-hat-wizard',
        label: 'COMPANIONS.Favorites.add',
        default: true,
        callback: () => CompanionHandler.addConjurationFavorite(sheet.actor, creature),
      });
    }

    new foundry.applications.api.DialogV2({
      window: {
        title: `${_loc('DIALOG.ItemRequiresAdoption')}: ${creature.name}`,
      },
      content: `<p>${_loc('DIALOG.whichFunction')}: ${creature.name}</p>`,
      buttons,
    }).render(true);
  }
}
