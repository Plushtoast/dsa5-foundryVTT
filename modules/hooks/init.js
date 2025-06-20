import * as initHandleBars from './handlebars.js';
import * as initDiceSoNice from './dicesonice.js';
import * as initActorHooks from './actor.js';
import * as macroSupport from './macro_support.js';
import * as chatlogHooks from './chatlog.js';
import * as ready from './ready.js';
import { chatContext } from './chat_context.js';
import * as sideBar from './sidebar.js';
import { setupConfiguration } from './configuration.js';
import * as journals from './journal.js';
import * as tokenHUD from './tokenHUD.js';
import * as migrateWorld from '../system/maintenance/migrator.js';
import * as initScene from './scene.js';
import * as initKeybindings from './keybindings.js';
import * as rollExtensions from '../system/rolls/dsarolls.js';

import ActorSheetdsa5Character from './../actor/character-sheet.js';
import ActorSheetdsa5Creature from './../actor/creature-sheet.js';
import ActorSheetdsa5NPC from './../actor/npc-sheet.js';
import ItemSheetdsa5 from './../item/item-sheet.js';
import MerchantSheetDSA5 from '../actor/merchant-sheet.js';
import BookWizard from '../wizards/adventure_wizard.js';
import MastersMenu from '../wizards/masters_menu.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effects.js';
import CreatureMerchantSheetDSA5 from '../actor/creature-merchant-sheet.js';
import CharacterMerchantSheetDSA5 from '../actor/character-merchant-sheet.js';
import DPS from '../system/automation/derepositioningsystem.js';
import { SelectUserDialog } from '../dialog/addTargetDialog.js';
import DSAJournalSheet from '../journal/dsa_journal_sheet.js';
import DSA5 from '../system/config-dsa5.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import { setActorDelta } from './actordelta.js';
import DSA5ItemLibrary from '../system/guiapps/itemlibrary.js';
import { DSAWorldCalendar } from '../system/calendar/calendar.js';
const { mergeObject } = foundry.utils;

export default function () {
  initHandleBars.default();
  initDiceSoNice.default();
  initActorHooks.default();
  macroSupport.default();
  chatlogHooks.default();
  ready.default();
  chatContext();
  sideBar.default();
  journals.default();
  tokenHUD.default();
  migrateWorld.default();
  initScene.default();
  rollExtensions.default();
  setActorDelta();
}

