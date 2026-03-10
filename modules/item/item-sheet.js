import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import { itemFromDrop, svgAutoFit, tabSlider } from '../system/helpers/view_helper.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import EquipmentDamage from '../system/automation/equipment-damage.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import { ItemSheetObfuscation } from './mixins/obfuscatemixin.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import RequestRoll from '../system/rolls/request-roll.js';
import APTracker from '../system/orwell/ap-tracker.js';
import { AppV2Mixin } from '../actor/mixins/appv2_mixin.js';
import { localize } from '../system/helpers/localizer.js';
import { DragMixin } from '../actor/mixins/drag_mixin.js';
import { PLANT_SHELF_LIFE_MAP, SPECIFIC_PLANT_METHODS } from './plant-config.js';
import PlantPreservationDialog from './plant-preservation-dialog.js';
const { mergeObject, getProperty, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class ItemSheetdsa5 extends AppV2Mixin(DragMixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2))) {
  _processFormData(event, form, formData) {
    const data = formData.object;
    const overrides = foundry.utils.flattenObject(this.item.overrides || {});
    Object.keys(overrides).forEach((v) => delete data[v]);
    return foundry.utils.expandObject(data);
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'details', label: 'Details' },
        { id: 'effects', label: 'statuseffects' },
      ],
      initial: 'description',
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 500,
      height: 500,
    },
    form: {
      submitOnChange: true,
    },
    actions: {
      showItemHead: function () {
        this.item.postItem();
      },
      headerOnUseEffect: function () {
        const onUse = new OnUseEffect(this.item);
        onUse.executeOnUseEffect();
      },
      rolleffect: function () {
        this.setupEffect();
      },
      conditionShow: { handler: this.showCondition, buttons: [0, 2] },
    },
    ownerActions: {
      _advanceStep: this.advanceWrapper,
      _refundStep: this.advanceWrapper,
      statusAdd: function () {
        DSA5StatusEffects.createCustomEffect(this.item, '', this.item.name);
      },
      conditionEdit: this.editCondition,
      conditionToggle: this.toggleCondition,
    },
    majorButtons: [
      {
        icon: 'fas fa-dice-six',
        label: 'SHEET.onUseEffect',
        action: 'headerOnUseEffect',
        visible: function () {
          return this.actor && OnUseEffect.getOnUseEffect(this.item);
        },
      },
      {
        label: 'SHEET.RollEffect',
        icon: 'fas fa-dice-d20',
        action: 'rolleffect',
        visible: function () {
          return this.hasRollEffect;
        },
      },
    ],
    window: {
      resizable: true,
      controls: [
        {
          icon: 'fas fa-comment',
          label: 'SHEET.PostItem',
          action: 'showItemHead',
        },
      ],
    },
    classes: ['dsa5', 'item', 'item-sheet'],
  };

  get title() {
    return this.item.name;
  }

  static setupSheets() {
    foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);
    foundry.documents.collections.Items.registerSheet('dsa5', ItemSheetdsa5, { makeDefault: true });

    const sheets = [
      { sheetClass: ItemSpeciesDSA5, types: ['species'] },
      { sheetClass: ItemBookDSA5, types: ['book'] },
      { sheetClass: ItemCareerDSA5, types: ['career'] },
      { sheetClass: ItemCultureDSA5, types: ['culture'] },
      { sheetClass: VantageSheetDSA5, types: ['advantage', 'disadvantage'] },
      { sheetClass: SpellSheetDSA5, types: ['ritual', 'ceremony', 'liturgy', 'spell'] },
      { sheetClass: SpecialAbilitySheetDSA5, types: ['specialability'] },
      { sheetClass: MeleeweaponSheetDSA5, types: ['meleeweapon'] },
      { sheetClass: PoisonSheetDSA5, types: ['poison'] },
      { sheetClass: DiseaseSheetDSA5, types: ['disease'] },
      { sheetClass: ConsumableSheetDSA5, types: ['consumable'] },
      { sheetClass: SpellExtensionSheetDSA5, types: ['spellextension'] },
      { sheetClass: MagictrickSheetDSA5, types: ['magictrick'] },
      { sheetClass: BlessingSheetDSA5, types: ['blessing'] },
      { sheetClass: RangeweaponSheet, types: ['rangeweapon'] },
      { sheetClass: EquipmentSheet, types: ['equipment'] },
      { sheetClass: ArmorSheet, types: ['armor'] },
      { sheetClass: AmmunitionSheet, types: ['ammunition'] },
      { sheetClass: PlantSheet, types: ['plant'] },
      { sheetClass: MagicalSignSheet, types: ['magicalsign'] },
      { sheetClass: PatronSheet, types: ['patron'] },
      { sheetClass: InformationSheet, types: ['information'] },
      { sheetClass: AggregatedTestSheet, types: ['aggregatedTest'] },
      { sheetClass: ApplicationSheetDSA5, types: ['application'] },
      { sheetClass: NoEffectsSheet, types: ['demonmark'] },
      { sheetClass: NoEffectsEquipmentSheet, types: ['money'] },
      { sheetClass: CombatSkillSheet, types: ['combatskill'] },
      { sheetClass: WithEffectsSheet, types: ['imprint', 'essence'] },
      { sheetClass: TrapSheet, types: ['trap'] },
      { sheetClass: SkillSheet, types: ['skill'] },
      { sheetClass: TraitSheet, types: ['trait'] },
      { sheetClass: EffectWrapperSheet, types: ['effectwrapper'] },
    ];
    sheets.forEach(({ sheetClass, types }) => {
      foundry.documents.collections.Items.registerSheet('dsa5', sheetClass, { makeDefault: true, types });
    });
    foundry.documents.collections.Items.unregisterSheet('dsa5', ItemSheetdsa5, { types: sheets.map((x) => x.types).flat() });
  }

  get dsaItemTemplate() {
    return `systems/dsa5/templates/items/item-${this.item.type}-sheet.hbs`;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!parts.details) parts.details = { template: this.dsaItemTemplate, scrollable: [''] };
    return parts;
  }

  setupEffect(ev) {
    this.item.setupEffect().then((setupData) => this.item.itemTest(setupData));
  }

  _getItemId(target) {
    return $(target).parents('.item')[0].dataset.itemId;
  }

  _advanceStep() { }

  _refundStep() { }

  static async advanceWrapper(event, target) {
    if (this.wrapperLocked) return;

    const funct = target.dataset.action;

    this.wrapperLocked = true;
    const icon = target.tagName == 'i' ? $(target) : $(target).find('i');
    icon.addClass('fa-spin fa-spinner');
    if (await this[funct]()) return;

    this.wrapperLocked = false;
    icon.removeClass('fa-spin fa-spinner');
  }

  static async showCondition(ev, target) {
    const id = target.dataset.id;
    if (ev.button == 0) {
      const effect = this.item.effects.get(id);
      effect.sheet.render(true);
    } else if (ev.button == 2) {
      this.item.deleteEmbeddedDocuments('ActiveEffect', [id]);
    }
  }

  static editCondition(ev, target) {
    const effect = this.item.effects.get(target.dataset.id);
    effect.sheet.render(true);
  }

  static toggleCondition(ev, target) {
    const condKey = $(target).parents('.statusEffect').attr('data-id');
    const ef = this.item.effects.get(condKey);
    ef.update({ disabled: !ef.disabled });
  }

  #lockOverrides(html) {
    const overrides = foundry.utils.flattenObject(this.item.overrides || {});
    Object.keys(overrides).forEach((v) => {
      const elem = html.find(`[name="${v}"]`);
      if (elem.length) {
        elem.prop('disabled', true);
        const icon = `<i class="fas fa-lock dsalocked" data-tooltip="TT.attributeLocked"></i>`;
        elem.after(icon);
      }
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    const header = this.element.querySelector(".window-header");
    if (header) {
        const seenActions = new Set();
        const controls = header.querySelectorAll(".header-control");
        
        controls.forEach(control => {
            const action = control.dataset.action;
            if (action) {
                if (seenActions.has(action)) {
                    control.remove();
                } else {
                    seenActions.add(action);
                }
            }
        });
    }

    tabSlider(html);

    html.find('.domainsPretty').on('click', (ev) => {
        $(ev.currentTarget).hide();
        $(ev.currentTarget).next('.domainToggle').show();
    });

    html.find('[data-action="editImage"]').on('mousedown', (ev) => {
        if (ev.button == 2) DSA5_Utility.showArtwork(this.item);
    });

    html.find('.select2').select2();

    DSA5ChatAutoCompletion.bindRollCommands(html);
    DSA5StatusEffects.bindButtons(html);

    this.#lockOverrides(html);

    const toObserve = html.find('header.item-header h1');
    if (toObserve.length) {
        const svg = toObserve.find('svg');
        if (svg) {
            const observer = new ResizeObserver(function (entries) {
                svgAutoFit(svg, entries[0].contentRect.width);
            });
            observer.observe(toObserve.get(0));
            const input = toObserve.find('input');
            if (!input.get(0).disabled) {
                svg.on('click', () => {
                    svg.hide();
                    input.show();
                    input.trigger('focus');
                });
                input.on('blur', () => {
                    svg.show();
                    input.hide();
                });
            }
        }
    }
}

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    this.wrapperLocked = false;

    data.isOwned = this.actor;
    data.editable = this.isEditable;
    data.systemFields = this.document.system.schema?.fields;

    if (data.isOwned) {
      data.canAdvance = this.actor.canAdvance && this._advancable();
      const customPrice = getProperty(this.item, 'flags.dsa5.customPriceTag');

      if (!this.isEditable && customPrice) data.customPrice = customPrice;
    }

    data.conditions = this.item.effects;

    if (!game.user.isGM)
      data.conditions = data.conditions.filter((e) => {
        return !e.getFlag('dsa5', 'hidePlayers');
      });

    data.enableWeaponAdvantages = game.settings.get('dsa5', 'enableWeaponAdvantages');
    data.armorAndWeaponDamage = game.settings.get('dsa5', 'armorAndWeaponDamage');
    data.isGM = game.user.isGM;
    data.enrichedDescription = await TextEditor.enrichHTML(getProperty(this.item.system, 'description.value'), { secrets: this.item.isOwner });
    data.enrichedGmdescription = await TextEditor.enrichHTML(getProperty(this.item.system, 'gmdescription.value'), { secrets: this.item.isOwner });
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');

    await this.item.system.getSheetData?.(data);

    return data;
  }

  _advancable() {
    return false;
  }

  async _handleDrop(dragData) {
    if (!(game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'))) return;

    if (dragData.type == 'Macro') {
      const item = await fromUuid(dragData.uuid);
      if (!item) return;
      if (!item.pack) return ui.notifications.info('DSAError.onlyCompendiumSpells', { format: { element: '"Macro"' }, localize: true });

      const code = `this.callMacro("${item.pack}", "${item.name}")`
      await this.item.update({ 'flags.dsa5.onUseEffect': code });
    } else if (dragData.type == 'DSALight') {
      const code = `game.dsa5.apps.LightDialog.applyVisionOrLight(true, "${dragData.key}", actor.getActiveTokens(), item.name)`
      await this.item.update({ 'flags.dsa5.onUseEffect': code });
    }
  }

  async _onDrop(event) {
    super._onDrop(event);
    const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
    this._handleDrop(dragData);
  }
}

class WithEffectsSheet extends ItemSheetdsa5 {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: [''],
    },
  };
}


