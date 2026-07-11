import ActorSheetDsa5 from './actor-sheet.js';
import { gearSearchPartTemplates, vehicleCombatPartTemplates } from './template-configs.js';
import DSA5 from '../config/config-dsa5.js';
import Actordsa5 from './actor-dsa5.js';
import ActorPickerDialog from '../dialog/actor-picker-dialog.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import NavalCombat from '../combat/mkr/naval-combat.js';
import NavalHeroActionHandler from '../combat/mkr/naval-hero-actions.js';
import NavalChase from '../combat/mkr/naval-chase.js';
import NavalBoardWeapons from '../combat/mkr/naval-board-weapons.js';

const { duplicate } = foundry.utils;

export default class ActorSheetdsa5Vehicle extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    classes: ['vehicle-sheet'],
    ownerActions: {
      assignWeaponCrew: ActorSheetdsa5Vehicle._assignWeaponCrew,
      clearWeaponCrew: ActorSheetdsa5Vehicle._clearWeaponCrew,
      pickWeaponAmmo: ActorSheetdsa5Vehicle._pickWeaponAmmo,
      navalHeroAction: ActorSheetdsa5Vehicle._navalHeroAction,
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
    if (this.isEditable) await NavalBoardWeapons.ensureRamWeapon(this.actor);

    const context = await super._prepareContext(options);
    const travelModes = this.actor.system.details.travelModes ?? [];
    context.prepare.vehicleTravelModeOptions = Object.entries(DSA5.vehicleTravelModes).map(([value, label]) => ({
      value,
      label,
      checked: travelModes.includes(value),
    }));
    this.#prepareVehicleCombatContext(context.prepare);
    this.#prepareNavalHeroContext(context.prepare);
    this.#prepareNavalChaseContext(context.prepare);
    this.#filterRamFromInventory(context.prepare);
    return context;
  }

  #prepareNavalChaseContext(prepare) {
    if (!NavalCombat.isNavalMkrActive()) {
      prepare.navalChaseSummary = null;
      return;
    }

    const token = canvas.tokens?.placeables?.find((t) => t.actor?.id === this.actor.id);
    prepare.navalChaseSummary = NavalChase.getChaseSummary(this.actor, token?.document);
  }

  #prepareNavalHeroContext(prepare) {
    if (!NavalCombat.isNavalMkrActive()) {
      prepare.navalHeroActionsEnabled = false;
      prepare.showNavalSail = false;
      prepare.showNavalDrive = false;
      return;
    }

    const propulsion = this.actor.system.details.propulsion;
    const travelModes = this.actor.system.details.travelModes ?? [];
    prepare.navalHeroActionsEnabled = NavalCombat.canUseHeroActions();
    prepare.showNavalSail = ['row', 'sail', 'mixed'].includes(propulsion) && travelModes.includes('sea');
    prepare.showNavalDrive = propulsion === 'land' || travelModes.includes('land');
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
      NavalBoardWeapons.enrich(weapon, this.actor, operator);
      return weapon;
    };

    const enrichRangedWeapon = (weapon) => {
      enrichWeapon(weapon);
      this.#enrichAmmo(weapon);
      return weapon;
    };

    prepare.wornRangedWeapons = (prepare.wornRangedWeapons ?? []).map(enrichRangedWeapon);

    const canRam = NavalBoardWeapons.isRamCapable(this.actor);
    prepare.wornMeleeWeapons = (prepare.wornMeleeWeapons ?? [])
      .filter((weapon) => !NavalBoardWeapons.isRamWeapon(weapon) || canRam)
      .map(enrichWeapon);
    prepare.vehicleGunnerySkills = (prepare.combatskills ?? [])
      .filter((skill) => skill?.name === _loc('LocalizedIDs.Crossbows'))
      .map((skill) => ({
        ...skill,
        displayName: skill.name,
      }));
  }

  #filterRamFromInventory(prepare) {
    const filterItems = (items) => (items ?? []).filter((item) => !NavalBoardWeapons.isRamWeapon(item));

    if (prepare.inventory?.meleeweapons?.items) {
      prepare.inventory.meleeweapons.items = filterItems(prepare.inventory.meleeweapons.items);
      prepare.inventory.meleeweapons.show = prepare.inventory.meleeweapons.items.length > 0;
    }
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

    const operatorUuid = this.actor.system.weaponOperators?.[dataset.itemId];
    const setup = await NavalBoardWeapons.resolveFireSetup(this.actor, item, mode, {
      tokenId: this.getTokenId(),
      operatorUuid,
    });
    if (!setup) return;

    const setupData = await setup.rollingActor.setupWeapon(item, mode, setup.options, this.getTokenId());
    if (setupData) await setup.rollingActor.basicTest(setupData);
  }

  static async _navalHeroAction(_ev, target) {
    const action = target.dataset.heroAction;
    if (!action) return;
    await NavalHeroActionHandler.execute(this.actor, action);
  }
}
