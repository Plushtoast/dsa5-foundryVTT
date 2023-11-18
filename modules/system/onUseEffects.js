import DSA5_Utility from "./utility-dsa5.js";
import RuleChaos from "./rule_chaos.js";
import DSA5SoundEffect from "./dsa-soundeffect.js";

export default class OnUseEffect {
    constructor(item) {
        this.item = item;
    }

    async callMacro(packName, name, args = {}) {
        const pack = game.packs.get(packName);
        let documents = await pack.getDocuments({ name });
        if (!documents.length) {
            for (let pack of game.packs.filter(x => x.documentName == "Macro" && /\(internal\)/.test(x.metadata.label))) {
                documents = await pack.getDocuments({ name });
                if (documents.length) break
            }
        }
        let result = {};
        if (documents.length) {
            try {
                args.result = result;
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
                const fn = new AsyncFunction("args", "actor", "item", documents[0].command)
                result.ret =  await fn.call(this, args, this.item.actor, this.item)
            } catch (err) {
                ui.notifications.error(
                    `There was an error in your macro syntax. See the console (F12) for details`
                );
                console.error(err);
                result.error = true;
            }
        } else {
            ui.notifications.error(game.i18n.format("DSAError.macroNotFound", { name }));
        }
        return result;
    }

    async executeOnUseEffect() {
        if (!game.user.can("MACRO_SCRIPT")) {
            return ui.notifications.warn(
                `You are not allowed to use JavaScript macros.`
            );
        }
        if (!this.item.actor) return;

        const macro = OnUseEffect.getOnUseEffect(this.item);
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
        const fn = new AsyncFunction("item", "actor", macro)
        try {
            await fn.call(this, this.item, this.item.actor);
        } catch (err) {
            ui.notifications.error(
                `There was an error in your macro syntax. See the console (F12) for details`
            );
            console.error(err);
            console.warn(err.stack);
        }
    }

    static getOnUseEffect(item) {
        return item.getFlag("dsa5", "onUseEffect");
    }

    async automatedAnimation(successLevel, options = {}) {
        if (DSA5_Utility.moduleEnabled("autoanimations")) {
            console.warn("Animations for on use effects not enabled yet");
        }
    }

    effectDummy(name, changes, duration) {
        return {
            name,
            icon: "icons/svg/aura.svg",
            changes,
            duration,
            flags: {
                dsa5: {
                    value: null,
                    editable: true,
                    description: name,
                    custom: true,
                },
            },
        };
    }

    async socketedConditionAddActor(actors, data) {
        if (game.user.isGM) {
            const systemCon = typeof data === "string";
            if (systemCon) {
                data = duplicate(CONFIG.statusEffects.find((e) => e.id == data));
                data.name = game.i18n.localize(data.name);
            }

            const names = [];
            for (let actor of actors) {
                if (systemCon) await actor.addCondition(data, 1, false, false);
                else await actor.addCondition(data);

                names.push(actor.name);
            }
            await this.createInfoMessage(data, names);
        } else {
            const payload = {
                id: this.item.uuid,
                data,
                actors: actors.map((x) => x.id),
            };
            game.socket.emit("system.dsa5", {
                type: "socketedConditionAddActor",
                payload,
            });
        }
    }

    async createInfoMessage(data, names, added = true) {
        if (names.length) {
            const format = added ? "ActiveEffects.appliedEffect" : "ActiveEffects.removedEffect"
            const infoMsg = game.i18n.format(format, {
                source: data.name,
                target: names.join(", "),
            });
            await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        }
    }

    async socketedRemoveCondition(targets, coreId, amount = 1) {
        if (game.user.isGM) {
            const names = [];
            for (let target of targets) {
                const token = canvas.tokens.get(target);
                if (token.actor) {
                    await token.actor.removeCondition(coreId, amount, false);
                    names.push(token.name);
                }
            }
            const data = CONFIG.statusEffects.find((x) => x.id == coreId);
            data.name = game.i18n.localize(data.name);
            await this.createInfoMessage(data, names, false);
        } else {
            const payload = {
                id: this.item.uuid,
                coreId,
                targets,
            };
            game.socket.emit("system.dsa5", {
                type: "socketedRemoveCondition",
                payload,
            });
        }
    }

    async socketedActorTransformation(targets, update) {
        if (game.user.isGM) {
            for (let target of targets) {
                const token = canvas.tokens.get(target);
                if (token.actor) {
                    await token.actor.update(update)
                }
            }
        } else {
            const payload = {
                id: this.item.uuid,
                targets,
                update
            };
            game.socket.emit("system.dsa5", {
                type: "socketedActorTransformation",
                payload,
            });
        }
    }

    async socketedConditionAdd(targets, data) {
        if (game.user.isGM) {
            const systemCon = typeof data === "string";
            if (systemCon) {
                data = duplicate(CONFIG.statusEffects.find((e) => e.id == data));
                data.name = game.i18n.localize(data.name);
            }

            const names = [];
            for (let target of targets) {
                const token = canvas.tokens.get(target);
                if (token.actor) {
                    if (systemCon) await token.actor.addCondition(data, 1, false, false);
                    else await token.actor.addCondition(data);

                    names.push(token.name);
                }
            }
            await this.createInfoMessage(data, names);
        } else {
            const payload = {
                id: this.item.uuid,
                data,
                targets,
            };
            game.socket.emit("system.dsa5", {
                type: "socketedConditionAdd",
                payload,
            });
        }
    }
}