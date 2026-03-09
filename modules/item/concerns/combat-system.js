import DSA5 from '../../config/config-dsa5.js';
import AdvantageRulesDSA5 from '../../system/rules/advantage-rules-dsa5.js';
import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';
import CreatureType from '../../system/automation/creature-type.js';
import Riding from '../../system/automation/riding.js';
import DPS from '../../system/automation/derepositioningsystem.js';
import RuleChaos from '../../system/rules/rule_chaos.js';
import CombatskillData from '../../data/item/combatskill.js';
import DSAActiveEffect from '../../status/dsa_active_effects.js';
import Actordsa5 from '../../actor/actor-dsa5.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';

const { getProperty, mergeObject, duplicate } = foundry.utils;

/**
 * Combat system utilities for DSA5 items
 */
export class CombatSystem {
    /**
     * Get defense malus from opposing attack
     * @param {Array} situationalModifiers - Array to add modifiers to
     * @param {Object} actor - Defending actor
     * @returns {boolean} Whether this is a range defense
     */
    static getDefenseMalus(situationalModifiers, actor) {
        const opposeFlags = actor.flags?.oppose;
        if (!opposeFlags) return false;

        const message = game.messages.get(opposeFlags.messageId);
        if (!message?.flags?.data) return false;

        const preData = message.flags.data.preData;
        const postData = message.flags.data.postData || {};
        const sourceType = getProperty(preData, 'source.type');
        const traitType = getProperty(preData, 'source.system.traitType.value');
        const isRangeDefense = !(sourceType === 'meleeweapon' || traitType === 'meleeAttack');
        const regex = / \[(-)?\d{1,}\]/;
        for (const mal of preData.situationalModifiers || []) {
            if (mal.dmmalus !== undefined && mal.dmmalus !== 0) {
                situationalModifiers.push({
                    name: `${_loc('MODS.defenseMalus')} - ${mal.name.replace(regex, '')}`,
                    value: mal.dmmalus,
                    selected: true,
                });
            } else if (mal.type === 'defenseMalus' && mal.value !== 0) {
                situationalModifiers.push({
                    name: mal.name.replace(regex, ''),
                    value: mal.value,
                    selected: true,
                });
            }
        }
        if (postData.halfDefense) {
            situationalModifiers.push({
                name: `${_loc('MODS.defenseMalus')} - ${_loc('halfDefenseShort')}`,
                value: 0.5,
                type: '*',
                selected: true,
            });
        }
        return isRangeDefense;
    }

