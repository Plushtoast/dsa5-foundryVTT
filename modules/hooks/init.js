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
import '../system/helpers/situational-modifiers-widget.js';
import { BurgerMenuRegistry } from '../item/burgermenus/burger-menu-registry.js';
import { registerMagicalActionHooks } from '../item/magical-actions/magical-action-registry.js';
import { MagicalAlchemistDSA5 } from '../item/concerns/alchimist-dsa5.js';
import { SavantDSA5 } from '../item/concerns/savant-dsa5.js';
import ActiveEffectLifecycle from '../status/activeEffectLifecycle.js';

import ActorSheetdsa5Character from './../actor/character-sheet.js';
import ActorSheetdsa5Creature from './../actor/creature-sheet.js';
import ActorSheetdsa5NPC from './../actor/npc-sheet.js';
import ActorSheetdsa5Vehicle from './../actor/vehicle-sheet.js';
import VehicleMerchantSheetDSA5 from '../actor/vehicle-merchant-sheet.js';
import ItemSheetdsa5 from './../item/item-sheet.js';
import MerchantSheetDSA5 from '../actor/merchant-sheet.js';
import BookWizard from '../wizards/adventure_wizard.js';
import MastersMenu from '../wizards/masters_menu.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effect_config.js';
import DSAEnhancementEffectConfig from '../status/enhancement_effect_config.js';
import CreatureMerchantSheetDSA5 from '../actor/creature-merchant-sheet.js';
import CharacterMerchantSheetDSA5 from '../actor/character-merchant-sheet.js';
import GroupActorSheet from '../actor/group-sheet.js';
import DPS from '../system/automation/derepositioningsystem.js';
import { SelectUserDialog } from '../dialog/addTargetDialog.js';
import DSAJournalSheet from '../journal/dsa_journal_sheet.js';
import DSA5 from '../config/config-dsa5.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import DSA5Skin from '../system/helpers/skin-dsa5.js';
import { setActorDelta } from './actordelta.js';
import DSA5ItemLibrary, { LibraryModulsFilter } from '../system/guiapps/itemlibrary.js';
import { DSAWorldCalendar } from '../system/calendar/calendar.js';

import { DSACalendarEntrySheet } from '../journal/dsacalendarentry_sheet.js';
import { DSAPersonaeEntrySheet } from '../journal/dsadramatispersonaeentry_sheet.js';
import { DSAQuestLogEntrySheet } from '../journal/dsaquestlogentry_sheet.js';
import { DSAAPTrackerEntrySheet } from '../journal/dsaaptrackerentry_sheet.js';
import { DSAMoneyTrackerEntrySheet } from '../journal/dsamoneytrackerentry_sheet.js';
import { DSACityDetailsEntrySheet } from '../journal/dsacitydetailsentry_sheet.js';
const { mergeObject } = foundry.utils;
const { DocumentSheetConfig } = foundry.applications.apps;

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
  BurgerMenuRegistry.registerHooks();
  registerMagicalActionHooks();
  MagicalAlchemistDSA5.registerHooks();
  SavantDSA5.registerHooks();
  ActiveEffectLifecycle.registerHooks();
}

