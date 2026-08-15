import DSA5 from '../config/config-dsa5.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import DSA5Skin from '../system/helpers/skin-dsa5.js';
import { showPatchViewer } from '../system/maintenance/migrator.js';
import { FormAppv2 } from '../actor/formapp.js';
import { DSAWorldCalendar } from '../system/calendar/calendar.js';
import NavalHouseRules, { NavalHouseRulesMenu } from '../combat/mkr/naval-house-rules.js';
const { duplicate, mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { NEEDS_MIGRATION_VERSION } = DSA5;

export function setupConfiguration() {
  const moneyChoices = () => {
    const moneyChoices = {};
    for (const pack of game.packs) {
      if (pack.metadata.type == 'Item' && pack.index.some((x) => x.type == 'money')) moneyChoices[pack.metadata.id] = pack.metadata.id;
    }
    return moneyChoices;
  };
  const settings = {
    tabsOutsideSheet: {
      name: 'DSASETTINGS.tabsOutsideSheet',
      hint: 'DSASETTINGS.tabsOutsideSheetHint',
      scope: 'client',
      config: true,
      default: true,
      type: Boolean,
      requiresReload: true,
    },
    summoningRollChooser: {
      name: 'DSASETTINGS.summoningRollChooser',
      hint: 'DSASETTINGS.summoningRollChooserHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    meleeBotchTableEnabled: {
      name: 'DSASETTINGS.meleeBotchTableEnabled',
      hint: 'DSASETTINGS.meleeBotchTableEnabledHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    rangeBotchTableEnabled: {
      name: 'DSASETTINGS.rangeBotchTableEnabled',
      hint: 'DSASETTINGS.rangeBotchTableEnabledHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    applyDamageInChat: {
      name: 'DSASETTINGS.applyDamageInChat',
      hint: 'DSASETTINGS.applyDamageInChatHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    hideSpellDetails: {
      name: 'DSASETTINGS.hideSpellDetails',
      hint: 'DSASETTINGS.hideSpellDetailsHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    notifyOnFadingEffects: {
      name: 'DSASETTINGS.notifyOnFadingEffects',
      hint: 'DSASETTINGS.notifyOnFadingEffectsHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    doubleDamageOptions: {
      name: 'DSASETTINGS.doubleDamageOptions',
      hint: 'DSASETTINGS.doubleDamageOptionsHint',
      scope: 'client',
      config: true,
      default: false,
      type: Boolean,
      requiresReload: true,
    },
    defenseBotchTableEnabled: {
      name: 'DSASETTINGS.defenseBotchTableEnabled',
      hint: 'DSASETTINGS.defenseBotchTableEnabledHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    higherDefense: {
      name: 'DSASETTINGS.higherDefense',
      hint: 'DSASETTINGS.higherDefenseHint',
      scope: 'world',
      config: true,
      default: '0',
      type: String,
      choices: {
        0: '0',
        2: '+2',
        4: '+4',
      },
    },
    informationDistribution: {
      name: 'DSASETTINGS.informationDistribution',
      hint: 'DSASETTINGS.informationDistributionHint',
      scope: 'world',
      config: true,
      default: '0',
      type: String,
      choices: {
        0: 'DSASETTINGS.information0',
        1: 'DSASETTINGS.information1',
        2: 'DSASETTINGS.information2',
      },
    },
    enableItemDropToCanvas: {
      name: 'DSASETTINGS.enableItemDropToCanvas',
      hint: 'DSASETTINGS.enableItemDropToCanvasHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    statusEffectCounterColor: {
      name: 'DSASETTINGS.statusEffectCounterColor',
      hint: 'DSASETTINGS.statusEffectCounterColorHint',
      scope: 'client',
      config: true,
      default: '#FFFFFF',
      type: String,
    },
    migrationVersion: {
      name: 'migrationVersion',
      scope: 'world',
      config: false,
      default: NEEDS_MIGRATION_VERSION - 1,
      type: Number,
    },
    journalFontSizeIndex: {
      name: 'journalFontSizeIndex',
      scope: 'client',
      config: false,
      default: 5,
      type: Number,
    },
    itemLibraryListFontSizeIndex: {
      name: 'itemLibraryListFontSizeIndex',
      scope: 'client',
      config: false,
      default: 0,
      type: Number,
    },
    firstTimeStart: {
      name: 'firstTimeStart',
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },
    welcomeAppDismissedVersion: {
      name: 'welcomeAppDismissedVersion',
      scope: 'client',
      config: false,
      default: 0,
      type: Number,
    },
    defaultConfigFinished: {
      name: 'defaultConfigFinished',
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },
    dsaTokenRuler: {
      name: 'DSASETTINGS.dsaTokenRuler',
      hint: 'DSASETTINGS.dsaTokenRulerHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    tokenizerSetup: {
      name: 'tokenizerSetup',
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },
    diceSetup: {
      name: 'diceSetup',
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },
    capQSat: {
      name: 'DSASETTINGS.capQSat',
      hint: 'DSASETTINGS.capQSatHint',
      scope: 'world',
      config: true,
      default: 6,
      type: Number,
    },
    hideEffects: {
      name: 'DSASETTINGS.hideEffects',
      hint: 'DSASETTINGS.hideEffectsHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    inventorySound: {
      name: 'DSASETTINGS.inventorySound',
      hint: 'DSASETTINGS.inventorySoundHint',
      scope: 'client',
      config: true,
      default: true,
      type: Boolean,
    },
    talentModifierEnabled: {
      name: 'DSASETTINGS.talentModifierEnabled',
      hint: 'DSASETTINGS.talentModifierEnabledHint',
      scope: 'client',
      config: true,
      default: false,
      type: Boolean,
    },
    noConfirmationRoll: {
      name: 'DSASETTINGS.noConfirmationRoll',
      hint: 'DSASETTINGS.noConfirmationRollHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    lessRegeneration: {
      name: 'DSASETTINGS.lessRegeneration',
      hint: 'DSASETTINGS.lessRegenerationHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    limitCombatSpecAbs: {
      name: 'DSASETTINGS.limitCombatSpecAbs',
      hint: 'DSASETTINGS.limitCombatSpecAbsHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    allowPhysicalDice: {
      name: 'DSASETTINGS.allowPhysicalDice',
      hint: 'DSASETTINGS.allowPhysicalDiceHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    enablePauseIcon: {
      name: 'DSASETTINGS.enablePauseIcon',
      hint: 'DSASETTINGS.enablePauseIconHint',
      scope: 'client',
      config: true,
      default: true,
      type: Boolean,
    },
    enableWeaponAdvantages: {
      name: 'DSASETTINGS.enableWeaponAdvantages',
      hint: 'DSASETTINGS.enableWeaponAdvantagesHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    hideOpposedDamageSelect: {
      name: 'DSASETTINGS.hideOpposedDamageSelect',
      hint: 'DSASETTINGS.hideOpposedDamageSelectHint',
      scope: 'world',
      config: true,
      default: 0,
      type: Number,
      choices: {
        0: 'hideOpposedOptions.0',
        1: 'hideOpposedOptions.1',
        2: 'hideOpposedOptions.2',
      },
    },
    enableForeignSpellModifer: {
      name: 'DSASETTINGS.enableForeignSpellModifer',
      hint: 'DSASETTINGS.enableForeignSpellModiferHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    enableWitchSpellPreferences: {
      name: 'DSASETTINGS.enableWitchSpellPreferences',
      hint: 'DSASETTINGS.enableWitchSpellPreferencesHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    playerCanEditSpellMacro: {
      name: 'DSASETTINGS.playerCanEditSpellMacro',
      hint: 'DSASETTINGS.playerCanEditSpellMacroHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    enableDPS: {
      name: 'DSASETTINGS.enableDPS',
      hint: 'DSASETTINGS.enableDPSHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    attackFromBehindAngle: {
      name: 'DSASETTINGS.attackFromBehindAngle',
      hint: 'DSASETTINGS.attackFromBehindAngleHint',
      scope: 'world',
      config: false,
      default: 100,
      type: Number,
      range: {
        min: 0,
        max: 360,
        step: 5,
      },
    },
    iniTrackerSize: {
      name: 'DSASETTINGS.iniTrackerSize',
      hint: 'DSASETTINGS.iniTrackerSizeHint',
      scope: 'client',
      config: true,
      default: 70,
      type: Number,
      range: {
        min: 30,
        max: 140,
        step: 5,
      },
    },
    iniTrackerCount: {
      name: 'DSASETTINGS.iniTrackerCount',
      hint: 'DSASETTINGS.iniTrackerCountHint',
      scope: 'client',
      config: true,
      default: 5,
      type: Number,
      range: {
        min: 3,
        max: 25,
        step: 1,
      },
      onChange: async (val) => {
        if (game.dsa5.apps.initTracker && game.combat) game.dsa5.apps.initTracker.render({ force: true });
      },
    },
    tokenhotbarSize: {
      name: 'DSASETTINGS.tokenhotbarSize',
      hint: 'DSASETTINGS.tokenhotbarSizeHint',
      scope: 'client',
      config: false,
      default: 35,
      type: Number,
      range: {
        min: 15,
        max: 100,
        step: 5,
      },
      onChange: () => {
        game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar(undefined, true);
      },
    },
    tokenhotbarLayout: {
      name: 'DSASETTINGS.tokenhotbarLayout',
      hint: 'DSASETTINGS.tokenhotbarLayoutHint',
      scope: 'client',
      config: false,
      default: 0,
      type: Number,
      choices: {
        0: 'DSASETTINGS.tokenhotbarLayout0',
        1: 'DSASETTINGS.tokenhotbarLayout1',
        2: 'DSASETTINGS.tokenhotbarLayout2',
        3: 'DSASETTINGS.tokenhotbarLayout3',
      },
      onChange: async (val) => {
        game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar(undefined, true);
      },
    },
    calendar: {
      name: 'DSASETTINGS.calendar',
      hint: 'DSASETTINGS.calendarHint',
      scope: 'world',
      config: true,
      default: 'default',
      requiresReload: true,
      type: new foundry.data.fields.StringField({ choices: DSAWorldCalendar.collectCalendars(), required: true }),
    },
    calendarSettings: {
      name: 'DSASETTINGS.calendarSettings',
      scope: 'world',
      config: false,
      default: {
        "dawn": 5,
        "morning": 7,
        "noon": 11,
        "afternoon": 16,
        "sunset": 19,
        "night": 21,
        "lightByDayTime": false,
        "moonAddsLight": false,
        'autoDayTimes': false,
        "use24HourFormat": false,
        "moon": {
          "darknessAdjust": 0.15,
        },
        "dayDarknessAdjust": {
          "dawn": 0.55,
          "morning": 0.2,
          "noon": 0,
          "afternoon": 0,
          "sunset": 0.55,
          "night": 0.95,
        }
      },
      type: Object,
    },
    calendarJournals: {
      name: 'DSASETTINGS.calendarJournals',
      scope: 'world',
      config: false,
      default: {
        activated: []
      },
      type: Object,
    },
    calendarActors: {
      name: 'DSASETTINGS.calendarActors',
      scope: 'world',
      config: false,
      default: {
        activated: []
      },
      type: Object,
    },
    questlogJournals: {
      name: 'DSASETTINGS.questlogJournals',
      scope: 'world',
      config: false,
      default: {
        activated: []
      },
      type: Object,
    },
    calendarFeatureVisibility: {
      name: 'DSASETTINGS.calendarFeatureVisibility',
      scope: 'world',
      config: false,
      default: {
        calendar: true,
        events: true,
        personae: true,
        questlog: true,
      },
      type: Object,
    },
    calendarPlayerDateVisibility: {
      name: 'DSASETTINGS.calendarPlayerDateVisibility',
      scope: 'world',
      config: false,
      default: 'exact',
      type: String,
    },
    moneyKompendium: {
      name: 'DSASETTINGS.moneyKompendium',
      hint: 'DSASETTINGS.moneyKompendiumHint',
      scope: 'world',
      config: true,
      default: '',
      type: new foundry.data.fields.StringField({ choices: moneyChoices }),
      onChange: async (val) => {
        const pack = game.packs.get(val);
        if (!pack) return;

        ui.notifications.info(
          pack.index
            .filter((x) => x.type == 'money')
            .map((x) => x.name)
            .join(', '),
        );
      },
    },
    moneyHasWeight: {
      name: 'DSASETTINGS.moneyHasWeight',
      hint: 'DSASETTINGS.moneyHasWeightHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
      requiresReload: true,
    },
    globalStyle: {
      name: 'DSASETTINGS.globalStyle',
      hint: 'DSASETTINGS.globalStyleHint',
      scope: 'client',
      config: true,
      default: 'dsa5-immersive',
      type: new foundry.data.fields.StringField({
        choices: () => DSA5Skin.getSettingChoices(),
        required: true,
      }),
      onChange: async (val) => {
        DSA5Skin.applyBodyClasses(val);
        if (!DSA5Skin.isValidCombination(val)) await DSA5Skin.promptFixCombination();
      },
    },
    selfControlOnPain: {
      name: 'DSASETTINGS.selfControlOnPain',
      hint: 'DSASETTINGS.selfControlOnPainHint',
      scope: 'world',
      config: true,
      default: 1,
      type: Number,
      choices: {
        0: 'DSASETTINGS.selfControlOnPain0',
        1: 'DSASETTINGS.selfControlOnPain1',
        2: 'DSASETTINGS.selfControlOnPain2',
      },
    },
    forceLanguage: {
      name: 'DSASETTINGS.forceLanguage',
      hint: 'DSASETTINGS.forceLanguageHint',
      scope: 'world',
      config: true,
      default: 'none',
      type: String,
      choices: {
        none: '-',
        de: 'German',
        en: 'English',
      },
    },
    hotbarv3: {
      name: 'DSASETTINGS.hotbarv3',
      hint: 'DSASETTINGS.hotbarv3Hint',
      scope: 'client',
      config: false,
      default: true,
      type: Boolean,
      onChange: () => {
        ui.hotbar.render(true);
      },
    },
    hotbarSortMode: {
      name: 'DSA5HOTBARCONFIG.sortMode',
      hint: 'DSA5HOTBARCONFIG.sortModeHint',
      scope: 'client',
      config: false,
      default: 'groupAlpha',
      type: String,
      onChange: () => {
        ui.hotbar.render(true);
      },
    },
    libraryModulsFilter: {
      name: 'libraryModulsFilter',
      scope: 'client',
      config: false,
      default: {},
      type: Object,
    },
    tokenhotbarPosition: {
      name: 'tokenhotbarPosition',
      scope: 'client',
      config: false,
      default: {},
      type: Object,
    },
    masterSettings: {
      name: 'masterSettings',
      scope: 'world',
      config: false,
      default: {},
      type: Object,
    },
    iniTrackerPosition: {
      name: 'iniTrackerPosition',
      scope: 'client',
      config: false,
      default: {},
      type: Object,
    },
    soundConfig: {
      name: 'DSASETTINGS.soundConfig',
      hint: 'DSASETTINGS.soundConfigHint',
      scope: 'world',
      config: true,
      default: '',
      type: String,
      onChange: async () => {
        DSA5SoundEffect.loadSoundConfig();
      },
    },
    [`breadcrumbs_${game.world.id}`]: {
      name: 'DSASETTINGS.breadcrumbs',
      hint: 'DSASETTINGS.breadcrumbsHint',
      scope: 'client',
      config: false,
      default: '',
      type: String,
    },
    [`recentBooks_${game.world.id}`]: {
      scope: 'client',
      config: false,
      default: '[]',
      type: String,
    },
    journalBrowserViewMode: {
      scope: 'client',
      config: false,
      default: 'list',
      type: String,
    },
    groupschips: {
      name: 'DSASETTINGS.groupschips',
      hint: 'DSASETTINGS.groupschips',
      scope: 'world',
      config: false,
      default: '0/0',
      type: String,
      onChange: async () => {
        if (game.user.isGM) game.dsa5.apps.gameMasterMenu.render();
      },
    },
    expandChatModifierlist: {
      name: 'DSASETTINGS.expandChatModifierlist',
      hint: 'DSASETTINGS.expandChatModifierlistHint',
      scope: 'client',
      config: true,
      default: false,
      type: Boolean,
    },
    indexWorldItems: {
      name: 'DSASETTINGS.indexWorldItems',
      scope: 'client',
      config: false,
      default: true,
      type: Boolean,
    },
    libraryIndexLoadMode: {
      name: 'DSASETTINGS.libraryIndexLoadMode',
      hint: 'DSASETTINGS.libraryIndexLoadModeHint',
      scope: 'client',
      config: true,
      default: 'bulk',
      type: String,
      choices: {
        bulk: 'DSASETTINGS.libraryIndexLoadModeBulk',
        chunked: 'DSASETTINGS.libraryIndexLoadModeChunked',
      },
    },
    filterDuplicateItems: {
      name: 'DSASETTINGS.filterDuplicateItems',
      scope: 'client',
      config: false,
      default: false,
      type: Boolean,
    },
    itemLibraryViewMode: {
      name: 'DSASETTINGS.itemLibraryViewMode',
      scope: 'client',
      config: false,
      default: 'list',
      type: String,
    },
    chargenDisplayMode: {
      name: 'CHARGEN.displayModeSetting',
      scope: 'client',
      config: false,
      default: 'fullscreen',
      type: String,
    },
    chargenUtilityWidth: {
      scope: 'client',
      config: false,
      default: 380,
      type: Number,
    },
    eventsViewMode: {
      name: 'DSASETTINGS.eventsViewMode',
      scope: 'client',
      config: false,
      default: 'timeline',
      type: String,
    },
    questlogFilterOpenOnly: {
      name: 'DSAQUESTLOG.filterOpenOnly',
      scope: 'client',
      config: false,
      default: false,
      type: Boolean,
    },
    enableCombatFlow: {
      name: 'DSASETTINGS.enableCombatFlow',
      hint: 'DSASETTINGS.enableCombatFlowHint',
      scope: 'client',
      config: true,
      default: true,
      type: Boolean,
      onchange: () => {
        if (game.dsa5.apps.initTracker) {
          game.dsa5.apps.initTracker.close();
          game.dsa5.apps.initTracker = undefined;
        }
      },
    },
    enableCombatPan: {
      name: 'DSASETTINGS.enableCombatPan',
      hint: 'DSASETTINGS.enableCombatPanHint',
      scope: 'client',
      config: true,
      default: true,
      type: Boolean,
    },
    enableAPTracking: {
      name: 'DSASETTINGS.enableAPTracking',
      hint: 'DSASETTINGS.enableAPTrackingHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    enableMoneyTracking: {
      name: 'DSASETTINGS.enableMoneyTracking',
      hint: 'DSASETTINGS.enableMoneyTrackingHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    sightAutomationEnabled: {
      name: 'sightAutomationEnabled',
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },
    lightSightCompensationEnabled: {
      name: 'lightSightCompensationEnabled',
      scope: 'world',
      config: false,
      default: false,
      type: Boolean,
    },
    randomWeaponSelection: {
      name: 'DSASETTINGS.randomWeaponSelection',
      hint: 'DSASETTINGS.randomWeaponSelectionHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    showWeaponsOnHover: {
      name: 'DSASETTINGS.showWeaponsOnHover',
      hint: 'DSASETTINGS.showWeaponsOnHoverHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    disableDidYouKnow: {
      name: 'DSASETTINGS.disableDidYouKnow',
      hint: 'DSASETTINGS.disableDidYouKnowHint',
      scope: 'client',
      config: true,
      default: false,
      type: Boolean,
    },
    hideJournalBrowserFreeModules: {
      name: 'DSASETTINGS.hideJournalBrowserFreeModules',
      hint: 'DSASETTINGS.hideJournalBrowserFreeModulesHint',
      scope: 'client',
      config: true,
      default: false,
      type: Boolean,
    },
    disableTokenhotbar: {
      name: 'DSASETTINGS.disableTokenhotbar',
      hint: 'DSASETTINGS.disableTokenhotbarHint',
      scope: 'client',
      config: false,
      default: true,
      type: Boolean,
      onChange: (val) => {
        if (val) game.dsa5.apps.tokenHotbar?.close();
        else game.dsa5.apps.tokenHotbar?.render(true);
      },
    },
    disableTokenhotbarMaster: {
      name: 'DSASETTINGS.disableTokenhotbarMaster',
      hint: 'DSASETTINGS.disableTokenhotbarMasterHint',
      scope: 'client',
      config: false,
      default: false,
      type: Boolean,
      onChange: () => {
        game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar(undefined, true);
      },
    },
    masterCanvasControls: {
      name: 'DSASETTINGS.masterCanvasControls',
      hint: 'DSASETTINGS.masterCanvasControls',
      scope: 'client',
      config: false,
      default: false,
      type: Boolean,
    },
    scrollingFontsize: {
      name: 'DSASETTINGS.scrollingFontsize',
      hint: 'DSASETTINGS.scrollingFontsizeHint',
      scope: 'client',
      config: true,
      default: 16,
      type: Number,
      range: {
        min: 6,
        max: 50,
        step: 1,
      },
    },
    tokenhotbaropacity: {
      name: 'DSASETTINGS.tokenhotbaropacity',
      hint: 'DSASETTINGS.tokenhotbaropacityHint',
      scope: 'client',
      config: false,
      default: 0.75,
      type: Number,
      range: {
        min: 0,
        max: 1,
        step: 0.05,
      },
      onChange: () => {
        game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar(undefined, true);
      },
    },
    armorAndWeaponDamage: {
      name: 'DSASETTINGS.armorAndWeaponDamage',
      hint: 'DSASETTINGS.armorAndWeaponDamageHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    hideRegenerationToOwner: {
      name: 'DSASETTINGS.hideRegenerationToOwner',
      hint: 'DSASETTINGS.hideRegenerationToOwnerHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    magischeHandlungen: {
      name: 'DSASETTINGS.magischeHandlungen',
      hint: 'DSASETTINGS.magischeHandlungenHint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean,
    },
    indexDescription: {
      name: 'DSASETTINGS.indexDescription',
      scope: 'client',
      config: false,
      default: true,
      type: Boolean,
    },
    encumbranceForRange: {
      name: 'DSASETTINGS.encumbranceForRange',
      hint: 'DSASETTINGS.encumbranceForRangeHint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
    },
    obfuscateTokenNames: {
      name: 'DSASETTINGS.obfuscateTokenNames',
      hint: 'DSASETTINGS.obfuscateTokenNamesHint',
      scope: 'world',
      config: true,
      default: '0',
      type: String,
      choices: {
        0: 'no',
        1: 'DSASETTINGS.yesNumbered',
        2: 'DSASETTINGS.renameNumbered',
        3: 'yes',
        4: 'DSASETTINGS.rename',
      },
    },
    merchantNotification: {
      name: 'DSASETTINGS.merchantNotification',
      hint: 'DSASETTINGS.merchantNotificationHint',
      scope: 'world',
      config: true,
      default: '2',
      type: String,
      choices: {
        0: 'no',
        1: 'yes',
        2: 'MERCHANT.onlyGM',
      },
    },
    sightOptions: {
      name: 'sightOptions',
      scope: 'world',
      config: false,
      default: '0.5|0.7|0.85|0.95',
      type: String,
    },
    trackedActors: {
      name: 'trackedActors',
      scope: 'world',
      config: false,
      default: {},
      type: Object,
    },
    enableMasterTokenFunctions: {
      name: 'enableMasterTokenFunctions',
      scope: 'world',
      config: false,
      default: {},
      type: Object,
      onChange: () => {
        game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar(undefined, true);
      },
    },
    selectedActors: {
      name: 'selectedActors',
      scope: 'world',
      config: false,
      default: {},
      type: Object,
    },
    expansionPermissions: {
      name: 'expansionPermissions',
      scope: 'world',
      config: false,
      default: {},
      type: Object,
    },
    journalBrowserCustomBooks: {
      scope: 'world',
      config: false,
      default: [],
      type: Array,
    },
    primaryParty: {
      name: 'primaryParty',
      scope: 'world',
      config: false,
      default: '',
      type: String,
    }
  };
  NavalHouseRules.registerSettings(settings);
  for (const [key, value] of Object.entries(settings)) {
    game.settings.register('dsa5', key, value);
  }

  const menus = {
    changelog: {
      name: 'Changelog',
      label: 'Changelog',
      hint: 'DSASETTINGS.changelog',
      type: ChangelogForm,
      restricted: false,
    },
    navalHouseRules: {
      name: 'VEHICLE.houseRules.menu',
      label: 'VEHICLE.houseRules.menu',
      hint: 'VEHICLE.houseRules.menuHint',
      type: NavalHouseRulesMenu,
      restricted: true,
    },
    exportConfiguration: {
      name: 'Export/Import Configuration',
      label: 'Export/Import Configuration',
      hint: 'DSASETTINGS.exportConfiguration',
      type: ExportForm,
      restricted: true,
    },
    configureTokenbar: {
      name: 'DSASETTINGS.configureTokenbar',
      label: 'DSASETTINGS.configureTokenbar',
      hint: 'DSASETTINGS.configureTokenbarHint',
      type: ConfigureTokenHotbar,
      restricted: false,
    },
  }
  for (const [key, value] of Object.entries(menus)) {
    game.settings.registerMenu('dsa5', key, value);
  }
}

const exportSetting = (form) => {
  let toExport = Array.from(game.settings.settings);
  const exportOnlyDSA = form.elements.exportOnlyDSA.checked;

  if (exportOnlyDSA) toExport = toExport.filter((x) => /^dsa5\./.test(x[0]));

  const exportData = {};
  const skipSettings = /(^dsa5\.(selectedActors|trackedActors|groupschips|tokenhotbarPosition|iniTrackerPosition|migrationVersion)$|^dsa5\.(breadcrumbs_|recentBooks_))/;

  for (const key of toExport) {
    if (skipSettings.test(key[0])) continue;

    const keys = key[0].split('.');
    const scope = keys.shift();
    const setting = keys.join('.');

    exportData[key[0]] = game.settings.get(scope, setting);
  }
  const filename = `fvtt-DSA5-Configuration.json`;

  saveDataToFile(JSON.stringify(exportData, null, 2), 'text/json', filename);
};

const importSettings = async (form) => {
  if (!form.data.files.length) return ui.notifications?.error('You did not upload a data file!');

  readTextFromFile(form.data.files[0]).then(async (data) => {
    const json = JSON.parse(data);
    const availableKeys = Array.from(game.settings.settings).map((x) => x[0]);
    for (const key of Object.keys(json)) {
      if (availableKeys.includes(key)) {
        const keys = key.split('.');
        const scope = keys.shift();
        const setting = keys.join('.');
        await game.settings.set(scope, setting, json[key]);
      }
    }
    game.settings.sheet.render(true);
  });
};

class ChangelogForm extends FormAppv2 {
  render() {
    showPatchViewer();
  }
}

class ExportForm extends FormAppv2 {
  async render() {
    const content = await renderTemplate('systems/dsa5/templates/dialog/exportConfiguration-dialog.hbs', {});
    new foundry.applications.api.DialogV2({
      window: {
        title: 'Export configuration',
      },
      content,
      buttons: [
        {
          action: 'export',
          icon: 'fa fa-check',
          label: 'Export',
          callback: (event, button, dialog) => {
            exportSetting(button.form);
          },
        },
        {
          action: 'import',
          icon: 'fas fa-check',
          label: 'Import',
          callback: (event, button, dialog) => {
            importSettings(button.form);
          },
        },
      ],
    }).render(true);
  }
}

class ConfigureTokenHotbar extends FormAppv2 {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'DSASETTINGS.configureTokenbar',
    },
    position: {
      width: 600,
    },
    actions: {
      resetTokenHotbar: this.resetTokenHotbar,
      masterFunction: this._onMasterFunctionClicked,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/configureTokenhotbar.hbs',
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('select, input, range-picker').on('change', async (ev) => {
      if (!ev.currentTarget.name) return;

      const name = ev.currentTarget.name.split('.');
      let val = ev.currentTarget.value;
      if (ev.currentTarget.type == 'checkbox') val = ev.currentTarget.checked;

      await game.settings.set(name[0], name[1], val);
      this.render();
    });
  }

  static async _onMasterFunctionClicked(ev, target) {
    const id = target.dataset.id;
    const setting = game.settings.get('dsa5', 'enableMasterTokenFunctions');
    setting[id] = !setting[id];
    $(target).toggleClass('deactivated', setting[id]);
    game.dsa5.apps.tokenHotbar.gmItems.find((x) => x.id == id).disabled = setting[id];
    await game.settings.set('dsa5', 'enableMasterTokenFunctions', setting);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    mergeObject(data, {
      tokenhotbarSize: game.settings.get('dsa5', 'tokenhotbarSize'),
      tokenhotbarLayout: game.settings.get('dsa5', 'tokenhotbarLayout'),
      disableTokenhotbarMaster: game.settings.get('dsa5', 'disableTokenhotbarMaster'),
      disableTokenhotbar: game.settings.get('dsa5', 'disableTokenhotbar'),
      tokenhotbaropacity: game.settings.get('dsa5', 'tokenhotbaropacity'),
      masterCanvasControls: game.settings.get('dsa5', 'masterCanvasControls'),
      hotbarv3: game.settings.get('dsa5', 'hotbarv3'),
      isGM: game.user.isGM,
      gmButtons: game.dsa5.apps.tokenHotbar?.gmItems,
      layoutChoices: game.settings.settings.get('dsa5.tokenhotbarLayout').choices,
    });
    return data;
  }

  static async resetTokenHotbar(event, target) {
    await game.settings.set('dsa5', 'tokenhotbarPosition', {});
    await game.settings.set('dsa5', 'tokenhotbarLayout', 0);
    await game.settings.set('dsa5', 'tokenhotbarSize', 35);
    game.dsa5.apps.tokenHotbar?.resetPosition();
    game.dsa5.apps.tokenHotbar?.render(true);
  }
}
