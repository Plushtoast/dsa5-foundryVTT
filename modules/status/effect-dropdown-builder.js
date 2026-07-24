import DSA5 from '../config/config-dsa5.js';
import DSA5CombatDialog from '../dialog/dialog-combat-dsa5.js';
import DSA5SpellDialog from '../dialog/dialog-spell-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MagicAnalysisService from '../system/magic-analysis/magic-analysis.js';

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
     * Builds a grouped dropdown menu HTML with optgroups for wizard mode
     * @param {ActiveEffect} [document] - The active effect document for context-specific options
     * @returns {string} HTML string containing the grouped dropdown
     */
    static buildGroupedDropdownMenu(document = null, categoryFilter = null) {
        const groups = this._getGroupDefinitions(document);

        const filtered = categoryFilter ? groups.filter((g) => g.key === categoryFilter) : groups;

        const optgroupStrings = filtered
            .filter((g) => g.subgroups.some((s) => s.options.length))
            .flatMap((g) => {
                if (categoryFilter) {
                    return g.subgroups.filter((s) => s.options.length).map((s) => {
                        const sorted = s.options.sort((a, b) => a.name.localeCompare(b.name));
                        const opts = sorted
                            .map((o) => `<option value="${o.val}" data-type="${o.type}" data-phase="${o.phase || 'initial'}" data-ph="${o.ph}">${o.name}</option>`)
                            .join('\n');
                        return `<optgroup label="${s.sub}">${opts}</optgroup>`;
                    });
                }
                const allOpts = g.subgroups.flatMap((s) => s.options).sort((a, b) => a.name.localeCompare(b.name));
                const opts = allOpts
                    .map((o) => `<option value="${o.val}" data-type="${o.type}" data-phase="${o.phase || 'initial'}" data-ph="${o.ph}">${o.name}</option>`)
                    .join('\n');
                return [`<optgroup label="${g.label}">${opts}</optgroup>`];
            })
            .join('\n');

        return `<select class="wizardMenu"><option value="">-</option>${optgroupStrings}</select>`;
    }

    static _getGroupDefinitions(document = null) {
        const groups = [
            { key: 'protection', icon: 'fa-solid fa-shield-halved', label: _loc('ActiveEffects.wizardCategories.protection'), subgroups: this._getBaseOptions() },
            { key: 'attributes', icon: 'fa-solid fa-chart-bar', label: _loc('ActiveEffects.wizardCategories.attributes'), subgroups: this._getCharacteristicOptions() },
            { key: 'skills', icon: 'fa-solid fa-graduation-cap', label: _loc('ActiveEffects.wizardCategories.skills'), subgroups: this._getSkillOptions() },
            { key: 'combat', icon: 'fa-solid fa-swords', label: _loc('ActiveEffects.wizardCategories.combat'), subgroups: this._getCombatOptions() },
            { key: 'magic', icon: 'fa-solid fa-hat-wizard', label: _loc('ActiveEffects.wizardCategories.magic'), subgroups: this._getSpellLiturgyOptions() },
            { key: 'regeneration', icon: 'fa-solid fa-heart-pulse', label: _loc('ActiveEffects.wizardCategories.regeneration'), subgroups: this._getRegenerationOptions() },
            { key: 'conditions', icon: 'fa-solid fa-face-dizzy', label: _loc('ActiveEffects.wizardCategories.conditions'), subgroups: this._getStatusEffectOptions() },
        ];
        if (document) {
            const weaponSubs = this._getWeaponSpecificOptions(document);
            if (weaponSubs.some((s) => s.options.length)) {
                groups.push({ key: 'weapon', icon: 'fa-solid fa-axe-battle', label: _loc('ActiveEffects.wizardCategories.weapon'), subgroups: weaponSubs });
            }
        }
        return groups;
    }

    static getWizardCategories(document = null) {
        return this._getGroupDefinitions(document)
            .filter((g) => g.subgroups.some((s) => s.options.length))
            .map(({ key, label, icon }) => ({ key, label, icon }));
    }

    static supportsWizardChanges(document = null, changes = []) {
        if (!changes?.length) return true;

        const supportedKeys = new Set(this._buildDropdownOptions(document).map((option) => option.val));
        return changes.every((change) => !change?.key || supportedKeys.has(change.key));
    }

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
        const groups = this._getGroupDefinitions(document);
        const options = groups.flatMap((g) => g.subgroups.flatMap((s) => s.options));
        return options.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Gets base protection and armor options
     * @returns {Array}
     * @private
     */
    static _getBaseOptions() {
        return [{ sub: _loc('ActiveEffects.wizardCategories.protection'), options: [
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
        ]}];
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

        const subgroups = [{
            sub: _loc('MODS.global'),
            options: [
                { name: `${skill} - ${FW}`, val: 'system.skillModifiers.FW', type: 'custom', ph: demo },
                { name: `${skill} - ${FP}`, val: 'system.skillModifiers.FP', type: 'custom', ph: demo },
                { name: `${skill} - ${FP} (${postRoll})`, val: 'system.skillModifiers.postRoll.FP', type: 'custom', ph: demo },
                { name: `${skill} - ${stepValue}`, val: 'system.skillModifiers.step', type: 'custom', ph: demo },
                { name: `${skill} - ${QS}`, val: 'system.skillModifiers.QL', type: 'custom', ph: demo },
                { name: `${skill} - ${QS} (${postRoll})`, val: 'system.skillModifiers.postRoll.QL', type: 'custom', ph: demo },
                { name: `${skill} - ${reroll} (${postRoll})`, val: 'system.skillModifiers.postRoll.reroll', type: 'custom', ph: demo },
                { name: `${skill} - ${partChecks}`, val: 'system.skillModifiers.TPM', type: 'custom', ph: demo },
                { name: `${skill} - ${_loc('MODS.global')}`, val: 'system.skillModifiers.global', type: 'custom', ph: '1' },
                { name: `${skill} - ${compensation}`, val: 'system.skillModifiers.CMP', type: 'custom', ph: demo },
                { name: _loc('MAGICANALYSIS.effectMaxQs'), val: MagicAnalysisService.MAGIC_ANALYSIS_KEYS.max, type: 'add', ph: '1' },
                { name: _loc('MAGICANALYSIS.effectStackQs'), val: MagicAnalysisService.MAGIC_ANALYSIS_KEYS.stack, type: 'add', ph: '1' },
            ],
        }];

        const models = ['liturgy', 'ceremony', 'spell', 'ritual', 'skill', 'feature'];
        for (const model of models) {
            const key = model === 'skill' ? 'skillglobal' : model;
            const modelName = _loc(key);

            subgroups.push({
                sub: modelName,
                options: [
                    { name: `${modelName} - ${FW}`, val: `system.skillModifiers.${model}.FW`, type: 'custom', ph: demo },
                    { name: `${modelName} - ${FP}`, val: `system.skillModifiers.${model}.FP`, type: 'custom', ph: demo },
                    { name: `${modelName} - ${stepValue}`, val: `system.skillModifiers.${model}.step`, type: 'custom', ph: demo },
                    { name: `${modelName} - ${QS}`, val: `system.skillModifiers.${model}.QL`, type: 'custom', ph: demo },
                    { name: `${modelName} - ${partChecks}`, val: `system.skillModifiers.${model}.TPM`, type: 'custom', ph: demo },
                    { name: `${modelName} - ${compensation}`, val: `system.skillModifiers.${model}.CMP`, type: 'custom', ph: demo },
                ],
            });
        }

        return subgroups;
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
        const compensation = _loc('MODS.compensation');

        const subgroups = [
            {
                sub: closeCombat,
                options: [
                    { name: `${closeCombat} - ${AT}`, val: 'system.meleeStats.attack', type: 'add', ph: '1' },
                    { name: `${closeCombat} - ${PA}`, val: 'system.meleeStats.parry', type: 'add', ph: '1' },
                    { name: `${closeCombat} - ${critSuccess}`, val: 'system.meleeStats.crit', type: 'add', ph: '1' },
                    { name: `${closeCombat} - ${critSuccess} (${PA})`, val: 'system.meleeStats.critPA', type: 'add', ph: '1' },
                    { name: `${closeCombat} - ${critSuccess} (${AT})`, val: 'system.meleeStats.critAT', type: 'add', ph: '1' },
                    { name: `${closeCombat} - ${damage}`, val: 'system.meleeStats.damage', type: 'add', ph: '+1d6' },
                    { name: `${closeCombat} - ${defenseMalus}`, val: 'system.meleeStats.defenseMalus', type: 'add', ph: '1' },
                ],
            },
            {
                sub: rangeCombat,
                options: [
                    { name: `${rangeCombat} - ${AT}`, val: 'system.rangeStats.attack', type: 'add', ph: '1' },
                    { name: `${rangeCombat} - ${critSuccess}`, val: 'system.rangeStats.crit', type: 'add', ph: '1' },
                    { name: `${rangeCombat} - ${damage}`, val: 'system.rangeStats.damage', type: 'add', ph: '+1d6' },
                    { name: `${rangeCombat} - ${defenseMalus}`, val: 'system.rangeStats.defenseMalus', type: 'add', ph: '1' },
                ],
            },
            {
                sub: miracle,
                options: [
                    { name: `${miracle} - ${AT}`, val: 'system.miracle.attack', type: 'add', ph: '1' },
                    { name: `${miracle} - ${PA}`, val: 'system.miracle.parry', type: 'add', ph: '1' },
                ],
            },
            {
                sub: combatskill,
                options: [
                    { name: `${combatskill} - ${AT}`, val: 'system.skillModifiers.combat.attack', type: 'custom', ph: csdemo },
                    { name: `${combatskill} - ${PA}`, val: 'system.skillModifiers.combat.parry', type: 'custom', ph: csdemo },
                    { name: `${combatskill} - ${_loc('KTW')}`, val: 'system.skillModifiers.combat.step', type: 'custom', ph: csdemo },
                    { name: `${combatskill} - ${compensation}`, val: 'system.skillModifiers.combat.CMP', type: 'custom', ph: `${csdemo}, * 1, attack:* 1, maneuver:* 1` },
                    { name: `${combatskill} - ${damage}`, val: 'system.skillModifiers.combat.damage', type: 'custom', ph: csdemo },
                    { name: `${combatskill} - ${_loc('damageThreshold')}`, val: 'system.skillModifiers.combat.damageThreshold', type: 'custom', ph: csdemo },
                ],
            },
            {
                sub: _loc('MODS.otherCombat'),
                options: [
                    { name: `${_loc('vulnerability')} - ${combatskill}`, val: 'system.vulnerabilities.combatskill', type: 'custom', ph: csdemo },
                    { name: _loc('MODS.creatureBonus'), val: 'system.creatureBonus', type: 'custom', ph: `${_loc('CONJURATION.elemental')} 1` },
                    { name: _loc('MODS.bonusActions'), val: 'system.combat.bonusActions', type: 'add', ph: '1' },
                    { name: _loc('MODS.actionCostMod'), val: 'system.combat.actionCostMod', type: 'add', ph: '-1' },
                ],
            },
        ];

        for (const model of ['meleeweapon', 'rangeweapon']) {
            const modelName = DSA5_Utility.categoryLocalization(model);
            const modifiers = foundry.utils.flattenObject(DSA5CombatDialog[`${model}RollModifiers`]);
            const opts = Object.keys(modifiers).map((k) => ({
                name: `${modelName} - ${_loc(`MODS.${k.replace(/\.[a-z]+$/, '')}`)}`,
                val: `system.${model}RollModifiers.${k}`,
                type: 'add',
                ph: '1',
            }));
            subgroups.push({ sub: modelName, options: opts });
        }

        return subgroups;
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
            {
                sub: combatReg,
                options: [
                    { name: `${combatReg} - ${wounds}`, val: 'system.repeatingEffects.startOfRound.wounds', type: 'custom', ph: '1d6' },
                    { name: `${combatReg} - ${astralEnergy}`, val: 'system.repeatingEffects.startOfRound.astralenergy', type: 'custom', ph: '1d6' },
                    { name: `${combatReg} - ${karmaEnergy}`, val: 'system.repeatingEffects.startOfRound.karmaenergy', type: 'custom', ph: '1d6' },
                ],
            },
            {
                sub: regenerate,
                options: [
                    { name: `${regenerate} - ${wounds}`, val: 'system.status.regeneration.LePgearmodifier', type: 'add', ph: '1' },
                    { name: `${regenerate} - ${astralEnergy}`, val: 'system.status.regeneration.AsPgearmodifier', type: 'add', ph: '1' },
                    { name: `${regenerate} - ${karmaEnergy}`, val: 'system.status.regeneration.KaPgearmodifier', type: 'add', ph: '1' },
                ],
            },
            {
                sub: `${regenerate} (${advanced})`,
                options: [
                    { name: `${regenerate} (${advanced}) - ${wounds}`, val: 'system.status.regeneration.LePConditional', type: 'custom', ph: conditionalHint },
                    { name: `${regenerate} (${advanced}) - ${astralEnergy}`, val: 'system.status.regeneration.AsPConditional', type: 'custom', ph: conditionalHint },
                    { name: `${regenerate} (${advanced}) - ${karmaEnergy}`, val: 'system.status.regeneration.KaPConditional', type: 'custom', ph: conditionalHint },
                ],
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
        const spellPreferences = _loc('spellpreferences');
        const spell = _loc('TYPES.Item.spell');
        const ritual = _loc('TYPES.Item.ritual');
        const liturgy = _loc('TYPES.Item.liturgy');

        const subgroups = [
            {
                sub: _loc('cost'),
                options: [
                    { name: KaPCost, val: 'system.kapModifier', type: 'add', ph: '1' },
                    { name: AsPCost, val: 'system.aspModifier', type: 'add', ph: '1' },
                    { name: `${permanentCost} ${_loc('CHARAbbrev.AsP')}`, val: 'system.status.astralenergy.permanentGear', type: 'add', ph: '1' },
                    { name: `${permanentCost} ${_loc('CHARAbbrev.KaP')}`, val: 'system.status.karmaenergy.permanentGear', type: 'add', ph: '1' },
                ],
            },
            {
                sub: `${damage} & ${foreign}`,
                options: [
                    { name: `${spell} - ${damage}`, val: 'system.spellStats.damage', type: 'add', ph: '1' },
                    { name: `${liturgy} - ${damage}`, val: 'system.liturgyStats.damage', type: 'add', ph: '1' },
                    { name: foreign, val: 'system.spellStats.foreign', type: 'add', ph: '1' },
                    { name: `${spell} - ${foreign}`, val: 'system.spellStats.foreignritual', type: 'add', ph: '1' },
                    { name: `${ritual} - ${foreign}`, val: 'system.spellStats.foreignspell', type: 'add', ph: '1' },
                ],
            },
            {
                sub: `${feature} / ${advanced}`,
                options: [
                    { name: `${feature} - ${AsPCost}`, val: 'system.skillModifiers.feature.AsPCost', type: 'custom', ph: featureHint },
                    { name: `${advanced} - ${AsPCost}`, val: 'system.skillModifiers.conditional.AsPCost', type: 'custom', ph: descriptor },
                    { name: `${feature} - ${KaPCost}`, val: 'system.skillModifiers.feature.KaPCost', type: 'custom', ph: featureHint },
                    { name: `${advanced} - ${KaPCost}`, val: 'system.skillModifiers.conditional.KaPCost', type: 'custom', ph: descriptor },
                    { name: spellPreferences, val: 'system.spellpreferences.value', type: 'override', ph: `${spell} 1, ${spell} 2` },
                ],
            },
            {
                sub: _loc('PLAYER.conjuration'),
                options: [
                    { name: `${_loc('PLAYER.conjuration')} - ${_loc('PLAYER.services')}`, val: 'system.skillModifiers.conjuration.services', type: 'custom', ph: 'Elemental 1' },
                    { name: `${_loc('PLAYER.conjuration')} - ${_loc('conjuringDifficulty')}`, val: 'system.skillModifiers.conjuration.difficulty', type: 'custom', ph: 'Elemental 1' },
                    { name: `${_loc('PLAYER.conjuration')} - ${AsPCost}`, val: 'system.skillModifiers.conjuration.AsPCost', type: 'custom', ph: 'Elemental -2' },
                ],
            },
        ];

        for (const model of ['spell', 'liturgy', 'ceremony', 'ritual']) {
            const modelName = DSA5_Utility.categoryLocalization(model);
            const opts = [];

            for (const k of ['soulpower', 'toughness']) {
                opts.push({ name: `${_loc(k)} (${modelName})`, val: `system.status.${k}.${model}resist`, type: 'add', ph: '1' });
            }

            for (const k of Object.keys(DSA5SpellDialog.rollModifiers)) {
                const loc = _loc(k.replace('Spell', ''));
                opts.push(
                    { name: `${modelName} - ${loc}`, val: `system.${model}RollModifiers.${k}.mod`, type: 'add', ph: '1' },
                    { name: `${modelName} - ${loc} - ${advanced}`, val: `system.${model}RollModifiers.${k}.custom`, type: 'custom', ph: descriptor },
                );
            }

            subgroups.push({ sub: modelName, options: opts });
        }

        return subgroups;
    }

    /**
     * Gets characteristic-related options
     * @returns {Array}
     * @private
     */
    static _getCharacteristicOptions() {
        const baseOpts = Object.keys(DSA5.characteristics).map((k) => ({
            name: _loc(`CHAR.${k.toUpperCase()}`),
            val: `system.characteristics.${k}.gearmodifier`,
            type: 'add',
            ph: '1',
        }));

        const finalValueNote = _loc('ActiveEffects.noteNoDerivedAttributes');
        const finalValueOpts = Object.keys(DSA5.characteristics).map((k) => ({
            name: `${_loc(`CHAR.${k.toUpperCase()}`)} (${finalValueNote})`,
            val: `system.characteristics.${k}.value`,
            type: 'add',
            phase: 'final',
            ph: '1',
        }));

        const calcOpts = DSA5.gearModifyableCalculatedAttributes.map((k) => ({
            name: _loc(k),
            val: `system.status.${k}.gearmodifier`,
            type: 'add',
            ph: '1',
        }));

        return [
            { sub: _loc('characteristics'), options: baseOpts },
            { sub: `${_loc('characteristics')} (${finalValueNote})`, options: finalValueOpts },
            { sub: _loc('calculatedAttributes'), options: calcOpts },
            {
                sub: _loc('MODS.otherModifiers'),
                options: [
                    { name: _loc('MODS.sight'), val: 'system.sightModifier.value', type: 'add', ph: '-1' },
                    { name: _loc('MODS.sightMax'), val: 'system.sightModifier.maxLevel', type: 'override', ph: '4' },
                    { name: `${_loc('LocalizedIDs.immuneTo')} ${_loc('condition')}`, val: 'system.immunities', type: 'add', ph: 'feared' },
                    { name: _loc('temperature.heatProtection'), val: 'system.temperature.heatProtection', type: 'add', ph: '1' },
                    { name: _loc('temperature.coldProtection'), val: 'system.temperature.coldProtection', type: 'add', ph: '1' },
                ],
            },
        ];
    }

    /**
     * Gets status effect options
     * @returns {Array}
     * @private
     */
    static _getStatusEffectOptions() {
        const options = CONFIG.statusEffects
            .filter((e) => e.system?.condition?.max)
            .map((e) => ({ name: _loc(e.name), val: `system.condition.${e.id}`, type: 'add', ph: '1' }));

        return [{ sub: _loc('ActiveEffects.wizardCategories.conditions'), options }];
    }

    /**
     * Gets weapon-specific options based on the document context
     * @param {ActiveEffect} document - The active effect document
     * @returns {Array}
     * @private
     */
    static _getWeaponSpecificOptions(document) {
        const subgroups = [];
        const parentType = document.parent?.type;

        if (parentType === 'armor') {
            subgroups.push({
                sub: _loc('armor'),
                options: [
                    { name: _loc('CustomActiveEffects.armor.vulnerability'), val: 'self.armorVulnerability', type: 'custom', ph: 'Swords 5' },
                ],
            });
        }

        if (['meleeweapon', 'rangeweapon'].includes(parentType)) {
            const modelName = DSA5_Utility.categoryLocalization(parentType);
            const maneuver = _loc('combatmaneuver');
            const maneuverExample = _loc('LocalizedIDs.weaponThrow');

            const situational = ['attack', 'parry', 'damage']
                .filter((k) => !(k === 'parry' && parentType === 'rangeweapon'))
                .map((k) => ({ name: `${modelName} - ${_loc(`CHAR.${k.toUpperCase()}`)}`, val: `self.situational.${k}`, type: 'custom', ph: '1' }));

            subgroups.push({ sub: modelName, options: situational });

            subgroups.push({
                sub: maneuver,
                options: [
                    { name: `${maneuver} - ${_loc('CHAR.attack')}`, val: 'self.maneuver.atbonus', type: 'custom', ph: `${maneuverExample} 1` },
                    { name: `${maneuver} - ${_loc('CHAR.parry')}`, val: 'self.maneuver.pabonus', type: 'custom', ph: `${maneuverExample} 1` },
                    { name: `${maneuver} - ${_loc('CHAR.damage')}`, val: 'self.maneuver.tpbonus', type: 'custom', ph: `${maneuverExample} 1` },
                ],
            });
        }

        return subgroups;
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
            (option) => `<option value="${option.val}" data-type="${option.type}" data-phase="${option.phase || 'initial'}" data-ph="${option.ph}">${option.name}</option>`
        );

        return `<select class="selMenu"><option value="">-</option>${optionStrings.join('\n')}</select>`;
    }

    // --- Enhancement-specific methods ---

    static _getEnhancementGroupDefinitions(targetType) {
        const groups = [];

        if (['meleeweapon', 'rangeweapon'].includes(targetType)) {
            groups.push({
                key: 'combat',
                icon: 'fa-solid fa-swords',
                label: _loc('ActiveEffects.wizardCategories.combat'),
                subgroups: this._getEnhancementCombatOptions(targetType),
            });
        }

        if (targetType === 'armor') {
            groups.push({
                key: 'protection',
                icon: 'fa-solid fa-shield-halved',
                label: _loc('ActiveEffects.wizardCategories.protection'),
                subgroups: this._getEnhancementProtectionOptions(),
            });
        }

        if (targetType === 'equipment') {
            groups.push({
                key: 'powersource',
                icon: 'fa-solid fa-gem',
                label: _loc('Enhancement.types.powersource'),
                subgroups: this._getEnhancementPowersourceOptions(),
            });
        }

        if (targetType === 'rangeweapon') {
            groups.push({
                key: 'attachment',
                icon: 'fa-solid fa-puzzle-piece',
                label: _loc('Enhancement.wizardCategories.attachment'),
                subgroups: this._getEnhancementAttachmentOptions(),
            });
        }

        groups.push({
            key: 'general',
            icon: 'fa-solid fa-box',
            label: _loc('Enhancement.wizardCategories.general'),
            subgroups: this._getEnhancementGeneralOptions(targetType),
        });

        return groups.filter((g) => g.subgroups.some((s) => s.options.length));
    }

    static _getEnhancementAttachmentOptions() {
        const ammunitionType = _loc('ammunitiongroup');
        const magazine = _loc('mag');
        const reloadTime = _loc('reloadTime');

        return [{
            sub: _loc('Enhancement.types.attachment'),
            options: [
                {
                    name: `${ammunitionType} → ${magazine}`,
                    val: 'system.ammunitiongroup.value',
                    type: 'override',
                    ph: 'mag',
                },
                {
                    name: `${reloadTime} (half LZ / mag swap)`,
                    val: 'system.reloadTime.value',
                    type: 'override',
                    ph: '6',
                },
                {
                    name: `${reloadTime} (custom dual)`,
                    val: 'system.reloadTime.value',
                    type: 'override',
                    ph: '2/6',
                },
            ],
        }];
    }

    static _getEnhancementPowersourceOptions() {
        const regenerate = _loc('regenerate');
        const astralEnergy = _loc('CHARAbbrev.AsP');
        const advanced = _loc('advanced');
        const conditionalHint = `${_loc('Description')} 1`;

        return [{
            sub: _loc('Enhancement.types.powersource'),
            options: [
                {
                    name: `${_loc('POWERSOURCE.anchoredSpellReduction')} (Artefakt)`,
                    val: 'system.powersource.anchoredSpellReduction',
                    type: 'add',
                    ph: '1',
                },
                {
                    name: `${regenerate} (${advanced}) - ${astralEnergy}`,
                    val: '@actor.system.status.regeneration.AsPConditional',
                    type: 'custom',
                    ph: conditionalHint,
                },
            ],
        }];
    }

    static _getEnhancementCombatOptions(targetType) {
        const damage = _loc('damage');
        const crit = _loc('CriticalSuccess');
        const botch = _loc('CriticalFailure');

        const options = [
            { name: damage, val: 'system.damage.value', type: 'add', ph: '1' },
            { name: crit, val: 'system.crit', type: 'add', ph: '-1' },
            { name: botch, val: 'system.botch', type: 'add', ph: '-1' },
        ];

        if (targetType === 'meleeweapon') {
            options.push(
                { name: _loc('atmod'), val: 'system.atmod.value', type: 'add', ph: '1' },
                { name: _loc('pamod'), val: 'system.pamod.value', type: 'add', ph: '1' },
                { name: _loc('damageThreshold'), val: 'system.damageThreshold.value', type: 'add', ph: '1' },
            );
        }

        if (targetType === 'rangeweapon') {
            options.push(
                { name: _loc('reloadTime'), val: 'system.reloadTime.value', type: 'add', ph: '-1' },
            );
        }

        return [{ sub: DSA5_Utility.categoryLocalization(targetType), options }];
    }

    static _getEnhancementProtectionOptions() {
        const protection = _loc('protection');
        return [{
            sub: protection,
            options: [
                { name: protection, val: 'system.protection.value', type: 'add', ph: '1' },
                { name: _loc('encumbrance'), val: 'system.encumbrance.value', type: 'add', ph: '-1' },
            ],
        }];
    }

    static _getEnhancementGeneralOptions(targetType) {
        const options = [
            { name: _loc('price'), val: 'system.price.value', type: 'add', ph: '10' },
            { name: _loc('Weight'), val: 'system.weight.value', type: 'add', ph: '-0.25' },
        ];

        if (targetType === 'equipment') {
            options.push(
                { name: _loc('carrycapacity'), val: 'system.capacity', type: 'add', ph: '1' },
            );
        }

        const hasStructure = ['meleeweapon', 'rangeweapon', 'armor'].includes(targetType);
        if (hasStructure) {
            const structure = _loc('structure');
            options.push(
                { name: structure, val: 'system.structure.max', type: 'add', ph: '1' },
            );
        }

        return [{ sub: _loc('Enhancement.wizardCategories.general'), options }];
    }

    static buildEnhancementDropdownMenu(targetType) {
        const groups = this._getEnhancementGroupDefinitions(targetType);
        const options = groups.flatMap((g) => g.subgroups.flatMap((s) => s.options));
        options.sort((a, b) => a.name.localeCompare(b.name));
        return this._generateDropdownHTML(options);
    }

    static buildEnhancementGroupedDropdownMenu(targetType, categoryFilter = null) {
        const groups = this._getEnhancementGroupDefinitions(targetType);
        const filtered = categoryFilter ? groups.filter((g) => g.key === categoryFilter) : groups;

        const optgroupStrings = filtered
            .filter((g) => g.subgroups.some((s) => s.options.length))
            .flatMap((g) => {
                if (categoryFilter) {
                    return g.subgroups.filter((s) => s.options.length).map((s) => {
                        const sorted = s.options.sort((a, b) => a.name.localeCompare(b.name));
                        const opts = sorted
                            .map((o) => `<option value="${o.val}" data-type="${o.type}" data-phase="${o.phase || 'initial'}" data-ph="${o.ph}">${o.name}</option>`)
                            .join('\n');
                        return `<optgroup label="${s.sub}">${opts}</optgroup>`;
                    });
                }
                const allOpts = g.subgroups.flatMap((s) => s.options).sort((a, b) => a.name.localeCompare(b.name));
                const opts = allOpts
                    .map((o) => `<option value="${o.val}" data-type="${o.type}" data-phase="${o.phase || 'initial'}" data-ph="${o.ph}">${o.name}</option>`)
                    .join('\n');
                return [`<optgroup label="${g.label}">${opts}</optgroup>`];
            })
            .join('\n');

        return `<select class="wizardMenu"><option value="">-</option>${optgroupStrings}</select>`;
    }

    static getEnhancementWizardCategories(targetType) {
        return this._getEnhancementGroupDefinitions(targetType)
            .filter((g) => g.subgroups.some((s) => s.options.length))
            .map(({ key, label, icon }) => ({ key, label, icon }));
    }

    static supportsEnhancementWizardChanges(targetType, changes = []) {
        if (!changes?.length) return true;
        const groups = this._getEnhancementGroupDefinitions(targetType);
        const supportedKeys = new Set(groups.flatMap((g) => g.subgroups.flatMap((s) => s.options.map((o) => o.val))));
        return changes.every((change) => !change?.key || supportedKeys.has(change.key));
    }

    /**
     * Finds a wizard change option by its key path (e.g. system.carryModifier).
     * @param {string} key
     * @returns {{ name: string, val: string, type: string, ph?: string }|null}
     */
    static findChangeOption(key) {
        if (!key) return null;

        for (const group of this._getGroupDefinitions()) {
            for (const subgroup of group.subgroups) {
                const option = subgroup.options.find((o) => o.val === key);
                if (option) return { ...option };
            }
        }

        for (const group of this._getEnhancementGroupDefinitions('equipment')) {
            for (const subgroup of group.subgroups) {
                const option = subgroup.options.find((o) => o.val === key);
                if (option) return { ...option };
            }
        }

        return null;
    }
}
