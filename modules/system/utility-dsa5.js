import DSA5ChatListeners from './chat_listeners.js';
import DSA5 from './config-dsa5.js'

export default class DSA5_Utility {

    static async allSkills() {
        let returnSkills = [];

        const pack = game.i18n.lang == "de" ? game.packs.get("dsa5.skills") : game.packs.get("dsa5.skillsen")
        if (!pack)
            return ui.notifications.error("No content found")

        let items
        await pack.getDocuments().then(content => items = content.filter(i => i.data.type == "skill"));
        for (let i of items) {
            returnSkills.push(i.data)
        }

        return returnSkills;
    }

    static async allCombatSkills() {
        let returnSkills = [];

        const pack = game.i18n.lang == "de" ? game.packs.get("dsa5.combatskills") : game.packs.get("dsa5.combatskillsen")
        if (!pack)
            return ui.notifications.error("No content found")

        let items
        await pack.getDocuments().then(content => items = content.filter(i => i.data.type == "combatskill"));
        for (let i of items) {
            returnSkills.push(i.data)
        }
        return returnSkills;
    }

    static calcTokenSize(actor, data) {
        let tokenSize = DSA5.tokenSizeCategories[actor.data.status.size.value]
        if (tokenSize) {
            if (tokenSize < 1) {
                data.scale = tokenSize;
                data.width = data.height = 1;
            } else {
                const int = Math.floor(tokenSize);
                data.width = data.height = int;
                data.scale = tokenSize / int;
                data.scale = Math.max(data.scale, 0.25);
            }
        }
    }

