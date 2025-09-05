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
import DSA5Payment from './system/helpers/payment.js';
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
import { MeasuredTemplateDSA } from './system/automation/measuretemplate.js';
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
import DSAActiveEffectConfig from './status/active_effects.js';
import APTracker from './system/orwell/ap-tracker.js';
import MoneyTracker from './system/orwell/money-tracker.js';
import OnUseEffect from './system/automation/onUseEffects.js';
import TestSuite from './system/helpers/testsuite.js';
import { connectTokenRing } from './hooks/tokenring.js';
import { itemModels, ActorDataModels, CombatantDataModels, CombatDataModels } from './data/models.js';
import { DSAToken, DSATokenDocument, DSATokenRuler } from './hooks/token.js';
import * as DSAPause from './hooks/pause.js';
import { CalendarWidget } from './system/calendar/calendarwidget.js';
import { DSACalendarPicker } from './system/calendar/calendarpicker.js';
import { DSACombatantGroup } from './combat/combatant_group.js';
import { DSATrapRegionBehavior } from './data/regionbehaviors/trap.js';
import { DSACalendarEntry } from './data/journal/dsacalendar.js';
import ACTORCONCERNS from './actor/concerns/module.js';
import ITEMCONCERNS from './item/concerns/module.js';

Hooks.once('init', () => {
  CONFIG.statusEffects = DSA5.statusEffects;
  game.dsa5 = {
    apps: {
      DSA5_Utility,
      DSA5Initializer,
      DSA5ChatListeners,
      DSA5Payment,
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
      MeasuredTemplateDSA,
      Riding,
      RuleChaos,
      Trade,
      DSAActiveEffectConfig,
      OnUseEffect,
      CalendarPicker: new DSACalendarPicker(),
      CalendarWidget: new CalendarWidget(),
    },
    entities: {
      Actordsa5,
      Itemdsa5,
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
        DSATrap: DSATrapRegionBehavior
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
  CONFIG.Token.objectClass = DSAToken;
  CONFIG.Token.documentClass = DSATokenDocument;
  CONFIG.Token.rulerClass = DSATokenRuler;
  CONFIG.Token.movement.defaultSpeed = 16;
  CONFIG.RegionBehavior.dataModels.DSATrap = DSATrapRegionBehavior;
  CONFIG.RegionBehavior.typeIcons.DSATrap = 'fas fa-land-mine-on';
  CONFIG.JournalEntryPage.dataModels.dsacalendar = DSACalendarEntry;
  //CONFIG.documentClass = DSACombatantGroup;
  //CONFIG.debug.hooks = true  
});

initHooks();
connectTokenRing();
