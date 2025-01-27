import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5 from '../system/config-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import SpecialabilityRulesDSA5 from '../system/specialability-rules-dsa5.js';
import { itemFromDrop, svgAutoFit, tabSlider } from '../system/view_helper.js';
import DSA5ChatAutoCompletion from '../system/chat_autocompletion.js';
import EquipmentDamage from '../system/equipment-damage.js';
import DiceDSA5 from '../system/dice-dsa5.js';
import OnUseEffect from '../system/onUseEffects.js';
import RuleChaos from '../system/rule_chaos.js';
import { ItemSheetObfuscation } from './obfuscatemixin.js';
import AdvantageRulesDSA5 from '../system/advantage-rules-dsa5.js';
import OpposedDsa5 from '../system/opposed-dsa5.js';
import Itemdsa5 from './item-dsa5.js';
import RequestRoll from '../system/request-roll.js';
import APTracker from '../system/ap-tracker.js';
import { AppV2Mixin } from '../actor/appv2_mixin.js';
const { mergeObject, getProperty, duplicate } = foundry.utils;

export default class ItemSheetdsa5 extends AppV2Mixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {
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
      width: 471,
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
    },
    window: {
      resizable: true,
      controls: [
        {
          icon: 'fas fa-comment',
          label: 'SHEET.PostItem',
          action: 'showItemHead',
        },
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
    },
    classes: ['dsa5', 'item', 'item-sheet'],
  };

  get title() {
    return this.item.name;
  }

  static setupSheets() {
    Items.unregisterSheet('core', ItemSheet);
    Items.registerSheet('dsa5', ItemSheetdsa5, { makeDefault: true });

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
      { sheetClass: NoEffectsSheet, types: ['demonmark', 'trap'] },
      { sheetClass: NoEffectsEquipmentSheet, types: ['money'] },
      { sheetClass: CombatSkillSheet, types: ['combatskill'] },
      { sheetClass: WithEffectsSheet, types: ['imprint', 'essence'] },
      { sheetClass: SkillSheet, types: ['skill'] },
      { sheetClass: TraitSheet, types: ['trait'] },
      { sheetClass: EffectWrapperSheet, types: ['effectwrapper'] },
    ];
    sheets.forEach(({ sheetClass, types }) => {
      Items.registerSheet('dsa5', sheetClass, { makeDefault: true, types });
    });
    Items.unregisterSheet('dsa5', ItemSheetdsa5, { types: sheets.map((x) => x.types).flat() });
  }

  get dsaItemTemplate() {
    return `systems/dsa5/templates/items/item-${this.item.type}-sheet.hbs`;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!parts.details) parts.details = { template: this.dsaItemTemplate, scrollable: ['.scrollable'] };
    return parts;
  }

  setupEffect(ev) {
    this.item.setupEffect().then((setupData) => this.item.itemTest(setupData));
  }

  _getItemId(ev) {
    return $(ev.currentTarget).parents('.item')[0].dataset.itemId;
  }

  _advanceStep() {}

  _refundStep() {}

  async advanceWrapper(ev, funct) {
    if (this.wrapperLocked) return;

    this.wrapperLocked = true;
    $(ev.currentTarget).find('i').addClass('fa-spin fa-spinner');
    const res = await this[funct]();
    if (res) return;

    this.wrapperLocked = false;
    $(ev.currentTarget).find('i').removeClass('fa-spin fa-spinner');
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    tabSlider(html);

    html.find('.advance-step').on('mousedown', (ev) => this.advanceWrapper(ev, '_advanceStep'));
    html.find('.refund-step').on('mousedown', (ev) => this.advanceWrapper(ev, '_refundStep'));
    html.find('.domainsPretty').on('click', (ev) => {
      $(ev.currentTarget).hide();
      $(ev.currentTarget).next('.domainToggle').show();
    });

    html.find('[data-action="editImage"]').on('mousedown', (ev) => {
      if (ev.button == 2) DSA5_Utility.showArtwork(this.item);
    });

    html.find('.status-add').on('click', async () => {
      DSA5StatusEffects.createCustomEffect(this.item, '', this.item.name);
    });

    html.find('.condition-show').on('mousedown', (ev) => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.id;
      if (ev.button == 0) {
        const effect = this.item.effects.get(id);
        effect.sheet.render(true);
      } else if (ev.button == 2) {
        this.item.deleteEmbeddedDocuments('ActiveEffect', [id]);
      }
    });

    html.find('.select2').select2();

    html.find('.condition-toggle').on('mousedown', (ev) => {
      let condKey = $(ev.currentTarget).parents('.statusEffect').attr('data-id');
      let ef = this.item.effects.get(condKey);
      ef.update({ disabled: !ef.disabled });
    });

    html.find('.condition-edit').on('click', (ev) => {
      const effect = this.item.effects.get(ev.currentTarget.dataset.id);
      effect.sheet.render(true);
    });

    DSA5ChatAutoCompletion.bindRollCommands(html);
    DSA5StatusEffects.bindButtons(html);

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
    data.enrichedDescription = await TextEditor.enrichHTML(getProperty(this.item.system, 'description.value'), { secrets: this.item.isOwner, async: true });
    data.enrichedGmdescription = await TextEditor.enrichHTML(getProperty(this.item.system, 'gmdescription.value'), { secrets: this.item.isOwner, async: true });
    return data;
  }

  _advancable() {
    return false;
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
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
    },
  };
}

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
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
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
      scrollable: ['.scrollable'],
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
      scrollable: ['.scrollable'],
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    delete tabs.effects;
    return tabs;
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
      template: 'systems/dsa5/templates/items/item-localizerdescription.hbs',
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
    },
  };
}