Hooks.once('init', () => {
  foundry.applications.handlebars.loadTemplates([
    'systems/dsa5/templates/dialog/default-dialog.hbs',
    'systems/dsa5/templates/dialog/parts/targets.hbs',
    'systems/dsa5/templates/dialog/enhanced-default-dialog.hbs',
    'systems/dsa5/templates/dialog/default-combat-dialog.hbs',
    'systems/dsa5/templates/chat/roll/test-card.hbs',
    'systems/dsa5/templates/dialog/parts/spellmodifiers.hbs',
    'systems/dsa5/templates/dialog/parts/canChangeCastingTime.hbs',
    'systems/dsa5/templates/actors/parts/schipspart.hbs',
    'systems/dsa5/templates/actors/parts/characteristics-large.hbs',
    'systems/dsa5/templates/actors/parts/containerContent.hbs',
    'systems/dsa5/templates/actors/parts/creature-derived-attributes-small.hbs',
    'systems/dsa5/templates/actors/parts/creature-derived-attributes-large.hbs',
    'systems/dsa5/templates/actors/parts/status_effects.hbs',
    'systems/dsa5/templates/actors/parts/purse.hbs',
    'systems/dsa5/templates/actors/parts/combat_weapon.hbs',
    'systems/dsa5/templates/actors/parts/combat_rangeweapon.hbs',
    'systems/dsa5/templates/actors/parts/horse.hbs',
    'systems/dsa5/templates/actors/parts/healthbar.hbs',
    'systems/dsa5/templates/items/traditionArtifact.hbs',
    'systems/dsa5/templates/status/advanced_functions.hbs',
    'systems/dsa5/templates/actors/parts/information.hbs',
    'systems/dsa5/templates/actors/parts/personaltrait.hbs',
    'systems/dsa5/templates/actors/parts/attributes.hbs',
    'systems/dsa5/templates/actors/parts/swarm.hbs',
    'systems/dsa5/templates/actors/parts/carryandpurse.hbs',
    'systems/dsa5/templates/actors/parts/specialabilities.hbs',
    'systems/dsa5/templates/actors/parts/experienceBox.hbs',
    'systems/dsa5/templates/actors/parts/temperature.hbs',
    'systems/dsa5/templates/actors/parts/temperatureSmall.hbs',
    'systems/dsa5/templates/items/browse/actor.hbs',
    'systems/dsa5/templates/items/browse/garadan.hbs',
    'systems/dsa5/templates/items/browse/culture.hbs',
    'systems/dsa5/templates/items/browse/species.hbs',
    'systems/dsa5/templates/items/browse/career.hbs',
    'systems/dsa5/templates/items/meleeweapon-attack-part.hbs',
    'systems/dsa5/templates/items/rangeweapon-attack-part.hbs',
  ]);
  
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);

  const actorSheets = [
    { sheetClass: ActorSheetdsa5Character, types: ['character'], makeDefault: true },
    { sheetClass: ActorSheetdsa5Creature, types: ['creature'], makeDefault: true },
    { sheetClass: ActorSheetdsa5NPC, types: ['npc'], makeDefault: true },
    { sheetClass: MerchantSheetDSA5, types: ['npc'] },
    { sheetClass: CreatureMerchantSheetDSA5, types: ['creature'] },
    { sheetClass: CharacterMerchantSheetDSA5, types: ['character'] },
  ];

  actorSheets.forEach(({ sheetClass, types, makeDefault }) => {
    foundry.documents.collections.Actors.registerSheet('dsa5', sheetClass, { types, makeDefault });
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(ActiveEffect, 'dsa5', DSAActiveEffectConfig, { makeDefault: true });
  foundry.documents.collections.Journal.registerSheet('dsa5', DSAJournalSheet, { makeDefault: true });

  ItemSheetdsa5.setupSheets();

  Hooks.call('registerDSAstyle', DSA5.styles);
  
  DSAWorldCalendar.prepare();
  setupConfiguration();
  DSAWorldCalendar.init();
  DPS.initDoorMinDistance();
  mergeObject(CONFIG.JournalEntry.noteIcons, DSA5.noteIcons);

  DSA5SoundEffect.prepareSoundEffects();

  let style = game.settings.get('dsa5', 'globalStyle');
  if (!DSA5.styles[style]) style = Object.keys(DSA5.styles)[0];
  $('body').addClass(style);
});

Hooks.once('setup', () => {
  if (!['de', 'en'].includes(game.i18n.lang)) {
    console.warn(`DSA5 - ${game.i18n.lang} is not a supported language. Falling back to default language.`);
    showForbiddenLanguageDialog();
  } else {
    const forceLanguage = game.settings.get('dsa5', 'forceLanguage');
    if (['de', 'en'].includes(forceLanguage) && game.i18n.lang != forceLanguage) showWrongLanguageDialog(forceLanguage);
  }

  BookWizard.initHook();
  initKeybindings.default();
  MastersMenu.registerButtons();
  SelectUserDialog.registerButtons();

  CONFIG.Canvas.lightAnimations.daylight = {
    label: 'LIGHT.daylight',
    illuminationShader: DaylightIlluminationShader,
  };

  AdvantageRulesDSA5.setupFunctions();
  SpecialabilityRulesDSA5.setupFunctions();
});

Hooks.once('i18nInit', () => {
  setupKnownEquipmentModifiers();
  
  game.dsa5.itemLibrary = new DSA5ItemLibrary();
});

class ForbiddenLanguageDialog extends foundry.applications.api.DialogV2 {
  async close(options = {}) {
    if (!['de', 'en'].includes(game.i18n.lang)) return;

    return super.close(options);
  }
}

const showForbiddenLanguageDialog = () => {
  new ForbiddenLanguageDialog({
    window: {
      title: 'language',
    },
    content: `<p>Your foundry language is not supported by this system. Due to technical reasons your foundry language setting has to be switched to either english or german.</p>`,
    buttons: [
      {
        action: 'de',
        icon: 'fa fa-check',
        label: 'en',
        callback: async () => {
          await game.settings.set('core', 'language', 'de');
          foundry.utils.debouncedReload();
        },
      },
      {
        action: 'en',
        icon: 'fas fa-check',
        label: 'de',
        callback: async () => {
          await game.settings.set('core', 'language', 'en');
          foundry.utils.debouncedReload();
        },
      },
      {
        action: 'logout',
        icon: 'fas fa-door-closed',
        label: 'SETTINGS.Logout',
        callback: async () => {
          ui.menu.items.logout.onClick();
        },
      },
    ],
  }).render(true);
};

const showWrongLanguageDialog = (forceLanguage) => {
  new foundry.applications.api.DialogV2({
    window: {
      title: 'DSASETTINGS.forceLanguage',
    },
    content: `<p>${game.i18n.format('DSAError.wrongLanguage', { lang: forceLanguage })}</p>`,
    buttons: [
      {
        action: 'ok',
        icon: 'fa fa-check',
        label: 'ok',
        callback: async () => {
          await game.settings.set('core', 'language', forceLanguage);
          foundry.utils.debouncedReload();
        },
      },
      {
        action: 'cancel',
        icon: 'fas fa-times',
        label: 'cancel',
      },
    ],
  }).render(true);
};

function setupKnownEquipmentModifiers() {
  game.dsa5.config.knownShortcuts = {
    [game.i18n.localize('CHARAbbrev.INI').toLowerCase()]: ['status', 'initiative', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.GS').toLowerCase()]: ['status', 'speed', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.AsP').toLowerCase()]: ['status', 'astralenergy', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.LeP').toLowerCase()]: ['status', 'wounds', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.KaP').toLowerCase()]: ['status', 'karmaenergy', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.AW').toLowerCase()]: ['status', 'dodge', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.SK').toLowerCase()]: ['status', 'soulpower', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.ZK').toLowerCase()]: ['status', 'toughness', 'gearmodifier'],
    [game.i18n.localize('CHARAbbrev.FtP').toLowerCase()]: ['status', 'fatePoints', 'gearmodifier'],
  };
  for (const k of Object.keys(DSA5.characteristics)) {
    game.dsa5.config.knownShortcuts[game.i18n.localize(`CHARAbbrev.${k.toUpperCase()}`).toLowerCase()] = ['characteristics', k.toLowerCase(), 'gearmodifier'];
  }
}

class DaylightIlluminationShader extends foundry.canvas.rendering.shaders.AdaptiveIlluminationShader {
  static fragmentShader = `
    ${this.SHADER_HEADER}
    ${this.PERCEIVED_BRIGHTNESS}

    void main() {
        ${this.FRAGMENT_BEGIN}
        ${this.TRANSITION}

        // Darkness
        framebufferColor = max(framebufferColor, colorBackground);
        // Elevation
        finalColor = mix(finalColor, max(finalColor, smoothstep( 0.1, 1.0, finalColor ) * 10.0), 1.0) * depth;
        // Final
        gl_FragColor = vec4(finalColor, 1.0);
      }`;
}
