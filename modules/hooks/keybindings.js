import { SelectUserDialog } from '../dialog/addTargetDialog.js';
import DSA5_Utility from '../system/utility-dsa5.js';
import { DSA5CombatTracker } from './combat_tracker.js';

export default function () {
  game.keybindings.register('dsa5', 'masterMenu', {
    name: 'gmMenu',
    hint: 'KEYBINDINGS.masterMenu',
    editable: [{ key: 'KeyM' }],
    onDown: () => DSA5_Utility.renderToggle(game.dsa5.apps.gameMasterMenu),
    restricted: true,
  });
  game.keybindings.register('dsa5', 'journalBrowser', {
    name: 'Book.Wizard',
    hint: 'KEYBINDINGS.journalBrowser',
    editable: [{ key: 'KeyJ' }],
    onDown: () => DSA5_Utility.renderToggle(game.dsa5.apps.journalBrowser),
  });
  game.keybindings.register('dsa5', 'library', {
    name: 'ItemLibrary',
    hint: 'KEYBINDINGS.library',
    editable: [{ key: 'KeyL' }],
    onDown: () => DSA5_Utility.renderToggle(game.dsa5.itemLibrary),
  });
  game.keybindings.register('dsa5', 'attacktest', {
    name: 'attacktest',
    hint: 'KEYBINDINGS.attack',
    editable: [{ key: 'KeyB' }],
    onDown: () => DSA5CombatTracker.runActAttackDialog(),
  });
  game.keybindings.register('dsa5', 'combatTrackerNext', {
    name: 'COMBAT.TurnNext',
    hint: 'COMBAT.TurnNext',
    editable: [{ key: 'KeyN' }],
    onDown: () => combatTurn('nextTurn'),
  });
  game.keybindings.register('dsa5', 'combatTrackerPrevious', {
    name: 'COMBAT.TurnPrev',
    hint: 'COMBAT.TurnPrev',
    editable: [{ key: 'KeyV' }],
    onDown: () => combatTurn('previousTurn'),
  });
  game.keybindings.register('dsa5', 'setTargetToUser', {
    name: 'DIALOG.setTargetToUser',
    hint: 'DIALOG.setTargetToUserHint',
    editable: [],
    onDown: async () => (await SelectUserDialog.getDialog()).render(true),
    restricted: true,
  });
}

const combatTurn = (mode) => {
  game.combat?.combatant?.isOwner && game.combat[mode]();
};
