import DSA5 from '../config/config-dsa5.js';
import DSA5CombatDialog from '../dialog/dialog-combat-dsa5.js';
import DSA5SpellDialog from '../dialog/dialog-spell-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const { getProperty } = foundry.utils;

/**
 * Utility class for building dropdown menus for Active Effect configurations
 */
export default class EffectDropdownBuilder {
    /**
     * Cache for dropdown options to improve performance
     * @type {string|null}
     * @private
     */
    static _cachedDropdownOptions = null;

    /**
     * Flag to track if cache needs invalidation
     * @type {boolean}
     * @private
     */
    static _cacheInvalidated = true;

    /**
     * Builds the dropdown menu HTML for effect key selection
     * @param {ActiveEffect} [document] - The active effect document for context-specific options
     * @returns {string} HTML string containing the dropdown options
     */
    static buildDropdownMenu(document = null) {
        // Use cache if available and not invalidated
        if (!this._cacheInvalidated && this._cachedDropdownOptions && !document) {
            return this._cachedDropdownOptions;
        }

        const options = this._buildDropdownOptions(document);
        const html = this._generateDropdownHTML(options);

        // Cache the result if no document-specific context
        if (!document) {
            this._cachedDropdownOptions = html;
            this._cacheInvalidated = false;
        }

        return html;
    }

    /**
     * Invalidates the dropdown cache (call when game data changes)
     */
    static invalidateCache() {
        this._cacheInvalidated = true;
        this._cachedDropdownOptions = null;
    }

