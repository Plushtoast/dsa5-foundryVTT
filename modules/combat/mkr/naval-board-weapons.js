import Actordsa5 from '../../actor/actor-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import VehicleRamWeapon from '../../data/actor/vehicle-ram-weapon.js';
import { RollDialogBuilder } from '../../dialog/dialog-builder.js';
import RangeweaponData from '../../data/item/rangeweapon.js';
import CombatskillData from '../../data/item/combatskill.js';
import DSA5Combatant from '../combatant.js';
import NavalCombat from './naval-combat.js';

const SIEGE_FK_MODIFIER = -4;
const { escapeHTML } = foundry.utils;
const BOARD_WEAPON_TYPES = new Set(['meleeweapon', 'rangeweapon']);

export default class NavalBoardWeapons {
  static register() {
    Hooks.on('createCombatant', this.#onCreateCombatant.bind(this));
  }

  /** Join tooltip lines for data-tooltip-html (escaped text + <br>). */
  static #tooltipHtml(parts) {
    return escapeHTML(parts.filter(Boolean).join('\n')).replaceAll('\n', '<br>');
  }

  /** When a ship joins combat, all board guns start loaded (and ram is ready). */
  static async #onCreateCombatant(combatant, _options, userId) {
    if (game.userId !== userId || !game.user.isGM) return;
    const vehicle = combatant.actor;
    if (vehicle?.type !== 'vehicle') return;
    await this.loadAllWeapons(vehicle);
  }

  /**
   * Set every ship rangeweapon to full LZ progress and clear ram cooldown.
   * @param {Actor} vehicle
   */
  static async loadAllWeapons(vehicle) {
    if (vehicle?.type !== 'vehicle') return;

    const updates = [];
    const operators = vehicle.system.weaponOperators ?? {};

    for (const item of vehicle.items) {
      if (item.type !== 'rangeweapon') continue;

      const operatorUuid = operators[item.id];
      const operator = operatorUuid ? fromUuidSync(operatorUuid) : null;
      const lz = Actordsa5.calcLZ(item, operator ?? vehicle);
      if (!lz) continue;

      const progress = Number(item.system.reloadTime?.progress ?? 0);
      if (progress >= lz) continue;

      updates.push({
        _id: item.id,
        'system.reloadTime.progress': lz,
      });
    }

    if (updates.length) await vehicle.updateEmbeddedDocuments('Item', updates);

    if ((vehicle.system.combatState?.ramCooldownMKR ?? 0) > 0) {
      await vehicle.update({ 'system.combatState.ramCooldownMKR': 0 });
    }
  }

  static isRamWeapon(item) {
    return VehicleRamWeapon.isRamWeapon(item);
  }

  static isRamCapable(vehicle) {
    return VehicleRamWeapon.isRamCapable(vehicle);
  }

  /**
   * Sea/air → Boote & Schiffe; land → Fahrzeuge.
   * Mirrors NavalHeroActionHandler.resolveManeuverAction without importing that module.
   * @returns {'boatsAndShips'|'driving'}
   */
  static resolveRamSkillKey(vehicle) {
    const propulsion = vehicle?.system?.details?.propulsion;
    const travelModes = vehicle?.system?.details?.travelModes ?? [];
    const showDrive = propulsion === 'land' || travelModes.includes('land') || travelModes.includes('vehicle');
    const showSail = (
      (['row', 'sail', 'mixed'].includes(propulsion) && travelModes.includes('sea'))
      || travelModes.includes('air')
    );
    if (showDrive && !showSail) return 'driving';
    if (showSail) return 'boatsAndShips';
    if (travelModes.includes('sea') || travelModes.includes('air') || ['row', 'sail', 'mixed'].includes(propulsion)) {
      return 'boatsAndShips';
    }
    if (showDrive) return 'driving';
    return 'boatsAndShips';
  }

  static resolveRamSkillName(vehicle) {
    return _loc(`LocalizedIDs.${this.resolveRamSkillKey(vehicle)}`);
  }

  static resolveRamSkill(rollingActor, vehicle) {
    return NavalCombat.resolveSkill(rollingActor, this.resolveRamSkillName(vehicle));
  }

  /** Worn board weapons on a vehicle (excludes legacy ram melee items). */
  static wornBoardWeapons(vehicle) {
    if (vehicle?.type !== 'vehicle') return [];
    return vehicle.items.filter((item) => (
      BOARD_WEAPON_TYPES.has(item.type)
      && item.system?.worn?.value
      && !this.isRamWeapon(item)
    ));
  }

  /**
   * FK/AT for a board weapon: hero operator combatskill, else vehicle gunnery / skill.
   * Mirrors vehicle-sheet attack display.
   */
  static computeWeaponAttack(vehicle, weapon, operator = null) {
    const atmod = Number(weapon.system?.atmod?.value ?? 0);
    let ammoMod = 0;

    if (weapon.type === 'rangeweapon' && weapon.system?.ammunitiongroup?.value !== '-') {
      const ammoId = weapon.system?.currentAmmo?.value;
      const ammoSource = operator ?? vehicle;
      const ammo = ammoId ? ammoSource.items?.get?.(ammoId) : null;
      if (ammo) ammoMod = Number(ammo.system?.atmod) || 0;
    }

    if (operator) {
      const skillName = weapon.system.combatskill.value;
      const skillItem = operator.items.find((i) => i.type === 'combatskill' && i.name === skillName);
      if (skillItem) {
        const skill = CombatskillData._calculateCombatSkillValues(skillItem.toObject(), operator.system);
        return Number(skill.system.attack.value) + atmod + ammoMod;
      }
    }

    const vehicleSkills = vehicle.items.filter((i) => i.type === 'combatskill');
    const gunnery = Number(vehicle.system.status.gunnery?.value ?? 12);
    const weaponSkill = vehicleSkills.find((s) => s.name === weapon.system.combatskill.value);
    const useGunnery = weapon.system?.siegeRules || weaponSkill?.name === _loc('LocalizedIDs.Crossbows');

    if (useGunnery) return gunnery + atmod + ammoMod;
    if (weaponSkill) return Number(weaponSkill.system.attack.value) + atmod + ammoMod;

    return Number(weapon.system?.attack?.value ?? weapon.attack ?? 0);
  }

  /** ActAttackDialog entries for a ship (board guns + ram). */
  static dialogAttackEntries(vehicle) {
    if (vehicle?.type !== 'vehicle') return [];

    const operators = vehicle.system.weaponOperators ?? {};
    const items = this.wornBoardWeapons(vehicle).map((item) => {
      const operatorUuid = operators[item.id];
      const operator = operatorUuid ? fromUuidSync(operatorUuid) : null;
      const attack = this.computeWeaponAttack(vehicle, item, operator);
      return {
        name: item.name,
        id: item.id,
        img: item.img,
        value: attack,
        special: 'navalBoardWeapon',
        tooltip: operator
          ? _loc('VEHICLE.attackOperator', { name: operator.name, value: attack })
          : _loc('VEHICLE.attackCrew', { value: attack }),
      };
    });

    const ram = this.prepareRamContext(vehicle);
    if (ram) {
      items.push({
        name: ram.name,
        id: 'navalRam',
        img: ram.img,
        value: ram.fw,
        special: 'navalRam',
        tooltip: ram.attackTooltip,
      });
    }

    return items;
  }

  /** Token hotbar attack buttons for a ship (broadside + board guns + ram). */
  static hotbarAttackEntries(vehicle) {
    if (vehicle?.type !== 'vehicle') return [];

    const operators = vehicle.system.weaponOperators ?? {};
    const entries = this.wornBoardWeapons(vehicle).map((item) => {
      const operatorUuid = operators[item.id];
      const operator = operatorUuid ? fromUuidSync(operatorUuid) : null;
      const attack = this.computeWeaponAttack(vehicle, item, operator);
      const damage = item.system?.damage?.value || item.system?.damage?.stp || '';
      return {
        name: item.name,
        id: item.id,
        icon: item.img,
        cssClass: `weapon i${item.id}`,
        abbrev: item.name?.[0],
        attack,
        damage,
        dadd: '',
        subfunction: 'navalBoardWeapon',
      };
    });

    const hasWornRange = vehicle.items.some((i) => i.type === 'rangeweapon' && i.system?.worn?.value);
    if (hasWornRange) {
      const label = _loc('VEHICLE.mkr.broadside');
      entries.unshift({
        name: label,
        id: 'navalBroadside',
        icon: 'systems/dsa5/icons/categories/ability_combat.webp',
        cssClass: 'weapon navalBroadside',
        iconClass: 'fas fa-ship',
        abbrev: label[0],
        subfunction: 'navalBroadside',
      });
    }

    const ram = this.prepareRamContext(vehicle);
    if (ram) {
      entries.push({
        name: ram.name,
        id: 'navalRam',
        icon: ram.img,
        cssClass: 'weapon navalRam',
        abbrev: ram.name?.[0],
        attack: ram.fw,
        damage: ram.damageStp || '',
        dadd: '',
        subfunction: 'navalRam',
      });
    }

    return entries;
  }

  /** Fire a worn board weapon (sheet / ActAttack / hotbar). */
  static async executeWeaponAttack(vehicle, itemId, { tokenId, subweapon } = {}) {
    if (vehicle?.type !== 'vehicle' || !itemId) return;

    const itemDoc = vehicle.items.get(itemId);
    if (!itemDoc || !BOARD_WEAPON_TYPES.has(itemDoc.type) || this.isRamWeapon(itemDoc)) return;

    const item = Actordsa5.buildSubweapon(itemDoc, subweapon) ?? itemDoc.toObject?.() ?? itemDoc;
    const operatorUuid = vehicle.system.weaponOperators?.[itemId];
    const setup = await this.resolveFireSetup(vehicle, item, 'attack', { tokenId, operatorUuid });
    if (!setup) return;

    const setupData = await setup.rollingActor.setupWeapon(
      setup.weapon ?? item,
      'attack',
      setup.options,
      setup.rollTokenId ?? tokenId,
    );
    if (setupData) await setup.rollingActor.basicTest(setupData);
  }

  /**
   * Crew fire without a hero operator: roll via emptyActor (full combat stats)
   * so vehicle missing rangeStats/characteristics does not break DiceDSA5.
   * Keeps the vehicle weapon `_id` for reload updates via vehicleSpeaker.
   */
  static #createCrewFireProxy(vehicle, item) {
    const gunnery = Number(vehicle.system.status.gunnery?.value ?? 12);

    const skillName = item.system?.combatskill?.value || _loc('LocalizedIDs.Crossbows');
    const vehicleSkill = vehicle.items.find((i) => i.type === 'combatskill' && i.name === skillName);
    const skillData = vehicleSkill
      ? foundry.utils.duplicate(vehicleSkill.toObject())
      : {
          name: skillName,
          type: 'combatskill',
          system: {
            talentValue: { value: gunnery },
            weapontype: { value: item.type === 'meleeweapon' ? 0 : 1 },
            guidevalue: { value: 'ff' },
            attack: { value: gunnery },
            parry: { value: 0 },
            StF: { value: 'B' },
          },
        };
    delete skillData._id;

    const useGunnery = item.system?.siegeRules || skillName === _loc('LocalizedIDs.Crossbows');
    const baseAt = useGunnery
      ? gunnery
      : Number(skillData.system.attack?.value ?? skillData.system.talentValue?.value ?? gunnery);
    skillData.system.talentValue.value = baseAt;

    const weaponData = foundry.utils.duplicate(item.toObject?.() ?? item);
    // Keep vehicle item id so reload/ammo updates can target the real weapon.
    weaponData.system.worn = { ...(weaponData.system.worn || {}), value: true };

    // Items must live on emptyActor createData: dialog/roll rebuild the proxy via
    // getSpeaker(speaker.emptyActor) and would otherwise lose combatskill.
    const proxy = DSA5_Utility.emptyActor(8, vehicle.name, {
      parent_source_uuid: vehicle.uuid,
      img: vehicle.img,
      prototypeToken: { name: vehicle.name, texture: { src: vehicle.img } },
      items: [skillData, weaponData],
    });

    // Fallback if the Actor constructor dropped items — attach then re-sync createData.
    if (!proxy.items.some((i) => i.type === 'combatskill' && i.name === skillName)) {
      const ItemClass = getDocumentClass('Item');
      new ItemClass(foundry.utils.duplicate(skillData), { parent: proxy, noHook: true });
      if (!proxy.items.get(weaponData._id)) {
        new ItemClass(foundry.utils.duplicate(weaponData), { parent: proxy, noHook: true });
      }
      proxy.emptyActor.items = proxy.items.map((i) => i.toObject());
    }

    const proxyWeapon = proxy.items.get(weaponData._id)
      ?? proxy.items.find((i) => BOARD_WEAPON_TYPES.has(i.type));
    return { proxy, weapon: proxyWeapon };
  }

  /** Sheet display model for the vehicle-only ram row (not an Item). */
  static prepareRamContext(vehicle) {
    if (!this.isRamCapable(vehicle)) return null;

    const operatorUuid = vehicle.system.weaponOperators?.[VehicleRamWeapon.OPERATOR_KEY];
    const operator = operatorUuid ? fromUuidSync(operatorUuid) : null;
    const skillName = this.resolveRamSkillName(vehicle);
    const skill = this.resolveRamSkill(operator ?? vehicle, vehicle);
    const fw = Number(skill?.system?.talentValue?.value ?? 0);
    const halfStp = VehicleRamWeapon.targetStpDamage(vehicle);
    const stpLabel = _loc('VEHICLE.ramTargetDamage', { stp: halfStp });
    const cooldown = vehicle.system.combatState?.ramCooldownMKR ?? 0;
    const ramSpeed = vehicle.system.status?.speed?.ram ?? 0;
    const ready = VehicleRamWeapon.isRamReady(vehicle);
    const reloadLabel = cooldown > 0
      ? _loc('VEHICLE.ramCooldownStatus', { mkr: cooldown })
      : _loc('VEHICLE.ramReady');
    const attackTooltip = operator
      ? _loc('VEHICLE.ramSkillOperator', { name: operator.name, skill: skillName, value: fw })
      : _loc('VEHICLE.ramSkillCrew', { skill: skillName, value: fw });
    const damageTooltip = [
      _loc('VEHICLE.boardWeaponDamageTooltip', { tp: '0', stp: stpLabel }),
      _loc('VEHICLE.ramSelfDamageHint', { formula: VehicleRamWeapon.SELF_DAMAGE }),
    ].join('\n');

    const fireParts = [attackTooltip];
    if (NavalCombat.isNavalMkrActive()) {
      fireParts.push(_loc('VEHICLE.ramSpeedHint', { speed: ramSpeed }));
      fireParts.push(_loc('VEHICLE.ramSkillCheck', {
        skill: skillName,
        modifier: VehicleRamWeapon.SKILL_MODIFIER,
      }));
      fireParts.push(reloadLabel);
      if (!ready) fireParts.push(_loc('VEHICLE.ramCooldownHint'));
      fireParts.push(_loc('VEHICLE.ramContactHint'));
      fireParts.push(damageTooltip);
      fireParts.push(operator
        ? _loc('VEHICLE.ramHeroFireMode', { name: operator.name })
        : _loc('VEHICLE.ramCrewFireMode'));
    }

    return {
      operatorKey: VehicleRamWeapon.OPERATOR_KEY,
      name: _loc('VEHICLE.ramWeapon'),
      img: 'icons/skills/melee/unarmed-punch-fist.webp',
      skillName,
      fw,
      skillModifier: VehicleRamWeapon.SKILL_MODIFIER,
      attackTooltip,
      boardWeaponFireTooltip: this.#tooltipHtml(fireParts),
      isReady: ready,
      boardWeaponReloadLabel: reloadLabel,
      damageTp: '0',
      damageStp: stpLabel,
      damageTooltip,
      crewOperatorUuid: operatorUuid ?? '',
      crewOperatorName: operator?.name ?? '',
      crewOperatorImg: operator
        ? (DSA5Combatant.tokenImageFor(operator) || operator.img)
        : '',
    };
  }

  /** Roll Boote & Schiffe / Fahrzeuge at −4 for a ram attempt. */
  static async executeRam(vehicle, { tokenId } = {}) {
    if (!this.canFireInMkr()) {
      ui.notifications.warn('VEHICLE.boardWeaponAttacksPhaseOnly', { localize: true });
      return;
    }
    if (!this.isRamCapable(vehicle)) {
      ui.notifications.warn('VEHICLE.ramNotCapable', { localize: true });
      return;
    }
    if (!VehicleRamWeapon.isRamReady(vehicle)) {
      ui.notifications.warn('VEHICLE.ramOnCooldown', {
        localize: true,
        mkr: vehicle.system.combatState?.ramCooldownMKR ?? 0,
      });
      return;
    }

    let rollingActor = vehicle;
    const operatorUuid = vehicle.system.weaponOperators?.[VehicleRamWeapon.OPERATOR_KEY];
    if (operatorUuid) {
      const operator = await fromUuid(operatorUuid);
      if (!operator) {
        ui.notifications.warn('VEHICLE.boardWeaponOperatorMissing', { localize: true });
        return;
      }
      rollingActor = operator;
    }

    const skill = this.resolveRamSkill(rollingActor, vehicle);
    if (!skill) {
      ui.notifications.warn('VEHICLE.mkr.missingSkill', {
        localize: true,
        skill: this.resolveRamSkillName(vehicle),
      });
      return;
    }

    const options = {
      vehicleSpeaker: RollDialogBuilder.buildSpeaker(vehicle, tokenId),
      vehicleRam: true,
      subtitle: ` (${_loc('VEHICLE.ramWeapon')})`,
      situationalModifiers: [{
        name: _loc('VEHICLE.ramSkillModifier'),
        value: VehicleRamWeapon.SKILL_MODIFIER,
        selected: true,
      }],
    };

    const setupData = await rollingActor.setupSkill(skill, options, tokenId);
    if (setupData) await rollingActor.basicTest(setupData);
  }

  static enrich(weapon, vehicle, operator = null) {
    if (weapon.type === 'rangeweapon') {
      this.#enrichRanged(weapon, vehicle, operator);
    } else if (weapon.type === 'meleeweapon') {
      this.#enrichMelee(weapon, vehicle, operator);
    } else {
      weapon.boardWeaponCrewTooltip = _loc('VEHICLE.boardWeaponCrewTooltip');
    }
    return weapon;
  }

  static shotsPerMkr(weapon, combat = game.combat) {
    const krPerMkr = combat?.system?.krPerMkr ?? NavalCombat.DEFAULT_KR_PER_MKR;
    return NavalCombat.shotsPerMkr(weapon.system?.reloadTime?.value, krPerMkr);
  }

  static isWeaponReady(weapon, rollingActor, vehicle = null) {
    const lz = this.#loadingTime(weapon, rollingActor);
    const progress = Number(weapon.system?.reloadTime?.progress) || 0;
    return lz === 0 || progress >= lz;
  }

  static canFireInMkr(combat = game.combat, user = game.user) {
    if (!NavalCombat.isNavalMkrActive(combat)) return true;
    if (user.isGM) return true;
    return combat.system.mkrPhase === 'attacks';
  }

  static async resolveFireSetup(vehicle, item, mode, { tokenId, operatorUuid, skipReadyCheck = false } = {}) {
    if (mode !== 'attack') {
      return this.#resolveDamageRoll(vehicle, item, tokenId, operatorUuid);
    }

    if (!this.canFireInMkr()) {
      ui.notifications.warn('VEHICLE.boardWeaponAttacksPhaseOnly', { localize: true });
      return null;
    }

    let rollingActor = vehicle;
    let weapon = item;
    let rollTokenId = tokenId;
    const options = {};
    /** Actor used for LZ / readiness (never the emptyActor proxy). */
    let readinessActor = vehicle;

    if (operatorUuid) {
      const operator = await fromUuid(operatorUuid);
      if (!operator) {
        ui.notifications.warn('VEHICLE.boardWeaponOperatorMissing', { localize: true });
        return null;
      }
      const skillName = item.system?.combatskill?.value;
      if (skillName && !operator.items.some((i) => i.type === 'combatskill' && i.name === skillName)) {
        ui.notifications.warn('VEHICLE.mkr.missingSkill', { localize: true, skill: skillName });
        return null;
      }
      rollingActor = operator;
      readinessActor = operator;
      options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
      if (item.system?.siegeRules) {
        options.situationalModifiers = [{
          name: _loc('VEHICLE.siegeFKPenalty'),
          value: SIEGE_FK_MODIFIER,
          selected: true,
        }];
      }
    } else {
      // Crew fire: vehicles lack combat stats — use emptyActor (same pattern as Besatzungstalente).
      const crew = this.#createCrewFireProxy(vehicle, item);
      rollingActor = crew.proxy;
      weapon = crew.weapon;
      rollTokenId = 'emptyActor';
      readinessActor = vehicle;
      options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
      if (item.system?.siegeRules) {
        options.situationalModifiers = [{
          name: _loc('VEHICLE.siegeFKPenalty'),
          value: SIEGE_FK_MODIFIER,
          selected: true,
        }];
      }
    }

    if (!skipReadyCheck && !this.isWeaponReady(item, readinessActor, vehicle)) {
      const lz = this.#loadingTime(item, readinessActor);
      const progress = Number(item.system?.reloadTime?.progress) || 0;
      ui.notifications.warn('VEHICLE.boardWeaponNotLoaded', {
        localize: true,
        weapon: item.name,
        progress,
        lz,
      });
      return null;
    }

    return { rollingActor, options, weapon, rollTokenId };
  }

  static async applyRamCooldown(attacker) {
    const vehicle = this.resolveAttackingVehicle(attacker);
    if (!vehicle || !this.isRamCapable(vehicle)) return;

    await vehicle.update({ 'system.combatState.ramCooldownMKR': VehicleRamWeapon.COOLDOWN_MKR });
  }

  static resolveAttackingVehicle(attacker) {
    let vehicle = DSA5_Utility.getSpeaker(attacker.speaker);
    if (vehicle?.type === 'vehicle') return vehicle;

    const inlineSpeaker = attacker?.options?.vehicleSpeaker
      ?? attacker?.testResult?.options?.vehicleSpeaker;
    if (inlineSpeaker?.actor) {
      const fromInline = game.actors.get(inlineSpeaker.actor);
      if (fromInline) return fromInline;
    }

    const msg = game.messages.get(attacker.messageId);
    const vehicleSpeaker = msg?.flags?.data?.preData?.extra?.options?.vehicleSpeaker
      ?? msg?.flags?.data?.extra?.options?.vehicleSpeaker;
    if (vehicleSpeaker?.actor) return game.actors.get(vehicleSpeaker.actor);

    return null;
  }

  static #resolveDamageRoll(vehicle, item, tokenId, operatorUuid) {
    let rollingActor = vehicle;
    let weapon = item;
    let rollTokenId = tokenId;
    const options = {};

    if (operatorUuid) {
      const operator = fromUuidSync(operatorUuid);
      if (operator) {
        rollingActor = operator;
        options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
      }
    } else {
      const crew = this.#createCrewFireProxy(vehicle, item);
      rollingActor = crew.proxy;
      weapon = crew.weapon;
      rollTokenId = 'emptyActor';
      options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
    }

    return { rollingActor, options, weapon, rollTokenId };
  }

  static #enrichMelee(weapon, vehicle, operator) {
    const stp = weapon.system?.damage?.stp;
    weapon.boardWeaponCrewTooltip = _loc('VEHICLE.boardWeaponCrewTooltip');

    if (!stp) return;

    const tp = `${weapon.damagedie ?? ''}${weapon.damageAdd ?? ''}` || weapon.system?.damage?.value || '—';
    weapon.damageTp = tp;
    weapon.damageStp = stp;
    weapon.damageDisplay = `${tp} / ${stp}`;
    weapon.damageTooltip = _loc('VEHICLE.boardWeaponDamageTooltip', { tp, stp });
    weapon.stpFormula = stp;
    weapon.isBoardWeaponLoaded = true;
    weapon.boardWeaponFireTooltip = this.#tooltipHtml([weapon.attackTooltip, weapon.damageTooltip]);
  }

  static #enrichRanged(weapon, vehicle, operator) {
    const rollingActor = operator ?? vehicle;
    const lz = this.#loadingTime(weapon, rollingActor);
    const progress = Number(weapon.system?.reloadTime?.progress) || 0;
    const shots = this.shotsPerMkr(weapon);
    const stp = weapon.system?.damage?.stp;

    weapon.boardWeaponCrewTooltip = _loc('VEHICLE.boardWeaponCrewTooltip');
    weapon.isBoardWeaponLoaded = lz === 0 || progress >= lz;
    weapon.boardWeaponShotsLabel = _loc('VEHICLE.boardWeaponShotsPerMkr', { count: shots });
    weapon.boardWeaponReloadLabel = lz > 0
      ? _loc('VEHICLE.boardWeaponReloadStatus', { progress, lz })
      : _loc('VEHICLE.boardWeaponNoReload');

    if (weapon.system?.siegeRules) {
      const tp = weapon.system?.damage?.value || weapon.damagedie || '—';
      const stpVal = stp || tp;
      weapon.damageTp = tp;
      weapon.damageStp = stpVal;
      weapon.damageDisplay = `${tp} / ${stpVal}`;
      weapon.damageTooltip = _loc('VEHICLE.boardWeaponDamageTooltip', { tp, stp: stpVal });
      weapon.stpFormula = stp || tp;
    } else if (stp) {
      const tp = `${weapon.damagedie ?? ''}${weapon.damageAdd ?? ''}`;
      weapon.damageTp = tp;
      weapon.damageStp = stp;
      weapon.damageDisplay = `${tp} / ${stp}`;
      weapon.damageTooltip = _loc('VEHICLE.boardWeaponDamageTooltip', { tp, stp });
    }

    if (lz > 0) {
      RangeweaponData.buildReloadProgress(weapon);
    }

    const fireParts = [weapon.attackTooltip];
    if (NavalCombat.isNavalMkrActive()) {
      fireParts.push(_loc('VEHICLE.boardWeaponShotsPerMkr', { count: shots }));
      if (lz > 0) fireParts.push(weapon.boardWeaponReloadLabel);
      if (!weapon.isBoardWeaponLoaded) fireParts.push(_loc('VEHICLE.boardWeaponNotLoadedHint'));
      if (weapon.system?.siegeRules) {
        fireParts.push(operator
          ? _loc('VEHICLE.boardWeaponHeroFireMode')
          : _loc('VEHICLE.boardWeaponCrewFireMode'));
      }
    }
    weapon.boardWeaponFireTooltip = this.#tooltipHtml(fireParts);
  }

  static #loadingTime(weapon, actor) {
    if (weapon.LZ != null) return weapon.LZ;
    return Actordsa5.calcLZ(weapon, actor);
  }
}
