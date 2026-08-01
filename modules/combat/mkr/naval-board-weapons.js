import Actordsa5 from '../../actor/actor-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import VehicleRamWeapon from '../../data/actor/vehicle-ram-weapon.js';
import { RollDialogBuilder } from '../../dialog/dialog-builder.js';
import RangeweaponData from '../../data/item/rangeweapon.js';
import NavalCombat from './naval-combat.js';

const SIEGE_FK_MODIFIER = -4;

export default class NavalBoardWeapons {
  static register() {
    // Sheet and roll wiring live in vehicle-sheet.js; this module centralises board-weapon rules.
  }

  static isRamWeapon(item) {
    return VehicleRamWeapon.isRamWeapon(item);
  }

  static isRamCapable(vehicle) {
    return VehicleRamWeapon.isRamCapable(vehicle);
  }

  static async ensureRamWeapon(vehicle) {
    return VehicleRamWeapon.ensureEmbedded(vehicle);
  }

  static enrich(weapon, vehicle, operator = null) {
    if (this.isRamWeapon(weapon)) {
      this.#enrichRam(weapon, vehicle, operator);
    } else if (weapon.type === 'rangeweapon') {
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
    if (this.isRamWeapon(weapon)) {
      return vehicle ? VehicleRamWeapon.isRamReady(vehicle) : true;
    }

    const lz = this.#loadingTime(weapon, rollingActor);
    const progress = Number(weapon.system?.reloadTime?.progress) || 0;
    return lz === 0 || progress >= lz;
  }

  static canFireInMkr(combat = game.combat, user = game.user) {
    if (!NavalCombat.isNavalMkrActive(combat)) return true;
    if (user.isGM) return true;
    return combat.system.mkrPhase === 'attacks';
  }

  static async resolveFireSetup(vehicle, item, mode, { tokenId, operatorUuid } = {}) {
    if (mode !== 'attack') {
      return this.#resolveDamageRoll(vehicle, item, tokenId, operatorUuid);
    }

    if (!this.canFireInMkr()) {
      ui.notifications.warn('VEHICLE.boardWeaponAttacksPhaseOnly', { localize: true });
      return null;
    }

    if (this.isRamWeapon(item)) {
      if (!this.isRamCapable(vehicle)) {
        ui.notifications.warn('VEHICLE.ramNotCapable', { localize: true });
        return null;
      }
      if (!VehicleRamWeapon.isRamReady(vehicle)) {
        ui.notifications.warn('VEHICLE.ramOnCooldown', {
          localize: true,
          mkr: vehicle.system.combatState?.ramCooldownMKR ?? 0,
        });
        return null;
      }
    }

    let rollingActor = vehicle;
    const options = {};

    if (operatorUuid) {
      const operator = await fromUuid(operatorUuid);
      if (!operator) {
        ui.notifications.warn('VEHICLE.boardWeaponOperatorMissing', { localize: true });
        return null;
      }
      rollingActor = operator;
      options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
      if (item.system?.siegeRules) {
        options.situationalModifiers = [{
          name: _loc('VEHICLE.siegeFKPenalty'),
          value: SIEGE_FK_MODIFIER,
          selected: true,
        }];
      }
    } else if (item.system?.siegeRules) {
      rollingActor = vehicle;
      options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
    } else if (this.isRamWeapon(item)) {
      rollingActor = vehicle;
      options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
    }

    if (!this.isWeaponReady(item, rollingActor, vehicle)) {
      if (this.isRamWeapon(item)) {
        ui.notifications.warn('VEHICLE.ramOnCooldown', {
          localize: true,
          mkr: vehicle.system.combatState?.ramCooldownMKR ?? 0,
        });
        return null;
      }

      const lz = this.#loadingTime(item, rollingActor);
      const progress = Number(item.system?.reloadTime?.progress) || 0;
      ui.notifications.warn('VEHICLE.boardWeaponNotLoaded', {
        localize: true,
        weapon: item.name,
        progress,
        lz,
      });
      return null;
    }

    return { rollingActor, options };
  }

  static async applyRamCooldown(attacker) {
    const vehicle = this.resolveAttackingVehicle(attacker);
    if (!vehicle || !this.isRamCapable(vehicle)) return;

    await vehicle.update({ 'system.combatState.ramCooldownMKR': VehicleRamWeapon.COOLDOWN_MKR });
  }

  static resolveAttackingVehicle(attacker) {
    let vehicle = DSA5_Utility.getSpeaker(attacker.speaker);
    if (vehicle?.type === 'vehicle') return vehicle;

    const msg = game.messages.get(attacker.messageId);
    const vehicleSpeaker = msg?.flags?.data?.extra?.options?.vehicleSpeaker;
    if (vehicleSpeaker?.actor) return game.actors.get(vehicleSpeaker.actor);

    return null;
  }

  static #resolveDamageRoll(vehicle, item, tokenId, operatorUuid) {
    let rollingActor = vehicle;
    const options = {};

    if (operatorUuid) {
      const operator = fromUuidSync(operatorUuid);
      if (operator) {
        rollingActor = operator;
        options.vehicleSpeaker = RollDialogBuilder.buildSpeaker(vehicle, tokenId);
      }
    }

    return { rollingActor, options };
  }

