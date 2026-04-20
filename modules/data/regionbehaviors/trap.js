import { TrapState } from "../../chatmessage/trap_state.js";
import DSA5_Utility from "../../system/helpers/utility-dsa5.js";
import { DSARegionBehaviorBase } from './base.js';
const { BooleanField, FilePathField, NumberField, HTMLField, StringField } = foundry.data.fields;

export class DSATrapRegionBehavior extends DSARegionBehaviorBase {
    static REGION_TYPE = 'DSATrap'
    static LOCALIZATION_PREFIXES = ["REGIONBEHAVIOR_DSATrap"];

    static events = {
        [CONST.REGION_EVENTS.TOKEN_EXIT]: this.#onTokenExit,
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
            complexity: new NumberField({
                initial: 0,
                choices: {
                    [DSATrapRegionBehavior.PRIMITIV_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.0",
                    [DSATrapRegionBehavior.EINFACH_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.1",
                    [DSATrapRegionBehavior.KOMPLEX_TRAP]: "REGIONBEHAVIOR_DSATrap.COMPLEXITIES.2",
                }
            }),
            damageFormula: new StringField({ initial: "" }),
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

    async _handleRegionEvent(regionEvent) {
        if (this.disarmed) return;
        if (this.remainingCharges < 1 && this.charges > 0) return;

        const { name, data, region } = regionEvent;
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
}