class LocalizerWithoutEffectsSheet extends NoEffectsSheet {
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
      template: 'systems/dsa5/templates/items/item-localizerdescription.hbs',
      scrollable: ['.scrollable'],
    },
  };
}

class TraitSheet extends WithEffectsSheet {
  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.ranges = DSA5.meleeRanges;
    return data;
  }
}

class CombatSkillSheet extends LocalizerSheet {
  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.hasLocalization = game.i18n.has(`Combatskilldescr.${this.item.name}`);
    data.localizerPrefix = 'Combatskilldescr.';
    return data;
  }
}

class SkillSheet extends LocalizerSheet {
  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.localizerPrefix = 'SKILLdescr.';
    data.hasLocalization = game.i18n.has(`SKILLdescr.${this.item.name}`);
    return data;
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
      scrollable: ['.scrollable'],
    },
    production: {
      template: 'systems/dsa5/templates/items/item-production.hbs',
      scrollable: ['.scrollable'],
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const embeddedItem = this.item.getFlag('dsa5', 'embeddedItem');
    let renderedItem;
    if (embeddedItem) renderedItem = await renderTemplate(`systems/dsa5/templates/items/browse/${embeddedItem.type}.html`, { document: embeddedItem });

    data.allSkills = await DSA5_Utility.allSkillsList();
    data.embeddedItem = embeddedItem;
    data.renderedItem = renderedItem;
    data.enrichedsuccess = await TextEditor.enrichHTML(this.item.system.success, { secrets: this.item.isOwner, async: true });
    data.enrichedpartsuccess = await TextEditor.enrichHTML(this.item.system.partsuccess, { secrets: this.item.isOwner, async: true });

    return data;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      postAsGroupCheck: AggregatedTestSheet.postAsGroupCheck,
      buildItem: AggregatedTestSheet.postFinishedItem,
    },
    window: {
      controls: [
        {
          label: 'SHEET.postAsGroupCheck',
          icon: 'fas fa-dice-d20',
          action: 'postAsGroupCheck',
          visible: function () {
            return !this.item.isOwned;
          },
        },
      ],
    },
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
      enrichedsuccess: await TextEditor.enrichHTML(this.item.system.success, { secrets: this.item.isOwner, async: true }),
      enrichedpartsuccess: await TextEditor.enrichHTML(this.item.system.partsuccess, { secrets: this.item.isOwner, async: true }),
      rollOptions,
    };

    RequestRoll.showGCMessage(rollOptions[0].target, 0, data);
  }

  static async postFinishedItem() {
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

  async _onDrop(event) {
    const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
    await this.dropCreation(dragData);
  }

  async dropCreation(dragData) {
    const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined, false);
    if (!DSA5.equipmentCategories.has(typeClass)) return;

    this.item.setFlag('dsa5', 'embeddedItem', item.toObject());
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
      scrollable: ['.scrollable'],
    },
    enchantment: {
      template: 'systems/dsa5/templates/items/item-enchantment.hbs',
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
    },
  };

  async _onDrop(event) {
    await this.enchant(event);
    if (this.isPoisonable) await this.poison(event);
  }

  async enchant(event) {
    const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
    await this._enchant([dragData]);
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
        if (!item.pack) return ui.notifications.error('DSAError.onlyCompendiumSpells', { localize: true });

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

  async poison(event) {
    const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
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
      const actor = await DSA5_Utility.emptyActor(14, this.item.name);
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

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('.ench-toggle-permanent').on('click', (ev) => {
      let { id, enchantments } = this.enchantMentId(ev);
      for (let ench of enchantments) {
        if (ench.id == id) {
          ench.permanent = !ench.permanent;
          break;
        }
      }
      this.item.update({ flags: { dsa5: { enchantments } } });
    });
    html.find('.ench-toggle-charge').on('click', (ev) => {
      let { id, enchantments } = this.enchantMentId(ev);
      this.toggleChargedState(id, enchantments);
    });
    html.find('.ench-roll').on('click', async (ev) => {
      let { id, enchantments } = this.enchantMentId(ev);
      this.rollEnchantment(id, enchantments);
    });
    html.find('.ench-fw').on('change', (ev) => {
      let { id, enchantments } = this.enchantMentId(ev);
      let fw = Number($(ev.currentTarget).val());
      if (!fw) return;

      for (let ench of enchantments) {
        if (ench.id == id) {
          ench.fw = fw;
          break;
        }
      }
      this.item.update({ flags: { dsa5: { enchantments } } });
    });
    html.find('.ench-delete').on('click', (ev) => {
      let { id, enchantments } = this.enchantMentId(ev);
      this.deleteEnchantment(id, enchantments);
    });
    html.find('.ench-show').on('click', async (ev) => {
      let { id, enchantments } = this.enchantMentId(ev);
      let enchantment = enchantments.find((x) => x.id == id);
      let item = await this.getSpell(enchantment);

      if (item) {
        item.sheet.render(true);
      }
    });
    html.find('.poison-toggle-permanent').on('click', (ev) => {
      this.item.update({
        flags: {
          dsa5: {
            poison: { permanent: !this.item.flags.dsa5.poison.permanent },
          },
        },
      });
    });
    html.find('.poison-delete').on('click', (ev) => {
      this.deletePoison();
    });
    html.find('.poison-show').on('click', async () => {
      let item;
      if (this.actor) item = this.actor.items.find((x) => x.type == 'poison' && x.name == this.item.flags.dsa5.poison.name);
      if (!item) item = await this.getSpell(this.item.flags.dsa5.poison);

      if (item) {
        item.sheet.render(true);
      }
    });
  }

  deletePoison() {
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
      if (!itemLibrary.equipmentBuild) {
        await itemLibrary.buildEquipmentIndex();
      }

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

  enchantMentId(ev) {
    return {
      id: $(ev.currentTarget).parents('.statusEffect').attr('data-id'),
      enchantments: this.item.getFlag('dsa5', 'enchantments'),
    };
  }

  prepareDomains() {
    let dom = getProperty(this.item.system, 'effect.attributes');
    if (dom) {
      const magical = new RegExp(game.i18n.localize('WEAPON.magical'), 'i');
      const blessed = new RegExp(game.i18n.localize('WEAPON.clerical'), 'i');
      dom = dom
        .split(',')
        .map((x) => {
          let cssclass = '';
          if (magical.test(x)) cssclass = 'magical';
          else if (blessed.test(x)) cssclass = 'blessed';
          return `<li class="${cssclass}">${x}</li>`;
        })
        .join('');
    }
    return dom;
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

    return enchantmentLabel.map((x) => game.i18n.localize(x)).join('/');
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.enchantments = this.item.getFlag('dsa5', 'enchantments');
    data.poison = this.item.getFlag('dsa5', 'poison');
    data.hasEnchantments = data.poison || (data.enchantments && data.enchantments.length > 0);
    return data;
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

  async enrichedProperties() {
    const propertiesToEnrich = ['qs1', 'qs2', 'qs3', 'qs4', 'qs5', 'qs6', 'crit', 'botch', 'fail'];
    const enrichedProperties = await Promise.all(
      propertiesToEnrich.map(async (prop) => {
        return { [`enriched${prop}`]: await TextEditor.enrichHTML(this.item.system[prop], { async: true }) };
      }),
    );
    return Object.assign({}, ...enrichedProperties);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.allSkills = await DSA5_Utility.allSkillsList();
    mergeObject(data, await this.enrichedProperties(this.item));
    return data;
  }
}

class AmmunitionSheet extends Enchantable {
  isPoisonable = true;

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.domains = this.prepareDomains();
    return data;
  }
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
      scrollable: ['.scrollable'],
    },
    containerContent: {
      template: 'systems/dsa5/templates/items/item-containerContent.hbs',
      scrollable: ['.scrollable'],
    },
    enchantment: {
      template: 'systems/dsa5/templates/items/item-enchantment.hbs',
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.isBagWithContents()) delete tabs.containerContent;
    return tabs;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.domains = this.prepareDomains();
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');

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
    return this.actor && this.item.system.equipmentType.value == 'bags';
  }

  async _onDrop(event) {
    if (this.isBagWithContents()) {
      const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
      const { item, typeClass, selfTarget } = await itemFromDrop(dragData, undefined);
      const selfItem = this.item.id == item.id;
      const ownItem = this.item.parent.id == dragData.actorId;

      if (DSA5.equipmentCategories.has(typeClass) && !selfItem) {
        item.system.parent_id = this.item.id;
        if (item.system.worn && item.system.worn.value) item.system.worn.value = false;

        if (ownItem) {
          await this.actor.updateEmbeddedDocuments('Item', [item]);
        } else {
          await this.actor.sheet._addLoot(item);
        }
        this.render(true);
        return;
      }
    }

    await super._onDrop(event);
  }
}