  static #enrichRam(weapon, vehicle, operator) {
    const halfStp = VehicleRamWeapon.targetStpDamage(vehicle);
    const stpLabel = _loc('VEHICLE.ramTargetDamage', { stp: halfStp });
    const cooldown = vehicle.system.combatState?.ramCooldownMKR ?? 0;
    const ramSpeed = vehicle.system.status?.speed?.ram ?? 0;

    weapon.boardWeaponCrewTooltip = _loc('VEHICLE.ramCrewTooltip');
    weapon.isBoardWeaponLoaded = VehicleRamWeapon.isRamReady(vehicle);
    weapon.damageTp = '0';
    weapon.damageStp = stpLabel;
    weapon.damageDisplay = `0 / ${stpLabel}`;
    weapon.damageTooltip = [
      _loc('VEHICLE.boardWeaponDamageTooltip', { tp: '0', stp: stpLabel }),
      _loc('VEHICLE.ramSelfDamageHint', { formula: VehicleRamWeapon.SELF_DAMAGE }),
    ].join('\n');
    weapon.stpFormula = VehicleRamWeapon.targetStpFormula(vehicle);
    weapon.boardWeaponReloadLabel = cooldown > 0
      ? _loc('VEHICLE.ramCooldownStatus', { mkr: cooldown })
      : _loc('VEHICLE.ramReady');

    const fireParts = [weapon.attackTooltip];
    if (NavalCombat.isNavalMkrActive()) {
      fireParts.push(_loc('VEHICLE.ramSpeedHint', { speed: ramSpeed }));
      fireParts.push(_loc('VEHICLE.ramAttackModifier'));
      fireParts.push(weapon.boardWeaponReloadLabel);
      if (!weapon.isBoardWeaponLoaded) fireParts.push(_loc('VEHICLE.ramCooldownHint'));
      fireParts.push(_loc('VEHICLE.ramContactHint'));
      fireParts.push(weapon.damageTooltip);
      if (operator) fireParts.push(_loc('VEHICLE.ramHeroFireMode', { name: operator.name }));
      else fireParts.push(_loc('VEHICLE.ramCrewFireMode'));
    }
    weapon.boardWeaponFireTooltip = fireParts.filter(Boolean).join('\n');
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
    weapon.boardWeaponFireTooltip = [weapon.attackTooltip, weapon.damageTooltip].filter(Boolean).join('\n');
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
    weapon.boardWeaponFireTooltip = fireParts.filter(Boolean).join('\n');
  }

  static #loadingTime(weapon, actor) {
    if (weapon.LZ != null) return weapon.LZ;
    return Actordsa5.calcLZ(weapon, actor);
  }
}