Hooks.once('init', () => {
  foundry.applications.handlebars.loadTemplates([
    'systems/dsa5/templates/dialog/default-dialog.hbs',
    'systems/dsa5/templates/dialog/parts/targets.hbs',
    'systems/dsa5/templates/dialog/enhanced-default-dialog.hbs',
    'systems/dsa5/templates/dialog/default-combat-dialog.hbs',
    'systems/dsa5/templates/chat/roll/test-card.hbs',
    'systems/dsa5/templates/chat/roll/parts/roll-request-row-identity.hbs',
    'systems/dsa5/templates/dialog/parts/spellmodifiers.hbs',
    'systems/dsa5/templates/dialog/parts/canChangeCastingTime.hbs',
    'systems/dsa5/templates/actors/parts/schipspart.hbs',
    'systems/dsa5/templates/actors/parts/characteristics-large.hbs',
    'systems/dsa5/templates/actors/parts/containerContent.hbs',
    'systems/dsa5/templates/actors/parts/creature-derived-attributes-small.hbs',
    'systems/dsa5/templates/actors/parts/creature-derived-attributes-large.hbs',
    'systems/dsa5/templates/actors/parts/status_effects.hbs',
    'systems/dsa5/templates/actors/parts/purse.hbs',
    'systems/dsa5/templates/actors/parts/skillselect.hbs',
    'systems/dsa5/templates/actors/parts/combat_weapon.hbs',
    'systems/dsa5/templates/actors/parts/combat_rangeweapon.hbs',
    'systems/dsa5/templates/actors/parts/horse.hbs',
    'systems/dsa5/templates/actors/merchant/merchant-permission-part.hbs',
    'systems/dsa5/templates/actors/parts/healthbar.hbs',
    'systems/dsa5/templates/items/traditionArtifact.hbs',
    'systems/dsa5/templates/actors/parts/tradition-items.hbs',
    'systems/dsa5/templates/status/advanced_functions.hbs',
    'systems/dsa5/templates/actors/parts/information.hbs',
    'systems/dsa5/templates/actors/parts/personaltrait.hbs',
    'systems/dsa5/templates/actors/parts/attributes.hbs',
    'systems/dsa5/templates/actors/parts/swarm.hbs',
    'systems/dsa5/templates/actors/parts/specialabilities.hbs',
    'systems/dsa5/templates/actors/parts/experienceBox.hbs',
    'systems/dsa5/templates/actors/parts/temperature.hbs',
    'systems/dsa5/templates/actors/parts/temperatureSmall.hbs',
    'systems/dsa5/templates/dialog/parts/actor-picker-row.hbs',
    'systems/dsa5/templates/dialog/parts/actor-picker-list.hbs',
    'systems/dsa5/templates/items/browse/actor.hbs',
    'systems/dsa5/templates/items/browse/garadan.hbs',
    'systems/dsa5/templates/items/browse/vehicle-stats.hbs',
    'systems/dsa5/templates/items/browse/culture.hbs',
    'systems/dsa5/templates/items/browse/species.hbs',
    'systems/dsa5/templates/items/browse/career.hbs',
    'systems/dsa5/templates/items/meleeweapon-attack-part.hbs',
    'systems/dsa5/templates/items/rangeweapon-attack-part.hbs',
    'systems/dsa5/templates/dialog/parts/message-mode.hbs',
    'systems/dsa5/templates/dialog/parts/disposition-mode.hbs',
    'systems/dsa5/templates/dialog/parts/group-check-skill-row.hbs',
    'systems/dsa5/templates/chat/payment/batch-request.hbs',
    'systems/dsa5/templates/chat/payment/transaction-summary.hbs',
    'systems/dsa5/templates/dialog/parts/situational-modifiers-widget.hbs',
    'systems/dsa5/templates/system/hud/companion-hotbar.hbs',
    'systems/dsa5/templates/actors/parts/member-card-header.hbs',
    'systems/dsa5/templates/tables/tableCard.hbs',
    'systems/dsa5/templates/tables/opportunity-attack-card.hbs',
    'systems/dsa5/templates/tables/accidental-attack-defense-card.hbs',
    'systems/dsa5/templates/tables/gear-dropped.hbs',
  ]);

  foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);

  const actorSheets = [
    { sheetClass: ActorSheetdsa5Character, types: ['character'], makeDefault: true },
    { sheetClass: ActorSheetdsa5Creature, types: ['creature'], makeDefault: true },
    { sheetClass: ActorSheetdsa5NPC, types: ['npc'], makeDefault: true },
    { sheetClass: ActorSheetdsa5Vehicle, types: ['vehicle'], makeDefault: true },
    { sheetClass: VehicleMerchantSheetDSA5, types: ['vehicle'], canBeDefault: false },
    { sheetClass: MerchantSheetDSA5, types: ['npc'], canBeDefault: false },
    { sheetClass: CreatureMerchantSheetDSA5, types: ['creature'], canBeDefault: false },
    { sheetClass: CharacterMerchantSheetDSA5, types: ['character'], canBeDefault: false },
    { sheetClass: GroupActorSheet, types: ['group'], makeDefault: true },
  ];

  actorSheets.forEach(({ sheetClass, types, makeDefault, canBeDefault }) => {
    foundry.documents.collections.Actors.registerSheet('dsa5', sheetClass, { types, makeDefault, canBeDefault });
  });

  const journalSheets = [
    { sheetClass: DSAPersonaeEntrySheet, types: ['dsapersonaedramatis'], makeDefault: true },
    { sheetClass: DSACalendarEntrySheet, types: ['dsacalendar'], makeDefault: true },
    { sheetClass: DSAQuestLogEntrySheet, types: ['dsaquestlog'], makeDefault: true },
    { sheetClass: DSAAPTrackerEntrySheet, types: ['dsaaptracker'], makeDefault: true },
    { sheetClass: DSAMoneyTrackerEntrySheet, types: ['dsamoneytracker'], makeDefault: true },
    { sheetClass: DSACityDetailsEntrySheet, types: ['citydetails'], makeDefault: true }
  ];

  journalSheets.forEach(({ sheetClass, types, makeDefault }) => {
    DocumentSheetConfig.registerSheet(JournalEntryPage, 'dsa5', sheetClass, { types, makeDefault });
  });

  DocumentSheetConfig.unregisterSheet(ActiveEffect, "core", foundry.applications.sheets.ActiveEffectConfig)
  DocumentSheetConfig.registerSheet(ActiveEffect, 'dsa5', DSAActiveEffectConfig, { types: ['base'], makeDefault: true });
  DocumentSheetConfig.registerSheet(ActiveEffect, 'dsa5', DSAEnhancementEffectConfig, { types: ['enhancement'], makeDefault: true });

  foundry.documents.collections.Journal.registerSheet('dsa5', DSAJournalSheet, { makeDefault: true });

  ItemSheetdsa5.setupSheets();

  DSA5.baseStyles = { ...DSA5.styles };
  Hooks.call('registerDSAstyle', DSA5.styles);

  DSAWorldCalendar.prepare();
  setupConfiguration();
  DSAWorldCalendar.init();
  DPS.initDoorMinDistance();
  mergeObject(CONFIG.JournalEntry.noteIcons, DSA5.noteIcons);

  DSA5SoundEffect.prepareSoundEffects();
});

