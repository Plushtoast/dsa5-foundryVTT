import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5 from './config-dsa5.js'

export default class DSA5_Utility {
    static async skillByName(name) {
        const pack = game.packs.get(game.i18n.lang == "de" ? "dsa5.skills" : "dsa5.skillsen")
        await pack.getIndex();
        const entry = pack.index.find(i => i.name === name);
        return await pack.getDocument(entry._id)
    }

    static async allSkills() {
        const pack = game.i18n.lang == "de" ? "dsa5.skills" : "dsa5.skillsen"
        return await this.getCompendiumEntries(pack, "skill")
    }

    static moduleEnabled(id) {
        return game.modules.get(id) && game.modules.get(id).active
    }

    static async allCombatSkills() {
        const pack = game.i18n.lang == "de" ? "dsa5.combatskills" : "dsa5.combatskillsen"
        return await this.getCompendiumEntries(pack, "combatskill")
    }

    static async getCompendiumEntries(compendium, itemType) {
        const pack = await game.packs.get(compendium)
        if (!pack) return ui.notifications.error("No content found")

        let result = []
        let items
        await pack.getDocuments().then(content => items = content.filter(i => i.data.type == itemType));
        for (let i of items) {
            result.push(i.toObject())
        }
        return result;
    }

    static renderToggle(elem) {
        if (elem.rendered) {
            if (elem._minimized) elem.maximize();
            else elem.close()
        } else elem.render(true);
    }

    static calcTokenSize(actorData, data) {
        let tokenSize = game.dsa5.config.tokenSizeCategories[actorData.data.status.size.value]
        if (tokenSize) {
            if (tokenSize < 1) {
                data.scale = tokenSize;
                data.width = data.height = 1;
            } else {
                const int = Math.floor(tokenSize);
                data.width = data.height = int;
                data.scale = Math.max(tokenSize / int, 0.25);
            }
        }
    }

