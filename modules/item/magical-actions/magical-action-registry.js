import NoModificationsAction from './no-modifications.js';
import SchelmenstreicheAction from './schelmenstreiche.js';
import HerrschaftsritualAction from './herrschaftsritual.js';
import ElfenliederAction from './elfenlieder.js';

const REGISTRY = {
  elfenlieder: ElfenliederAction,
  geodenritual: NoModificationsAction,
  goblinrituale: NoModificationsAction,
  hexenflueche: NoModificationsAction,
  schelmenstreiche: SchelmenstreicheAction,
  zaubermelodien: NoModificationsAction,
  zaubertaenze: NoModificationsAction,
  herrschaftsritual: HerrschaftsritualAction,
  verzerrte_elfenlieder: ElfenliederAction,
};

export function createMagicalAction(kind) {
  const Handler = REGISTRY[kind];
  return Handler ? new Handler() : null;
}

export function registerMagicalActionHooks() {
  Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
    const { source } = dialogState;
    const kind = source?.system?.magicalActionKind?.value;
    if (!kind) return;

    const handler = createMagicalAction(kind);
    if (!handler) return;

    menuItems.push(...handler.getBurgerMenuItems(dialogState));
  });
}
