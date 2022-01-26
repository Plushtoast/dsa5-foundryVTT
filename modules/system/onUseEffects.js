import DSA5_Utility from "./utility-dsa5.js";
import RuleChaos from "./rule_chaos.js";

export default class OnUseEffect {
    constructor(item) {
        this.item = item
    }

    async callMacro(packName, name, args = {}) {
        const pack = game.packs.get(packName)
        const documents = await pack.getDocuments({ name })
        let result = {}
        if (documents.length) {
            const body = `(async () => {${documents[0].data.command}})()`;
            const fn = Function("args", "actor", "item", body);
            try {
                args.result = result
                await fn.call(this, args, this.item.actor, this.item);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
                result.error = true
            }
        }
        return result
    }

    async executeOnUseEffect() {
        if (!game.user.can("MACRO_SCRIPT")) {
            return ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
        }
        if (!this.item.actor) return

        const macro = OnUseEffect.getOnUseEffect(this.item)
        const body = `(async () => {${macro}})()`;
        const fn = Function("item", "actor", body);
        try {
            await fn.call(this, this.item, this.item.actor);
        } catch (err) {
            ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
            console.error(err);
            console.warn(err.stack)
        }
    }

    static getOnUseEffect(item) {
        return item.getFlag("dsa5", "onUseEffect")
    }

    async automatedAnimation(successLevel, options = {}) {
        if (game.modules.get("autoanimations") && game.modules.get("autoanimations").active) {
            console.warn("Animations for on use effects not enabled yet")
        }
    }

    effectDummy(label, changes, duration) {
        return {
            label,
            icon: "icons/svg/aura.svg",
            changes,
            duration,
            flags: {
                dsa5: {
                    value: null,
                    editable: true,
                    customizable: true,
                    description: label,
                    custom: true
                }
            }
        }
    }

    async socketedConditionAddActor(actors, data) {
        if (game.user.isGM) {
            const names = []
            for (let actor of actors) {
                await actor.addCondition(data)
                names.push(actor.name)
            }
            if (names.length) {
                const infoMsg = game.i18n.format("ActiveEffects.appliedEffect", { source: data.label, target: names.join(", ") })
                await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg))
            }
        } else {
            const payload = {
                id: this.item.uuid,
                data,
                actors: actors.map(x => x.id)
            }
            game.socket.emit("system.dsa5", {
                type: "socketedConditionAddActor",
                payload
            })
        }
    }

    async socketedConditionAdd(targets, data) {
        if (game.user.isGM) {
            const names = []
            for (let target of targets) {
                const token = canvas.tokens.get(target)
                if (token.actor) {
                    await token.actor.addCondition(data)
                    names.push(token.name)
                }
            }
            if (names.length) {
                const infoMsg = game.i18n.format("ActiveEffects.appliedEffect", { source: data.label, target: names.join(", ") })
                await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg))
            }
        } else {
            const payload = {
                id: this.item.uuid,
                data,
                targets
            }
            game.socket.emit("system.dsa5", {
                type: "socketedConditionAdd",
                payload
            })
        }
    }
}