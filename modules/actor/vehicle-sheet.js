import ActorSheetDsa5 from './actor-sheet.js';
import { gearSearchPartTemplates, vehicleCombatPartTemplates } from './template-configs.js';
import DSA5 from '../config/config-dsa5.js';
import Actordsa5 from './actor-dsa5.js';
import ActorPickerDialog from '../dialog/actor-picker-dialog.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { RollDialogBuilder } from '../dialog/dialog-builder.js';

const { duplicate } = foundry.utils;

const SIEGE_FK_MODIFIER = -4;

export default class ActorSheetdsa5Vehicle extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    classes: ['vehicle-sheet'],
    ownerActions: {
      assignWeaponCrew: ActorSheetdsa5Vehicle._assignWeaponCrew,
      clearWeaponCrew: ActorSheetdsa5Vehicle._clearWeaponCrew,
      pickWeaponAmmo: ActorSheetdsa5Vehicle._pickWeaponAmmo,
    },
  };

  static PARTS = {
    sheet: super.PARTS.sheet,
    header: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-header.hbs',
      templates: ['systems/dsa5/templates/actors/actorv2/avatar.hbs', 'systems/dsa5/templates/actors/vehicle/vehicle-header-part.hbs', 'systems/dsa5/templates/actors/parts/vehicle-healthbar.hbs'],
    },
    tabs: super.PARTS.tabs,
    combat: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-combat.hbs',
      scrollable: [''],
      templates: [...vehicleCombatPartTemplates],
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/creature/creature-loot.hbs',
      scrollable: [''],
      templates: [...gearSearchPartTemplates],
    },
    status: super.PARTS.status,
    notes: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-notes.hbs',
      scrollable: [''],
    },
  };

  static LIMITEDPARTS = {
    sheet: super.PARTS.sheet,
    header: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-header.hbs',
    },
    tabs: super.PARTS.tabs,
    main: {
      template: 'systems/dsa5/templates/actors/limited/creature-limited.hbs',
      scrollable: [''],
    },
    notes: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-notes.hbs',
      scrollable: [''],
    },
  };

  static propertiesToEnrich = [
    { key: 'enrichedDescription', path: 'description.value' },
    { key: 'enrichedNotes', path: 'details.notes.value' },
    { key: 'enrichedOwnerdescription', path: 'details.notes.ownerdescription' },
  ];

  static TABS = {
    sheet: {
      tabs: [
        { id: 'combat', label: 'VEHICLE.tabCombat', img: 'systems/dsa5/icons/categories/ability_combat.webp' },
        { id: 'inventory', label: 'TYPES.Item.equipment', img: 'systems/dsa5/icons/categories/Equipment.webp' },
        { id: 'status', label: 'status', img: 'systems/dsa5/icons/categories/ability_ceremonial.webp' },
        { id: 'notes', label: 'Description', img: 'systems/dsa5/icons/categories/Ability_Language.webp' },
      ],
      initial: 'combat',
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    delete tabs.main;
    delete tabs.skills;
    delete tabs.magic;
    delete tabs.religion;
    delete tabs.companion;
    this.cleanTabs(tabs);
    return tabs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const travelModes = this.actor.system.details.travelModes ?? [];
    context.prepare.vehicleTravelModeOptions = Object.entries(DSA5.vehicleTravelModes).map(([value, label]) => ({
      value,
      label,
      checked: travelModes.includes(value),
    }));
    this.#prepareVehicleCombatContext(context.prepare);
    return context;
  }

  #prepareVehicleCombatContext(prepare) {
    const operators = this.actor.system.weaponOperators ?? {};
    const vehicleSkills = this.actor.items.filter((i) => i.type === 'combatskill');

    const enrichWeapon = (weapon) => {
      const operatorUuid = operators[weapon._id];
      const operator = operatorUuid ? fromUuidSync(operatorUuid) : null;
      weapon.crewOperatorUuid = operatorUuid ?? '';
      weapon.crewOperatorName = operator?.name ?? '';
      weapon.combatskillLabel = weapon.system.combatskill.value ?? '';
      weapon.attack = this.#computeWeaponAttack(weapon, operator, vehicleSkills);
      weapon.attackTooltip = operator
        ? _loc('VEHICLE.attackOperator', { name: operator.name, value: weapon.attack })
        : _loc('VEHICLE.attackCrew', { value: weapon.attack });
      return weapon;
    };

    const enrichRangedWeapon = (weapon) => {
      enrichWeapon(weapon);
      this.#enrichAmmo(weapon);
      return weapon;
    };

    prepare.wornRangedWeapons = (prepare.wornRangedWeapons ?? []).map(enrichRangedWeapon);
    prepare.wornMeleeWeapons = (prepare.wornMeleeWeapons ?? []).map(enrichWeapon);
    prepare.vehicleGunnerySkills = (prepare.combatskills ?? [])
      .filter((skill) => skill?.name === _loc('LocalizedIDs.Crossbows'))
      .map((skill) => ({
        ...skill,
        displayName: skill.name,
      }));
  }

  #computeWeaponAttack(weapon, operator, vehicleSkills) {
    const atmod = Number(weapon.system?.atmod?.value ?? 0);
    let ammoMod = 0;

    if (weapon.type === 'rangeweapon' && weapon.system?.ammunitiongroup?.value !== '-') {
      const ammoId = weapon.system?.currentAmmo?.value;
      const ammoSource = operator ?? this.actor;
      const ammo = ammoId ? ammoSource.items?.get?.(ammoId) : null;
      if (ammo) ammoMod = Number(ammo.system?.atmod) || 0;
    }

    if (operator) {
      const skills = operator.items.filter((i) => i.type === 'combatskill');
      const skill = skills.find((s) => s.name === weapon.system.combatskill.value);
      if (skill) return Number(skill.system.attack.value) + atmod + ammoMod;
    }

    const gunnery = Number(this.actor.system.status.gunnery?.value ?? 12);
    const weaponSkill = vehicleSkills.find((s) => s.name === weapon.system.combatskill.value);
    const useGunnery = weapon.system?.siegeRules || weaponSkill?.name === _loc('LocalizedIDs.Crossbows');

    if (useGunnery) return gunnery + atmod + ammoMod;

    if (weaponSkill) return Number(weaponSkill.system.attack.value) + atmod + ammoMod;

    return weapon.attack ?? 0;
  }

  #enrichAmmo(weapon) {
    weapon.hasAmmunition = weapon.system?.ammunitiongroup?.value !== '-';
    if (!weapon.hasAmmunition) return;

    const currentAmmo = weapon.ammo?.find((a) => a._id === weapon.system.currentAmmo?.value);
    if (currentAmmo?.system?.ammunitiongroup?.value === 'mag') {
      weapon.ammoLabel = `${currentAmmo.system.mag.value}/${currentAmmo.system.mag.max}`;
      weapon.ammoTooltip = `${currentAmmo.name} (${currentAmmo.system.quantity.value})`;
      weapon.ammoEmpty = currentAmmo.system.mag.value <= 0 && currentAmmo.system.quantity.value <= 0;
    } else if (currentAmmo) {
      weapon.ammoLabel = String(currentAmmo.system.quantity.value);
      weapon.ammoTooltip = currentAmmo.name;
      weapon.ammoEmpty = currentAmmo.system.quantity.value <= 0;
    } else {
      weapon.ammoLabel = '';
      weapon.ammoTooltip = _loc('VEHICLE.pickAmmo');
      weapon.ammoEmpty = true;
    }
  }

  async _onChangeForm(formConfig, event) {
    if (event.target?.name === 'system.details.travelModes') {
      const form = this.element.querySelector('form') ?? this.form;
      const selected = Array.from(form.querySelectorAll('input[name="system.details.travelModes"]:checked'), (el) => el.value);
      await this.actor.update({ 'system.details.travelModes': selected });
      return;
    }
    return super._onChangeForm(formConfig, event);
  }

  static async _assignWeaponCrew(_ev, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const [actorId] = await ActorPickerDialog.open({
      title: 'VEHICLE.pickCrewOperator',
      selectionMode: 'single',
      showSourceToggle: true,
    });
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const operators = duplicate(this.actor.system.weaponOperators ?? {});
    operators[itemId] = actor.uuid;
    await this.actor.update({ 'system.weaponOperators': operators });
  }

  static async _clearWeaponCrew(_ev, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const operators = duplicate(this.actor.system.weaponOperators ?? {});
    delete operators[itemId];
    await this.actor.update({ 'system.weaponOperators': operators });
  }

  static async _pickWeaponAmmo(_ev, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const weapon = this.actor.items.get(itemId);
    if (!weapon || weapon.system.ammunitiongroup?.value === '-') return;

    const ammoGroup = weapon.system.ammunitiongroup.value;
    const ammoList = this.actor.items.filter(
      (i) => i.type === 'ammunition' && i.system.ammunitiongroup?.value === ammoGroup,
    );

    if (!ammoList.length) {
      ui.notifications.warn('VEHICLE.noAmmunition', { localize: true });
      return;
    }

    const buttons = ammoList.map((ammo) => {
      const qty = ammo.system.ammunitiongroup?.value === 'mag'
        ? `${ammo.system.mag.value}/${ammo.system.mag.max} (${ammo.system.quantity.value})`
        : ammo.system.quantity.value;
      return {
        action: ammo.id,
        label: `${ammo.name} (${qty})`,
        icon: 'fas fa-bullseye',
      };
    });

    buttons.push(
      { action: 'clear', label: _loc('VEHICLE.clearAmmo'), icon: 'fas fa-ban' },
      { action: 'cancel', label: _loc('cancel'), icon: 'fas fa-times' },
    );

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: _loc('VEHICLE.pickAmmo') },
      content: `<p>${weapon.name}</p>`,
      buttons,
    });

    if (!choice || choice === 'cancel') return;

    await this.actor.updateEmbeddedDocuments('Item', [{
      _id: itemId,
      'system.currentAmmo.value': choice === 'clear' ? '' : choice,
    }]);
  }

  static async _chRollCombat(ev, target) {
    const dataset = this._getItemDataset(target);
    const mode = target.dataset.mode;
    const itemDoc = this.actor.items.get(dataset.itemId);
    const item = Actordsa5.buildSubweapon(itemDoc, dataset.subweapon) ?? itemDoc?.toObject?.() ?? itemDoc;
    if (!item) return;

    let rollingActor = this.actor;
    const options = {};
    const operatorUuid = this.actor.system.weaponOperators?.[dataset.itemId];

    if (operatorUuid) {
      const operator = await fromUuid(operatorUuid);
      if (operator) {
        rollingActor = operator;
        options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(this.actor, this.getTokenId());
      }
    } else if (item.system?.siegeRules && mode === 'attack') {
      const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: _loc('VEHICLE.siegeFireMode') },
        content: `<p>${_loc('VEHICLE.siegeFireModeHint')}</p>`,
        buttons: [
          { action: 'crew', label: _loc('VEHICLE.fireAsCrew'), icon: 'fas fa-users', default: true },
          { action: 'hero', label: _loc('VEHICLE.fireAsHero'), icon: 'fas fa-user' },
          { action: 'cancel', label: _loc('cancel'), icon: 'fas fa-times' },
        ],
      });

      if (!choice || choice === 'cancel') return;

      if (choice === 'hero') {
        const [operatorId] = await ActorPickerDialog.open({
          title: 'VEHICLE.pickOperator',
          selectionMode: 'single',
          showSourceToggle: true,
          entryFilter: (entry) => {
            const actor = game.actors.get(entry.id);
            return actor && DSA5_Utility.actorCapabilities(actor).canOperateSiegeWeapon;
          },
        });
        if (!operatorId) return;
        rollingActor = game.actors.get(operatorId);
        if (!rollingActor) return;
        options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(this.actor, this.getTokenId());
      }

      options.situationalModifiers = [{
        name: _loc('VEHICLE.siegeFKPenalty'),
        value: SIEGE_FK_MODIFIER,
        selected: true,
      }];
    }

    const setupData = await rollingActor.setupWeapon(item, mode, options, this.getTokenId());
    if (setupData) await rollingActor.basicTest(setupData);
  }
}