export class ArmorSheet extends ItemSheetObfuscation(Enchantable) {
  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.armorSubcategories[this.item.system.subcategory];
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      rollDamaged: function () {
        EquipmentDamage.breakingTest(this.item);
      },
    },
    window: {
      controls: [
        {
          label: 'WEAR.checkShort',
          icon: 'fas fa-dice-d20',
          action: 'rollDamaged',
          visible: function () {
            return this.actor && game.settings.get('dsa5', 'armorAndWeaponDamage') && this.item.system.structure.max > 0;
          },
        },
      ],
    },
  };
}

class PlantSheet extends ItemSheetObfuscation(NoEffectsEquipmentSheet) {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/items/item-header.hbs',
    },
    stat: {
      template: 'systems/dsa5/templates/items/item-plant-header.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    description: {
      template: 'systems/dsa5/templates/items/item-description.hbs',
      scrollable: ['.scrollable'],
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.attributes = Object.keys(this.item.system.planttype).map((x) => {
      return { name: x, checked: this.item.system.planttype[x] };
    });
    data.enrichedEffect = await TextEditor.enrichHTML(this.item.system.effect, { secrets: this.item.isOwner, async: true });
    data.enrichedRecipes = await TextEditor.enrichHTML(this.item.system.recipes, { secrets: this.item.isOwner, async: true });
    data.enrichedInformation = await TextEditor.enrichHTML(this.item.system.infos, { secrets: this.item.isOwner, async: true });
    return data;
  }
}

