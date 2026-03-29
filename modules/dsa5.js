import ActorSheetdsa5 from './actor/actor-sheet.js';
import ActorSheetdsa5Character from './actor/character-sheet.js';
import ActorSheetdsa5Creature from './actor/creature-sheet.js';
import ActorSheetdsa5NPC from './actor/npc-sheet.js';
import Actordsa5 from './actor/actor-dsa5.js';
import Itemdsa5 from './item/item-dsa5.js';
import ItemSheetdsa5 from './item/item-sheet.js';
import initHooks from './hooks/init.js';
import MacroDSA5 from './system/helpers/macroControl.js';
import DSA5 from './config/config-dsa5.js';
import DSA5_Utility from './system/helpers/utility-dsa5.js';
import DSA5Initializer from './system/maintenance/initializer.js';
import ChatMessageDSA5Roll from './chat/ChatMessageDSA5.js';
import DSA5ChatListeners from './system/sidebar/chat_listeners.js';
import DSA5Payment from './system/payment/payment.js';
import QueryOrchestrator from './system/queries/query-orchestrator.js';
import PaymentRequestService from './system/payment/payment-requests.js';
import TransactionSummaryService from './system/payment/transaction-summary.js';
import InformationQueryService from './system/queries/information-query.js';
import { DSA5CombatTracker } from './combat/combat_tracker.js';
import DSA5Combat from './combat/combat.js';
import DSA5Combatant from './combat/combatant.js';
import DSA5Hotbar from './system/guiapps/hotbar.js';
import RollMemory from './system/rolls/roll_memory.js';
import SpecialabilityRulesDSA5 from './system/rules/specialability-rules-dsa5.js';
import AdvantageRulesDSA5 from './system/rules/advantage-rules-dsa5.js';
import Migrakel from './system/maintenance/migrakel.js';
import DSA5Dialog from './dialog/dialog-dsa5.js';
import DPS from './system/automation/derepositioningsystem.js';
import DSATables from './tables/dsatables.js';
import DiceDSA5 from './system/rolls/dice-dsa5.js';
import DSA5StatusEffects from './status/status_effects.js';
import { MerchantSheetMixin, RandomGoodsAddition } from './actor/mixins/merchantmixin.js';
import DSATour from './tours/dsa_tour.js';
import OpposeDSA from './system/rolls/opposed-dsa5.js';
import DSAActiveEffect from './status/dsa_active_effects.js';
import EquipmentDamage from './system/automation/equipment-damage.js';
import DidYouKnow from './system/helpers/didyouknow.js';
import MerchantSheetDSA5 from './actor/merchant-sheet.js';
import { DSARegionTemplate } from './system/automation/measuretemplate.js';
import RequestRoll from './system/rolls/request-roll.js';
import Riding from './system/automation/riding.js';
import RuleChaos from './system/rules/rule_chaos.js';
import DSA5SoundEffect from './system/helpers/dsa-soundeffect.js';
import { clickableAbility, tabSlider, tinyNotification } from './system/helpers/view_helper.js';
import CareerWizard from './wizards/career_wizard.js';
import SpeciesWizard from './wizards/species_wizard.js';
import CultureWizard from './wizards/culture_wizard.js';
import { ReactToSkillDialog, ActAttackDialog, ReactToAttackDialog } from './dialog/dialog-react.js';
import DialogReactDSA5 from './dialog/dialog-react.js';
import { Trade } from './actor/trade.js';
import DSAActiveEffectConfig from './status/active_effect_config.js';
import APTracker from './system/orwell/ap-tracker.js';
import MoneyTracker from './system/orwell/money-tracker.js';
import OnUseEffect from './system/automation/onUseEffects.js';
import TestSuite from './system/helpers/testsuite.js';
import { connectTokenRing } from './hooks/tokenring.js';
import { itemModels, ActorDataModels, CombatantDataModels, CombatDataModels, ActiveEffectDataModels } from './data/models.js';
import { DSAToken, DSATokenDocument, DSATokenRuler } from './hooks/token.js';
import * as DSAPause from './hooks/pause.js';
import { CalendarWidget } from './system/calendar/calendarwidget.js';
import { DSACalendarPicker } from './system/calendar/calendarpicker.js';
import { DSACombatantGroup } from './combat/combatant_group.js';
import { DSATrapRegionBehavior } from './data/regionbehaviors/trap.js';
import { DSAAuraRegionBehavior } from './data/regionbehaviors/aura.js';
import { DSAZoneRegionBehavior } from './data/regionbehaviors/zone.js';
import { DSACalendarEntry } from './data/journal/dsacalendar.js';
import ACTORCONCERNS from './actor/concerns/module.js';
import ITEMCONCERNS from './item/concerns/module.js';
import { ItemFactory } from './item/item-factory.js';
import { DSAPersonaEntry } from './data/journal/dsapersonaedramatis.js';
import { DSAQuestLogEntry } from './data/journal/dsaquestlog.js';
import { DSAAPTrackerEntry } from './data/journal/dsaaptracker.js';
import { DSAMoneyTrackerEntry } from './data/journal/dsamoneytracker.js';
import { DSAWorldCalendar } from './system/calendar/calendar.js';
//import { DAGTalentTree } from './actor/dag/dag_talent_tree.js';