const AdvancableSkill = (superclass) =>
  class extends superclass {
    _advancable() {
      return this.actor;
    }

    async _refundStep() {
      const value = this.item.system.talentValue.value;
      if (value > (this.item.system.advanceMin || 0)) {
        const cost = this.item.system.refundCost() * -1;
        await this.item.update({ 'system.talentValue.value': value - 1 });
        await this.actor._updateAPs(cost);
        await APTracker.track(this.actor, { type: 'item', item: this.item, previous: value, next: value - 1 }, cost);
        return true;
      }
    }

    async _advanceStep() {
      const value = this.item.system.talentValue.value;
      const cost = this.item.system.advanceCost();
      if ((await this.actor.checkEnoughXP(cost)) && this._checkMaximumItemAdvancement(value + 1)?.result) {
        await this.item.update({ 'system.talentValue.value': value + 1 });
        await this.actor._updateAPs(cost);
        await APTracker.track(this.actor, { type: 'item', item: this.item, previous: value, next: value + 1 }, cost);
        return true;
      }
    }

    get advanceSkill() {
      return 'LocalizedIDs.exceptionalSkill';
    }

    _maxAllowedAdvancement(maxBonus) {
      return this.maxByAttr(maxBonus);
    }

    _checkMaximumItemAdvancement(newValue) {
      const maxBonus = AdvantageRulesDSA5.vantageStep(this.actor, `${localize(this.advanceSkill)} (${this.item.name})`, false);
      const max = this._maxAllowedAdvancement(maxBonus);
      const result = newValue <= max;
      if (!result)
        ui.notifications.error('DSAError.AdvanceMaximumReached', {
          localize: true,
        });

      return { result, max, maxBonus };
    }

    maxByAttr(advantageBonus) {
      return (
        Math.max(
          ...[
            this.actor.system.characteristics[this.item.system.characteristic1.value].value,
            this.actor.system.characteristics[this.item.system.characteristic2.value].value,
            this.actor.system.characteristics[this.item.system.characteristic3.value].value,
          ],
        ) +
        2 +
        advantageBonus
      );
    }
  };

class EffectsEquipmentSheet extends ItemSheetdsa5 {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-equipment.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: [''],
    },
  };
}

class NoEffectsEquipmentSheet extends ItemSheetdsa5 {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-equipment.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    delete tabs.effects;
    return tabs;
  }
}

class NoEffectsSheet extends ItemSheetdsa5 {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    delete tabs.effects;
    return tabs;
  }
}

class MacroOnlyEffectsSheet extends WithEffectsSheet {
  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.noActiveEffects = true;
    return data;
  }
}

class EffectWrapperSheet extends WithEffectsSheet {
  static PARTS = {
    details: {
      template: 'systems/dsa5/templates/items/item-effectwrapper-sheet.hbs',
      templates: [
        'systems/dsa5/templates/system/dsatabs.hbs',
        'systems/dsa5/templates/items/item-header.hbs',
        'systems/dsa5/templates/items/item-stat.hbs',
        'systems/dsa5/templates/items/item-description.hbs',
        'systems/dsa5/templates/items/item-effects.hbs',
      ],
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    delete tabs.details;
    return tabs;
  }
}

class LocalizerSheet extends WithEffectsSheet {
  static PARTS = {
    header: super.PARTS.header,
    stat: super.PARTS.stat,
    tabs: super.PARTS.tabs,
    description: {
      template: 'systems/dsa5/templates/items/item-localizerdescription.hbs',
      scrollable: [''],
    },
    effects: super.PARTS.effects,
  };
}

class LocalizerWithoutEffectsSheet extends NoEffectsSheet {
  static PARTS = {
    header: super.PARTS.header,
    stat: super.PARTS.stat,
    tabs: super.PARTS.tabs,
    description: {
      template: 'systems/dsa5/templates/items/item-localizerdescription.hbs',
      scrollable: [''],
    },
  };
}

class CombatSkillSheet extends AdvancableSkill(LocalizerSheet) {
  get advanceSkill() {
    return 'LocalizedIDs.exceptionalCombatTechnique';
  }

  _maxAllowedAdvancement(maxBonus) {
    return Math.max(...this.item.system.guidevalue.value.split('/').map((x) => this.actor.system.characteristics[x].value)) + 2 + maxBonus;
  }
}

class SkillSheet extends AdvancableSkill(LocalizerSheet) { }

class AggregatedTestSheet extends ItemSheetdsa5 {
  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'production', label: 'PLAYER.creation' },
        { id: 'details', label: 'Details' },
      ],
      initial: 'description',
    },
  };

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
    production: {
      template: 'systems/dsa5/templates/items/item-production.hbs',
      scrollable: [''],
    },
  };

  static DEFAULT_OPTIONS = {
    actions: {
      postAsGroupCheck: AggregatedTestSheet.postAsGroupCheck,
      buildItem: AggregatedTestSheet._postFinishedItemWrapper,
    },
    majorButtons: [
      {
        label: 'SHEET.postAsGroupCheck',
        icon: 'fas fa-dice-d20',
        action: 'postAsGroupCheck',
        visible: function () {
          return !this.item.isOwned;
        },
      },
    ],
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.item.getFlag('dsa5', 'embeddedItem')) delete tabs.production;
    return tabs;
  }

  static async postAsGroupCheck() {
    const rollOptions = ['value', 'value2', 'value3']
      .filter((x) => this.item.system.talent[x])
      .map((x) => {
        return {
          type: 'skill',
          modifier: this.item.system.baseModifier,
          calculatedModifier: this.item.system.baseModifier,
          target: this.item.system.talent[x],
        };
      });

    if (!rollOptions.length) return;

    const data = {
      modifier: this.item.system.baseModifier,
      maxRolls: this.item.system.allowedTestCount.value,
      enrichedsuccess: await TextEditor.enrichHTML(this.item.system.success, { secrets: this.item.isOwner }),
      enrichedpartsuccess: await TextEditor.enrichHTML(this.item.system.partsuccess, { secrets: this.item.isOwner }),
      rollOptions,
    };

    RequestRoll.showGCMessage(rollOptions[0].target, 0, data);
  }

  static async _postFinishedItemWrapper(event, target) {
    await this.postFinishedItem();
  }

  async postFinishedItem() {
    if (!this.actor) return;

    const resultItem = this.item.getFlag('dsa5', 'embeddedItem');

    if (!resultItem) return;

    const template = await renderTemplate('systems/dsa5/templates/chat/production-result.hbs', {
      actor: this.actor,
      item: resultItem,
      actorImg: OpposedDsa5.videoOrImgTag(this.actor.img),
    });
    const chatData = DSA5_Utility.chatDataSetup(template);
    chatData.flags = {
      dsa5: { embeddedItem: resultItem },
    };
    await ChatMessage.create(chatData);
  }

  async _handleDrop(dragData) {
    await this.dropCreation(dragData);
    await super._handleDrop(dragData);
  }

  async dropCreation(dragData) {
    const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined);
    if (!DSA5.equipmentCategories.has(typeClass)) return;

    this.item.setFlag('dsa5', 'embeddedItem', item);
  }
}