class PatronSheet extends NoEffectsSheet { }

class ApplicationSheetDSA5 extends LocalizerWithoutEffectsSheet {
  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.localizerPrefix = `APPLICATION.${this.item.system.skill} - `;
    data.hasLocalization = game.i18n.has(`${data.localizerPrefix}${this.item.name}`);
    data.allSkills = await DSA5_Utility.allSkillsList();
    return data;
  }
}

class MagicalSignSheet extends NoEffectsSheet {
  hasRollEffect = true;

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }

  async setupEffect() {
    const aspcost = Number(this.item.system.asp) || 0;
    if (this.actor.system.status.astralenergy.value < aspcost)
      return ui.notifications.error('DSAError.NotEnoughAsP', {
        localize: true,
      });

    const actor = this.actor;
    const sign = game.dsa5.config.ItemSubclasses.magicalsign;
    const skill = actor.items.find((x) => x.type == 'skill' && x.name == game.i18n.localize('LocalizedIDs.artisticAbility'));
    const chatMessage = `<hr/><p><b>${this.item.name}</b></p><p>${this.item.system.description.value}</p><p>${sign.chatData(this.item.system, '').join('</br>')} <span class="costCheck"></span></p>`;
    const setupData = await actor.setupSkill(skill, { other: [chatMessage], subtitle: ` (${game.i18n.localize('TYPES.Item.magicalsign')})` }, undefined);
    const res = await actor.basicTest(setupData, { suppressMessage: true });
    res.result.preData.calculatedSpellModifiers = { finalcost: aspcost, costsMana: true };
    await DiceDSA5.renderRollCard(res.cardOptions, res.result, res.options.rerenderMessage);
  }
}