Hooks.once('init', () => {
  CONFIG.statusEffects = DSA5.statusEffects;
  game.dsa5 = {
    apps: {
      DSA5_Utility,
      DSA5Initializer,
      DSA5ChatListeners,
      DSA5Payment,
      QueryOrchestrator,
      PaymentRequestService,
      TransactionSummaryService,
      SpecialabilityRulesDSA5,
      AdvantageRulesDSA5,
      Migrakel,
      DSA5Dialog,
      DSA5StatusEffects,
      DPS,
      DSATables,
      DSA5SoundEffect,
      RequestRoll,
      DiceDSA5,
      DSATour,
      OpposeDSA,
      EquipmentDamage,
      APTracker,
      MoneyTracker,
      DidYouKnow,
      DSARegionTemplate,
      Riding,
      RuleChaos,
      Trade,
      DSAActiveEffectConfig,
      OnUseEffect,
      CalendarPicker: new DSACalendarPicker(),
      CalendarWidget: new CalendarWidget(),
      WorldCalendar: DSAWorldCalendar,
      //DAGTalentTree,
    },
    entities: {
      Actordsa5,
      Itemdsa5,
      ItemFactory,
    },
    concerns: {
      Actor: ACTORCONCERNS,
      Item: ITEMCONCERNS
    },
    sheets: {
      ActorSheetdsa5,
      ActorSheetdsa5Character,
      ActorSheetdsa5Creature,
      ActorSheetdsa5NPC,
      MerchantSheetMixin,
      MerchantSheetDSA5,
      ItemSheetdsa5,
    },
    wizards: {
      CareerWizard,
      CultureWizard,
      SpeciesWizard,
    },
    view: {
      tinyNotification,
      tabSlider,
      clickableAbility,
    },
    dialogs: {
      DialogReactDSA5,
      ReactToSkillDialog,
      ActAttackDialog,
      ReactToAttackDialog,
      RandomGoodsAddition,
    },
    macro: MacroDSA5,
    dataModels: {
      Item: itemModels,
      Actor: ActorDataModels,
      Combat: CombatDataModels,
      Combatant: CombatantDataModels,
      RegionBehavior: {
        DSATrap: DSATrapRegionBehavior,
        DSAAura: DSAAuraRegionBehavior,
        DSAZone: DSAZoneRegionBehavior,
      },
      JournalEntryPage: {
        dsacalendar: DSACalendarEntry,
        dsapersonaedramatis: DSAPersonaEntry,
        dsaquestlog: DSAQuestLogEntry,
        dsaaptracker: DSAAPTrackerEntry,
        dsamoneytracker: DSAMoneyTrackerEntry
      }
    },
    config: DSA5,
    TestSuite,
    memory: new RollMemory()
  };

  CONFIG.Actor.documentClass = Actordsa5;
  CONFIG.Actor.dataModels = ActorDataModels;
  CONFIG.Item.documentClass = Itemdsa5;
  CONFIG.Item.dataModels = itemModels;
  CONFIG.ChatMessage.template = 'systems/dsa5/templates/chat/chat-message.hbs';
  CONFIG.ChatMessage.documentClass = ChatMessageDSA5Roll;
  CONFIG.ui.combat = DSA5CombatTracker;
  CONFIG.ui.hotbar = DSA5Hotbar;
  CONFIG.Combat.dataModels = CombatDataModels;
  CONFIG.Combat.documentClass = DSA5Combat;
  CONFIG.Combatant.dataModels = CombatantDataModels;
  CONFIG.Combatant.documentClass = DSA5Combatant;
  CONFIG.ActiveEffect.documentClass = DSAActiveEffect;
  CONFIG.ActiveEffect.dataModels.base = ActiveEffectDataModels.base;
  CONFIG.ActiveEffect.expiryAction = 'delete';
  CONFIG.Token.objectClass = DSAToken;
  CONFIG.Token.documentClass = DSATokenDocument;
  CONFIG.Token.rulerClass = DSATokenRuler;
  CONFIG.Token.movement.defaultSpeed = 16;
  CONFIG.RegionBehavior.dataModels.DSATrap = DSATrapRegionBehavior;
  CONFIG.RegionBehavior.typeIcons.DSATrap = 'fas fa-land-mine-on';
  CONFIG.RegionBehavior.dataModels.DSAAura = DSAAuraRegionBehavior;
  CONFIG.RegionBehavior.typeIcons.DSAAura = 'fas fa-circle-radiation';
  CONFIG.RegionBehavior.dataModels.DSAZone = DSAZoneRegionBehavior;
  CONFIG.RegionBehavior.typeIcons.DSAZone = 'fas fa-bullseye';
  CONFIG.JournalEntryPage.dataModels.dsacalendar = DSACalendarEntry;
  CONFIG.JournalEntryPage.dataModels.dsapersonaedramatis = DSAPersonaEntry;
  CONFIG.JournalEntryPage.dataModels.dsaquestlog = DSAQuestLogEntry;
  CONFIG.JournalEntryPage.dataModels.dsaaptracker = DSAAPTrackerEntry;
  CONFIG.JournalEntryPage.dataModels.dsamoneytracker = DSAMoneyTrackerEntry;
  //CONFIG.documentClass = DSACombatantGroup;
  //CONFIG.debug.hooks = true

  CONFIG.fontDefinitions["Gentium Basic"] = {
    editor: true,
    fonts: [
      {urls: ['systems/dsa5/fonts/GenBasR.woff2']},
      {urls: ['systems/dsa5/fonts/GenBasBI.woff2'], weight: "500"},
      {urls: ['systems/dsa5/fonts/GenBasB.woff2'], weight: "700"},
    ]
  };
  CONFIG.fontDefinitions.Andalus = {
    editor: true,
    fonts: [
      {urls: ['systems/dsa5/fonts/andlso.woff2']},
    ] 
  };

  PaymentRequestService.register();
  TransactionSummaryService.register();
  InformationQueryService.register();
});

initHooks();
connectTokenRing();
