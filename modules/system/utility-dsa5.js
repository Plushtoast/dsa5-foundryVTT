import Actordsa5 from '../actor/actor-dsa5.js';
import { conditionsMatcher } from '../hooks/texteditor.js';
import DSA5 from './config-dsa5.js'
const { mergeObject, duplicate } = foundry.utils

export default class DSA5_Utility {
    static async skillByName(name) {
        const pack = game.packs.get(this.getLanguagePack())
        await pack.getIndex();
        const entry = pack.index.find(i => i.name === name);
        return await pack.getDocument(entry._id)
    }

    static async allSkills() {
        return await this.getCompendiumEntries(this.getLanguagePack(), "skill")
    }

    static moduleEnabled(id) {
        return game.modules.get(id) && game.modules.get(id).active
    }

    static async allCombatSkills() {
        return await this.getCompendiumEntries(this.getLanguagePack(), "combatskill")
    }

    static getLanguagePack() {
        return game.i18n.lang == "de" ? "dsa5.skills" : "dsa5.skillsen"
    }

    static async getCompendiumEntries(compendium, itemType) {
        const pack = await game.packs.get(compendium)
        if (!pack) return ui.notifications.error("No content found")

        const search = Array.isArray(itemType) ? itemType : [itemType]
        const items = (await pack.getDocuments()).filter(i => search.includes(i.type));
        return items.map(x => x.toObject());
    }

    static renderToggle(elem) {
        if (elem.rendered) {
            if (elem._minimized) elem.maximize();
            else elem.close()
        } else elem.render(true);
    }

    static calcTokenSize(actorData, data) {
        let tokenSize = game.dsa5.config.tokenSizeCategories[actorData.system.status.size.value]
        if (tokenSize) {
            if (tokenSize < 1) {
                mergeObject(data, {
                    texture: {
                        scaleX: tokenSize,
                        scaleY: tokenSize
                    },
                    width: 1,
                    height: 1
                })
            } else {
                const int = Math.floor(tokenSize);
                const scale = Math.max(tokenSize / int, 0.25)
                mergeObject(data, {
                    width: int,
                    height: int,
                    texture: {
                        scaleX: scale,
                        scaleY: scale
                    }
                })
            }
        }
    }

    static registerMasterTokens(file) {
        if(!DSA5_Utility.moduleEnabled("dsa5-mastersworkshop")) return

        DSA5.masterTokens.push(file)
    }

    static async allMoneyItems() {
        const customPack = game.settings.get("dsa5", "moneyKompendium")
        const moneyPack = game.packs.get(customPack) ? customPack : this.getLanguagePack() 
        return (await this.getCompendiumEntries(moneyPack, "money")).sort((a, b) => a.system.price.value - b.system.price.value)
            .map(x => {
                x.system.quantity.value = 0
                return x
            })
    }

    static async allSkillsList() {
        return ((await this.allSkills()) || []).map(x => x.name).sort((a, b) => a.localeCompare(b))
    }

    static async allCombatSkillsList(weapontype) {
        return ((await this.allCombatSkills()).filter(x => x.system.weapontype.value == weapontype) || []).map(x => x.name).sort((a, b) => a.localeCompare(b))
    }

    static async callItemTransformationMacro(macroName, source, effect, args = {}) {
        const parts = macroName.split(".")
        const pack = game.packs.get(`${parts[0]}.${parts[1]}`);
        if(!pack) {
            console.warn(`Pack ${pack} not found`);
            return {}
        }

        let documents = await pack.getDocuments({ name: parts[2] });
        let result = {};
        if (documents.length) {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
            const fn = new AsyncFunction("args", "source", "effect", documents[0].command)
            try {
                args.result = result;
                await fn.call(this, args, source, effect);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
                result.error = true;
            }
        } else {
            ui.notifications.error(game.i18n.format("DSAError.macroNotFound", { name: macroName }));
        }
        return result;
    }