class ItemBookDSA5 extends ItemSheetObfuscation(Enchantable) {}

class WeaponSheetDSA5 extends ItemSheetObfuscation(Enchantable) {
  static DEFAULT_OPTIONS = {
    actions: {
      attackAdd: WeaponSheetDSA5.addAttackSheet,
      attackDelete: WeaponSheetDSA5.deleteAttack,
      rollDamaged: function () {
        EquipmentDamage.breakingTest(this.item);
      },
    },
    window: {
      controls: [
        {
          label: 'WEAR.checkShort',
          icon: 'fas fa-dice-d20',
          action: 'rollDamaged',
          visible: function () {
            return this.actor && game.settings.get('dsa5', 'armorAndWeaponDamage') && this.item.system.structure.max > 0;
          },
        },
      ],
    },
  };

  tabGroups = {
    alternateAttacks: 'baseAttack',
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.alternateAttacks = getProperty(this.item, 'flags.dsa5.alternateAttacks');
    data.hasAlternateAttacks = data.alternateAttacks && Object.keys(data.alternateAttacks).length > 0;
    return data;
  }

  _onClickTab(event) {
    super._onClickTab(event);
    if (event.target.dataset.tab == 'details') this.changeTab('baseAttack', 'alternateAttacks');
  }

  static async deleteAttack(event, target) {
    const key = target.dataset.key;
    await this.item.update({ [`flags.dsa5.alternateAttacks.-=${key}`]: null });
  }

  static async addAttackSheet() {
    const attackName = foundry.utils.randomID();

    await this.item.update({
      flags: {
        dsa5: {
          alternateAttacks: {
            [attackName]: {
              name: game.i18n.localize('CHAR.ATTACK'),
            },
          },
        },
      },
    });
  }
}