Hooks.once('setup', () => {
  DSA5Skin.registerHooks();

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

Hooks.once('i18nInit', async () => {
  setupKnownEquipmentModifiers();

  game.dsa5.itemLibrary = new DSA5ItemLibrary();
  game.dsa5.apps.LibraryModulsFilter = LibraryModulsFilter;
  const { default: ItemLibraryEmbed } = await import('../system/guiapps/itemlibrary-embed.js');
  game.dsa5.apps.ItemLibraryEmbed = ItemLibraryEmbed;

  foundry.helpers.Localization.localizeDataModel(CONFIG.RegionBehavior.dataModels.DSATrap);
  //foundry.helpers.Localization.localizeDataModel(CONFIG.JournalEntryPage.dataModels.dsacalendar);
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
    content: `<p>${_loc('DSAError.wrongLanguage', { lang: forceLanguage })}</p>`,
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
    [_loc('CHARAbbrev.INI').toLowerCase()]: ['status', 'initiative', 'gearmodifier'],
    [_loc('CHARAbbrev.GS').toLowerCase()]: ['status', 'speed', 'gearmodifier'],
    [_loc('CHARAbbrev.AsP').toLowerCase()]: ['status', 'astralenergy', 'gearmodifier'],
    [_loc('CHARAbbrev.LeP').toLowerCase()]: ['status', 'wounds', 'gearmodifier'],
    [_loc('CHARAbbrev.KaP').toLowerCase()]: ['status', 'karmaenergy', 'gearmodifier'],
    [_loc('CHARAbbrev.AW').toLowerCase()]: ['status', 'dodge', 'gearmodifier'],
    [_loc('CHARAbbrev.SK').toLowerCase()]: ['status', 'soulpower', 'gearmodifier'],
    [_loc('CHARAbbrev.ZK').toLowerCase()]: ['status', 'toughness', 'gearmodifier'],
    [_loc('CHARAbbrev.FtP').toLowerCase()]: ['status', 'fatePoints', 'gearmodifier'],
  };
  for (const k of Object.keys(DSA5.characteristics)) {
    game.dsa5.config.knownShortcuts[_loc(`CHARAbbrev.${k.toUpperCase()}`).toLowerCase()] = ['characteristics', k.toLowerCase(), 'gearmodifier'];
  }
}

class DaylightIlluminationShader extends foundry.canvas.rendering.shaders.AdaptiveIlluminationShader {
  static _createFragmentShader() {
    return `
    ${this.SHADER_HEADER}
    ${this.PERCEIVED_BRIGHTNESS}

    void main() {
        ${this.FRAGMENT_BEGIN}
        ${this.TRANSITION}

        // Darkness
        finalColor = max(finalColor, computedBackgroundColor);
        // Elevation
        finalColor = mix(finalColor, max(finalColor, smoothstep( 0.1, 1.0, finalColor ) * 10.0), 1.0) * depth;
        // Final
        gl_FragColor = vec4(finalColor, 1.0);
      }`;
  }
}