class Enchantable extends ItemSheetdsa5 {
  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'enchantment', label: 'enchantment' },
        { id: 'details', label: 'Details' },
        { id: 'effects', label: 'statuseffects' },
      ],
      initial: 'description',
    },
  };

  static DEFAULT_OPTIONS = {
    actions: {},
    ownerActions: {
      enchTogglePermanent: this._togglePermanent,
      enchToggleCharge: this._toggleCharge,
      enchRoll: this._enchRoll,
      enchDelete: this._enchDelete,
      enchShow: this._enchShow,
      poisonTogglePermanent: this._poisonTogglePermanent,
      poisonDelete: this._deletePoison,
      poisonShow: this._poisonShow,
    },
  };

  static _togglePermanent(ev, target) {
    let { id, enchantments } = this.enchantMentId(target);
    for (let ench of enchantments) {
      if (ench.id == id) {
        ench.permanent = !ench.permanent;
        break;
      }
    }
    this.item.update({ flags: { dsa5: { enchantments } } });
  }

  static _toggleCharge(ev, target) {
    let { id, enchantments } = this.enchantMentId(target);
    this.toggleChargedState(id, enchantments);
  }

  static _enchRoll(ev, target) {
    let { id, enchantments } = this.enchantMentId(target);
    this.rollEnchantment(id, enchantments);
  }

  static _enchDelete(ev, target) {
    let { id, enchantments } = this.enchantMentId(target);
    this.deleteEnchantment(id, enchantments);
  }

  static async _enchShow(ev, target) {
    let { id, enchantments } = this.enchantMentId(target);
    let enchantment = enchantments.find((x) => x.id == id);
    let item = await this.getSpell(enchantment);

    if (item) item.sheet.render(true);
  }

  static _poisonTogglePermanent(ev, target) {
    this.item.update({
      flags: {
        dsa5: {
          poison: { permanent: !this.item.flags.dsa5.poison.permanent },
        },
      },
    });
  }

  static async _poisonShow(ev, target) {
    let item;
    if (this.actor) item = this.actor.items.find((x) => x.type == 'poison' && x.name == this.item.flags.dsa5.poison.name);
    if (!item) item = await this.getSpell(this.item.flags.dsa5.poison);

    if (item) {
      item.sheet.render(true);
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    html.find('.ench-fw').on('change', (ev) => {
      let { id, enchantments } = this.enchantMentId(ev.currentTarget);
      let fw = Number(ev.currentTarget.value);
      if (!fw) return;

      for (let ench of enchantments) {
        if (ench.id == id) {
          ench.fw = fw;
          break;
        }
      }
      this.item.update({ flags: { dsa5: { enchantments } } });
    });
  }

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-equipment.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
    enchantment: {
      template: 'systems/dsa5/templates/items/item-enchantment.hbs',
      scrollable: [''],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: [''],
    },
  };

  get isEnchantable() {
    return true;
  }

  async _handleDrop(dragData) {
    if (this.isEnchantable) await this._enchant([dragData]);
    if (this.isPoisonable) await this._poison(dragData);
    await super._handleDrop(dragData);
  }

  async _enchant(dragDataArray) {
    const enchantments = this.item.getFlag('dsa5', 'enchantments') || [];
    if (enchantments.length + dragDataArray.length > 7)
      return ui.notifications.error('DSAError.tooManyEnchants', {
        localize: true,
      });

    for (let dragData of dragDataArray) {
      const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined, false);
      if (['spell', 'liturgy', 'ceremony', 'ritual'].includes(typeClass)) {
        if (!item.pack) return ui.notifications.error('DSAError.onlyCompendiumSpells', { format: { element: localize('TYPES.Item.spell') }, localize: true });

        const enchantment = {
          name: item.name,
          pack: item.pack,
          id: enchantments.length,
          itemId: item.id,
          permanent: ['liturgy', 'ceremony'].includes(typeClass) || dragData.permanent,
          actorId: dragData.actorId,
          charged: true,
          talisman: ['liturgy', 'ceremony'].includes(typeClass),
          fw: ['liturgy', 'ceremony'].includes(typeClass) ? 18 : dragData.fw || 0,
        };
        enchantments.push(enchantment);
      }
    }
    if (enchantments.length) {
      const update = { flags: { dsa5: { enchantments } } };
      await this.item.update(update);
    }
  }

  async _poison(dragData) {
    const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined, false);
    if (typeClass == 'poison') {
      const poison = {
        name: item.name,
        pack: item.pack,
        itemId: item._id,
        permanent: false,
        actorId: dragData.actorId,
      };
      let update = { flags: { dsa5: { poison } } };
      if (this.item.actor) {
        if (this.item.actor.uuid != item.actor?.uuid) {
          const proceed = await foundry.applications.api.DialogV2.confirm({
            window: {
              title: game.i18n.format('WIZARD.addItem', { item: item.name }),
            },
            content: `<p>${localize('DSAError.poisonNeedsToBeInActor')}</p><p>${localize('POISON.addNow')}</p>`,
            rejectClose: false,
            modal: true,
          });
          if (proceed) {
            await this.item.actor.createEmbeddedDocuments('Item', [item.toObject()]);
          }
        }
      } else {
        ui.notifications.info('DSAError.poisonNeedsToBeInActor', { localize: true });
      }
      await this.item.update(update);
    }
  }

  toggleChargedState(id, enchantments) {
    for (let ench of enchantments) {
      if (ench.id == id) {
        ench.charged = ench.talisman && ench.permanent ? true : !ench.charged;
        break;
      }
    }
    this.item.update({ flags: { dsa5: { enchantments } } });
  }

  async rollEnchantment(id, enchantments) {
    const enchantment = enchantments.find((x) => x.id == id);
    if (!enchantment.charged) return ui.notifications.error('DSAError.NotEnoughCharges', { localize: true });

    let item = await this.getSpell(enchantment);

    if (item) {
      item = item.toObject();
      item.system.talentValue.value = enchantment.fw;
      const actor = DSA5_Utility.emptyActor(14, this.item.name, { parent_source_uuid: this.item.actor?.uuid });
      actor.setupSpell(item, {}, 'emptyActor').then(async (setupData) => {
        const infoMsg = game.i18n.format('CHATNOTIFICATION.enchantmentUsed', {
          item: this.item.name,
          spell: item.name,
        });
        await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        await actor.basicTest(setupData);
        if (enchantment.permanent) {
          this.toggleChargedState(id, enchantments);
        } else {
          this.deleteEnchantment(id, enchantments);
        }
      });
    }
  }

  static _deletePoison(ev, target) {
    this.item.update({ [`flags.dsa5.-=poison`]: null });
  }

  deleteEnchantment(id, enchantments) {
    let enchantment = enchantments.findIndex((x) => x.id == id);
    enchantments.splice(enchantment, 1);
    this.item.update({ flags: { dsa5: { enchantments } } });
  }

  async getSpell(enchantment) {
    const pack = await game.packs.get(enchantment.pack);
    let item;
    if (pack) {
      item = await pack.getDocument(enchantment.itemId);
      if (!item) {
        const itemId = await pack.index.getName(enchantment.name);
        if (itemId) item = await pack.getDocument(itemId._id);
      }
    }

    if (!item) {
      const itemLibrary = game.dsa5.itemLibrary;
      await itemLibrary.buildEquipmentIndex();

      itemLibrary.findCompendiumItem;
      const cats = enchantment.talisman ? ['liturgy', 'ceremony'] : ['spell', 'ritual'];

      for (let cat of cats) {
        item = await game.dsa5.itemLibrary.findCompendiumItem(enchantment.name, cat);
        item = item.find((x) => x.name == enchantment.name && x.type == cat && x.system);

        if (item) break;
      }
    }

    if (!item)
      ui.notifications.error('DSAError.enchantmentNotFound', {
        localize: true,
      });

    return item;
  }

  enchantMentId(target) {
    return {
      id: $(target).parents('.statusEffect').attr('data-id'),
      enchantments: this.item.getFlag('dsa5', 'enchantments'),
    };
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    const enchantmentLabel = this.enchantmentLabel;
    if (enchantmentLabel) {
      tabs.enchantment.label = enchantmentLabel;
    } else {
      delete tabs.enchantment;
    }
    return tabs;
  }

  get enchantmentLabel() {
    const enchantments = this.item.getFlag('dsa5', 'enchantments') || [];
    const poison = this.item.getFlag('dsa5', 'poison');
    const enchantmentLabel = [];

    if (poison) enchantmentLabel.push('TYPES.Item.poison');
    if (enchantments.some((x) => !x.talisman)) enchantmentLabel.push('enchantment');
    if (enchantments.some((x) => x.talisman)) enchantmentLabel.push('talisman');

    return enchantmentLabel.map((x) => localize(x)).join('/');
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.enchantments = this.item.getFlag('dsa5', 'enchantments');
    data.poison = this.item.getFlag('dsa5', 'poison');
    data.hasEnchantments = data.poison || (data.enchantments && data.enchantments.length > 0);
    return data;
  }
}

class TrapSheet extends Enchantable {
  static PARTS = {
    ...Enchantable.PARTS,
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
    details: {
      template: 'systems/dsa5/templates/items/item-trap-sheet.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/items/item-aoe.hbs']
    }
  };
}

class TraitSheet extends Enchantable {
  static PARTS = {
    ...Enchantable.PARTS,
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
  };

  get isEnchantable() {
    return false;
  }

  get isPoisonable() {
    return ['meleeAttack', 'rangeAttack'].includes(this.item.system.traitType.value);
  }
}

class InformationSheet extends ItemSheetdsa5 {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
  };

  static TABS = {
    sheet: {
      tabs: [{ id: 'details', label: 'Details' }],
      initial: 'details',
    },
  };
}

class AmmunitionSheet extends ItemSheetObfuscation(Enchantable) {
  isPoisonable = true;
}

class EquipmentSheet extends ItemSheetObfuscation(Enchantable) {
  static TABS = {
    sheet: {
      tabs: [
        { id: 'containerContent', label: 'Equipment.bags' },
        { id: 'description', label: 'Description' },
        { id: 'enchantment', label: 'enchantment' },
        { id: 'details', label: 'Details' },
        { id: 'effects', label: 'statuseffects' },
      ],
      initial: 'description',
    },
  };

  static PARTS = {
    ...Enchantable.PARTS,
    containerContent: {
      template: 'systems/dsa5/templates/items/item-containercontent.hbs',
      scrollable: [''],
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.isBagWithContents()) delete tabs.containerContent;
    return tabs;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    if (this.isBagWithContents()) {
      let weightSum = 0;
      mergeObject(data, {
        containerContent: this.actor.items
          .filter((x) => DSA5.equipmentCategories.has(x.type) && x.system.parent_id == this.item.id)
          .map((x) => {
            x.system.preparedWeight = parseFloat((x.system.weight.value * x.system.quantity.value).toFixed(3));
            weightSum += Number(x.system.preparedWeight);
            const enchants = getProperty(x, 'flags.dsa5.enchantments');
            if (enchants && enchants.length > 0) {
              x.enchantClass = 'rar';
            } else if ((x.system.effect && x.system.effect.value != '') || x.effects.length > 0) {
              x.enchantClass = 'common';
            }
            return x;
          }),
        weightSum: parseFloat(weightSum.toFixed(3)),
        weightWidth: `style="width: ${Math.min(this.item.system.capacity ? (weightSum / this.item.system.capacity) * 100 : 0, 100)}%"`,
        weightExceeded: weightSum > Number(this.item.system.capacity) ? 'exceeded' : '',
      });
    }
    return data;
  }