    static async allMoneyItems() {
        const pack = game.packs.get("dsa5.money")
        if (!pack)
            return ui.notifications.error("No content found")

        let items
        await pack.getDocuments().then(content => items = content.filter(i => i.data.type == "money").map(i => {
            let res = duplicate(i.data)
            res.data.quantity.value = 0
            return res
        }));

        return items.filter(t => Object.values(DSA5.moneyNames)
                .map(n => n.toLowerCase()).includes(t.name.toLowerCase()))
            .sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1)
    }

    static async allSkillsList() {
        let skills = (await this.allSkills()) || [];
        let res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
    }

    static async allCombatSkillsList(weapontype) {
        let skills = (await this.allCombatSkills()).filter(x => x.data.weapontype.value == weapontype) || [];
        let res = {};
        for (let sk of skills) {
            res[sk.name] = sk.name;
        }
        return res;
    }

    static parseAbilityString(ability) {
        return {
            original: ability.replace(/ (FP|SR|FW|SP)?[+-]?\d{1,2}$/, '').trim(),
            name: ability.replace(/\((.+?)\)/g, "()").replace(/ (FP|SR|FW|SP)?[+-]?\d{1,2}$/, '').trim(),
            step: Number((ability.match(/[+-]?\d{1,2}$/) || [1])[0]),
            special: (ability.match(/\(([^()]+)\)/) || ["", ""])[1],
            type: ability.match(/ (FP|SP)[+-]?\d{1,2}/) ? "FP" : (ability.match(/ (FW|SR)[+-]?\d{1,2}/) ? "FW" : ""),
            bonus: ability.match(/[-+]\d{1,2}$/) != undefined
        }
    }

    static chatDataSetup(content, modeOverride, forceWhisper) {
        let chatData = {
            user: game.user.id,
            rollMode: modeOverride || game.settings.get("core", "rollMode"),
            content: content
        };

        if (["gmroll", "blindroll"].includes(chatData.rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatData.rollMode === "blindroll") chatData["blind"] = true;
        else if (chatData.rollMode === "selfroll") chatData["whisper"] = [game.user];


        if (forceWhisper) {
            chatData["speaker"] = ChatMessage.getSpeaker();
            chatData["whisper"] = ChatMessage.getWhisperRecipients(forceWhisper);
        }

        return chatData;
    }

    static findItembyId(id) {
        let item = game.items.entities.find(x => x.id == id);
        if (item) {
            return item;
        }
    }

    static findActorbyId(id) {
        let item = game.actors.entities.find(x => x.id == id);
        if (item) {
            return item;
        }
    }

    static async findItembyIdAndPack(id, packMan) {
        const pack = game.packs.get(packMan)

        let item
        await pack.getDocuments().then(content => item = content.find(i => i.id == id));
        if (item) {
            return item;
        }
    }

    static getSpeaker(speaker) {
        let actor = ChatMessage.getSpeakerActor(speaker)
        if (!actor) {
            let token = canvas.tokens.get(speaker.token)
            if (token) actor = token.actor
        }
        if (!actor) {
            let scene = game.scenes.get(speaker.scene)
            try {
                if (scene) actor = new Token(scene.getEmbeddedDocument("Token", speaker.token)).actor
            } catch (error) {}
        }
        return actor
    }

    static _calculateAdvCost(currentAdvances, type, modifier = 1) {
        return DSA5.advancementCosts[type][Number(currentAdvances) + modifier]
    }

    static editRollAtIndex(roll, index, newValue) {
        let curindex = 0
        let resIndex = 0
        for (let term of roll.terms) {
            if (term instanceof Die || term.class == "Die") {
                if (term.results[index - curindex]) {
                    let oldVal = term.results[index - curindex].result
                    term.results[index - curindex].result = newValue
                    return oldVal
                }
                curindex += term.results.length
            }
            resIndex++
        }
        return 0
    }

    static async showArtwork({ img, name, uuid }) {
        new ImagePopout(img, {
            title: name,
            shareable: true,
            uuid: uuid
        }).render(true)
    }

    static async findAnyItem(lookup) {
        let results = []
        let names = lookup.map(x => x.name)
        let types = lookup.map(x => x.type)
        for (let k of game.items.entities) {
            let index = names.indexOf(k.name)
            if (index >= 0 && types[index] == k.type) {
                names.splice(index, 1)
                types.splice(index, 1)
                results.push(k)
            }
        }
        //let item = game.items.entities.find(i => i.permission > 1 && i.type == category && i.name == name)
        if (names.length > 0) {
            for (let p of game.packs) {
                if (p.metadata.entity == "Item" && (game.user.isGM || !p.private)) {
                    await p.getDocuments().then(content => {
                        for (let k of content) {
                            let index = names.indexOf(k.name)
                            if (index >= 0 && types[index] == k.type) {
                                names.splice(index, 1)
                                types.splice(index, 1)
                                results.push(k)
                            }
                        }
                    })
                    if (names.length <= 0)
                        break
                }
            }
        }
        return results
    }

    static replaceDies(content, inlineRoll = false) {
        let regex = /( |^)(\d{1,2})?[wWdD][0-9]+((\+|-)[0-9]+)?/g
        let roll = inlineRoll ? "" : "/roll "
        return content.replace(regex, function(str) {
            return ` [[${roll}${str.replace(/[DwW]/,"d")}]]`
        })
    }

    static customEntityLinks(content) {
        const regex = /@(Rq|Gc)\[[a-zA-zöüäÖÜÄ&; -]+ (-)?\d+\]/g
        const rolls = { "@Rq": "roll", "@Gc": "GC" }
        const titles = { "@Rq": "", "@Gc": `${game.i18n.localize("HELP.groupcheck")} ` }
        return content.replace(regex, function(str) {
            const type = str.match(/^@(Rq|Gc)/)[0]
            const mod = str.match(/(-)?\d+/)[0]
            const skill = str.replace(mod, "").match(/\[[a-zA-zöüäÖÜÄ&; -]+/)[0].replace(/[\[\]]/g, "").trim()
            return `<a class="roll-button request-${rolls[type]}" data-type="skill" data-modifier="${mod}" data-name="${skill}"><em class="fas fa-dice"></em>${titles[type]}${skill} ${mod}</a>`
        })
    }

    static replaceConditions(content) {
        if (!DSA5.statusRegex) {
            let effects = DSA5.statusEffects.map(x => game.i18n.localize(x.label).toLowerCase())
            let keywords = ["status", "condition", "level", "levels"].map(x => game.i18n.localize(x)).join("|")
            DSA5.statusRegex = {
                effects: effects,
                regex: new RegExp(`(${keywords}) (${effects.join('|')})`, 'gi')
            }
        }

        return content.replace(DSA5.statusRegex.regex, function(str) {
            let parts = str.split(" ")
            let elem = parts.shift()
            parts = parts.join(" ")
            let cond = DSA5.statusEffects[DSA5.statusRegex.effects.indexOf(parts.toLowerCase())]
            return `${elem} <a class="chatButton chat-condition" data-id="${cond.id}"><img src="${cond.icon}"/>${parts}</a>`
        })
    }

    static experienceDescription(experience) {
        if (experience >= 2100) {
            return "EXP.legendary";
        } else if (experience >= 1700) {
            return "EXP.brillant";
        } else if (experience >= 1400) {
            return "EXP.masterful";
        } else if (experience >= 1200) {
            return "EXP.competent";
        } else if (experience >= 1100) {
            return "EXP.experienced";
        } else if (experience >= 1000) {
            return "EXP.average";
        } else {
            return "EXP.inexperienced";
        }
    }

}