    /**
     * Builds the array of dropdown options
     * @param {ActiveEffect} [document] - The active effect document for context
     * @returns {Array<{name: string, val: string, type: string, ph: string}>}
     * @private
     */
    static _buildDropdownOptions(document = null) {
        const options = [];

        options.push(...this._getBaseOptions());

        options.push(...this._getSkillOptions());

        options.push(...this._getCombatOptions());

        options.push(...this._getRegenerationOptions());

        options.push(...this._getSpellLiturgyOptions());

        options.push(...this._getCharacteristicOptions());

        options.push(...this._getStatusEffectOptions());

        if (document) {
            options.push(...this._getWeaponSpecificOptions(document));
        }

        return options.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Gets base protection and armor options
     * @returns {Array}
     * @private
     */
    static _getBaseOptions() {
        return [
            {
                name: _loc('protection'),
                val: 'system.totalArmor',
                type: 'add',
                ph: '1',
            },
            {
                name: _loc('liturgyArmor'),
                val: 'system.liturgyArmor',
                type: 'add',
                ph: '1',
            },
            {
                name: `${_loc('resistanceModifier')} (${_loc('condition')})`,
                val: 'system.resistances.effects',
                type: 'custom',
                ph: 'inpain 1',
            },
            {
                name: `${_loc('threshold')} (${_loc('condition')})`,
                val: 'system.thresholds.effects',
                type: 'custom',
                ph: 'inpain 1',
            },
            {
                name: _loc('spellArmor'),
                val: 'system.spellArmor',
                type: 'add',
                ph: '1',
            },
            {
                name: _loc('carrycapacity'),
                val: 'system.carryModifier',
                type: 'add',
                ph: '1',
            },
        ];
    }

    /**
     * Gets skill-related options
     * @returns {Array}
     * @private
     */
    static _getSkillOptions() {
        const FW = _loc('MODS.FW');
        const skill = _loc('TYPES.Item.skill');
        const FP = _loc('MODS.FP');
        const stepValue = _loc('stepValue');
        const QS = _loc('MODS.QS');
        const postRoll = _loc('MODS.postRoll');
        const reroll = _loc('MODS.reroll');
        const partChecks = _loc('MODS.partChecks');
        const compensation = _loc('MODS.compensation');
        const demo = `${_loc('LocalizedIDs.perception')} 1`;

        const skillOptions = [
            {
                name: `${skill} - ${FW}`,
                val: 'system.skillModifiers.FW',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${FP}`,
                val: 'system.skillModifiers.FP',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${FP} (${postRoll})`,
                val: 'system.skillModifiers.postRoll.FP',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${stepValue}`,
                val: 'system.skillModifiers.step',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${QS}`,
                val: 'system.skillModifiers.QL',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${QS} (${postRoll})`,
                val: 'system.skillModifiers.postRoll.QL',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${reroll} (${postRoll})`,
                val: 'system.skillModifiers.postRoll.reroll',
                type: 'custom',
                ph: `${_loc('LocalizedIDs.perception')} 1`,
            },
            {
                name: `${skill} - ${partChecks}`,
                val: 'system.skillModifiers.TPM',
                type: 'custom',
                ph: demo,
            },
            {
                name: `${skill} - ${_loc('MODS.global')}`,
                val: 'system.skillModifiers.global',
                type: 'custom',
                ph: '1',
            },
            {
                name: `${skill} - ${compensation}`,
                val: `system.skillModifiers.CMP`,
                type: 'custom',
                ph: demo,
            },
        ];

        // Add model-specific skill options
        const models = ['liturgy', 'ceremony', 'spell', 'ritual', 'skill', 'feature'];
        for (const model of models) {
            const key = model === 'skill' ? 'skillglobal' : model;
            const modelName = _loc(key);

            skillOptions.push(
                {
                    name: `${modelName} - ${FW}`,
                    val: `system.skillModifiers.${model}.FW`,
                    type: 'custom',
                    ph: demo,
                },
                {
                    name: `${modelName} - ${FP}`,
                    val: `system.skillModifiers.${model}.FP`,
                    type: 'custom',
                    ph: demo,
                },
                {
                    name: `${modelName} - ${stepValue}`,
                    val: `system.skillModifiers.${model}.step`,
                    type: 'custom',
                    ph: demo,
                },
                {
                    name: `${modelName} - ${QS}`,
                    val: `system.skillModifiers.${model}.QL`,
                    type: 'custom',
                    ph: demo,
                },
                {
                    name: `${modelName} - ${partChecks}`,
                    val: `system.skillModifiers.${model}.TPM`,
                    type: 'custom',
                    ph: demo,
                },
                {
                    name: `${modelName} - ${compensation}`,
                    val: `system.skillModifiers.${model}.CMP`,
                    type: 'custom',
                    ph: demo,
                },
            );
        }

        return skillOptions;
    }

    /**
     * Gets combat-related options
     * @returns {Array}
     * @private
     */
    static _getCombatOptions() {
        const closeCombat = _loc('closeCombatAttacks');
        const rangeCombat = _loc('rangeCombatAttacks');
        const miracle = _loc('LocalizedIDs.miracle');
        const csdemo = `${_loc('LocalizedIDs.wrestle')} 1`;
        const combatskill = _loc('TYPES.Item.combatskill');
        const critSuccess = _loc('CriticalSuccess');
        const AT = _loc('CHARAbbrev.AT');
        const PA = _loc('CHARAbbrev.PA');
        const damage = _loc('CHARAbbrev.damage');
        const defenseMalus = _loc('MODS.defenseMalus');

        const combatOptions = [
            // Close combat options
            {
                name: `${closeCombat} - ${AT}`,
                val: 'system.meleeStats.attack',
                type: 'add',
                ph: '1',
            },
            {
                name: `${closeCombat} - ${PA}`,
                val: 'system.meleeStats.parry',
                type: 'add',
                ph: '1',
            },
            {
                name: `${closeCombat} - ${critSuccess}`,
                val: 'system.meleeStats.crit',
                type: 'add',
                ph: '1',
            },
            {
                name: `${closeCombat} - ${critSuccess} (${PA})`,
                val: 'system.meleeStats.critPA',
                type: 'add',
                ph: '1',
            },
            {
                name: `${closeCombat} - ${critSuccess} (${AT})`,
                val: 'system.meleeStats.critAT',
                type: 'add',
                ph: '1',
            },
            {
                name: `${closeCombat} - ${damage}`,
                val: 'system.meleeStats.damage',
                type: 'add',
                ph: '+1d6',
            },
            {
                name: `${closeCombat} - ${defenseMalus}`,
                val: 'system.meleeStats.defenseMalus',
                type: 'add',
                ph: '1',
            },

            // Range combat options
            {
                name: `${rangeCombat} - ${AT}`,
                val: 'system.rangeStats.attack',
                type: 'add',
                ph: '1',
            },
            {
                name: `${rangeCombat} - ${critSuccess}`,
                val: 'system.rangeStats.crit',
                type: 'add',
                ph: '1',
            },
            {
                name: `${rangeCombat} - ${damage}`,
                val: 'system.rangeStats.damage',
                type: 'add',
                ph: '+1d6',
            },
            {
                name: `${rangeCombat} - ${defenseMalus}`,
                val: 'system.rangeStats.defenseMalus',
                type: 'add',
                ph: '1',
            },

            // Miracle options
            {
                name: `${miracle} - ${AT}`,
                val: 'system.miracle.attack',
                type: 'add',
                ph: '1',
            },
            {
                name: `${miracle} - ${PA}`,
                val: 'system.miracle.parry',
                type: 'add',
                ph: '1',
            },

            // Combat skill options
            {
                name: `${combatskill} - ${AT}`,
                val: 'system.skillModifiers.combat.attack',
                type: 'custom',
                ph: csdemo,
            },
            {
                name: `${combatskill} - ${PA}`,
                val: 'system.skillModifiers.combat.parry',
                type: 'custom',
                ph: csdemo,
            },
            {
                name: `${combatskill} - ${_loc('KTW')}`,
                val: 'system.skillModifiers.combat.step',
                type: 'custom',
                ph: csdemo,
            },
            {
                name: `${combatskill} - ${damage}`,
                val: 'system.skillModifiers.combat.damage',
                type: 'custom',
                ph: csdemo,
            },
            {
                name: `${combatskill} - ${_loc('damageThreshold')}`,
                val: 'system.skillModifiers.combat.damageThreshold',
                type: 'custom',
                ph: csdemo,
            },

            // Vulnerability
            {
                name: `${_loc('vulnerability')} - ${combatskill}`,
                val: 'system.vulnerabilities.combatskill',
                type: 'custom',
                ph: csdemo,
            },

            // Creature bonus
            {
                name: _loc('MODS.creatureBonus'),
                val: 'system.creatureBonus',
                type: 'custom',
                ph: `${_loc('CONJURATION.elemental')} 1`,
            },
        ];

        // Add weapon-specific combat modifiers
        for (const model of ['meleeweapon', 'rangeweapon']) {
            const modelName = DSA5_Utility.categoryLocalization(model);
            const modifiers = foundry.utils.flattenObject(DSA5CombatDialog[`${model}RollModifiers`]);

            for (const k of Object.keys(modifiers)) {
                combatOptions.push({
                    name: `${modelName} - ${_loc(`MODS.${k.replace(/\.[a-z]+$/, '')}`)}`,
                    val: `system.${model}RollModifiers.${k}`,
                    type: 'add',
                    ph: '1',
                });
            }
        }

        return combatOptions;
    }

    /**
     * Gets regeneration-related options
     * @returns {Array}
     * @private
     */
    static _getRegenerationOptions() {
        const regenerate = _loc('regenerate');
        const combatReg = `${regenerate} (${_loc('CHARAbbrev.CR')})`;
        const wounds = _loc('wounds');
        const astralEnergy = _loc('astralenergy');
        const karmaEnergy = _loc('karmaenergy');
        const advanced = _loc('advanced');
        const conditionalHint = `${_loc('Description')} 1`;

        return [
            // Combat regeneration
            {
                name: `${combatReg} - ${wounds}`,
                val: 'system.repeatingEffects.startOfRound.wounds',
                type: 'custom',
                ph: '1d6',
            },
            {
                name: `${combatReg} - ${astralEnergy}`,
                val: 'system.repeatingEffects.startOfRound.astralenergy',
                type: 'custom',
                ph: '1d6',
            },
            {
                name: `${combatReg} - ${karmaEnergy}`,
                val: 'system.repeatingEffects.startOfRound.karmaenergy',
                type: 'custom',
                ph: '1d6',
            },

            // Regular regeneration
            {
                name: `${regenerate} - ${wounds}`,
                val: 'system.status.regeneration.LePgearmodifier',
                type: 'add',
                ph: '1',
            },
            {
                name: `${regenerate} - ${astralEnergy}`,
                val: 'system.status.regeneration.AsPgearmodifier',
                type: 'add',
                ph: '1',
            },
            {
                name: `${regenerate} - ${karmaEnergy}`,
                val: 'system.status.regeneration.KaPgearmodifier',
                type: 'add',
                ph: '1',
            },
            {
                name: `${regenerate} (${advanced}) - ${wounds}`,
                val: 'system.status.regeneration.LePConditional',
                type: 'custom',
                ph: conditionalHint,
            },
            {
                name: `${regenerate} (${advanced}) - ${astralEnergy}`,
                val: 'system.status.regeneration.AsPConditional',
                type: 'custom',
                ph: conditionalHint,
            },
            {
                name: `${regenerate} (${advanced}) - ${karmaEnergy}`,
                val: 'system.status.regeneration.KaPConditional',
                type: 'custom',
                ph: conditionalHint,
            },
        ];
    }

    /**
     * Gets spell and liturgy related options
     * @returns {Array}
     * @private
     */
    static _getSpellLiturgyOptions() {
        const AsPCost = _loc('AsPCost');
        const KaPCost = _loc('KaPCost');
        const permanentCost = _loc('permanentCost');
        const featureHint = `${_loc('Healing')} 1`;
        const descriptor = `${_loc('Description')} 1`;
        const advanced = _loc('advanced');
        const feature = _loc('feature');
        const damage = _loc('damage');
        const foreign = _loc('DSASETTINGS.enableForeignSpellModifer');
        const spell = _loc('TYPES.Item.spell');
        const ritual = _loc('TYPES.Item.ritual');
        const liturgy = _loc('TYPES.Item.liturgy');

        const options = [
            // Base costs
            { name: KaPCost, val: 'system.kapModifier', type: 'add', ph: '1' },
            { name: AsPCost, val: 'system.aspModifier', type: 'add', ph: '1' },
            {
                name: `${permanentCost} ${_loc('CHARAbbrev.AsP')}`,
                val: 'system.status.astralenergy.permanentGear',
                type: 'add',
                ph: '1',
            },
            {
                name: `${permanentCost} ${_loc('CHARAbbrev.KaP')}`,
                val: 'system.status.karmaenergy.permanentGear',
                type: 'add',
                ph: '1',
            },

            // Spell/Liturgy damage
            {
                name: `${spell} - ${damage}`,
                val: 'system.spellStats.damage',
                type: 'add',
                ph: '1',
            },
            {
                name: `${liturgy} - ${damage}`,
                val: 'system.liturgyStats.damage',
                type: 'add',
                ph: '1',
            },
            {
                name: foreign,
                val: 'system.spellStats.foreign',
                type: 'add',
                ph: '1',
            },
            {
                name: `${spell} - ${foreign}`,
                val: 'system.spellStats.foreignritual',
                type: 'add',
                ph: '1',
            },
            {
                name: `${ritual} - ${foreign}`,
                val: 'system.spellStats.foreignspell',
                type: 'add',
                ph: '1',
            },

            // Feature costs
            {
                name: `${feature} - ${AsPCost}`,
                val: 'system.skillModifiers.feature.AsPCost',
                type: 'custom',
                ph: featureHint,
            },
            {
                name: `${advanced} - ${AsPCost}`,
                val: 'system.skillModifiers.conditional.AsPCost',
                type: 'custom',
                ph: descriptor,
            },
            {
                name: `${feature} - ${KaPCost}`,
                val: 'system.skillModifiers.feature.KaPCost',
                type: 'custom',
                ph: featureHint,
            },
            {
                name: `${advanced} - ${KaPCost}`,
                val: 'system.skillModifiers.conditional.KaPCost',
                type: 'custom',
                ph: descriptor,
            },
        ];

        // Add spell/liturgy roll modifiers
        for (const model of ['spell', 'liturgy', 'ceremony', 'ritual']) {
            const modelName = DSA5_Utility.categoryLocalization(model);

            // Resistance options
            for (const k of ['soulpower', 'toughness']) {
                options.push({
                    name: `${_loc(k)} (${modelName})`,
                    val: `system.status.${k}.${model}resist`,
                    type: 'add',
                    ph: '1',
                });
            }

            // Roll modifiers
            for (const k of Object.keys(DSA5SpellDialog.rollModifiers)) {
                const loc = _loc(k.replace('Spell', ''));
                options.push(
                    {
                        name: `${modelName} - ${loc}`,
                        val: `system.${model}RollModifiers.${k}.mod`,
                        type: 'add',
                        ph: '1',
                    },
                    {
                        name: `${modelName} - ${loc} - ${advanced}`,
                        val: `system.${model}RollModifiers.${k}.custom`,
                        type: 'custom',
                        ph: descriptor,
                    },
                );
            }
        }

        return options;
    }

    /**
     * Gets characteristic-related options
     * @returns {Array}
     * @private
     */
    static _getCharacteristicOptions() {
        const options = [];

        // Base characteristics
        for (const k of Object.keys(DSA5.characteristics)) {
            options.push({
                name: _loc(`CHAR.${k.toUpperCase()}`),
                val: `system.characteristics.${k}.gearmodifier`,
                type: 'add',
                ph: '1',
            });
        }

        // Calculated attributes
        for (const k of DSA5.gearModifyableCalculatedAttributes) {
            options.push({
                name: _loc(k),
                val: `system.status.${k}.gearmodifier`,
                type: 'add',
                ph: '1',
            });
        }

        // Special modifiers
        options.push(
            {
                name: _loc('MODS.sight'),
                val: 'system.sightModifier.value',
                type: 'add',
                ph: '-1',
            },
            {
                name: _loc('MODS.sightMax'),
                val: 'system.sightModifier.maxLevel',
                type: 'override',
                ph: '4',
            },
            {
                name: `${_loc('LocalizedIDs.immuneTo')} ${_loc('condition')}`,
                val: 'system.immunities',
                type: 'add',
                ph: 'feared',
            },
            {
                name: _loc('temperature.heatProtection'),
                val: 'system.temperature.heatProtection',
                type: 'add',
                ph: '1',
            },
            {
                name: _loc('temperature.coldProtection'),
                val: 'system.temperature.coldProtection',
                type: 'add',
                ph: '1',
            },
        );

        return options;
    }

    /**
     * Gets status effect options
     * @returns {Array}
     * @private
     */
    static _getStatusEffectOptions() {
        const options = [];

        for (const effect of CONFIG.statusEffects) {
            if (effect.system?.condition?.max) {
                options.push({
                    name: _loc(effect.name),
                    val: `system.condition.${effect.id}`,
                    type: 'add',
                    ph: '1',
                });
            }
        }

        return options;
    }

    /**
     * Gets weapon-specific options based on the document context
     * @param {ActiveEffect} document - The active effect document
     * @returns {Array}
     * @private
     */
    static _getWeaponSpecificOptions(document) {
        const options = [];
        const parentType = document.parent?.type;

        // Armor-specific options
        if (parentType === 'armor') {
            options.push({
                name: _loc('CustomActiveEffects.armor.vulnerability'),
                val: 'self.armorVulnerability',
                type: 'custom',
                ph: 'Swords 5',
            });
        }

        // Weapon-specific options
        if (['meleeweapon', 'rangeweapon'].includes(parentType)) {
            const modelName = DSA5_Utility.categoryLocalization(parentType);
            const maneuver = _loc('combatmaneuver');
            const maneuverExample = _loc('LocalizedIDs.weaponThrow');

            // Situational modifiers
            for (const k of ['attack', 'parry', 'damage']) {
                if (k === 'parry' && parentType === 'rangeweapon') continue;

                const mode = _loc(`CHAR.${k.toUpperCase()}`);
                options.push({
                    name: `${modelName} - ${mode}`,
                    val: `self.situational.${k}`,
                    type: 'custom',
                    ph: '1',
                });
            }

            // Maneuver modifiers
            options.push(
                {
                    name: `${maneuver} - ${_loc('CHAR.attack')}`,
                    val: 'self.maneuver.atbonus',
                    type: 'custom',
                    ph: `${maneuverExample} 1`,
                },
                {
                    name: `${maneuver} - ${_loc('CHAR.parry')}`,
                    val: 'self.maneuver.pabonus',
                    type: 'custom',
                    ph: `${maneuverExample} 1`,
                },
                {
                    name: `${maneuver} - ${_loc('CHAR.damage')}`,
                    val: 'self.maneuver.tpbonus',
                    type: 'custom',
                    ph: `${maneuverExample} 1`,
                },
            );
        }

        return options;
    }

    /**
     * Generates the HTML string for the dropdown
     * @param {Array} options - Array of option objects
     * @returns {string} HTML string
     * @private
     */
    static _generateDropdownHTML(options) {
        // Validate options
        for (const option of options) {
            if (!option.ph || option.type === undefined) {
                console.warn('Invalid dropdown option:', option);
            }
        }

        const optionStrings = options.map(
            (option) => `<option value="${option.val}" data-type="${option.type}" data-ph="${option.ph}">${option.name}</option>`
        );

        return `<select class="selMenu"><option value="">-</option>${optionStrings.join('\n')}</select>`;
    }
}