class RangeweaponSheet extends WeaponSheetDSA5 {
  get isPoisonable() {
    return game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`) == 'Throwing Weapons';
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    data.combatskills = await DSA5_Utility.allCombatSkillsList('range');
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`)];
    return data;
  }
}

class BlessingSheetDSA5 extends NoEffectsSheet {
  get hasRollEffect() {
    return this.actor;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }

  async setupEffect() {
    if (this.actor.system.status.karmaenergy.value < 1)
      return ui.notifications.error('DSAError.NotEnoughKaP', {
        localize: true,
      });

    const cantrip = game.dsa5.config.ItemSubclasses.magictrick;
    await this.actor.update({
      'system.status.karmaenergy.value': (this.actor.system.status.karmaenergy.value -= 1),
    });
    let chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('blessing')} ${game.i18n.localize('probe')}</b></p><p>${this.item.system.description.value}</p><p>${cantrip.chatData(this.item.system, '').join('</br>')}</p>`;
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
  }
}

class ItemCareerDSA5 extends NoEffectsSheet {
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
      template: 'systems/dsa5/templates/items/item-career-description.hbs',
      scrollable: ['.scrollable'],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 700,
      height: 700,
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.enrichedClothing = await TextEditor.enrichHTML(this.item.system.clothing.value, { secrets: this.item.isOwner, async: true });
    return data;
  }
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
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
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
    window: {
      controls: [
        {
          label: 'SHEET.ConsumeItem',
          icon: 'fas fa-dice-d20',
          action: 'consumeItem',
          visible: function () {
            return this.actor;
          },
        },
      ],
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.calculatedPrice = Itemdsa5.getSubClass(this.item.type).consumablePrice(this.item);
    data.availableSteps = Object.fromEntries(this.item.system.QLList.split('\n').map((_, i) => [i + 1, i + 1]));
    data.enrichedIngredients = await TextEditor.enrichHTML(this.item.system.ingredients, { secrets: this.item.isOwner, async: true });
    return data;
  }

  setupEffect() {
    this.item.setupEffect();
  }
}

class ItemCultureDSA5 extends NoEffectsSheet {
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
      template: 'systems/dsa5/templates/items/item-culture-description.hbs',
      scrollable: ['.scrollable'],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 700,
      height: 700,
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.enrichedClothing = await TextEditor.enrichHTML(this.item.system.clothing.value, { secrets: this.item.isOwner, async: true });
    return data;
  }
}

class DiseaseSheetDSA5 extends WithEffectsSheet {
  hasRollEffect = true;
}

class MagictrickSheetDSA5 extends NoEffectsSheet {
  get hasRollEffect() {
    return this.actor;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }

  async setupEffect() {
    if (this.actor.system.status.astralenergy.value < 1)
      return ui.notifications.error('DSAError.NotEnoughAsP', {
        localize: true,
      });

    const cantrip = game.dsa5.config.ItemSubclasses.magictrick;
    await this.actor.update({
      'system.status.astralenergy.value': (this.actor.system.status.astralenergy.value -= 1),
    });
    const chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('magictrick')} ${game.i18n.localize('probe')}</b></p><p>${this.item.system.description.value}</p><p>${cantrip.chatData(this.item.system, '').join('</br>')}</p>`;
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
  }
}

class MeleeweaponSheetDSA5 extends WeaponSheetDSA5 {
  isPoisonable = true;