  async breakOverflow(data, parent) {
    let elm = $(await renderTemplate('systems/dsa5/templates/items/baghover.hbs', data));

    let top = parent.offset().top + 52;
    let left = parent.offset().left - 75;
    elm.appendTo($('body'));
    elm.css({
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      bottom: 'auto',
      right: 'auto',
      'z-index': 10000,
    });
    return elm;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    const slots = html.find('.slot');
    slots.on('mouseenter', async (ev) => {
      const item = $(ev.currentTarget);
      let elm = await this.breakOverflow(
        {
          name: ev.currentTarget.dataset.name,
          weight: ev.currentTarget.dataset.weight,
          quantity: ev.currentTarget.dataset.quantity,
        },
        item,
      );
      elm.fadeIn();
      item.on('mouseleave', () => {
        elm.remove();
        item.off('mouseleave');
      });
    });

    slots.on('mousedown', async (ev) => {
      let itemId = ev.currentTarget.dataset.itemId;
      let item = this.actor.items.get(itemId);

      if (ev.button == 0) item.sheet.render(true);
      else if (ev.button == 2) {
        $('.itemInfo').remove();
        await item.update({ 'system.parent_id': 0 });
        this.render(true);
      }
    });
  }

  isBagWithContents() {
    return this.item.system.isBagWithContents;
  }

  async _handleDrop(dragData) {
    if (this.isBagWithContents()) {
      const { item, typeClass, selfTarget } = await itemFromDrop(dragData, this.item.parent.uuid);
      const selfItem = this.item.id == item._id;

      if (DSA5.equipmentCategories.has(typeClass) && !selfItem) {
        item.system.parent_id = this.item.id;
        if (item.system.worn && item.system.worn.value) item.system.worn.value = false;

        if (selfTarget) {
          await this.item.actor.updateEmbeddedDocuments('Item', [item]);
        } else {
          await this.actor.sheet._addLoot(item);
        }
        this.render(true);
        return;
      }
    }

    await super._handleDrop(dragData);
  }
}

export class ArmorSheet extends ItemSheetObfuscation(Enchantable) {
  static DEFAULT_OPTIONS = {
    actions: {
      rollDamaged: function () {
        EquipmentDamage.breakingTest(this.item);
      },
    },
    majorButtons: [
      {
        label: 'WEAR.checkShort',
        icon: 'fas fa-dice-d20',
        action: 'rollDamaged',
        visible: function () {
          return this.actor && game.settings.get('dsa5', 'armorAndWeaponDamage') && this.item.system.structure.max > 0;
        },
      },
    ],
  };
}


class PlantSpoiledDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    constructor(item) {
        super({ id: `plant-spoiled-dialog-${item.id}` });
        this.item = item;
    }

    static async applyR1Effect(item) {
        const itemData = item.system;
        const toDays = { 
            'seconds': 1/86400, 'minutes': 1/1440, 'hours': 1/24, 
            'days': 1, 'weeks': 7, 'months': 30, 'years': 365 
        };

        let baseInDays = 0;
        if (itemData.plantState === "Roh") {
            const mainPart = itemData.mainIngredient || "leaves";
            const rawData = PLANT_SHELF_LIFE_MAP[mainPart]?.raw || "12h";
            let baseNumber = parseFloat(rawData);
            if (isNaN(baseNumber) && rawData.includes("year")) baseNumber = 20;
            const unitCode = String(rawData).replace(/[0-9.]/g, '');
            const unitMap = { 's': 'seconds', 'i': 'minutes', 'h': 'hours', 'd': 'days', 'w': 'weeks', 'm': 'months', 'y': 'years' };
            let sourceUnit = unitMap[unitCode] || (rawData.includes("year") ? "years" : "hours");
            baseInDays = baseNumber * (toDays[sourceUnit] || 1);
        } else {
            const mundaneValue = parseFloat(itemData.mundane?.shelfLife?.value) || 0;
            const mundaneUnit = itemData.processed?.shelfLife?.unit || itemData.shelfLife?.unit || "days";
            baseInDays = mundaneValue * (toDays[mundaneUnit] || 1);
        }

        // Berechnung: (Basiswert * 2), supernatural factor auf 1
        const newShelfLife = baseInDays * 2;

        await item.update({
            "system.isSpoiled": false,
            "system.supernatural.factor": 1,
            "system.remaining.shelfLife.value": Number(Math.round(newShelfLife * 10) / 10),
            "flags.dsa5.-=spoiledResult": null
        });
    }

    static async sendSpoiledMessage(item, resultString) {
        if (!item.actor) return;
        const actorName = item.actor.name;
        const effectText = game.i18n.localize(`PLANT.spoiledRows.R${resultString}`);
        const localizedMessage = game.i18n.format("PLANT.spoiledChatMessage", { itemName: item.name, actorName: actorName });
        const content = `<div style="display: flex; justify-content: center; margin-bottom: 15px;"><div class="spoiled-plant-image-click" data-uuid="${item.uuid}" title="${item.name} öffnen" style="width: 55px; height: 55px; background-image: url('${item.img}'); background-size: contain; background-repeat: no-repeat; background-position: center; cursor: pointer;"></div></div><p>${localizedMessage}</p><p><i>${effectText}</i></p>`;
        await ChatMessage.create({ content: content, whisper: ChatMessage.getWhisperRecipients("GM") });
    }

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.deepClone(super.DEFAULT_OPTIONS), {
        classes: ["dsa5", "plant-spoiled-app"], 
        window: { title: "PLANT.spoiledEffect", resizable: true },
        position: { width: 780, height: 700 },
        actions: {
            rollTable: async function(event, target) {
                const roll = await new Roll("1d20").evaluate();
                let res = String(roll.total);
                const v = roll.total;
                if (v >= 3 && v <= 5) res = "3_5"; else if (v >= 6 && v <= 7) res = "6_7"; 
                else if (v >= 8 && v <= 9) res = "8_9"; else if (v >= 11 && v <= 12) res = "11_12"; 
                else if (v >= 14 && v <= 15) res = "14_15";

                await roll.toMessage({ flavor: `<b>${this.item.name}</b>`, rollMode: CONST.DICE_ROLL_MODES.BLIND });
                
                if (res === "1") {
                    await PlantSpoiledDialog.applyR1Effect(this.item);
                    this.close();
                } else {
                    const wasSpoiled = this.item.system.isSpoiled;
                    await this.item.update({ "system.isSpoiled": true, "flags.dsa5.spoiledResult": res });
                    if (!wasSpoiled) await PlantSpoiledDialog.sendSpoiledMessage(this.item, res);
                    this.render(true);
                }
            },
            showDetails: async function(event, target) {
                const itemName = target.dataset.name;
                let item = game.items.find(i => i.name === itemName);
                if (!item) {
                    for (let pack of game.packs) {
                        if (pack.documentName !== "Item") continue;
                        const index = await pack.getIndex();
                        const entry = index.find(e => e.name === itemName);
                        if (entry) { item = await pack.getDocument(entry._id); break; }
                    }
                }
                if (item) item.sheet.render(true);
            },
            selectRow: async function(event, target) {
                const rowElement = target.closest('.selectableRow');
                if (!rowElement) return;
                const row = rowElement.dataset.row;
                
                if (row === "1") {
                    await PlantSpoiledDialog.applyR1Effect(this.item);
                    this.close();
                } else {
                    const wasSpoiled = this.item.system.isSpoiled;
                    await this.item.update({ "system.isSpoiled": true, "flags.dsa5.spoiledResult": row });
                    if (!wasSpoiled) await PlantSpoiledDialog.sendSpoiledMessage(this.item, row);
                    this.render(true);
                }
            }
        }
    });

    static PARTS = { main: { template: "systems/dsa5/templates/items/item-plant-spoiled.hbs" } };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.currentResult = this.item.getFlag("dsa5", "spoiledResult") || "";
        return context;
    }
}

/**
 * Das Haupt-Sheet der Pflanze.
 * Pfad: Data\systems\dsa5\modules\item\PlantSheet.js
 */
class PlantSheet extends ItemSheetObfuscation(ItemSheetdsa5) {
    static TABS = {
        sheet: {
            tabs: [
                { id: 'description', label: 'Description' },
                { id: 'details', label: 'Details' },
                { id: 'work', label: 'PLANT.work' }, 
                { id: 'effects', label: 'statuseffects' },
            ],
            initial: 'details',
        },
    };

    static PARTS = {
        header: { template: 'systems/dsa5/templates/items/item-header.hbs' },
        stat: { template: 'systems/dsa5/templates/items/item-plant-header.hbs' },
        tabs: { template: 'systems/dsa5/templates/items/item-plant-tabs.hbs' }, 
        description: { template: 'systems/dsa5/templates/items/item-description.hbs' },
        details: { template: 'systems/dsa5/templates/items/item-plant-sheet.hbs' },
        work: { template: 'systems/dsa5/templates/items/item-plant-tab-work.hbs' },
        effects: { template: 'systems/dsa5/templates/items/item-effects.hbs' },
    };
	
