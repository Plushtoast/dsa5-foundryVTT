import ActorSheetDsa5 from './actor-sheet.js';
import { gearSearchPartTemplates, vehicleCombatPartTemplates } from './template-configs.js';
import DSA5 from '../config/config-dsa5.js';
import Actordsa5 from './actor-dsa5.js';
import ActorPickerDialog from '../dialog/actor-picker-dialog.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import NavalHeroActionHandler from '../combat/mkr/naval-hero-actions.js';
import NavalCombatDamage from '../combat/mkr/naval-combat-damage.js';
import NavalBroadside from '../combat/mkr/naval-broadside.js';
import VehicleChase from '../combat/chase/vehicle-chase.js';
import NavalBoardWeapons from '../combat/mkr/naval-board-weapons.js';
import VehicleRamWeapon from '../data/actor/vehicle-ram-weapon.js';
import DSA5Combatant from '../combat/combatant.js';

const { duplicate } = foundry.utils;

export default class ActorSheetdsa5Vehicle extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    classes: ['vehicle-sheet'],
    ownerRollActions: {
      chRollCombat: ActorSheetdsa5Vehicle._chRollCombat,
      navalRam: ActorSheetdsa5Vehicle._navalRam,
    },
    ownerActions: {
      assignWeaponCrew: ActorSheetdsa5Vehicle._assignWeaponCrew,
      clearWeaponCrew: ActorSheetdsa5Vehicle._clearWeaponCrew,
      pickWeaponAmmo: ActorSheetdsa5Vehicle._pickWeaponAmmo,
      navalHeroAction: ActorSheetdsa5Vehicle._navalHeroAction,
      navalBoarding: ActorSheetdsa5Vehicle._navalBoarding,
      navalBroadside: ActorSheetdsa5Vehicle._navalBroadside,
      memberCardLink: ActorSheetdsa5Vehicle._crewMemberLink,
      memberContextMenu: ActorSheetdsa5Vehicle._crewMemberContextMenu,
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
    crew: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-crew.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/member-card-header.hbs'],
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
        { id: 'crew', label: 'VEHICLE.tabCrew', img: 'systems/dsa5/icons/categories/ability_command.webp' },
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
    if (this.isEditable) {
      await VehicleRamWeapon.removeLegacyEmbedded(this.actor);
      await this.actor.system.ensureDefaultSkills?.();
    }

    const context = await super._prepareContext(options);
    const travelModes = this.actor.system.details.travelModes ?? [];
    context.prepare.vehicleTravelModeOptions = Object.entries(DSA5.vehicleTravelModes).map(([value, label]) => ({
      value,
      label,
      checked: travelModes.includes(value),
    }));
    context.prepare.vehicleLocomotionSkills = (this.actor.system.defaultSkills?.() ?? this.actor.system.locomotionSkills?.() ?? [])
      .map((skill) => skill.toObject());
    this.#prepareVehicleCombatContext(context.prepare);
    this.#prepareNavalHeroContext(context.prepare);
    this.#prepareNavalChaseContext(context.prepare);
    this.#prepareCrewMembers(context.prepare);
    return context;
  }

  #prepareCrewMembers(prepare) {
    const members = [];
    const sorted = Object.entries(this.actor.system.crewMembers ?? {})
      .sort(([, a], [, b]) => a.sort - b.sort);

    for (const [key, member] of sorted) {
      const actor = fromUuidSync(member.uuid);
      if (!actor) continue;

      const s = actor.system;
      const canViewPrivateDetails = game.user.isGM || actor.isOwner;
      const owner = game.users.find((u) => u.character?.id === actor.id);

      members.push({
        key,
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        type: actor.type,
        ownerName: owner?.name ?? null,
        ownerColor: owner?.color ?? null,
        canViewPrivateDetails,
        system: {
          status: {
            wounds: { value: s.status?.wounds?.value ?? 0, max: s.status?.wounds?.max ?? 0 },
            astralenergy: { value: s.status?.astralenergy?.value ?? 0, max: s.status?.astralenergy?.max ?? 0 },
            karmaenergy: { value: s.status?.karmaenergy?.value ?? 0, max: s.status?.karmaenergy?.max ?? 0 },
          },
          isMage: !!s.isMage,
          isPriest: !!s.isPriest,
          details: {
            species: s.details?.species?.value ?? '',
            culture: s.details?.culture?.value ?? '',
            career: s.details?.career?.value ?? '',
          },
          creatureClass: s.creatureClass?.value ?? '',
        },
      });
    }

    prepare.crewMembers = members;
  }

  #prepareNavalChaseContext(prepare) {
    if (!VehicleChase.isVehicleChase()) {
      prepare.navalChaseSummary = null;
      return;
    }

    prepare.navalChaseSummary = VehicleChase.getChaseSummary(this.actor, game.combat);
  }

  #prepareNavalHeroContext(prepare) {
    const propulsion = this.actor.system.details.propulsion;
    const travelModes = this.actor.system.details.travelModes ?? [];
    prepare.showNavalSail = (
      (['row', 'sail', 'mixed'].includes(propulsion) && travelModes.includes('sea'))
      || travelModes.includes('air')
    );
    prepare.showNavalDrive = propulsion === 'land' || travelModes.includes('land') || travelModes.includes('vehicle');
  }

  #prepareVehicleCombatContext(prepare) {
    const operators = this.actor.system.weaponOperators ?? {};

    const enrichWeapon = (weapon) => {
      const weaponId = weapon._id;
      const operatorUuid = operators[weaponId];
      const operator = operatorUuid ? fromUuidSync(operatorUuid) : null;
      weapon.crewOperatorUuid = operatorUuid ?? '';
      weapon.crewOperatorName = operator?.name ?? '';
      weapon.crewOperatorImg = operator
        ? (DSA5Combatant.tokenImageFor(operator) || operator.img)
        : '';
      weapon.combatskillLabel = weapon.system.combatskill.value ?? '';
      weapon.attack = NavalBoardWeapons.computeWeaponAttack(this.actor, weapon, operator);
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
    prepare.wornMeleeWeapons = (prepare.wornMeleeWeapons ?? [])
      .filter((weapon) => !NavalBoardWeapons.isRamWeapon(weapon))
      .map(enrichWeapon);
    prepare.ramAttack = NavalBoardWeapons.prepareRamContext(this.actor);
    prepare.vehicleGunnerySkills = (prepare.combatskills ?? [])
      .filter((skill) => skill?.name === _loc('LocalizedIDs.Crossbows'))
      .map((skill) => ({
        ...skill,
        displayName: skill.name,
      }));
  }

  #enrichAmmo(weapon) {
    const needsAmmoGroup = weapon.system?.ammunitiongroup?.value !== '-';
    const tracksAmmo = this.actor.system.requiresAmmunition?.() !== false && needsAmmoGroup;
    weapon.hasAmmunition = tracksAmmo;
    // NPC / no player crew: munition not tracked → show ∞ in the Mun column.
    weapon.ammoInfinite = !tracksAmmo && needsAmmoGroup;
    if (!weapon.hasAmmunition) {
      if (weapon.ammoInfinite) weapon.ammoTooltip = _loc('infinite');
      return;
    }

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

  async _onDropActor(event, data) {
    const actor = data?.document
      ?? (data instanceof Actor ? data : null)
      ?? (data?.uuid ? await fromUuid(data.uuid) : null);
    if (!actor) return;
    if (actor.uuid === this.actor.uuid) return false;

    await this.actor.system.addCrewMember(actor);
  }

  static _crewMemberLink(_event, target) {
    const uuid = target.closest('[data-uuid]')?.dataset.uuid;
    if (uuid) fromUuidSync(uuid)?.sheet?.render(true);
  }

  static async _crewMemberContextMenu(event, target) {
    const memberEl = target.closest('[data-member-key]');
    if (!memberEl) return;

    const app = this;
    const menu = new foundry.applications.ux.ContextMenu(this.element, '', [
      {
        label: _loc('VEHICLE.removeCrewMember'),
        icon: '<i class="fas fa-trash"></i>',
        onClick: () => {
          const key = memberEl.dataset.memberKey;
          if (key) app.actor.system.removeCrewMember(key);
        },
      },
    ], { jQuery: false, fixed: true, eventName: 'none' });
    ui.context?.close();
    await menu.render(target, { animate: true });
    ui.context = menu;
  }

  static async _assignWeaponCrew(_ev, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const candidates = ActorSheetdsa5Vehicle.#weaponOperatorCandidates(this.actor);
    if (!candidates.length) {
      ui.notifications.warn('DSAError.noProperActor', { localize: true });
      return;
    }

    const actors = ActorPickerDialog.buildActorPickerData({ actors: candidates });
    const [actorId] = await ActorPickerDialog.open({
      title: 'VEHICLE.pickCrewOperator',
      selectionMode: 'single',
      actors,
    });
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor || !['character', 'npc', 'creature'].includes(actor.type)) {
      ui.notifications.warn('VEHICLE.crewInvalidActor', { localize: true });
      return;
    }

    const operators = duplicate(this.actor.system.weaponOperators ?? {});
    operators[itemId] = actor.uuid;
    await this.actor.update({ 'system.weaponOperators': operators });
  }

  /** Gunners may be characters, NPCs, or creatures (crew preferred in list order). */
  static #weaponOperatorCandidates(vehicle) {
    const types = new Set(['character', 'npc', 'creature']);
    const crewIds = new Set();
    const crew = [];

    for (const actor of vehicle.system.crewActors ?? []) {
      if (!types.has(actor.type) || crewIds.has(actor.id)) continue;
      crewIds.add(actor.id);
      crew.push(actor);
    }

    const others = game.actors.filter((actor) => types.has(actor.type) && !crewIds.has(actor.id));
    others.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return [...crew, ...others];
  }

  static async _clearWeaponCrew(_ev, target) {
    const itemId = target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    await this.actor.update({ [`system.weaponOperators.${itemId}`]: _del });
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
    if (mode === 'attack') {
      await NavalBoardWeapons.executeWeaponAttack(this.actor, dataset.itemId, {
        tokenId: this.getTokenId(),
        subweapon: dataset.subweapon,
      });
      return;
    }

    const itemDoc = this.actor.items.get(dataset.itemId);
    const item = Actordsa5.buildSubweapon(itemDoc, dataset.subweapon) ?? itemDoc?.toObject?.() ?? itemDoc;
    if (!item) return;

    const operatorUuid = this.actor.system.weaponOperators?.[dataset.itemId];
    const setup = await NavalBoardWeapons.resolveFireSetup(this.actor, item, mode, {
      tokenId: this.getTokenId(),
      operatorUuid,
    });
    if (!setup) return;

    const setupData = await setup.rollingActor.setupWeapon(
      setup.weapon ?? item,
      mode,
      setup.options,
      setup.rollTokenId ?? this.getTokenId(),
    );
    if (setupData) await setup.rollingActor.basicTest(setupData);
  }

  static async _navalRam() {
    await NavalBoardWeapons.executeRam(this.actor, { tokenId: this.getTokenId() });
  }

  static async _navalHeroAction(_ev, target) {
    const action = target.dataset.heroAction;
    if (!action) return;
    await NavalHeroActionHandler.execute(this.actor, action);
  }

  static async _navalBoarding() {
    await NavalCombatDamage.initiateBoarding();
  }

  static async _navalBroadside() {
    await NavalBroadside.open(this.actor, { tokenId: this.getTokenId() });
  }
}
