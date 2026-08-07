import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import { bindItemHeaderTitle, itemFromDrop, tabSlider } from '../system/helpers/view_helper.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import EquipmentDamage from '../system/automation/equipment-damage.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import { ItemSheetObfuscation } from './mixins/obfuscatemixin.js';
import { InformableSheet } from './mixins/informablesheet.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import GroupCheck from '../system/rolls/group-check.js';
import APTracker from '../system/orwell/ap-tracker.js';
import { AppV2Mixin } from '../actor/mixins/appv2_mixin.js';
import MeleeweaponData from '../data/item/meleeweapon.js';
import TraitData from '../data/item/trait.js';
import MagicAnalysisService from '../system/magic-analysis/magic-analysis.js';
import MagicAnalysisContentResolver from '../system/magic-analysis/magic-analysis-content-resolver.js';
import ItemEnchantment from './item-enchantment.js';

const { mergeObject, getProperty, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class ItemSheetdsa5 extends AppV2Mixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const overrides = foundry.utils.flattenObject(this.item.overrides || {});
    Object.keys(overrides).forEach((v) => foundry.utils.deleteProperty(data, v));
    return data;
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
      addOnUseAction: this.addOnUseAction,
      editOnUseAction: this.editOnUseAction,
      deleteOnUseAction: this.deleteOnUseAction,
      rolleffect: function () {
        this.setupEffect();
      },
      conditionShow: { handler: this.showCondition, buttons: [0, 2] },
    },
    ownerActions: {
      _advanceStep: this.advanceWrapper,
      _refundStep: this.advanceWrapper,
      headerOnUseEffect: {
        handler: async function (ev) {
          const onUse = new OnUseEffect(this.item);
          await onUse.executeOnUseEffect(OnUseEffect.buildExecutionOptions(ev));
        },
        buttons: [0, 2],
      },
      statusAdd: function () {
        DSA5StatusEffects.createCustomEffect(this.item, '', this.item.name);
      },
      enhancementAdd: this.addEnhancementEffect,
      conditionEdit: this.editCondition,
      conditionToggle: this.toggleCondition,
    },
    majorButtons: [
      {
        icon: 'fas fa-dice-six',
        label: 'SHEET.onUseEffect',
        action: 'headerOnUseEffect',
        visible: function () {
          return this.actor && OnUseEffect.hasOnUseEffect(this.item);
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
      { sheetClass: ItempackageSheet, types: ['itempackage'] },
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
    if (this.isEffectDisabledBySetting(ef)) {
      ui.notifications.info(_loc('DSASETTINGS.enableWeaponAdvantagesHint'));
      return;
    }
    ef.update({ disabled: !ef.disabled });
  }

  isEffectDisabledBySetting(effect) {
    return !!(effect?.system?.equipmentAdvantage && !game.settings.get('dsa5', 'enableWeaponAdvantages'));
  }

  _decorateSheetEffect(effect) {
    const disabledBySetting = this.isEffectDisabledBySetting(effect);
    effect.disabledBySetting = disabledBySetting;
    effect.sheetDisabled = effect.disabled || disabledBySetting;
    return effect;
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

    const renderedParts = options.parts;
    if (!renderedParts || renderedParts.includes('header')) {
      bindItemHeaderTitle(html);
    }

  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    this.wrapperLocked = false;

    data.isOwned = this.actor;
    data.editable = this.isEditable;
    data.systemFields = this.document.system.schema.fields;

    if (data.isOwned) {
      data.canAdvance = this.actor.canAdvance && this._advancable();
      const customPrice = getProperty(this.item, 'flags.dsa5.customPriceTag');

      if (!this.isEditable && customPrice) data.customPrice = customPrice;
    }

    data.enableWeaponAdvantages = game.settings.get('dsa5', 'enableWeaponAdvantages');
    data.armorAndWeaponDamage = game.settings.get('dsa5', 'armorAndWeaponDamage');
    data.isGM = game.user.isGM;
    data.enrichedDescription = await TextEditor.enrichHTML(getProperty(this.item.system, 'description.value'), { secrets: this.item.isOwner });
    data.enrichedGmdescription = await TextEditor.enrichHTML(getProperty(this.item.system, 'gmdescription.value'), { secrets: this.item.isOwner });
    data.canOnUseEffect = this.isEditable && this.item.system.implementsOnUseEffect && (game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'));
    data.canEditMacros = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    data.onUseActions = OnUseEffect.getOnUseActions(this.item);

    await this.item.system.getSheetData(data);

    const allEffects = Array.from(data.conditions || this.item.effects)
      .filter((effect) => game.user.isGM || !effect.system?.visibility?.hidePlayers);

    data.conditions = allEffects
      .filter((effect) => effect.type !== 'enhancement')
      .map((effect) => this._decorateSheetEffect(effect));

    data.enhancementEffects = allEffects
      .filter((effect) => effect.type === 'enhancement')
      .map((effect) => this._decorateSheetEffect(effect));

    data.supportsEnhancements = !!CONFIG.Item.dataModels[this.item.type]?.ENHANCEMENT_SLOT_LIMITS;

    data.transferedConditions = Array.from(data.transferedConditions || []).map((effect) => this._decorateSheetEffect(effect));

    return data;
  }

  static async addOnUseAction() {
    if (!(game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'))) return;
    await this.item.system.createOnUseAction();
  }

  static async addEnhancementEffect() {
    const effects = await this.item.createEmbeddedDocuments('ActiveEffect', [{
      name: _loc('TYPES.ActiveEffect.enhancement'),
      type: 'enhancement',
      img: 'systems/dsa5/icons/talents/Metallbearbeitung.webp',
      'system.targetType': this.item.type,
    }]);
    effects[0]?.sheet?.render(true);
  }

  static async editOnUseAction(_event, target) {
    if (!(game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'))) return;
    await this.item.system.editOnUseAction(target.dataset.id);
  }

  static async deleteOnUseAction(_event, target) {
    if (!(game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'))) return;
    await this.item.system.removeOnUseAction(target.dataset.id);
  }

  _advancable() {
    return false;
  }

  async _handleDrop(dragData) {
    if (!this.item.system.implementsOnUseEffect) return;
    if (!(game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'))) return;

    let code;
    if (dragData.type == 'Macro') {
      const item = await fromUuid(dragData.uuid);
      if (!item) return;
      if (!item.pack) return ui.notifications.info('DSAError.onlyCompendiumSpells', { format: { element: '"Macro"' }, localize: true });

      code = `this.callMacro("${item.pack}", "${item.name}")`;
    } else if (dragData.type == 'DSALight') {
      code = `game.dsa5.apps.LightDialog.applyVisionOrLight(true, "${dragData.key}", actor.getActiveTokens(), item.name)`;
    }

    if (!code) return;

    await this.item.system.addOnUseAction({ macro: code });
  }

  async _onDrop(event) {
    await super._onDrop(event);
    this._handleDrop(event.dsaDropData ?? {});
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
      const maxBonus = AdvantageRulesDSA5.vantageStep(this.actor, `${_loc(this.advanceSkill)} (${this.item.name})`, false);
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

  async _onDropActiveEffect() {
    return null;
  }

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

  async _onDropActiveEffect() {
    return null;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    delete tabs.effects;
    return tabs;
  }
}

class ItempackageSheet extends NoEffectsSheet {
  static DEFAULT_OPTIONS = {
    position: {
      width: 600,
    },
    actions: {
      addPackageItem: this.#addPackageItem,
      deletePackageItem: this.#deletePackageItem,
      showPackageContents: this.#showPackageContents,
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.packageItems = this.item.system.items;
    data.itemFields = this.item.system.schema.fields.items.element.fields;
    data.equipmentCategories = Object.fromEntries([...DSA5.equipmentCategories].map(c => [c, _loc(`TYPES.Item.${c}`)]));
    return data;
  }

  static #addPackageItem() {
    this.item.system.addItem();
  }

  static #deletePackageItem(_event, target) {
    this.item.system.removeItem(target.dataset.key);
  }

  static #showPackageContents() {
    this.item.system.showContents();
  }

  async _handleDrop(dragData) {
    const { item, typeClass } = await itemFromDrop(dragData, undefined, false);
    if (!DSA5.equipmentCategories.has(typeClass)) return;

    this.item.system.addItem(item.name, typeClass, 1, 0, item.system?.price?.value ?? 0);
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

class SkillSheet extends AdvancableSkill(LocalizerSheet) {
  static PARTS = {
    ...LocalizerSheet.PARTS,
    applications: {
      template: 'systems/dsa5/templates/items/item-skill-applications.hbs',
      scrollable: [''],
    },
  };

  static DEFAULT_OPTIONS = {
    ownerActions: {
      applicationToggle: this._toggleApplication,
      applicationEdit: this._editApplication,
      applicationDelete: this._deleteApplication,
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'details', label: 'Details' },
        { id: 'applications', label: 'TYPES.Item.application' },
        { id: 'effects', label: 'statuseffects' },
      ],
      initial: 'description',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.applications = [];

    if (data.isOwned && this.actor) {
      const skillName = String(this.item.name || '').trim().toLowerCase();
      data.applications = this.actor.items.filter((x) => x.type == 'application' && String(x.system.skill || '').trim().toLowerCase() == skillName);
    }

    return data;
  }

  static async _deleteApplication(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.find((x) => x.id == itemId);
    if (!item) return;

    await this.actor.sheet._itemDeleteDialog(item);
  }

  static _editApplication(ev, target) {
    const itemId = this._getItemId(target);
    this.actor.items.get(itemId)?.sheet.render(true);
  }

  static _toggleApplication(ev, target) {
    const elem = $(target);
    elem.find('i').toggleClass('fa-chevron-down fa-chevron-up');
    elem.closest('.item').find('.expandDetails:first').toggleClass('shown');
  }
}

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

    GroupCheck.openDialog({
      configuration: {
        rollOptions,
        maxRolls: this.item.system.allowedTestCount.value,
        targetQs: 10,
        partsuccess: this.item.system.partsuccess,
        success: this.item.system.success,
      },
    });
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
      showDragHint: true,
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
    const { item, typeClass, _selfTarget } = await itemFromDrop(dragData, undefined);
    if (!DSA5.equipmentCategories.has(typeClass)) return;

    this.item.setFlag('dsa5', 'embeddedItem', item);
  }
}

class Enchantable extends InformableSheet(ItemSheetdsa5) {
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
      enchExtDelete: this._enchExtDelete,
      poisonTogglePermanent: this._poisonTogglePermanent,
      poisonDelete: this._deletePoison,
      poisonShow: this._poisonShow,
    },
  };

  static _togglePermanent(ev, target) {
    const { id, enchantments } = this.enchantMentId(target);
    for (const ench of enchantments) {
      if (ench.id == id) {
        ench.permanent = !ench.permanent;
        break;
      }
    }
    this.item.update({ flags: { dsa5: { enchantments } } });
  }

  static _toggleCharge(ev, target) {
    const { id, enchantments } = this.enchantMentId(target);
    this.toggleChargedState(id, enchantments);
  }

  static _enchRoll(ev, target) {
    const { id, enchantments } = this.enchantMentId(target);
    this.rollEnchantment(id, enchantments);
  }

  static _enchDelete(ev, target) {
    const { id, enchantments } = this.enchantMentId(target);
    this.deleteEnchantment(id, enchantments);
  }

  static async _enchShow(ev, target) {
    const { id, enchantments } = this.enchantMentId(target);
    const enchantment = enchantments.find((x) => x.id == id);
    const item = await this.getSpell(enchantment);

    if (item) item.sheet.render(true);
  }

  static _enchExtDelete(ev, target) {
    const enchEl = $(target).parents('.statusEffect');
    const enchId = enchEl.attr('data-id');
    const extIdx = Number($(target).closest('[data-ext-idx]').attr('data-ext-idx'));
    const enchantments = this.item.getFlag('dsa5', 'enchantments');
    const enchantment = enchantments.find((x) => x.id == enchId);
    if (enchantment?.extensions) {
      enchantment.extensions.splice(extIdx, 1);
      this.item.update({ flags: { dsa5: { enchantments } } });
    }
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
      const { id, enchantments } = this.enchantMentId(ev.currentTarget);
      const fw = Number(ev.currentTarget.value);
      if (!fw) return;

      for (const ench of enchantments) {
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
    if (await this._linkInformationRef(dragData)) return;
    if (this.isEnchantable) {
      await this._enchant([dragData]);
      await this._enchantExtension(dragData);
    }
    if (this.isPoisonable) await this._poison(dragData);
    await super._handleDrop(dragData);
  }

  async _enchant(dragDataArray) {
    const enchantments = duplicate(this.item.getFlag('dsa5', 'enchantments') || []);
    if (enchantments.length + dragDataArray.length > 7)
      return ui.notifications.error('DSAError.tooManyEnchants', {
        localize: true,
      });

    for (const dragData of dragDataArray) {
      const { item, typeClass, _selfTarget } = await itemFromDrop(dragData, undefined, false);
      if (['spell', 'liturgy', 'ceremony', 'ritual'].includes(typeClass)) {
        if (!item.pack) return ui.notifications.error('DSAError.onlyCompendiumSpells', { format: { element: _loc('TYPES.Item.spell') }, localize: true });

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

  async _enchantExtension(dragData) {
    const { item, typeClass } = await itemFromDrop(dragData, undefined, false);
    if (typeClass !== 'spellextension') return;
    if (!item.pack) return ui.notifications.error('DSAError.onlyCompendiumSpells', { format: { element: _loc('TYPES.Item.spellextension') }, localize: true });

    const enchantments = duplicate(this.item.getFlag('dsa5', 'enchantments') || []);
    const spellTypes = item.system.category === 'liturgy' || item.system.category === 'ceremony'
      ? ['liturgy', 'ceremony'] : ['spell', 'ritual'];
    const enchantment = enchantments.find((e) => e.name === item.system.source && spellTypes.includes(this._enchantmentCategory(e)));
    if (!enchantment) {
      return ui.notifications.error('DSAError.noEnchantmentForExtension', { localize: true });
    }
    if (enchantment.fw < item.system.talentValue) {
      return ui.notifications.error('DSAError.talentValueTooLow', { localize: true });
    }
    if (!enchantment.extensions) enchantment.extensions = [];
    if (enchantment.extensions.some((e) => e.name === item.name)) return;

    enchantment.extensions.push({
      name: item.name,
      pack: item.pack,
      itemId: item.id,
    });
    await this.item.update({ flags: { dsa5: { enchantments } } });
  }

  _enchantmentCategory(enchantment) {
    return enchantment.talisman ? 'liturgy' : 'spell';
  }

  async _poison(dragData) {
    const { item, typeClass, _selfTarget } = await itemFromDrop(dragData, undefined, false);
    if (typeClass == 'poison') {
      const poison = {
        name: item.name,
        pack: item.pack,
        itemId: item._id,
        permanent: false,
        actorId: dragData.actorId,
      };
      const update = { flags: { dsa5: { poison } } };
      if (this.item.actor) {
        if (this.item.actor.uuid != item.actor?.uuid) {
          const proceed = await foundry.applications.api.DialogV2.confirm({
            window: {
              title: _loc('WIZARD.addItem', { item: item.name }),
            },
            content: `<p>${_loc('DSAError.poisonNeedsToBeInActor')}</p><p>${_loc('POISON.addNow')}</p>`,
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

  toggleChargedState(id, _enchantments) {
    return ItemEnchantment.toggleCharge(this.item, id);
  }

  async rollEnchantment(id, _enchantments) {
    return ItemEnchantment.roll(this.item, id);
  }

  static _deletePoison(ev, target) {
    this.item.update({ 'flags.dsa5.poison': _del });
  }

  deleteEnchantment(id, _enchantments) {
    return ItemEnchantment.delete(this.item, id);
  }

  async getSpell(enchantment) {
    return ItemEnchantment.resolveDocument(enchantment, { notify: true });
  }

  enchantMentId(target) {
    return {
      id: $(target).parents('.statusEffect').attr('data-id'),
      enchantments: duplicate(this.item.getFlag('dsa5', 'enchantments') || []),
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

    return enchantmentLabel.map((x) => _loc(x)).join('/');
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.enchantments = this.item.getFlag('dsa5', 'enchantments');
    data.poison = this.item.getFlag('dsa5', 'poison');
    data.hasEnchantments = data.poison || (data.enchantments && data.enchantments.length > 0);
    data.isEnchantableItem = this.isEnchantable;

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

  get hasRollEffect() {
    if (!this.actor || this.item.system.traitType?.value !== 'familiar') return false;
    if (OnUseEffect.hasOnUseEffect(this.item)) return false;
    return TraitData.getFamiliarActivationAspCost(this.item) > 0;
  }

  async setupEffect() {
    const paid = await TraitData.payFamiliarActivationAsp(this.actor, this.item);
    if (!paid) return;

    const cantrip = this.item.system.chatDataToString();
    const chatMessage = await renderTemplate('systems/dsa5/templates/chat/roll/simpleability.hbs', {
      item: this.item,
      cantrip,
    });
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
  }
}

class InformationSheet extends ItemSheetdsa5 {
  static DEFAULT_OPTIONS = {
    majorButtons: [
      {
        label: 'SHEET.PostItem',
        icon: 'fas fa-dice-d20',
        action: 'showItemHead',
      },
    ],
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
  };

  static TABS = {
    sheet: {
      tabs: [{ id: 'details', label: 'Details' }],
      initial: 'details',
    },
  };

  async _prepareContext(options) {
    const data = await super._prepareContext(options);
    data.isMagicalAnalysis = this.item.system.subType === 'magicalAnalysis';
    if (data.isMagicalAnalysis) {
      const parentItem = options.magicAnalysisParentUuid
        ? await fromUuid(options.magicAnalysisParentUuid)
        : null;
      foundry.utils.mergeObject(
        data,
        await MagicAnalysisContentResolver.placeholders(parentItem),
      );
    }
    if (data.isMagicalAnalysis && !data.document.system.skill) {
      data.document.system.skill = MagicAnalysisService.MAGIEKUNDE_SKILL;
    }
    return data;
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    if (data.system?.subType === 'magicalAnalysis') {
      const subTypeChanged = data.system.subType !== this.item.system.subType;
      if (subTypeChanged || !data.system.skill) {
        data.system.skill = MagicAnalysisService.MAGIEKUNDE_SKILL;
      }
    }
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.isEditable && this.item.system.subType === 'magicalAnalysis' && !this.item.system.skill) {
      await this.item.update({ 'system.skill': MagicAnalysisService.MAGIEKUNDE_SKILL });
    }
  }
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
    const elm = $(await renderTemplate('systems/dsa5/templates/items/baghover.hbs', data));

    const top = parent.offset().top + 52;
    const left = parent.offset().left - 75;
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
      const elm = await this.breakOverflow(
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
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);

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

class PlantSheet extends InformableSheet(ItemSheetObfuscation(EffectsEquipmentSheet)) {
  static PARTS = {
    header: super.PARTS.header,
    stat: {
      template: 'systems/dsa5/templates/items/item-plant-header.hbs',
    },
    tabs: super.PARTS.tabs,
    description: super.PARTS.description,
    effects: super.PARTS.effects,
  };

  static DEFAULT_OPTIONS = {
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

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.noActiveEffects = true;
    return data;
  }

  setupEffect() {
    this.item.setupEffect();
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
    const skill = actor.items.find((x) => x.type == 'skill' && x.name == _loc('LocalizedIDs.artisticAbility'));
    const chatMessage = `<hr/><p><b>${this.item.name}</b></p><p>${this.item.system.description.value}</p><p>${sign}<span class="costCheck"></span></p>`;
    const setupData = await actor.setupSkill(skill, { other: [chatMessage], subtitle: ` (${_loc('TYPES.Item.magicalsign')})` }, undefined);
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
    await this.item.update({ [`flags.dsa5.alternateAttacks.${target.dataset.key}`]: _del });
  }

  static async addAttackSheet() {
    const attackName = foundry.utils.randomID();

    await this.item.update({
      flags: {
        dsa5: {
          alternateAttacks: {
            [attackName]: {
              name: _loc('CHAR.ATTACK'),
            },
          },
        },
      },
    });
  }
}

class RangeweaponSheet extends WeaponSheetDSA5 {
  get isPoisonable() {
    return _loc(`LocalizedCTs.${this.item.system.combatskill.value}`) == 'Throwing Weapons';
  }
}

class BlessingSheetDSA5 extends MacroOnlyEffectsSheet {
  get hasRollEffect() {
    return this.actor && !OnUseEffect.hasOnUseEffect(this.item);
  }

  async setupEffect() {
    if (this.actor.system.status.karmaenergy.value < 1)
      return ui.notifications.error('DSAError.NotEnoughKaP', { localize: true, });

    await this.actor.update({ 'system.status.karmaenergy.value': this.actor.system.status.karmaenergy.value - 1, });
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
      toggleQL: this.#toggleQLEdit,
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

  static #toggleQLEdit(ev, target) {
    this.element.querySelectorAll('.ql-edit').forEach(el => el.classList.toggle('dsahidden'));
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
    return this.actor && !OnUseEffect.hasOnUseEffect(this.item);
  }

  async setupEffect() {
    const paid = await this.actor.applyMana(1, 'AsP');
    if (!paid) return;
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
    context.isBrawling = _loc(`LocalizedCTs.${this.item.system.combatskill.value}`) === 'Brawling';
    context.showImprovisedToggle = MeleeweaponData.hasImprovisedName(this.item.name);
    if (context.alternateAttacks) {
      context.alternateAttacks = Object.fromEntries(
        Object.entries(context.alternateAttacks).map(([key, attack]) => [
          key,
          {
            ...attack,
            showImprovisedToggle: MeleeweaponData.hasImprovisedName(attack.name || this.item.name),
          },
        ]),
      );
    }
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
    actions: {
      rollGeneratorEntry: this.rollGeneratorEntry,
    },
    ownerActions: {
      addGeneratorEntry: this.addGeneratorEntry,
      deleteGeneratorEntry: this.deleteGeneratorEntry,
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const systemClass = this.item.system.constructor;
    const generatorFieldConfigs = [
      {
        field: 'furSkinColor',
        label: systemClass.getGeneratorLabel('furSkinColor'),
        isTextarea: true,
        placeholder: '1d6\n1-2=dunkelbraun\n3-4=hellbraun\n5=weiss\n6=schwarz',
      },
      {
        field: 'eyeColor',
        label: systemClass.getGeneratorLabel('eyeColor'),
        isTextarea: true,
        placeholder: '1d20\n1-2=schwarzbraun\n3-4=graublau\n5-8=saphirblau',
      },
      {
        field: 'bodyHeight',
        label: systemClass.getGeneratorLabel('bodyHeight'),
        unit: systemClass.getGeneratorUnit('bodyHeight'),
        isTextarea: false,
        placeholder: '168 + 2d20',
      },
      {
        field: 'weight',
        label: systemClass.getGeneratorLabel('weight'),
        unit: systemClass.getGeneratorUnit('weight'),
        isTextarea: false,
        placeholder: '@bodyheight - 110 - 2d6',
      },
    ];

    data.generatorFields = generatorFieldConfigs.map((config) => ({
      ...config,
      entries: this.item.system.getGeneratorEntries(config.field),
    }));
    return data;
  }

  static async addGeneratorEntry(_event, target) {
    const field = target.dataset.field;
    if (!field) return;

    await this.item.system.addGeneratorEntry(field);
  }

  static async deleteGeneratorEntry(_event, target) {
    const { field, key } = target.dataset;
    if (!field || !key) return;

    await this.item.system.removeGeneratorEntry(field, key);
  }

  static async rollGeneratorEntry(_event, target) {
    const { field, key } = target.dataset;
    if (!field || !key) return;

    try {
      const result = field === 'weight'
        ? await this.rollWeightEntry(key)
        : await this.item.system.rollNamedGeneratorEntry(field, key);

      const label = this.item.system.constructor.getGeneratorLabel(field);
      const suffix = result.total != null && result.formula ? ` (${result.formula} = ${result.total})` : '';
      ui.notifications.info(`${label} - ${result.display}${suffix}`);
    } catch (error) {
      ui.notifications.warn(error.message);
    }
  }

  static async rollWeightEntry(entryId) {
    const { result } = await this.item.system.rollWeightEntryWithDependencies(entryId);
    return result;
  }
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
          if (SpecialabilityRulesDSA5.hasAbility(this.actor, `${_loc('LocalizedIDs.propertyKnowledge')} (${feature})`, false)) {
            focusValue = this.maxByAttr(maxBonus);
            break;
          }
        }
        break;
      case 'liturgy':
      case 'ceremony':
        const aspect = new RegExp(`^${_loc('LocalizedIDs.aspectKnowledge')}`);
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
      }).sort((a, b) => (Number(a.system.talentValue) || 0) - (Number(b.system.talentValue) || 0) || a.name.localeCompare(b.name, game.i18n.lang));
    }
    return data;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.actor) delete tabs.extensions;
    return tabs;
  }

  static _editExtension(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    item.sheet.render(true);
  }

  static async _deleteExtension(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.find((x) => x.id == itemId);
    if (!item) return;

    await this.actor.sheet._itemDeleteDialog(item);
  }

  async _cleverDeleteItem(itemId) {
    const item = this.actor.items.find((x) => x.id == itemId);
    const xpCost = (Number(item.system.APValue.value) || 0) * -1;
    await this.actor._updateAPs(xpCost, {}, { render: false });
    await this.actor.deleteEmbeddedDocuments('Item', [itemId]);
    await APTracker.track(this.actor, { type: 'item', item, state: -1 }, xpCost);
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