		static async _handleSpoiledConsumption(actor, item, result) {
    const effectText = game.i18n.localize(`PLANT.spoiledRows.R${result}`);
    const spoiledTitle = game.i18n.localize("PLANT.spoiledPlantEffectTitle");
    let chatMsg = `<b>${item.name} (${game.i18n.localize("PLANT.isSpoiled")})</b><br>${effectText}`;
    
    const addTimedStunned = async (durationInSeconds) => {
        const effectData = {
            name: `${spoiledTitle}: ${game.i18n.localize("CONDITION.stunned")}`,
            img: "icons/svg/daze.svg",
            changes: [
                {
                    key: "system.condition.stunned",
                    mode: 2, // ADD
                    value: "1",
                    priority: null
                }
            ],
            duration: {
                seconds: durationInSeconds,
                startTime: game.time.worldTime
            },
            statuses: ["stunned"],
            flags: {
                dsa5: {
                    value: 1,
                    manual: 1,
                    auto: 0,
                    hideOnToken: false
                }
            }
        };

        await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    };

			// gleiche Basis wie smoke makro
		const applyCompendiumEffect = async (itemName) => {
		let doc = game.items.find(i => i.name === itemName);
		if (!doc) {
			for (let pack of game.packs) {
				if (pack.documentName !== "Item") continue;
				const index = await pack.getIndex();
				const entry = index.find(e => e.name === itemName);
				if (entry) { doc = await pack.getDocument(entry._id); break; }
			}
		}
		
		if (doc) {
			let itemData = doc.toObject();

			// 1. FIX: Dauer-Strings bereinigen (verhindert den safeEval-Fehler)
			if (itemData.effects) {
				itemData.effects.forEach(eff => {
					if (eff.duration?.value && typeof eff.duration.value === "string") {
						eff.duration.value = eff.duration.value.replace(/[Tt]ag(e)?/g, "24");
					}
				});
			}

			// 2. TARGETING: Den Actor als Ziel für das System markieren
			const token = actor.getActiveTokens()[0] || canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
			if (token) {
				// Setzt das Ziel für den aktuellen User auf den eigenen Token
				token.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });
			}

			// 3. AUSFÜHRUNG: Temporäres Item erstellen und Test triggern
			const tempItem = await actor.createEmbeddedDocuments("Item", [itemData], { render: false });
			const itemInstance = actor.items.get(tempItem[0].id);

			try {
				const setupData = await itemInstance.setupEffect();
				if (setupData) {
					await itemInstance.itemTest(setupData);
				}
			} catch (e) {
				console.warn("Pflanzen-System: Fehler bei Effekt-Setup für " + itemName, e);
			} finally {
				await actor.deleteEmbeddedDocuments("Item", [itemInstance.id]);
			}
		}
	};

    switch (result) {
        case "2":
            const gmExtra = ` <br><i>${game.i18n.localize("PLANT.gmApplyManually")}</i>`;
            await ChatMessage.create({ content: chatMsg, speaker: { alias: "System" } });
            await ChatMessage.create({ content: chatMsg + gmExtra, whisper: ChatMessage.getWhisperRecipients("GM") });
            return;
        case "6_7":
            await addTimedStunned(1800); 
            break;
        case "8_9":
            await addTimedStunned(3600); 
            break;
        case "11_12":
            await applyCompendiumEffect(game.i18n.localize("PLANT.poisongroup.Wurara"));
            break;
        case "13":
            await applyCompendiumEffect(game.i18n.localize("PLANT.poisongroup.Arax"));
            break;
        case "14_15":
            await applyCompendiumEffect(game.i18n.localize("PLANT.poisongroup.FlinkerDifar"));
            break;
        case "16":
            await applyCompendiumEffect(game.i18n.localize("PLANT.poisongroup.Sumpffieber"));
            break;
        case "17":
            await actor.applyDamage("1d6");
            break;
        case "18":
            await applyCompendiumEffect(game.i18n.localize("PLANT.poisongroup.Wirselkraut"));
            break;
        case "19":
            // 1d3 Heilung via negativem Schaden
            await actor.applyDamage("-1d3");
            break;
        case "20":
            await actor.applyDamage("2d6");
            await addTimedStunned(3600);
            break;
    }

    await ChatMessage.create({
        content: chatMsg,
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        whisper: ChatMessage.getWhisperRecipients("GM").concat(game.user.id)
    });
};

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(ItemSheetdsa5.DEFAULT_OPTIONS, {
        window: { 
            size: { width: 750, height: 780 },
            classes: ["dsa5", "item", "plant-sheet"] 
        },
        actions: {
            consumePlantAction: async function(event, target) { 
				const item = this.item;
				const actor = item.actor;
				if (!actor) return;

				const currentQty = Number(item.system.quantity?.value ?? 0);
				if (currentQty <= 0) {
					return ui.notifications.warn(game.i18n.localize("DSA5.NotEnoughItems"));
				}

				const isSpoiled = item.system.isSpoiled === true;
				const spoiledResult = item.getFlag("dsa5", "spoiledResult");

				if (isSpoiled && spoiledResult) {
					await this.constructor._handleSpoiledConsumption(actor, item, spoiledResult);
				} else {
					const consumeMacro = item.getFlag("dsa5", "onConsumeEffect");
					if (consumeMacro && consumeMacro.trim() !== "") {
						try {
							const speaker = ChatMessage.getSpeaker({ actor: actor });
							const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
							const fn = new AsyncFunction("speaker", "actor", "item", "args", consumeMacro);
							await fn(speaker, actor, item, [speaker, actor, item]);
						} catch (err) {
							ui.notifications.error("Fehler im Verzehr-Makro (siehe Konsole)");
							console.error("DSA5 | Fehler im Verzehr-Makro:", err);
						}
					}
				}

				if (currentQty <= 1) await item.delete();
				else await item.update({ "system.quantity.value": currentQty - 1 });
				
				ui.notifications.info(game.i18n.format("PLANT.itemConsumed", {item: item.name}));
			},
			
			resetShelfLife: async function(event, target) {
				const itemData = this.item.system;
				
				const isRoh = itemData.plantState === "Roh"; 
				const supernaturalFactor = parseFloat(itemData.supernatural?.factor) || 1;
				
				const toDays = { 
					'seconds': 1/86400, 'minutes': 1/1440, 'hours': 1/24, 
					'days': 1, 'weeks': 7, 'months': 30, 'years': 365 
				};

				let finalDays = 0;

				if (isRoh) {
					const mainPart = itemData.mainIngredient || "leaves";
					const rawData = PLANT_SHELF_LIFE_MAP[mainPart]?.raw || "12h";
					
					let baseNumber = parseFloat(rawData);
					if (isNaN(baseNumber) && rawData.includes("year")) baseNumber = 20; 

					const unitCode = String(rawData).replace(/[0-9.]/g, '');
					const unitMap = { 
						's': 'seconds', 'i': 'minutes', 'h': 'hours', 
						'd': 'days', 'w': 'weeks', 'm': 'months', 'y': 'years' 
					};
					let sourceUnit = unitMap[unitCode] || (rawData.includes("year") ? "years" : "hours");

					const baseInDays = baseNumber * (toDays[sourceUnit] || 1);

					finalDays = baseInDays * supernaturalFactor;
				} else {
					const mundaneValue = parseFloat(itemData.mundane?.shelfLife?.value) || 0;
					const mundaneUnit = itemData.processed?.shelfLife?.unit || itemData.shelfLife?.unit || "days";
					
					finalDays = mundaneValue * (toDays[mundaneUnit] || 1) * supernaturalFactor;
				}

				return await this.item.update({
					"system.remaining.shelfLife.value": Number(Math.round(finalDays * 10) / 10),
					"system.isSpoiled": false
				});
			},
						
			checkShelfLifeAction: async function(event, target) {
    const item = this.item;
    const actor = item.actor;

    if (!actor) {
        ui.notifications.warn("Die Pflanze muss sich in einem Inventar befinden.");
        return;
    }

    const skillName = game.i18n.localize("PLANT.skillPlantLore");
    const skill = actor.items.find(x => x.type == "skill" && x.name == skillName);
    
    if (skill) {
        const tokenId = actor.sheet?.getTokenId?.() || undefined;

        actor.setupSkill(skill, { subtitle: ` (${item.name})` }, tokenId).then(async (setupData) => {
            const res = await actor.basicTest(setupData);
            const availableQs = res.result.qualityStep || 0;

            if (availableQs > 0) {
                let valInDays = Number(item.system.remaining?.shelfLife?.value) || 0;
                let isSpoiledFlag = item.system.isSpoiled;

                let finalVal = 0;
                let finalUnit = "";

                // Einheiten-Kaskade
                if (valInDays >= 365) {
                    finalVal = valInDays / 365;
                    finalUnit = "years";
                } else if (valInDays >= 30) {
                    finalVal = valInDays / 30;
                    finalUnit = "months";
                } else if (valInDays >= 1) {
                    finalVal = valInDays;
                    finalUnit = "days";
                } else {
                    let hours = valInDays * 24;
                    if (hours >= 1) {
                        finalVal = hours;
                        finalUnit = "hours";
                    } else {
                        let minutes = hours * 60;
                        if (minutes >= 1) {
                            finalVal = minutes;
                            finalUnit = "minutes";
                        } else {
                            finalVal = minutes * 60;
                            finalUnit = "seconds";
                        }
                    }
                }

                finalVal = Number(Math.round(finalVal + "e+1") + "e-1");
                if (isNaN(finalVal)) finalVal = 0;

                let messageKey = "";
                let templateData = { itemName: item.name, val: finalVal };

                if (isSpoiledFlag) {
                    messageKey = "PLANT.shelfLifeSpoiled";
                } else if (valInDays <= 0) { 
                    messageKey = "PLANT.shelfLifeAlmostSpoiled";
                } else {
                    messageKey = "PLANT.shelfLifeRemainingMsg";
                    const grammarSuffix = (finalVal === 1) ? "Single" : "Plural";
                    templateData.unit = game.i18n.localize(`PLANT.shelfLifeUnits.${finalUnit}${grammarSuffix}`);
                }

                const localizedMessage = game.i18n.format(messageKey, templateData);

                const content = `
                    <div style="display: flex; justify-content: center; margin-bottom: 15px;">
                        <div class="spoiled-plant-image-click" 
                             data-uuid="${item.uuid}" 
                             title="${item.name} öffnen"
                             style="width: 55px; height: 55px; background-image: url('${item.img}'); background-size: contain; background-repeat: no-repeat; background-position: center; cursor: pointer;">
                        </div>
                    </div>
                    <p style="text-align: center; margin: 0;">${localizedMessage}</p>
                `;

                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    content: content,
                    whisper: [game.user.id] 
                });
            } else if (res.result) {
                ui.notifications.info(game.i18n.format("PLANT.skillTestFailed", { skill: skillName }));
            }
        });
    }
},
			
            workPlantAction: async function() { 
                try {
                    const actor = this.item.actor;
                    if (!actor) return;

                    let playerMenu = game.dsa5.apps.playerMenu || Object.values(ui.windows).find(app => app.constructor.name === "PlayerMenu");

                    if (!playerMenu) {
                        const { default: PlayerMenuClass } = await import('/systems/dsa5/modules/wizards/player_menu.js');
                        playerMenu = new PlayerMenuClass();
                        game.dsa5.apps.playerMenu = playerMenu;
                    }

                    await playerMenu.setActor(actor);
                    
                    const plantHelper = playerMenu.subApps.find(s => s.tabName === "PlantHelper");
                    if (plantHelper) {
                        await plantHelper.setupPlant(this.item);
                    }

                    playerMenu.bringToFront();
                } catch (error) {
                    console.error("DEBUG-SHEET | Fehler:", error);
                }
            },
            openPreservationDetails: async function(event, target) {
                new PlantPreservationDialog({ item: this.item }).render(true);
            },
            showSpoiledInfo: async function(event, target) {
                new PlantSpoiledDialog(this.item).render(true);
            }
        }
    });

    _getHeaderControls() {
        let controls = super._getHeaderControls();
        const hasConsumeMacro = !!(this.item.getFlag("dsa5", "onConsumeEffect")?.trim());
        
        controls.push({ 
            icon: "fa-solid fa-plant-wilt", 
            label: "PLANT.checkShelfLife", 
            action: "checkShelfLifeAction" 
        });

        controls.push({ icon: "fas fa-mortar-pestle", label: "PLANT.workButton", action: "workPlantAction" });
        
        if (hasConsumeMacro) {
            controls.push({ icon: "fas fa-cookie-bite", label: "PLANT.consume", action: "consumePlantAction" });
        }

        const seenActions = new Set();
        return controls.filter(c => {
            if (!c.action) return true;
            if (seenActions.has(c.action)) return false;
            seenActions.add(c.action);
            return true;
        });
    }

    async obfuscateItem(ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const section = ev.currentTarget.dataset.obfuscate;
        const newState = !this.isObfuscated(section);
        return await this.item.update({ [`system.obfuscation.${section}`]: newState });
    }

    isObfuscated(section) {
        return !!this.item.system.obfuscation?.[section];
    }

    async obfuscateTabs(options) {
        const tabs = ['details', 'effects', 'description', 'enchantment', 'work'];
        const html = $(this.element);
        for (let tab of tabs) {
            const ele = html.find(`nav [data-tab="${tab}"]`);
            if (!ele.length) continue;
            ele.find(".obfuscationBtn").remove();
            if (game.user.isGM) {
                const isPale = !this.isObfuscated(tab);
                ele.append(` <a data-tooltip="Abschnitt verschleiern" class="obfuscationBtn obfuscateSection${isPale ? ' pale' : ''}" data-obfuscate="${tab}"><i class="fas fa-mask"></i></a>`);
            } else if (this.isObfuscated(tab)) {
                ele.remove();
            }
        }
    }

    /**
     * MODIFIZIERTE DATEN-VORBEREITUNG
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const itemData = this.item.system;

        // Grundvoraussetzung für das Template
        context.document = this.item;
        
        // --- 1. IDENTITÄT UND DEFINITIONEN ---
        const plantIdentity = this.item.getFlag("dsa5", "originalBasePlant") || this.item.name;
        const localizedRauschgurke = game.i18n.localize("PLANT.rush_cucumber");

        // 2. Pflanzenteile aus Checkboxen sammeln
        const checkedParts = Object.keys(itemData.plantPart || {}).filter(k => itemData.plantPart[k]);
        
        if (plantIdentity === localizedRauschgurke) {
            if (!checkedParts.includes("rush_cucumber")) checkedParts.push("rush_cucumber");
        }

        // --- 3. BASIS-HALTBARKEIT (Dynamische Kaskade für die Anzeige) ---
        let mainPart = itemData.mainIngredient || "leaves";
        if (plantIdentity === localizedRauschgurke) {
            mainPart = "rush_cucumber";
        }

        const rawData = PLANT_SHELF_LIFE_MAP[mainPart]?.raw || "12h";
        
        // Umrechnung des Rohwerts (z.B. "720h" oder "years") in Tage
        let baseNumber = parseFloat(rawData);
        if (isNaN(baseNumber) && rawData.includes("year")) baseNumber = 20; // Fallback für reine Text-Werte
        
        const unitCode = String(rawData).replace(/[0-9.]/g, '');
        const unitMap = { 's': 'seconds', 'i': 'minutes', 'h': 'hours', 'd': 'days', 'w': 'weeks', 'm': 'months', 'y': 'years' };
        let sourceUnit = unitMap[unitCode] || (rawData.includes("year") ? "years" : "hours");

        const toDays = { 'seconds': 1/86400, 'minutes': 1/1440, 'hours': 1/24, 'days': 1, 'weeks': 7, 'months': 30, 'years': 365 };
        let valInDays = baseNumber * (toDays[sourceUnit] || 1);

        // --- DYNAMISCHE EINHEITEN-WAHL (Die Kaskade) ---
        let displayValue = 0;
        let finalUnit = "";

        if (valInDays >= 365) {
            displayValue = valInDays / 365;
            finalUnit = "years";
        } else if (valInDays >= 30) {
            displayValue = valInDays / 30;
            finalUnit = "months";
        } else if (valInDays >= 1) {
            displayValue = valInDays;
            finalUnit = "days";
        } else {
            let hours = valInDays * 24;
            if (hours >= 1) {
                displayValue = hours;
                finalUnit = "hours";
            } else {
                let minutes = hours * 60;
                if (minutes >= 1) {
                    displayValue = minutes;
                    finalUnit = "minutes";
                } else {
                    displayValue = minutes * 60;
                    finalUnit = "seconds";
                }
            }
        }

        // Präzise Rundung auf max. 1 Nachkommastelle
        displayValue = Number(Math.round(displayValue + "e+1") + "e-1");

        // 4. Prüfen, ob das Mundane-Feld leer ist (Rohzustand)
        const mundaneVal = itemData.mundane?.shelfLife?.value;
        const isMundaneEmpty = (mundaneVal === null || mundaneVal === undefined || mundaneVal === "");
        context.isMundaneEmpty = isMundaneEmpty;

        // 5. UNIT-LOGIK (Sicherheitscheck: Manuelle Wahl vs. Kaskade)
        let unitLong;
        if (isMundaneEmpty) {
            unitLong = finalUnit;
        } else {
            const savedUnit = itemData.processed?.shelfLife?.unit || itemData.shelfLife?.unit;
            
            unitLong = (savedUnit && savedUnit !== "" && !savedUnit.includes(",")) ? savedUnit : finalUnit;
        }


        if (unitLong !== finalUnit) {
            const fromDays = { 'seconds': 86400, 'minutes': 1440, 'hours': 24, 'days': 1, 'weeks': 1/7, 'months': 1/30, 'years': 1/365 };
            displayValue = valInDays * (fromDays[unitLong] || 1);
            displayValue = Number(Math.round(displayValue + "e+1") + "e-1");
        }

        const grammarSuffix = (displayValue === 1) ? "Single" : "Plural";
        context.rawUnit = unitLong; // Das sorgt dafür, dass das Dropdown auf der richtigen Stelle steht
        context.rawUnitLabel = game.i18n.localize(`PLANT.shelfLifeUnits.${unitLong}${grammarSuffix}`);
        context.rawPlaceholderValue = game.i18n.format("PLANT.rawStatus", { val: displayValue });

        // 6. Dropdown-Optionen für Zeiteinheiten
        const unitsForSelect = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
        context.shelfLifeDropdownOptions = unitsForSelect.reduce((acc, key) => {
            acc[key] = game.i18n.localize(`PLANT.shelfLifeUnits.${key}Select`);
            return acc;
        }, {});

        // --- 7. METHODEN-LOGIK ---
        let genericMethods = [];
        for (const p of checkedParts) {
            if (PLANT_SHELF_LIFE_MAP[p]?.methods) {
                genericMethods.push(...PLANT_SHELF_LIFE_MAP[p].methods);
            }
        }

        let specificMethods = [];
        for (const [plantKey, methods] of Object.entries(SPECIFIC_PLANT_METHODS)) {
            const localizedPlantBaseName = game.i18n.localize(`PLANT.specificPlants.${plantKey}`);
            const isPlantMatch = (localizedPlantBaseName === plantIdentity);
            const isParenthesisMatch = this.item.name.startsWith(localizedPlantBaseName) && this.item.name.includes("(");
            const isProductMatch = methods.some(m => m.p && game.i18n.localize(`PLANT.products.${m.p}`) === this.item.name);

            if (isPlantMatch || isParenthesisMatch || isProductMatch) {
                specificMethods = methods;
                break; 
            }
        }

        context.availableMethods = {};
        genericMethods.forEach(method => {
            context.availableMethods[method.m] = game.i18n.localize(`PLANT.states.${method.m}`);
        });

        specificMethods.forEach(method => {
            const specKey = method.m + "_spec";
            if (method.p) {
                context.availableMethods[specKey] = game.i18n.localize(`PLANT.products.${method.p}`);
            } else {
                context.availableMethods[specKey] = game.i18n.localize(`PLANT.states.${method.m}`) + " (Spezial)";
            }
        });

        // --- 8. ZUSTÄNDE UND FLAGS ---
        context.plantStates = {
            "Roh": game.i18n.localize("PLANT.stateRaw"),
            "Haltbargemacht": game.i18n.localize("PLANT.statePreserved")
        };

        context.isAlreadyPreservedSupernatural = (itemData.supernatural?.factor || 1) > 1;
        context.isSpoiled = itemData.isSpoiled;

        const plantParts = itemData.plantPart || {};
        context.plantPartList = Object.keys(plantParts).map(key => ({ 
            key, 
            path: `system.plantPart.${key}`, 
            localizedLabel: game.i18n.localize(`PLANT.${key}`), 
            value: plantParts[key], 
            isMain: itemData.mainIngredient === key 
        }));

        // 9. OPTISCHER WORKAROUND FÜR DROP-DOWN
        const currentMethod = itemData.preservationMethod;
        if (currentMethod && !currentMethod.includes("_spec") && specificMethods.some(m => m.m === currentMethod)) {
             const isSpecificResult = specificMethods.some(m => (m.p && game.i18n.localize(`PLANT.products.${m.p}`) === this.item.name) || (this.item.name.includes("(")));
             if (isSpecificResult) {
                 context.document = foundry.utils.deepClone(this.item);
                 context.document.system.preservationMethod = currentMethod + "_spec";
             }
        }

        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.obfuscateTabs(context);
        const html = $(this.element);

        // --- CSS INJECTION FÜR DRAG & DROP UND TABS ---
        if (!html.find('#plant-sheet-custom-css').length) {
            html.prepend(`
            <style id="plant-sheet-custom-css">
                /* 1. NEU: System-Overlay killen, das sich heimlich über alles legt und Klicks stiehlt */
                .plant-sheet.dsaDraggedOver::after,
                .plant-sheet form.dsaDraggedOver::after,
                .plant-sheet .window-content.dsaDraggedOver::after { 
                    display: none !important; 
                    pointer-events: none !important; 
                }

                /* 2. Basis-Styling der Drop-Fläche (Z-Index erhöht, um immer oben zu liegen) */
                .drop-area-full { position: relative; z-index: 100; width: 100%; min-height: 110px; margin-top: 5px; border-radius: 8px; transition: all 0.2s ease; display: flex; flex-direction: column; }
                
                /* Platzhalter-Inhalt (Icon & Text) */
                .drop-zone-placeholder { pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 10px; border: 2px dashed #666; border-radius: 8px; height: 100%; }
                .drop-zone-placeholder i { font-size: 2.5em !important; margin: 0 !important; }
                .drop-zone-placeholder p { font-size: 1.1em !important; font-weight: bold; margin: 0 !important; }
                
                /* 3. Einträge in der Liste (Abstand & Klick-Optik) */
                .recipe-entry { margin-top: 8px; cursor: pointer; transition: transform 0.1s ease; position: relative; z-index: 101; }
                .recipe-entry:hover { transform: translateX(3px); }
                
                /* 4. Spezifische Highlights (nutzt unsere eigene Hover-Klasse!) */
                .drop-area[data-type="auxiliary"].plant-drag-hover { background-color: rgba(161, 202, 88, 0.2) !important; }
                .drop-area[data-type="auxiliary"].plant-drag-hover .drop-zone-placeholder { border: 2px solid #A1CA58 !important; color: #A1CA58 !important; }
                
                .drop-area[data-type="poison"].plant-drag-hover { background-color: rgba(204, 78, 82, 0.2) !important; }
                .drop-area[data-type="poison"].plant-drag-hover .drop-zone-placeholder { border: 2px solid #CC4E52 !important; color: #CC4E52 !important; }
                
                .drop-area[data-type="drug"].plant-drag-hover { background-color: rgba(72, 203, 186, 0.2) !important; }
                .drop-area[data-type="drug"].plant-drag-hover .drop-zone-placeholder { border: 2px solid #48CBBA !important; color: #48CBBA !important; }
                
                /* 5. Erzwingt Linksbündigkeit für die einklappbaren Tabs im Dialog */
                .plant-work-gui-root .left-aligned-details summary { display: flex !important; align-items: center; justify-content: flex-start !important; text-align: left !important; gap: 8px; padding: 5px; cursor: pointer; }
                .plant-work-gui-root .left-aligned-details summary i { width: 1.5em; text-align: center; }
                .plant-work-gui-root details.groupbox { margin-bottom: 5px; }
            </style>
            `);
        }
        
        // Verdorben-Checkbox Logik
		html.find('input[name="system.isSpoiled"]').on('change', async (ev) => { 
			const checked = ev.currentTarget.checked;
			if (checked) {
				if (!this.item.getFlag("dsa5", "spoiledResult")) {
					const roll = await new Roll("1d20").evaluate();
					let res = String(roll.total);
					const v = roll.total;
					if (v >= 3 && v <= 5) res = "3_5"; else if (v >= 6 && v <= 7) res = "6_7"; 
					else if (v >= 8 && v <= 9) res = "8_9"; else if (v >= 11 && v <= 12) res = "11_12"; 
					else if (v >= 14 && v <= 15) res = "14_15";

					await this.item.update({ "system.isSpoiled": true, "flags.dsa5.spoiledResult": res });
					await roll.toMessage({ flavor: `<b>${this.item.name}</b>`, rollMode: CONST.DICE_ROLL_MODES.BLIND });
                    
					await PlantSpoiledDialog.sendSpoiledMessage(this.item, res);
				}
			} else {
				await this.item.update({ "system.isSpoiled": false, "flags.dsa5.-=spoiledResult": null });
			}
            
            for (const app of foundry.applications.instances.values()) {
                if (app.id === `plant-spoiled-dialog-${this.item.id}`) {
                    app.render(true);
                    break;
                }
            }
		});

        // Drag & Drop visuelles Feedback (jetzt mit eigener Klasse!)
        html.find('.drop-area').on('dragenter dragover', (ev) => { 
            ev.preventDefault(); 
            ev.stopPropagation(); 
            $(ev.currentTarget).addClass('plant-drag-hover'); 
        }).on('dragleave drop', (ev) => { 
            $(ev.currentTarget).removeClass('plant-drag-hover'); 
        });

        // Klick auf ein Rezept öffnet das Item-Sheet
        html.find('.recipe-entry').on('click', async (ev) => { 
            // Den Namen aus dem Element extrahieren (entweder data-name oder aus dem Text)
            let itemName = ev.currentTarget.dataset.name || ev.currentTarget.querySelector('.content-link')?.innerText?.trim();

            if (itemName) {
                // Dynamische Suche über Welt-Items und alle Kompendien
                let item = game.items.find(i => i.name === itemName);
                if (!item) {
                    for (let pack of game.packs) {
                        if (pack.documentName !== "Item") continue;
                        const index = await pack.getIndex();
                        const entry = index.find(e => e.name === itemName);
                        if (entry) { item = await pack.getDocument(entry._id); break; }
                    }
                }
                
                // Rückfall-Netz: Falls der Name nicht klappt, UUID probieren
                if (!item) {
                    const uuid = ev.currentTarget.querySelector('.content-link')?.dataset.uuid;
                    if (uuid) item = await fromUuid(uuid);
                }

                if (item) item.sheet.render(true); 
            }
        });

        // Rechtsklick auf ein Rezept löscht es aus der Liste
        html.find('.recipe-entry').on('contextmenu', async (ev) => { 
            ev.preventDefault(); 
            const { id, type } = ev.currentTarget.dataset; 
            let listName = type === 'poison' ? 'poisonRecipes' : (type === 'drug' ? 'drugRecipes' : 'auxiliaryRecipes'); 
            const recipes = Array.from(this.document.system[listName] || []); 
            await this.document.update({ [`system.${listName}`]: recipes.filter(r => r.id !== id) }); 
        });

        // Rechtsklick auf den Radiobutton (Hauptbestandteil) entfernt die Auswahl
        html.find('input[type="radio"][name="system.mainIngredient"]').on('contextmenu', async (ev) => { 
            ev.preventDefault(); 
            if (ev.currentTarget.checked) await this.document.update({ "system.mainIngredient": "" }); 
        });
    }

    async _onDrop(event) {
        let data; try { data = JSON.parse(event.dataTransfer.getData('text/plain')); } catch (err) { return super._onDrop(event); }
        if (data.type !== "Item") return super._onDrop(event);
        const dropArea = event.target.closest('.drop-area'); if (!dropArea) return super._onDrop(event);
        const item = await Item.fromDropData(data);
        if (item) {
            let listName = dropArea.dataset.type === 'poison' ? 'poisonRecipes' : (dropArea.dataset.type === 'drug' ? 'drugRecipes' : 'auxiliaryRecipes');
            const recipes = foundry.utils.deepClone(this.item.system[listName] || []);
            if (!recipes.find(r => r.id === item.id)) { 
                recipes.push({ id: item.id, name: item.name, img: item.img, uuid: item.uuid }); 
                await this.item.update({ [`system.${listName}`]: recipes }); 
            }
        }
    }
}

class PatronSheet extends NoEffectsSheet { }

class ApplicationSheetDSA5 extends LocalizerWithoutEffectsSheet { }

class MagicalSignSheet extends NoEffectsSheet {
  hasRollEffect = true;

  async setupEffect() {
    const aspcost = Number(this.item.system.asp) || 0;
    if (this.actor.system.status.astralenergy.value < aspcost)
      return ui.notifications.error('DSAError.NotEnoughAsP', {
        localize: true,
      });

    const actor = this.actor;
    const sign = this.item.system.chatDataToString();
    const skill = actor.items.find((x) => x.type == 'skill' && x.name == localize('LocalizedIDs.artisticAbility'));
    const chatMessage = `<hr/><p><b>${this.item.name}</b></p><p>${this.item.system.description.value}</p><p>${sign}<span class="costCheck"></span></p>`;
    const setupData = await actor.setupSkill(skill, { other: [chatMessage], subtitle: ` (${localize('TYPES.Item.magicalsign')})` }, undefined);
    const res = await actor.basicTest(setupData, { suppressMessage: true });
    res.result.preData.calculatedSpellModifiers = { finalcost: aspcost, costsMana: true };
    await DiceDSA5.renderRollCard(res.cardOptions, res.result, res.options.rerenderMessage);
  }
}

class ItemBookDSA5 extends ItemSheetObfuscation(Enchantable) { }

class WeaponSheetDSA5 extends ItemSheetObfuscation(Enchantable) {
  static DEFAULT_OPTIONS = {
    actions: {
      rollDamaged: function () {
        EquipmentDamage.breakingTest(this.item);
      },
    },
    ownerActions: {
      attackAdd: WeaponSheetDSA5.addAttackSheet,
      attackDelete: WeaponSheetDSA5.deleteAttack,
    },
    majorButtons: [
      {
        label: 'WEAR.checkShort',
        icon: 'fas fa-dice-d20',
        action: 'rollDamaged',
        visible: function () {
          return this.actor && game.settings.get('dsa5', 'armorAndWeaponDamage') && this.item.system.structure.max > 0;
        },
      },
    ],
  };

  tabGroups = {
    alternateAttacks: 'baseAttack',
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.alternateAttackTab = this.tabGroups.alternateAttacks;
    data.alternateAttacks = getProperty(this.item, 'flags.dsa5.alternateAttacks');
    data.hasAlternateAttacks = data.alternateAttacks && Object.keys(data.alternateAttacks).length > 0;
    return data;
  }

  _onClickTab(event) {
    super._onClickTab(event);
    if (event.target.dataset.tab == 'details') this.changeTab('baseAttack', 'alternateAttacks');
  }

  static async deleteAttack(event, target) {
    this.tabGroups.alternateAttacks = 'baseAttack';
    await this.item.update({ [`flags.dsa5.alternateAttacks.-=${target.dataset.key}`]: null });
  }

  static async addAttackSheet() {
    const attackName = foundry.utils.randomID();

    await this.item.update({
      flags: {
        dsa5: {
          alternateAttacks: {
            [attackName]: {
              name: localize('CHAR.ATTACK'),
            },
          },
        },
      },
    });
  }
}

class RangeweaponSheet extends WeaponSheetDSA5 {
  get isPoisonable() {
    return localize(`LocalizedCTs.${this.item.system.combatskill.value}`) == 'Throwing Weapons';
  }
}

class BlessingSheetDSA5 extends MacroOnlyEffectsSheet {
  get hasRollEffect() {
    return this.actor && !foundry.utils.getProperty(this.item, 'flags.dsa5.onUseEffect');
  }

  async setupEffect() {
    if (this.actor.system.status.karmaenergy.value < 1)
      return ui.notifications.error('DSAError.NotEnoughKaP', { localize: true, });

    await this.actor.update({ 'system.status.karmaenergy.value': (this.actor.system.status.karmaenergy.value -= 1), });
    const cantrip = this.item.system.chatDataToString();
    const chatMessage = await renderTemplate('systems/dsa5/templates/chat/roll/simpleability.hbs', {
      item: this.item,
      cantrip: cantrip,
    });
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
  }
}

class ItemCareerDSA5 extends NoEffectsSheet {
  static PARTS = {
    header: super.PARTS.header,
    stat: super.PARTS.stat,
    tabs: super.PARTS.tabs,
    description: {
      template: 'systems/dsa5/templates/items/item-career-description.hbs',
      scrollable: [''],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 700,
      height: 700,
    },
  };
}

class ConsumableSheetDSA5 extends ItemSheetObfuscation(ItemSheetdsa5) {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-consumable-stats.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/items/item-aoe.hbs'],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 480,
    },
    actions: {
      consumeItem: function () {
        this.setupEffect();
      },
    },
    majorButtons: [
      {
        label: 'SHEET.ConsumeItem',
        icon: 'fas fa-dice-d20',
        action: 'consumeItem',
        visible: function () {
          return this.actor;
        },
      },
    ],
  };

  setupEffect() {
    this.item.setupEffect();
  }
}

class ItemCultureDSA5 extends NoEffectsSheet {
  static PARTS = {
    header: super.PARTS.header,
    stat: super.PARTS.stat,
    tabs: super.PARTS.tabs,
    description: {
      template: 'systems/dsa5/templates/items/item-culture-description.hbs',
      scrollable: [''],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 700,
      height: 700,
    },
  };
}

class DiseaseSheetDSA5 extends WithEffectsSheet {
  hasRollEffect = true;
}

class MagictrickSheetDSA5 extends MacroOnlyEffectsSheet {
  get hasRollEffect() {
    return this.actor && !foundry.utils.getProperty(this.item, 'flags.dsa5.onUseEffect');
  }

  async setupEffect() {
    if (this.actor.system.status.astralenergy.value < 1)
      return ui.notifications.error('DSAError.NotEnoughAsP', { localize: true });

    await this.actor.update({ 'system.status.astralenergy.value': (this.actor.system.status.astralenergy.value -= 1), });
    const cantrip = this.item.system.chatDataToString();
    const chatMessage = await renderTemplate('systems/dsa5/templates/chat/roll/simpleability.hbs', {
      item: this.item,
      cantrip: cantrip
    });
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
  }
}

class MeleeweaponSheetDSA5 extends WeaponSheetDSA5 {
  isPoisonable = true;

  async _prepareContext(_options) {
    const context = await super._prepareContext(_options);
    context.isBrawling = localize(`LocalizedCTs.${this.item.system.combatskill.value}`) === 'Brawling';
    return context;
  }
}

class PoisonSheetDSA5 extends ItemSheetObfuscation(EffectsEquipmentSheet) {
  hasRollEffect = true;
}

class SpecialAbilitySheetDSA5 extends WithEffectsSheet {
  async _refundStep() {
    const value = this.item.system.step.value;
    if (value > 1) {
      let xpCost = this.item.system.refundCost();
      xpCost = await SpecialabilityRulesDSA5.refundFreelanguage(this.item, this.actor, xpCost, false);
      await this.actor._updateAPs(xpCost * -1, {}, { render: false });
      await this.item.update({ 'system.step.value': value - 1 });
      await APTracker.track(this.actor, { type: 'item', item: this.item, previous: value, next: value - 1 }, xpCost);
      return true;
    }
  }

  async _advanceStep() {
    const value = this.item.system.step.value;
    if (value < this.item.system.maxRank.value) {
      let xpCost = this.item.system.advanceCost();
      xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(this.item, this.actor, xpCost, false);
      if (await this.actor.checkEnoughXP(xpCost)) {
        await this.actor._updateAPs(xpCost, {}, { render: false });
        await this.item.update({ 'system.step.value': value + 1 });
        await APTracker.track(this.actor, { type: 'item', item: this.item, previous: value, next: value + 1 }, xpCost);
        return true;
      }
    }
  }

  _advancable() {
    return this.item.system.maxRank.value > 0;
  }
}

class ItemSpeciesDSA5 extends NoEffectsSheet {
  static PARTS = {
    header: super.PARTS.header,
    stat: super.PARTS.stat,
    tabs: super.PARTS.tabs,
    description: {
      template: 'systems/dsa5/templates/items/item-species-description.hbs',
      scrollable: [''],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 530,
      height: 570,
    },
  };
}

class SpellSheetDSA5 extends AdvancableSkill(ItemSheetdsa5) {
  _maxAllowedAdvancement(maxBonus) {
    let focusValue = 0;
    switch (this.item.type) {
      case 'spell':
      case 'ritual':
        for (const feature of this.item.system.feature
          .replace(/\(a-z äöü-\)/gi, '')
          .split(',')
          .map((x) => x.trim())) {
          if (SpecialabilityRulesDSA5.hasAbility(this.actor, `${localize('LocalizedIDs.propertyKnowledge')} (${feature})`, false)) {
            focusValue = this.maxByAttr(maxBonus);
            break;
          }
        }
        break;
      case 'liturgy':
      case 'ceremony':
        const aspect = new RegExp(`^${localize('LocalizedIDs.aspectKnowledge')}`);
        if (
          this.actor.items
            .filter((x) => x.type == 'specialability' && aspect.test(x.name))
            .some((x) => this.item.system.distribution.value.includes(x.name.split('(')[1].split(')')[0]))
        ) {
          focusValue = this.maxByAttr(maxBonus);
        }
        break;
    }
    return Math.max(14 + maxBonus, focusValue);
  }

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-stat.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: [''],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: [''],
    },
    extensions: {
      template: 'systems/dsa5/templates/items/item-extension.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/items/item-aoe.hbs'],
    },
  };

  static DEFAULT_OPTIONS = {
    ownerActions: {
      itemDelete: this._deleteExtension,
      itemEdit: this._editExtension,
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'details', label: 'Details' },
        { id: 'extensions', label: 'extensions' },
        { id: 'effects', label: 'statuseffects' },
      ],
      initial: 'description',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    if (data.isOwned) {
      data.extensions = this.actor.items.filter((x) => {
        return x.type == 'spellextension' && x.system.source == this.item.name && this.item.type == x.system.category;
      });
    }
    return data;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.actor) delete tabs.extensions;
    return tabs;
  }

  static _editExtension(ev, target) {
    let itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    item.sheet.render(true);
  }

  static async _deleteExtension(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.find((x) => x.id == itemId);
    const message = game.i18n.format('DIALOG.DeleteItemDetail', {
      item: item.name,
    });
    const content = await renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.hbs', { message });
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'DIALOG.deleteConfirmation',
      },
      content,
      rejectClose: false,
      modal: true,
    });
    if (proceed) {
      this._cleverDeleteItem(itemId);
      $(target).closest('.item').remove();
    }
  }

  async _cleverDeleteItem(itemId) {
    let item = this.actor.items.find((x) => x.id == itemId);
    await this.actor._updateAPs(-1 * item.system.APValue.value, {}, { render: false });
    await this.actor.deleteEmbeddedDocuments('Item', [itemId]);
    await APTracker.track(this.actor, { type: 'item', item, state: -1 }, apCost);
  }
}

class SpellExtensionSheetDSA5 extends WithEffectsSheet { }

class VantageSheetDSA5 extends WithEffectsSheet {
  _advancable() {
    return this.item.system.max.value > 0;
  }

  async _refundStep() {
    const value = this.item.system.step.value;
    if (value > 1) {
      let xpCost = this.item.system.refundCost();
      xpCost = await AdvantageRulesDSA5.reduceSingularVantages(this.actor, this.item, xpCost);
      await this.actor._updateAPs(xpCost * -1, {}, { render: false });
      await this.item.update({ 'system.step.value': value - 1 });
      await APTracker.track(this.actor, { type: 'item', item: this.item, previous: value, next: value - 1 }, xpCost);
      return true;
    }
  }

  async _advanceStep() {
    const value = this.item.system.step.value;
    if (value < this.item.system.max.value) {
      let xpCost = this.item.system.advanceCost();
      const dup = duplicate(this.item);
      dup.system.step.value += 1;
      xpCost = await AdvantageRulesDSA5.addSingularVantages(this.actor, dup, xpCost);
      if (await this.actor.checkEnoughXP(xpCost)) {
        await this.actor._updateAPs(xpCost, {}, { render: false });
        await this.item.update({ 'system.step.value': value + 1 });
        await APTracker.track(this.actor, { type: 'item', item: this.item, previous: value, next: value + 1 }, xpCost);
        return true;
      }
    }
  }
}


Hooks.on("renderChatMessage", (app, html, msg) => {
    const jhtml = $(html);
    

    jhtml.find('.spoiled-plant-image-click').each(function(i, element) {
        

        element.addEventListener("click", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const uuid = element.dataset.uuid;
            if (uuid) {
                const document = await fromUuid(uuid);
                if (document && document.sheet) {
                    document.sheet.render(true);
                }
            }
        });
        
    });
});