    static async allMoneyItems() {
        let items = (await this.getCompendiumEntries("dsa5.money", "money")).map(i => {
            i.data.quantity.value = 0
            return i
        });

        return items.filter(t => Object.values(DSA5.moneyNames)
                .map(n => n.toLowerCase()).includes(t.name.toLowerCase()))
            .sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1)
    }

    static async allSkillsList() {
        return ((await this.allSkills()) || []).map(x => x.name).sort((a, b) => a.localeCompare(b))
    }

    static async allCombatSkillsList(weapontype) {
        return ((await this.allCombatSkills()).filter(x => x.data.weapontype.value == weapontype) || []).map(x => x.name).sort((a, b) => a.localeCompare(b));
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
        return game.items.contents.find(x => x.id == id);
    }

    static findActorbyId(id) {
        return game.actors.contents.find(x => x.id == id);
    }

    static async findItembyIdAndPack(id, packMan) {
        const pack = game.packs.get(packMan)
        let item
        await pack.getDocuments().then(content => item = content.find(i => i.id == id));
        return item
    }

    static getSpeaker(speaker) {
        /*if (!speaker.scene) {
            console.trace()
        }*/
        let actor = ChatMessage.getSpeakerActor(speaker)
        if (!actor && canvas.tokens) {
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

    static fateAvailable(actor, group) {
        if (group)
            return game.settings.get("dsa5", "groupschips").split("/").map(x => Number(x))[0] > 0

        return actor.data.data.status.fatePoints.value > 0
    }

    static _calculateAdvCost(currentAdvances, type, modifier = 1) {
        return DSA5.advancementCosts[type][Number(currentAdvances) + modifier]
    }

    static async getFolderForType(documentType, parent = null, folderName = null, sort = 0, color = "") {
        let folder = await game.folders.contents.find(x => x.name == folderName && x.type == documentType && x.data.parent == parent)
        if (!folder) {
            folder = await Folder.create({
                name: folderName,
                type: documentType,
                sorting: documentType == "JournalEntry" ? "a" : "m",
                color,
                sort,
                parent
            })
        }
        return folder
    }

    static toObjectIfPossible(source) {
        return typeof source.toObject === 'function' ? source.toObject(false) : duplicate(source)
    }

    static async showArtwork({ img, name, uuid, isOwner }, hide = false) {
        new ImagePopout(img, {
            title: hide ? (isOwner ? name : "-") : name,
            shareable: true,
            uuid: uuid
        }).render(true)
    }

    static async findAnyItem(lookup) {
        let results = []
        let names = lookup.map(x => x.name)
        let types = lookup.map(x => x.type)
        for (let k of game.items.contents) {
            let index = names.indexOf(k.name)
            if (index >= 0 && types[index] == k.type) {
                names.splice(index, 1)
                types.splice(index, 1)
                results.push(k)
            }
            if (names.length <= 0) break
        }

        if (names.length > 0) {
            const regx = /^dsa5-core/
            const sortedPacks = Array.from(game.packs.keys()).sort((a, b) => {
                if (regx.test(a) && regx.test(b)) a.localeCompare(b)
                if (regx.test(b)) return -1
                if (regx.test(a)) return 1
                return a.localeCompare(b)
            })

            for (let pack of sortedPacks) {
                let p = game.packs.get(pack)
                if (p.documentName == "Item" && (game.user.isGM || !p.private)) {
                    await p.getDocuments({ name: { $in: names }, type: { $in: types } }).then(content => {
                        for (let k of content) {
                            let index = names.indexOf(k.name)
                            if (index >= 0 && types[index] == k.type) {
                                names.splice(index, 1)
                                types.splice(index, 1)
                                results.push(k.toObject())
                            }
                        }
                    })
                    if (names.length <= 0) break
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
        if (!content) return content
        const regex = /@(Rq|Gc|Ch)\[[a-zA-zöüäÖÜÄ&; -]+ (-|\+)?\d+\]/g
        const rolls = { "@Rq": "roll", "@Gc": "GC", "@Ch": "CH" }
        const icons = { "@Rq": "dice", "@Gc": "dice", "@Ch": "user-shield" }
        const titles = { "@Rq": "", "@Gc": `${game.i18n.localize("HELP.groupcheck")} `, "@Ch": "" }
        const rqRegex = /^@(Rq|Gc|Ch)/
        const modRegex = /(-|\+)?\d+/
        const replaceRegex = /\[[a-zA-zöüäÖÜÄ&; -]+/
        const replaceRegex2 = /[\[\]]/g
        return content.replace(regex, function(str) {
            const type = str.match(rqRegex)[0]
            const mod = Number(str.match(modRegex)[0])
            const skill = str.replace(mod, "").match(replaceRegex)[0].replace(replaceRegex2, "").trim()
            return `<a class="roll-button request-${rolls[type]}" data-type="skill" data-modifier="${mod}" data-name="${skill}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${skill} ${mod}</a>`
        })
    }

    static escapeRegex(input) {
        const source = typeof input === 'string' || input instanceof String ? input : '';
        return source.replace(/[-[/\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    static replaceConditions(content) {
        if (!content) return content
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
        const grades = [2100, 1700, 1400, 1200, 1100, 1000]
        const labels = ["EXP.legendary", "EXP.brillant", "EXP.masterful", "EXP.competent", "EXP.experienced", "EXP.average"]
        let index = 0
        for (const grade of grades) {
            if (Number(experience) >= Number(grade)) return labels[index]
            index++
        }
        return "EXP.inexperienced"
    }

    static async emptyActor(attrs = 12) {
        if (!Array.isArray(attrs)) {
            attrs = [attrs, attrs, attrs, attrs, attrs, attrs, attrs, attrs]
        }

        const actor = await Actordsa5.create({
            name: "Alrik",
            type: "npc",
            items: [],
            data: {
                status: { wounds: { value: 50 }, fatePoints: {} },
                characteristics: {
                    mu: { initial: attrs[0] },
                    kl: { initial: attrs[1] },
                    in: { initial: attrs[2] },
                    ch: { initial: attrs[3] },
                    ff: { initial: attrs[4] },
                    ge: { initial: attrs[5] },
                    ko: { initial: attrs[6] },
                    kk: { initial: attrs[7] }
                },

            }
        }, { temporary: true, noHook: true })
        actor.prepareData()
        return actor
    }

}