    /**
     * Get target size and add creature type modifiers
     * @param {Object} actor - Attacking actor
     * @param {Object} source - Attack source
     * @param {Array} situationalModifiers - Modifiers array
     * @returns {string} Target size
     */
    static getTargetSizeAndModifier(actor, source, situationalModifiers) {
        let targetSize = 'average';
        game.user.targets.forEach((target) => {
            if (target.actor) {
                const size = getProperty(target.actor, 'system.status.size.value');
                if (size) targetSize = size;
                CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor);
                CombatSystem.checkDuplicatus(actor, target.actor, situationalModifiers);
            }
        });
        return targetSize;
    }

    /**
     * Check for Duplicatus effect
     * @param {Object} actor - Acting actor
     * @param {Object} target - Target actor
     * @param {Array} situationalModifiers - Modifiers array
     */
    static checkDuplicatus(actor, target, situationalModifiers) {
        const val = getProperty(target, 'system.extra.duplicatus');
        const immuneToIllusion = CreatureType.detectCreatureType(actor)
            .some((x) => x.spellImmunities.includes('Illusion'));
        if (val) {
            situationalModifiers.push({
                name: `Duplicatus - ${_loc('doppelganger')}`,
                value: val,
                selected: !immuneToIllusion,
                type: 'effect',
                source: 'Duplicatus',
            });
        }
    }

    /**
     * Add swarm modifiers
     * @param {Object} actor - Actor
     * @param {string} mode - Combat mode (attack/parry)
     * @param {Array} situationalModifiers - Modifiers array
     */
    static addSwarmModifiers(actor, mode, situationalModifiers) {
        if (actor.system.swarm?.count > 1) {
            const swarmName = _loc('swarm.name');
            if (mode === 'attack') {
                situationalModifiers.push(
                    {
                        name: `${swarmName} - ${_loc('MODS.defenseMalus')}`,
                        value: actor.system.swarm.parry,
                        type: 'defenseMalus',
                        selected: true,
                    },
                    {
                        name: `${swarmName} - ${_loc('CHARAbbrev.AT')}`,
                        value: actor.system.swarm.attack,
                        selected: true,
                    },
                    {
                        name: `${swarmName} - ${_loc('CHARAbbrev.damage')}`,
                        value: actor.system.swarm.damage,
                        type: 'dmg',
                        selected: true,
                    },
                );
            } else {
                situationalModifiers.push({
                    name: `${swarmName} - ${_loc('CHARAbbrev.PA')}`,
                    value: actor.system.swarm.parry,
                    selected: true,
                });
            }
        }
    }

    /**
     * Get combat skill modifiers
     * @param {Object} actor - Actor
     * @param {Object} source - Source item
     * @param {Array} situationalModifiers - Modifiers array
     */
    static getCombatSkillModifier(actor, source, situationalModifiers) {
        if (source.type === 'trait') return;

        const combatskill = actor.items.find((x) =>
            x.type === 'combatskill' && x.name === source.system.combatskill.value);
        if (!combatskill) return;

        for (let ef of combatskill.effects) {
            for (let change of ef.changes) {
                switch (change.key) {
                    case 'system.rangeStats.defenseMalus':
                    case 'system.meleeStats.defenseMalus':
                        situationalModifiers.push({
                            name: `${combatskill.name} - ${_loc('MODS.defenseMalus')}`,
                            value: change.value * -1,
                            type: 'defenseMalus',
                            selected: true,
                        });
                        break;
                }
            }
        }
    }

    /**
     * Add attack stat effect
     * @param {Array} situationalModifiers - Modifiers array
     * @param {number} value - Stat value
     */
    static addAttackStatEffect(situationalModifiers, value) {
        if (value !== 0) {
            value = isNaN(value) ? value : Number(value);
            situationalModifiers.push({
                name: _loc('statuseffects'),
                value,
                selected: true,
            });
        }
    }

    /**
     * Prepare melee attack modifiers
     * @param {Array} situationalModifiers - Modifiers array
     * @param {Object} actor - Actor
     * @param {Object} data - Data object
     * @param {Object} source - Source weapon
     * @param {Array} combatSpecAbs - Combat special abilities
     * @param {boolean} wrongHandDisabled - Whether wrong hand is disabled
     */
    static prepareMeleeAttack(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled) {
        let targetWeaponSize = 'short';
        // Determine target weapon size
        game.user.targets.forEach((target) => {
            const targetActor = target.actor;
            if (!targetActor) return;

            const combatskills = targetActor.items
                .filter((x) => x.type === 'combatskill')
                .map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), targetActor.system));
            for (let item of targetActor.items) {
                const isMeleeWeapon = item.type === 'meleeweapon';
                const isTraitMelee = item.type === 'trait' &&
                    item.system.traitType.value === 'meleeAttack' &&
                    item.system.pa;
                if (!(isMeleeWeapon && item.system.worn.value) && !isTraitMelee) continue;

                if (isMeleeWeapon) item = Actordsa5._prepareMeleeWeapon(item.toObject(), combatskills, targetActor);
                if (DSA5.meleeRangesArray.indexOf(item.system.reach.value) >
                    DSA5.meleeRangesArray.indexOf(targetWeaponSize)) {
                    targetWeaponSize = item.system.reach.value;
                }
                if (targetWeaponSize === 'long') break;
            }
        });
        const targetSize = CombatSystem.getTargetSizeAndModifier(actor, source, situationalModifiers);
        CombatSystem.getCombatSkillModifier(actor, source, situationalModifiers);
        const defenseMalus = Number(actor.system.meleeStats.defenseMalus) * -1;
        if (defenseMalus !== 0) {
            situationalModifiers.push({
                name: `${_loc('statuseffects')} - ${_loc('MODS.defenseMalus')}`,
                value: defenseMalus,
                type: 'defenseMalus',
                selected: true,
            });
        }
        CombatSystem.addSwarmModifiers(actor, ITEM_CONSTANTS.COMBAT_MODES.ATTACK, situationalModifiers);
        mergeObject(data, {
            visionOptions: DSA5.meleeRangeVision(data.mode),
            weaponSizes: DSA5.meleeRanges,
            melee: true,
            showAttack: true,
            targetWeaponSize,
            combatSpecAbs,
            meleeSizeOptions: DSA5.meleeSizeCategories,
            targetSize,
            constricted: actor.hasCondition('constricted'),
            wrongHandDisabled,
            offHand: !wrongHandDisabled && getProperty(source, 'system.worn.offHand'),
        });
    }

    /**
     * Prepare melee parry modifiers
     * @param {Array} situationalModifiers - Modifiers array
     * @param {Object} actor - Actor
     * @param {Object} data - Data object
     * @param {Object} source - Source weapon
     * @param {Array} combatSpecAbs - Combat special abilities
     * @param {boolean} wrongHandDisabled - Whether wrong hand is disabled
     */
    static prepareMeleeParry(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled) {
        const isRangeDefense = CombatSystem.getDefenseMalus(situationalModifiers, actor);
        CombatSystem.addSwarmModifiers(actor, ITEM_CONSTANTS.COMBAT_MODES.PARRY, situationalModifiers);
        mergeObject(data, {
            visionOptions: DSA5.meleeRangeVision(data.mode),
            showDefense: true,
            isRangeDefense,
            wrongHandDisabled: wrongHandDisabled && getProperty(source, 'system.worn.offHand'),
            offHand: !wrongHandDisabled && getProperty(source, 'system.worn.offHand') && !RuleChaos.isShield(source),
            melee: true,
            combatSpecAbs,
            constricted: actor.hasCondition('constricted'),
        });
    }

    /**
     * Prepare range attack modifiers
     * @param {Array} situationalModifiers - Modifiers array
     * @param {Object} actor - Actor
     * @param {Object} data - Data object
     * @param {Object} source - Source weapon
     * @param {string} tokenId - Token ID
     * @param {Array} combatSpecAbs - Combat special abilities
     * @param {Object} currentAmmo - Current ammunition
     */
    static prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatSpecAbs, currentAmmo = undefined) {
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.restrictedSenseSight', -2));
        CombatSystem.getCombatSkillModifier(actor, source, situationalModifiers);
        const targetSize = CombatSystem.getTargetSizeAndModifier(actor, source, situationalModifiers);
        const defenseMalus = Number(actor.system.rangeStats.defenseMalus) * -1;
        if (defenseMalus !== 0) {
            situationalModifiers.push({
                name: `${_loc('statuseffects')} - ${_loc('MODS.defenseMalus')}`,
                value: defenseMalus,
                type: 'defenseMalus',
                selected: true,
            });
        }
        const rangeOptions = new Set(['short', 'medium', 'long', 'rangesense', 'extreme']);
        rangeOptions.delete(AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.senseOfRange') ? 'long' : 'rangesense');
        if (!SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.extremeShot')) {
            rangeOptions.delete('extreme');
        }
        let mountedOptions;
        const isRiding = Riding.isRiding(actor);
        const isDriving = Riding.isDriving(actor);
        if (isDriving) {
            const drivingArcher = SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.drivingArcher');
            mountedOptions = drivingArcher ?
                duplicate(DSA5.drivingArcherOptionsSpecAb) :
                duplicate(DSA5.drivingArcherOptions);
        } else if (isRiding) {
            const mountedArcher = SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.mountedArcher');
            mountedOptions = mountedArcher ?
                duplicate(DSA5.mountedRangeOptionsSpecAb) :
                duplicate(DSA5.mountedRangeOptions);
        } else {
            mountedOptions = duplicate(DSA5.mountedRangeOptions);
        }
        let finalMountedOptions = {};
        for (let key of Object.keys(mountedOptions)) {
            finalMountedOptions[`${_loc('mountedRangeOptions.' + key)} (${mountedOptions[key]})`] = mountedOptions[key];
        }
        CombatSystem.addSwarmModifiers(actor, ITEM_CONSTANTS.COMBAT_MODES.ATTACK, situationalModifiers);
        mergeObject(data, {
            rangeOptions,
            rangeDistance: Array.from(rangeOptions)[DPS.distanceModifier(game.canvas.tokens.get(tokenId), source, currentAmmo)],
            visionOptions: DSA5.rangeVision,
            mountedOptions: finalMountedOptions,
            shooterMovementOptions: DSA5.shooterMovementOptions,
            targetMovementOptions: DSA5.targetMovementOptions,
            targetSize,
            combatSpecAbs,
        });
    }

    /**
   * Add species-specific combat modifiers
   * @param {Array<Object>} situationalModifiers - Array to add modifiers to
   * @param {Object} actor - Acting character
   * @param {Object} data - Test data
   * @param {Object} source - Source weapon
   * @returns {void}
   */
    static addSpeciesModifiers(situationalModifiers, actor, data, source) {
        const creatureClass = actor.type === 'creature'
            ? actor.system.creatureClass.value
            : actor.system.details.species.value;
        const localizedSpecies = _loc(`LocalizedSpecies.${creatureClass}`);
        const speciesObject = DSA5.speciesCombatModifiers[localizedSpecies];
        if (speciesObject) {
            const attackOrParry = [
                ITEM_CONSTANTS.COMBAT_MODES.ATTACK,
                ITEM_CONSTANTS.COMBAT_MODES.PARRY
            ].includes(data.mode);
            const domains = (getProperty(source, 'system.effect.attributes') || '')
                .split(',')
                .map((x) => _loc(`LocalizedSpecies.${x.trim()}`));
            const domainMalus = domains.some((domain) =>
                speciesObject.opposingDomains.has(domain)
            ) ? 1 : 0;
            const combatSkillKey = _loc(`LocalizedCTs.${source.system.combatskill.value}`);
            if (speciesObject.combatskills.has(combatSkillKey)) {
                if (attackOrParry) {
                    situationalModifiers.push({
                        name: _loc('speciesModifier', { species: creatureClass }),
                        value: -2 - domainMalus,
                        selected: true,
                        source: `${_loc('TYPES.Item.species')} (${creatureClass})`,
                    });
                }
                situationalModifiers.push({
                    name: `${_loc('speciesModifier', { species: creatureClass })} ${_loc('CHARAbbrev.damage')}`,
                    value: -2 - domainMalus,
                    type: 'dmg',
                    selected: true,
                    source: `${_loc('TYPES.Item.species')} (${creatureClass})`,
                });
            }
        }
    }

    /**
   * Add weapon-specific modifiers from active effects
   * @param {Array<Object>} situationalModifiers - Array to add modifiers to
   * @param {Object} source - Source weapon
   * @param {string} mode - Combat mode (attack, parry, damage)
   * @returns {void}
   */
    static addWeaponModifiers(situationalModifiers, source, mode) {
        for (let effect of source.effects || []) {
            if (!DSAActiveEffect.realyRealyEnabled(effect)) continue;

            for (let change of effect.changes) {
                if (change.key === `self.situational.${mode}`) {
                    const type = { damage: 'dmg' }[mode] || '';
                    const data = `${change.value}`.split(' ');
                    let value;
                    const name = [effect.name];
                    if (data.length > 1) {
                        value = Number(data.pop());
                        name.push(data.join(' '));
                    } else {
                        value = Number(data[0]);
                    }
                    situationalModifiers.push({
                        name: name.join(' - '),
                        value,
                        source: source.name,
                        type,
                    });
                }
            }
        }
    }
}