  getGripInfo() {
    const twoHanded = RuleChaos.regex2h.test(this.item.name);
    let wrongGripHint = '';
    if (!twoHanded) {
      wrongGripHint = 'wrongGrip.yieldTwo';
    } else {
      const localizedCT = game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`);
      switch (localizedCT) {
        case 'Two-Handed Impact Weapons':
        case 'Two-Handed Swords':
          const reg = new RegExp(game.i18n.localize('wrongGrip.wrongGripBastardRegex'));
          if (reg.test(this.item.name)) wrongGripHint = 'wrongGrip.yieldOneBastard';
          else wrongGripHint = 'wrongGrip.yieldOneSwordBlunt';

          break;
        default:
          wrongGripHint = 'wrongGrip.yieldOnePolearms';
      }
    }

    return {
      twoHanded,
      wrongGripHint,
      wrongGripLabel: twoHanded ? 'wrongGrip.oneHanded' : 'wrongGrip.twoHanded',
    };
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.combatskills = await DSA5_Utility.allCombatSkillsList('melee');
    data.isShield = RuleChaos.isShield(this.item);
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`)];
    mergeObject(data, this.getGripInfo());
    if (this.actor) {
      const combatSkill = this.actor.items.find((x) => x.type == 'combatskill' && x.name == this.item.system.combatskill.value);
      data.canBeOffHand = combatSkill && !combatSkill.system.weapontype.twoHanded && this.item.system.worn.value;
      data.canBeWrongGrip = !['Daggers', 'Fencing Weapons'].includes(game.i18n.localize(`LocalizedCTs.${this.item.system.combatskill.value}`));
    }
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }
}

class PoisonSheetDSA5 extends ItemSheetObfuscation(EffectsEquipmentSheet) {
  hasRollEffect = true;
}

class SpecialAbilitySheetDSA5 extends WithEffectsSheet {
  async _refundStep() {
    const value = this.item.system.step.value;
    if (value > 1) {
      let xpCost = await SpecialabilityRulesDSA5.stepXPCost(this.item, value - 1);
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
      let xpCost = await SpecialabilityRulesDSA5.stepXPCost(this.item, value);
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

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.categories = {
      general: {},
      clerical: {},
      magical: {},
    };
    let currentKey = 'general';
    for (let [key, name] of Object.entries(DSA5.specialAbilityCategories)) {
      if (key == 'clerical') currentKey = 'clerical';
      else if (key == 'magical') currentKey = 'magical';

      data.categories[currentKey][key] = name;
    }
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }
}

class ItemSpeciesDSA5 extends NoEffectsSheet {
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
      template: 'systems/dsa5/templates/items/item-species-description.hbs',
      scrollable: ['.scrollable'],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 530,
      height: 570,
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.hasLocalization = game.i18n.has(`Racedescr.${this.item.name}`);
    return data;
  }
}

class SpellSheetDSA5 extends ItemSheetdsa5 {
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
      scrollable: ['.scrollable'],
    },
    effects: {
      template: 'systems/dsa5/templates/items/item-effects.hbs',
      scrollable: ['.scrollable'],
    },
    extensions: {
      template: 'systems/dsa5/templates/items/item-extension.hbs',
      scrollable: ['.scrollable'],
      templates: ['systems/dsa5/templates/items/item-aoe.hbs'],
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

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('.item-edit').on('click', (ev) => {
      ev.preventDefault();
      let itemId = this._getItemId(ev);
      const item = this.actor.items.get(itemId);
      item.sheet.render(true);
    });

    html.find('.item-delete').on('click', (ev) => {
      this._deleteItem(ev);
    });
  }

  async _deleteItem(ev) {
    const itemId = this._getItemId(ev);
    const item = this.actor.items.find((x) => x.id == itemId);
    const message = game.i18n.format('DIALOG.DeleteItemDetail', {
      item: item.name,
    });
    const content = await renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html', { message });
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
      $(ev.currentTarget).closest('.item').remove();
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

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.canOnUseEffect = game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro');
    return data;
  }

  async _refundStep() {
    const value = this.item.system.step.value;
    if (value > 1) {
      let xpCost = await AdvantageRulesDSA5.stepXPCost(this.item, value - 1);
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
      let xpCost = await AdvantageRulesDSA5.stepXPCost(this.item, value);
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
