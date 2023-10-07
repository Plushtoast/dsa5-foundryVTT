import DSA5ChatListeners from "./chat_listeners.js"
import RequestRoll from "./request-roll.js"
import DSA5_Utility from "./utility-dsa5.js"
import { UserMultipickDialog } from "../dialog/addTargetDialog.js"

export default class DSA5ChatAutoCompletion {
    static skills = []
    static cmds = ["sk", "at", "pa", "sp", "li", "rq", "gc", "w", "ch"]

    constructor() {
        if (DSA5ChatAutoCompletion.skills.length == 0) {
            DSA5_Utility.allSkills().then(res => {
                DSA5ChatAutoCompletion.skills = res.map(x => { return { name: x.name, type: "skill" } })
                    .concat(Object.values(game.dsa5.config.characteristics).map(x => {
                        return { name: game.i18n.localize(x), type: "attribute" }
                    }).concat([
                        { name: game.i18n.localize('regenerate'), type: "regeneration" },
                        { name: game.i18n.localize('fallingDamage'), type: "fallingDamage" },
                    ]))
            })
        }
        
        this.filtering = false
        this.combatConstants = {
            dodge: game.i18n.localize("dodge"),
            parryWeaponless: game.i18n.localize("parryWeaponless"),
            attackWeaponless: game.i18n.localize("attackWeaponless")
        }
    }

    get regex() {
        ///^\/(sk |at |pa |sp |li |rq |gc |w |ch)/
        return new RegExp(`^\/(${DSA5ChatAutoCompletion.cmds.join(" |")})`)
    }

    async chatListeners(html) {
        let target = this

        const cmMessage = html.find('#chat-message')

        html.on('keyup', '#chat-message', async function(ev) {
            target._parseInput(ev)
        })

        html.on('click', '.quick-item', async function(ev) {
            target._quickSelect($(ev.currentTarget))
        })

        cmMessage.on('keydown', function(ev) {
            target._navigateQuickFind(ev)
        })
        const handlers = jQuery._data(cmMessage[0]).events["keydown"];
        handlers.unshift(handlers.pop());
    }

    _parseInput(ev) {
        let val = ev.target.value
        if (this.regex.test(val)) {
            if ([38, 40, 13, 9].includes(ev.which))
                return false
            else if (ev.which == 27) {
                this._closeQuickfind(ev)
                return false
            }

            const cmd = this._getCmd(val)
            const search = val.substring(1 + cmd.length).toLowerCase().trim()
            this[`_filter${cmd}`](search, ev)
            this.filtering = true
        } else {
            this._closeQuickfind(ev)
        }
    }

    _getCmd(val) {
        return val.substring(1, 3).toUpperCase().trim()
    }

    _completeCurrentEntry(target) {
        $('#chat-message').val($('#chat-message').val().split(" ")[0] + " " + target.text()) + " "
    }

    _closeQuickfind(ev) {
        this.filtering = false
        $(ev.currentTarget).closest('#chat-form').find(".quickfind").remove()
    }

    _filterW(search, ev) {
        let result = game.users.contents.filter(x => x.active && x.name.toLowerCase().trim().indexOf(search) != -1).map(x => { return { name: x.name, type: "user" } })
        this._checkEmpty(result)
        this._setList(result, "W", ev)
    }

