import { TrapState } from "../../chatmessage/trap_state.js";
import DSA5_Utility from "../../system/helpers/utility-dsa5.js";
import QueryOrchestrator from "../../system/queries/query-orchestrator.js";
import TrapAutomation from "../../system/automation/trap.js";
import TrapDamageFormulaField from "../item/fields/trap_damage_formula_field.js";
import { DSARegionBehaviorBase } from './base.js';
const { BooleanField, FilePathField, NumberField, HTMLField, StringField, SchemaField, TypedObjectField } = foundry.data.fields;

export class DSATrapRegionBehavior extends DSARegionBehaviorBase {
    static REGION_TYPE = 'DSATrap'
    static LOCALIZATION_PREFIXES = ["REGIONBEHAVIOR_DSATrap"];

    static events = {
        [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#onTokenExit,
        [CONST.REGION_EVENTS.TOKEN_ROUND_START]: this.#onTokenRoundStart,
    };

    static PRIMITIV_TRAP = 0;
    static EINFACH_TRAP = 1;
    static KOMPLEX_TRAP = 2;

    static TRAPTRIGGER_PRESSURE_PLATE = 0;
    static TRAPTRIGGER_WIRE = 1;
    static TRAPTRIGGER_LOCK = 2;
    static TRAPTRIGGER_SUPERNATURAL = 3;

    static TRAPTYPE_TRAP = 0;
    static TRAPTYPE_STONE = 1;
    static TRAPTYPE_ARROW = 2;
    static TRAPTYPE_BLADE = 3;
    static TRAPTYPE_CRUSH = 4;
    static TRAPTYPE_SLIDE = 5;
    static TRAPTYPE_SUFFOCATE = 6;
    static TRAPTYPE_MAGICAL = 7;

    static weaponFields() {
        return {
            weaponType: new StringField({
                initial: '',
                blank: true,
                choices: {
                    meleeweapon: 'TYPES.Item.meleeweapon',
                    rangeweapon: 'TYPES.Item.rangeweapon',
                },
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.attack.weaponType.label',
            }),
            at: new NumberField({
                initial: 12,
                integer: true,
                min: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.attack.at.label',
            }),
            traits: new StringField({
                initial: '',
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.attack.traits.label',
            }),
        };
    }

    static sharedSchema() {
        return {
            difficulty: new NumberField({ required: true, initial: 0 }),
            stealth: new NumberField({ required: true, initial: 0 }),
            trapType: new NumberField({
                initial: 0, choices: {
                    [DSATrapRegionBehavior.TRAPTYPE_TRAP]: "REGIONBEHAVIOR_DSATrap.TYPES.0",
                    [DSATrapRegionBehavior.TRAPTYPE_STONE]: "REGIONBEHAVIOR_DSATrap.TYPES.1",
                    [DSATrapRegionBehavior.TRAPTYPE_ARROW]: "REGIONBEHAVIOR_DSATrap.TYPES.2",
                    [DSATrapRegionBehavior.TRAPTYPE_BLADE]: "REGIONBEHAVIOR_DSATrap.TYPES.3",
                    [DSATrapRegionBehavior.TRAPTYPE_CRUSH]: "REGIONBEHAVIOR_DSATrap.TYPES.4",
                    [DSATrapRegionBehavior.TRAPTYPE_SLIDE]: "REGIONBEHAVIOR_DSATrap.TYPES.5",
                    [DSATrapRegionBehavior.TRAPTYPE_SUFFOCATE]: "REGIONBEHAVIOR_DSATrap.TYPES.6",
                    [DSATrapRegionBehavior.TRAPTYPE_MAGICAL]: "REGIONBEHAVIOR_DSATrap.TYPES.7",
                }
            }),
            attack: new SchemaField(this.weaponFields()),
            attacks: new TypedObjectField(new SchemaField({
                name: new StringField({
                    initial: '',
                    label: 'REGIONBEHAVIOR_DSATrap.FIELDS.attacks.name.label',
                }),
                damageFormula: new TrapDamageFormulaField({
                    initial: '',
                    blank: true,
                    label: 'REGIONBEHAVIOR_DSATrap.FIELDS.damageFormula.label',
                }),
                ...this.weaponFields(),
            }), { initial: {}, label: 'REGIONBEHAVIOR_DSATrap.FIELDS.attacks.label' }),
            complexity: new NumberField({
                initial: 0,
                choices: {
                    [DSATrapRegionBehavior.PRIMITIV_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.0",
                    [DSATrapRegionBehavior.EINFACH_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.1",
                    [DSATrapRegionBehavior.KOMPLEX_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.2",
                }
            }),
            damageFormula: new TrapDamageFormulaField({ initial: '', blank: true }),
            tools: new StringField({ initial: "" }),
            trigger: new NumberField({
                initial: 0,
                choices: {
                    [DSATrapRegionBehavior.TRAPTRIGGER_PRESSURE_PLATE]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.0",
                    [DSATrapRegionBehavior.TRAPTRIGGER_WIRE]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.1",
                    [DSATrapRegionBehavior.TRAPTRIGGER_LOCK]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.2",
                    [DSATrapRegionBehavior.TRAPTRIGGER_SUPERNATURAL]: "REGIONBEHAVIOR_DSATrap.TRIGGERS.3"
                }
            }),
            autoPause: new BooleanField({ required: true, initial: true }),
            sound: new FilePathField({ categories: ["AUDIO"] }),
            timerRounds: new NumberField({
                required: true,
                integer: true,
                min: 0,
                initial: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.timerRounds.label',
            }),
            escapeModifier: new NumberField({
                required: true,
                integer: true,
                initial: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.escapeModifier.label',
            }),
            escalateEvery: new NumberField({
                required: true,
                integer: true,
                min: 0,
                initial: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.escalateEvery.label',
            }),
            escalateMax: new NumberField({
                required: true,
                integer: true,
                initial: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.escalateMax.label',
            }),
            chaseGs: new NumberField({
                required: true,
                integer: true,
                min: 0,
                initial: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.chaseGs.label',
            }),
            chaseFw: new NumberField({
                required: true,
                integer: true,
                min: 0,
                initial: 0,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.chaseFw.label',
            }),
            chaseDistanceFormula: new TrapDamageFormulaField({
                initial: '',
                blank: true,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.chaseDistanceFormula.label',
            }),
            passwordRequired: new BooleanField({
                required: true,
                initial: false,
                label: 'REGIONBEHAVIOR_DSATrap.FIELDS.passwordRequired.label',
            }),
            events: foundry.data.regionBehaviors.RegionBehaviorType._createEventsField({
                events: [
                    CONST.REGION_EVENTS.TOKEN_ENTER,
                    CONST.REGION_EVENTS.TOKEN_EXIT,
                    CONST.REGION_EVENTS.TOKEN_ANIMATE_IN,
                    CONST.REGION_EVENTS.TOKEN_ANIMATE_OUT,
                    CONST.REGION_EVENTS.TOKEN_MOVE_IN,
                    CONST.REGION_EVENTS.TOKEN_MOVE_OUT,
                    CONST.REGION_EVENTS.TOKEN_TURN_START,
                    CONST.REGION_EVENTS.TOKEN_TURN_END,
                    CONST.REGION_EVENTS.TOKEN_ROUND_START,
                    CONST.REGION_EVENTS.TOKEN_ROUND_END,
                ],
                initial: [CONST.REGION_EVENTS.TOKEN_MOVE_IN]
            }),
        }
    }

    static defineSchema() {
        return {
            gmdescription: new HTMLField({ initial: "" }),
            description: new HTMLField({ initial: "" }),
            ...this.sharedSchema(),
            disarmed: new BooleanField({ required: true, initial: false }),
            detected: new BooleanField({ required: true, initial: false }),
            charges: new NumberField({ required: true, initial: 0 }),
            remainingCharges: new NumberField({ required: true, initial: 0 }),
            removeOnExit: new BooleanField({ initial: false }),
        }
    }

    static async #onTokenExit(event) {
        if (!event.user.isSelf) return;
        const { token } = event.data;
        if (this.removeOnExit) await this.removeEffects(token);
    }

    static async #onTokenRoundStart(event) {
        if (!event.user.isSelf) return;
        if (!DSA5_Utility.isActiveGM()) return;
        await TrapAutomation.onRegionRound(this.parent);
    }

    async _handleRegionEvent(regionEvent) {
        if (this.disarmed) return;
        if (this.remainingCharges < 1 && this.charges > 0) return;

        const { name, data, region } = regionEvent;
        if (name === CONST.REGION_EVENTS.TOKEN_ROUND_START || name === CONST.REGION_EVENTS.TOKEN_ROUND_END) return;
        const token = data.token;

        if (!token) return;

        if (regionEvent.user.isSelf) token.stopMovement();

        if (!DSA5_Utility.isActiveGM()) return;

        if (this.autoPause) {
            game.togglePause(true, { broadcast: true });
            canvas.animatePan({ x: token.x, y: token.y });
        }

        const trapState = new TrapState(this.parent, token, region, name)
        trapState.toMessage();
    }

    async toItem() {
        const data = {
            name: this.parent.name,
            system: {}
        }

        for (const key of Object.keys(DSATrapRegionBehavior.sharedSchema())) {
            if (this[key] !== undefined) {
                data.system[key] = this[key];
            }
        }

        data.charges = `${this.charges}`;

        return data;
    }

    static async handleTrapRollResult({ trapMessageUuid, mode, actorId, status, resultDetails, skipActorMatch = false }) {
        if (!game.user.isGM) return;
        if (!QueryOrchestrator.TERMINAL_STATES.has(status)) return;

        const trapMessage = await fromUuid(trapMessageUuid);
        if (!trapMessage) return;

        const trapState = await TrapState.fromMessage(trapMessage);
        if (!trapState) return;
        await trapState.applyRollResult({ mode, actorId, status, skipActorMatch });
    }

    static migrateData(source, options) {
        TrapAutomation.migrateSource(source);
        return super.migrateData(source, options);
    }

    async _preCreate(data, options, user) {
        TrapAutomation.applyAttackWeaponPrefillOnCreate(data, this);
        return super._preCreate(data, options, user);
    }

    async _preUpdate(changed, options, user) {
        TrapAutomation.applyAttackWeaponPrefill(this, changed);
        return super._preUpdate(changed, options, user);
    }

    buildHoverTooltip({ isGM = game.user.isGM } = {}) {
        const tooltip = super.buildHoverTooltip({ isGM });
        if (isGM) return tooltip;
        if (this.detected) {
            tooltip.description = this.constructor.plainText(this.description);
        }
        tooltip.status = null;
        return tooltip;
    }

    hoverTooltipStatus() {
        if (this.parent?.disabled) {
            return { key: 'disabled', label: _loc('DSAREGION.TOOLTIP.disabled') };
        }
        if (this.disarmed) {
            return { key: 'disarmed', label: _loc('REGIONBEHAVIOR_DSATrap.FIELDS.disarmed.label') };
        }
        if (Number(this.charges) > 0 && Number(this.remainingCharges) < 1) {
            return { key: 'empty', label: _loc('DSAREGION.TOOLTIP.empty') };
        }
        return { key: 'active', label: _loc('DSAREGION.TOOLTIP.active') };
    }

    hoverTooltipLines() {
        const vis = TrapAutomation.sheetVisibility(this.trapType);
        const lines = [
            this.constructor.tooltipLine(
                _loc('REGIONBEHAVIOR_DSATrap.FIELDS.trapType.label'),
                this.localizedChoice('trapType', this.trapType),
            ),
        ];

        if (vis.showDamage) {
            const damage = TrapAutomation.strikesFrom(this)
                .map((strike) => (strike.name ? `${strike.name} ${strike.damageFormula}` : strike.damageFormula))
                .filter(Boolean)
                .join(', ');
            lines.push(this.constructor.tooltipLine(_loc('damage'), damage));
        }

        if (vis.showAttack) {
            lines.push(this.constructor.tooltipLine(_loc('CHARAbbrev.AT'), this.attack?.at));
        }

        if (Number(this.charges) > 0) {
            lines.push(this.constructor.tooltipLine(
                _loc('charges'),
                `${Math.max(0, Number(this.remainingCharges) || 0)}/${this.charges}`,
            ));
        } else {
            lines.push(this.constructor.tooltipLine(_loc('charges'), _loc('infinite')));
        }

        lines.push(this.constructor.tooltipLine(
            _loc('REGIONBEHAVIOR_DSATrap.FIELDS.stealth.label'),
            this.constructor.signedValue(this.stealth),
        ));
        lines.push(this.constructor.tooltipLine(
            _loc('REGIONBEHAVIOR_DSATrap.FIELDS.difficulty.label'),
            this.constructor.signedValue(this.difficulty),
        ));
        lines.push(this.constructor.tooltipLine(
            _loc('REGIONBEHAVIOR_DSATrap.FIELDS.trigger.label'),
            this.localizedChoice('trigger', this.trigger),
        ));

        if (this.detected) {
            lines.push(this.constructor.tooltipLine(
                _loc('REGIONBEHAVIOR_DSATrap.FIELDS.detected.label'),
                _loc('yes'),
            ));
        }

        if (vis.showTimer && Number(this.timerRounds) > 0) {
            lines.push(this.constructor.tooltipLine(
                _loc('REGIONBEHAVIOR_DSATrap.FIELDS.timerRounds.label'),
                this.timerRounds,
            ));
            lines.push(this.constructor.tooltipLine(
                _loc('REGIONBEHAVIOR_DSATrap.FIELDS.escapeModifier.label'),
                this.constructor.signedValue(this.escapeModifier),
            ));
        }

        if (vis.showChase) {
            if (Number(this.chaseGs) > 0) {
                lines.push(this.constructor.tooltipLine(
                    _loc('REGIONBEHAVIOR_DSATrap.FIELDS.chaseGs.label'),
                    this.chaseGs,
                ));
            }
            if (this.chaseDistanceFormula) {
                lines.push(this.constructor.tooltipLine(
                    _loc('REGIONBEHAVIOR_DSATrap.FIELDS.chaseDistanceFormula.label'),
                    this.chaseDistanceFormula,
                ));
            }
        }

        if (vis.showPassword && this.passwordRequired) {
            lines.push(this.constructor.tooltipLine(
                _loc('REGIONBEHAVIOR_DSATrap.FIELDS.passwordRequired.label'),
                _loc('yes'),
            ));
        }

        return lines.filter(Boolean);
    }
}