    static isActiveGM(){
        const activeGM = game.users.activeGM

        if(!activeGM) ui.notifications.warn(game.i18n.localize("DSAError.requiresGM"))

        return activeGM?.isSelf
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

    static categoryLocalization(a){
        return game.i18n.localize(`TYPES.Item.${a}`)
    }

    static attributeLocalization(a){
        return game.i18n.localize(`CHAR.${a.toUpperCase()}`)
    }

    static attributeAbbrLocalization(a){
        return game.i18n.localize(`CHARAbbrev.${a.toUpperCase()}`)
    }

    static async callAsyncHooks(hook, args){
        for(let func of DSA5.asyncHooks[hook]){
            await func(...args)
        }
    }

    static chatDataSetup(content, modeOverride, forceWhisper, forceWhisperIDs) {
        let chatData = {
            user: game.user.id,
            rollMode: modeOverride || game.settings.get("core", "rollMode"),
            content
        };

        if (["gmroll", "blindroll"].includes(chatData.rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatData.rollMode === "blindroll") chatData["blind"] = true;
        else if (chatData.rollMode === "selfroll") chatData["whisper"] = [game.user];

        if (forceWhisper) {
            chatData["speaker"] = ChatMessage.getSpeaker();
            chatData["whisper"] = ChatMessage.getWhisperRecipients(forceWhisper);
        }
        if (forceWhisperIDs) {
            chatData["speaker"] = ChatMessage.getSpeaker();
            chatData["whisper"] = forceWhisperIDs
        }

        return chatData;
    }

    static getSpeaker(speaker) {
        let actor = ChatMessage.getSpeakerActor(speaker)
        if (!actor && canvas.tokens) {
            let token = canvas.tokens.get(speaker.token)
            if (token) actor = token.actor
        }
        if (!actor) {
            let scene = game.scenes.get(speaker.scene)
            try {
                if (scene) actor = new Token(scene.getEmbeddedDocument("Token", speaker.token))?.actor
            } catch (error) {}
        }

        return actor
    }

    static fateAvailable(actor, group) {
        if (group)
            return game.settings.get("dsa5", "groupschips").split("/").map(x => Number(x))[0] > 0

        return actor.system.status.fatePoints.value > 0
    }

    static _calculateAdvCost(currentAdvances, type, modifier = 1) {
        return DSA5.advancementCosts[type][Number(currentAdvances) + modifier]
    }

    static async getFolderForType(documentType, parent = null, folderName = null, sort = 0, color = "", sorting = undefined) {
        let folder = await game.folders.contents.find(x => x.name == folderName && x.type == documentType && x.folder?.id == parent)
        if (!folder) {
            folder = await Folder.create({
                name: folderName,
                type: documentType,
                sorting: sorting || (documentType == "JournalEntry" ? "a" : "m"),
                color,
                sort,
                folder: parent
            })
        }
        return folder
    }

    static toObjectIfPossible(source) {
        return typeof source.toObject === 'function' ? source.toObject(false) : duplicate(source)
    }

    static async showArtwork({ img, name, uuid, isOwner }, hide = false) {
        return new ImagePopout(img, {
            title: hide ? (isOwner ? name : "-") : name,
            shareable: true,
            uuid
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
                results.push(k.toObject())
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
                if (p.documentName == "Item" && (game.user.isGM || p.visible)) {
                    await p.getDocuments({ name__in: names, type__in: types }).then(content => {
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
        let roll = inlineRoll ? "" : "/r "
        return content.replace(regex, function(str) {
            return ` [[${roll}${str.replace(/[DwW]/,"d")}]]`
        })
    }

    static escapeRegex(input) {
        const source = typeof input === 'string' || input instanceof String ? input : '';
        return source.replace(/[-[/\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    static replaceConditions(content) {
        if (!content) return content

        return content.replace(DSA5.statusRegex.regex, (str) => conditionsMatcher([str]))
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

    static async emptyActor(attrs = 12, name = "Alrik") {
        if (!Array.isArray(attrs)) {
            attrs = [attrs, attrs, attrs, attrs, attrs, attrs, attrs, attrs]
        }

        const actor = new Actordsa5({
            name,
            type: "npc",
            items: [],
            system: {
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
        }, { noHook: true })
        actor.prepareData()
        return actor
    }

}