    _filterAT(search, ev) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["meleeweapon", "rangeweapon"]
            let traitTypes = ["meleeAttack", "rangeAttack"]
            let result = actor.items.filter(x => {
                    return ((types.includes(x.type) && x.system.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.system.traitType.value))) &&
                        x.name.toLowerCase().trim().indexOf(search) != -1
                }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
                .concat([{ name: this.combatConstants.attackWeaponless, type: "item" }].filter(x => x.name.toLowerCase().trim().indexOf(search) != -1))
            this._checkEmpty(result)
            this._setList(result, "AT", ev)
        }
    }

    _filterPA(search, ev) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["meleeweapon"]
            let result = actor.items.filter(x => { return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 && x.system.worn.value == true }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
                .concat([{ name: this.combatConstants.dodge, type: "item" }, { name: this.combatConstants.parryWeaponless, type: "item" }].filter(x => x.name.toLowerCase().trim().indexOf(search) != -1))
            this._checkEmpty(result)
            this._setList(result, "PA", ev)
        }
    }

    _filterSP(search, ev) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["spell", "ritual"]
            let result = actor.items.filter(x => { return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
            this._checkEmpty(result)
            this._setList(result, "SP", ev)
        }
    }

    _checkEmpty(result) {
        if (!result.length) result.push({ name: game.i18n.localize("DSAError.noMatch"), type: "none" })
    }

    _filterLI(search, ev) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["liturgy", "ceremony"]
            let result = actor.items.filter(x => { return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
            this._checkEmpty(result)
            this._setList(result, "LI", ev)
        }
    }

    _getSkills(search, type = undefined) {
        search = search.replace(/(-|\+)?\d+/g, '').trim()
        let result = DSA5ChatAutoCompletion.skills.filter(x => { return x.name.toLowerCase().trim().indexOf(search) != -1 && (type == undefined || type == x.type) }).slice(0, 5)
        this._checkEmpty(result)
        return result
    }


    _filterCH(search, ev) {
        this._setList(this._getSkills(search), "CH", ev)
    }

    _filterSK(search, ev) {
        this._setList(this._getSkills(search), "SK", ev)
    }

    _filterRQ(search, ev) {
        this._setList(this._getSkills(search), "RQ", ev)
    }

    _filterGC(search, ev) {
        this._setList(this._getSkills(search, "skill"), "GC", ev)
    }

    _setList(result, cmd, ev) {
        let html = $(`<div class="quickfind dsalist"><ul>${result.map(x=> `<li data-type="${x.type}" data-category="${cmd}" class="quick-item">${x.name}</li>`).join("")}</ul></div>`)
        
        html.find(`.quick-item:first`).addClass("focus")
        const par = $(ev.currentTarget).closest('#chat-form')
        let quick = par.find(".quickfind")
        if (quick.length) {
            quick.replaceWith(html)
        } else {
            par.append(html)
        }
    }

    _navigateQuickFind(ev) {
        if (this.filtering) {
            let target = $(ev.currentTarget).closest('#chat-form').find('.focus')
            switch (ev.which) {
                case 38: // Up
                    if (target.prev(".quick-item").length)
                        target.removeClass("focus").prev(".quick-item").addClass("focus")
                    return false;
                case 40: // Down
                    if (target.next(".quick-item").length)
                        target.removeClass("focus").next(".quick-item").addClass("focus")
                    return false;
                case 13: // Enter
                    if (target.attr("data-category") == "W"){
                        break
                    }else{
                        ev.stopPropagation()
                        ev.preventDefault()
                        this._quickSelect(target);
                        return false;
                    }
                case 9:
                    ev.stopPropagation()
                    ev.preventDefault()
                    this._completeCurrentEntry(target)
                    return false
            }
        }
        return true
    }

    static _getActor() {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        if (!actor) {
            ui.notifications.error(game.i18n.localize("DSAError.noProperActor"))
            return{}
        }
        return {
            actor,
            tokenId: speaker.token
        }
    }

    _quickSelect(target) {
        let cmd = target.attr("data-category")
        switch(cmd){
            case "NM":
            case "GC":
            case "RQ":
            case "CH":
                this[`_quick${cmd}`](target)
                break
            case "W":
                this._completeCurrentEntry(target)
                break
            default:
                const {actor, tokenId} = DSA5ChatAutoCompletion._getActor()
                if (actor) {
                    this._resetChatAutoCompletion(target)
                    this[`_quick${cmd}`](target, actor, tokenId)
                }
        }
    }

    _quickW(target, actor, tokenId){

    }

    _quickCH(target){
        DSA5ChatListeners.check3D20(target)
        this._resetChatAutoCompletion(target)
    }

    _quickSK(target, actor, tokenId) {
        switch(target.attr("data-type")){
            case "skill":
                let skill = actor.items.find(i => i.name == target.text() && i.type == "skill")
                if (skill) actor.setupSkill(skill, {}, tokenId).then(setupData => {actor.basicTest(setupData)});
                break
            case "attribute":
                let characteristic = Object.keys(game.dsa5.config.characteristics).find(key => game.i18n.localize(game.dsa5.config.characteristics[key]) == target.text())
                actor.setupCharacteristic(characteristic, {}, tokenId).then(setupData => { actor.basicTest(setupData) });
                break
            case "regeneration":
                actor.setupRegeneration("regenerate", {}, tokenId).then(setupData => { actor.basicTest(setupData) });
                break
        }

    }

    _resetChatAutoCompletion(target){
        const par = target.closest('#chat-form')
        par.find('#chat-message').val("")
        par.find(".quickfind").remove()
    }

    _quickGC(target){
        const modifier = Number($('#chat-message').val().match(/(-|\+)?\d+/g)) || 0
        this._resetChatAutoCompletion(target)
        RequestRoll.showGCMessage(target.text(), modifier)
    }

    _quickRQ(target){
        const modifier = Number($('#chat-message').val().match(/(-|\+)?\d+/g)) || 0
        this._resetChatAutoCompletion(target)
        RequestRoll.showRQMessage(target.text(), modifier)
    }

    _quickPA(target, actor, tokenId) {
        let text = target.text()

        if (this.combatConstants.dodge == text) {
            actor.setupDodge({}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else if (this.combatConstants.parryWeaponless == text) {
            actor.setupWeaponless("parry", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
        else {
            let types = ["meleeweapon"]
            let result = actor.items.find(x => { return types.includes(x.type) && x.name == target.text() })
            if (result) {
                actor.setupWeapon(result, "parry", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }

    _quickAT(target, actor, tokenId) {
        let text = target.text()
        if (this.combatConstants.attackWeaponless == text) {
            actor.setupWeaponless("attack", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
        else {
            const types = ["meleeweapon", "rangeweapon"]
            const traitTypes = ["meleeAttack", "rangeAttack"]
            let result = actor.items.find(x => { return types.includes(x.type) && x.name == target.text() })
            if(!result) result = actor.items.find(x => { return x.type == "trait" && x.name == target.text() && traitTypes.includes(x.system.traitType.value) })

            if (result) {
                actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
    _quickSP(target, actor, tokenId) {
        const types = ["ritual", "spell"]
        const result = actor.items.find(x => { return types.includes(x.type) && x.name == target.text() })
        if (result) {
            actor.setupSpell(result, {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
    }
    _quickLI(target, actor, tokenId) {
        const types = ["liturgy", "ceremony"]
        const result = actor.items.find(x => { return types.includes(x.type) && x.name == target.text() })
        if (result) {
            actor.setupSpell(result, {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
    }

    static async infoItemAsync(uuid){
        const item = await fromUuid(uuid)
        item.postItem()
    }

    static bindRollCommands(html){
        html.on('click', '.request-roll', ev => {
            const dataset = ev.currentTarget.dataset
            RequestRoll.showRQMessage(dataset.name, Number(dataset.modifier) || 0, dataset.label)
            ev.stopPropagation()
            return false
        })
        html.on('click', '.postInfo', ev => {
            const item = fromUuidSync(ev.currentTarget.dataset.uuid)
            if(item) {
                if(typeof item.postItem === 'function'){
                    item.postItem()
                }else{
                    this.infoItemAsync(ev.currentTarget.dataset.uuid)
                }
            }

            ev.stopPropagation()
            return false
        })
        html.on('click', '.postContentChat', async(ev) => {
            const content = $(ev.currentTarget).closest('.postChatSection').find('.postChatContent').html()
            UserMultipickDialog.getDialog(content)            
        })
        html.on('click', '.request-GC', ev => {
            RequestRoll.showGCMessage(ev.currentTarget.dataset.name, Number(ev.currentTarget.dataset.modifier) || 0)
            ev.stopPropagation()
            return false
        })
        html.on('click', '.request-CH', ev => {
            DSA5ChatListeners.check3D20(undefined, ev.currentTarget.dataset.name, { modifier: Number(ev.currentTarget.dataset.modifier) || 0 })
            ev.stopPropagation()
            return false
        })
    }

}