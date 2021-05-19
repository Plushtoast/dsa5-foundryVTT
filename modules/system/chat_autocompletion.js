import DSA5_Utility from "./utility-dsa5.js"


export default class DSA5ChatAutoCompletion {
    //Special thanks to BlueBirdBlackSky and DJ Addi
    static skills = []


    constructor() {
        if (DSA5ChatAutoCompletion.skills.length == 0) {
            DSA5_Utility.allSkills().then(res => {
                DSA5ChatAutoCompletion.skills = res.map(x => { return { name: x.name, type: "skill" } })
                    .concat(Object.values(game.dsa5.config.characteristics).map(x => {
                        return { name: game.i18n.localize(x), type: "attribute" }
                    }).concat({ name: game.i18n.localize('regenerate'), type: "regeneration" }))
            })
        }
        this.regex = /^\/(sk|at|pa|sp|li|rq|gc) /
        this.filtering = false
        this.constants = {
            dodge: game.i18n.localize("dodge"),
            parryWeaponless: game.i18n.localize("parryWeaponless"),
            attackWeaponless: game.i18n.localize("attackWeaponless")
        }
    }

    async chatListeners(html) {
        let target = this

        this.anchor = $('#chat-message').parent()
        $('#chat-message').off('keydown')
        html.on('keyup', '#chat-message', async function(ev) {
            target._parseInput(ev)
        })

        html.on('click', '.quick-item', async function(ev) {
            target._quickSelect($(ev.currentTarget))
        })

        html.on('keydown', '#chat-message', function(ev) {
            target._navigateQuickFind(ev)
        })
    }

    _parseInput(ev) {
        let val = ev.target.value
        if (this.regex.test(val)) {
            if ([38, 40, 13, 9].includes(ev.which))
                return false
            else if (ev.which == 27) {
                this._closeQuickfind()
                return false
            }

            let cmd = val.substring(1, 3).toUpperCase()
            let search = val.substring(3).toLowerCase().trim()
            this[`_filter${cmd}`](search)
            this.filtering = true
        } else {
            this._closeQuickfind()
        }
    }

    _completeCurrentEntry(target) {
        $('#chat-message').val($('#chat-message').val().split(" ")[0] + " " + target.text()) + " "
    }

    _closeQuickfind() {
        this.filtering = false
        this.anchor.find(".quickfind").remove()
    }

    _filterAT(search) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["meleeweapon", "rangeweapon"]
            let traitTypes = ["meleeAttack", "rangeAttack"]
            let result = actor.data.items.filter(x => {
                    return ((types.includes(x.type) && x.data.data.worn.value == true) || (x.type == "trait" && traitTypes.includes(x.data.data.traitType.value))) &&
                        x.name.toLowerCase().trim().indexOf(search) != -1
                }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
                .concat([{ name: this.constants.attackWeaponless, type: "item" }].filter(x => x.name.toLowerCase().trim().indexOf(search) != -1))
            this._checkEmpty(result)
            this._setList(result, "AT")
        }
    }

    _filterPA(search) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["meleeweapon"]
            let result = actor.data.items.filter(x => { return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 && x.data.data.worn.value == true }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
                .concat([{ name: this.constants.dodge, type: "item" }, { name: this.constants.parryWeaponless, type: "item" }].filter(x => x.name.toLowerCase().trim().indexOf(search) != -1))
            this._checkEmpty(result)
            this._setList(result, "PA")
        }
    }

    _filterSP(search) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["spell", "ritual"]
            let result = actor.data.items.filter(x => { return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
            this._checkEmpty(result)
            this._setList(result, "SP")
        }
    }

    _checkEmpty(result) {
        if (!result.length) result.push({ name: game.i18n.localize("DSAError.noMatch"), type: "none" })
    }

    _filterLI(search) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (actor) {
            let types = ["liturgy", "ceremony"]
            let result = actor.data.items.filter(x => { return types.includes(x.type) && x.name.toLowerCase().trim().indexOf(search) != -1 }).slice(0, 5).map(x => { return { name: x.name, type: "item" } })
            this._checkEmpty(result)
            this._setList(result, "LI")
        }
    }

    _getSkills(search, type = undefined) {
        search = search.replace(/(-)?\d+/g, '').trim()
        let result = DSA5ChatAutoCompletion.skills.filter(x => { return x.name.toLowerCase().trim().indexOf(search) != -1 && (type == undefined || type == x.type) }).slice(0, 5)
        this._checkEmpty(result)
        return result
    }

    _filterSK(search) {
        this._setList(this._getSkills(search), "SK")
    }

    _filterRQ(search) {
        this._setList(this._getSkills(search), "RQ")
    }

    _filterGC(search) {
        this._setList(this._getSkills(search, "skill"), "GC")
    }

    _setList(result, cmd) {
            let html = $(`<div class="quickfind dsalist"><ul>${result.map(x=> `<li data-type="${x.type}" data-category="${cmd}" class="quick-item">${x.name}</li>`).join("")}</ul></div>`)

        html.find(`.quick-item:first`).addClass("focus")
        let quick = this.anchor.find(".quickfind")
        if (quick.length) {
            quick.replaceWith(html)
        } else {
            this.anchor.append(html)
        }
    }

    _navigateQuickFind(ev) {
        if (this.filtering) {
            let target = this.anchor.find('.focus')
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
                    ev.stopPropagation()
                    ev.preventDefault()
                    this._quickSelect(target);
                    return false;
                case 9:
                    ev.stopPropagation()
                    ev.preventDefault()
                    this._completeCurrentEntry(target)
                    return false
            }
        }
        ui.chat._onChatKeyDown(ev);
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
        if(["RQ","GC"].includes(cmd)){
            this[`_quick${cmd}`](target)
        }
        else{
            const {actor, tokenId} = DSA5ChatAutoCompletion._getActor()
            if (actor) {
                this._resetChatAutoCompletion()
                this[`_quick${cmd}`](target, actor, tokenId)
            }
        }
    }

    _quickSK(target, actor, tokenId) {
        switch(target.attr("data-type")){
            case "skill":
                let skill = actor.items.find(i => i.name == target.text() && i.type == "skill")
                if (skill) actor.setupSkill(skill.data, {}, tokenId).then(setupData => {actor.basicTest(setupData)});               
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

    _resetChatAutoCompletion(){
        $('#chat-message').val("")
        this.anchor.find(".quickfind").remove()
    }

    _quickGC(target){
        const modifier = Number($('#chat-message').val().match(/(-)?\d+/g)) || 0
        this._resetChatAutoCompletion()
        DSA5ChatAutoCompletion.showGCMessage(target.text(), modifier)       
    }

    _quickRQ(target){
        const modifier = Number($('#chat-message').val().match(/(-)?\d+/g)) || 0
        this._resetChatAutoCompletion()
        DSA5ChatAutoCompletion.showRQMessage(target.text(), modifier)       
    }

    static showRQMessage(target, modifier = 0){
        const mod = modifier < 0 ? ` ${modifier}` : (modifier > 0 ? ` +${modifier}` : "")
        const type = DSA5ChatAutoCompletion.skills.find(x => x.name == target).type
        const msg = game.i18n.format("CHATNOTIFICATION.requestRoll", {user: game.user.name, item: `<a class="roll-button request-roll" data-type="${type}" data-modifier="${modifier}" data-name="${target}"><i class="fas fa-dice"></i> ${target}${mod}</a>`})
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
    }

    static async showGCMessage(target, modifier = 0){
        const mod = modifier < 0 ? ` ${modifier}` : (modifier > 0 ? ` +${modifier}` : "")
        const type = DSA5ChatAutoCompletion.skills.find(x => x.name == target).type
        const data = {
            msg:  game.i18n.format("CHATNOTIFICATION.requestGroupCheck", {user: game.user.name, item: `<a class="roll-button request-gc" data-type="${type}" data-modifier="${modifier}" data-name="${target}"><i class="fas fa-dice"></i> ${target}${mod}</a>`}),
            results: [],
            qs: 0
        }
        const content = await renderTemplate("systems/dsa5/templates/chat/roll/groupcheck.html", data)
        let chatData = DSA5_Utility.chatDataSetup(content)
        chatData.flags = data
        ChatMessage.create(chatData);
    }

    _quickPA(target, actor, tokenId) {
        let text = target.text()

        if (this.constants.dodge == text) {
            actor.setupDodge({}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else if (this.constants.parryWeaponless == text) {
            actor.setupWeaponless("parry", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
        else {
            let types = ["meleeweapon"]
            let result = actor.data.items.find(x => { return types.includes(x.type) && x.name == target.text() })
            if (result) {
                actor.setupWeapon(result, "parry", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
    
    _quickAT(target, actor, tokenId) {
        let text = target.text()
        if (this.constants.attackWeaponless == text) {
            actor.setupWeaponless("attack", {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
        else {
            let types = ["meleeweapon", "rangeweapon"]
            let traitTypes = ["meleeAttack", "rangeAttack"]
            let result = actor.data.items.find(x => { return types.includes(x.type) && x.name == target.text() })
            if(!result) result = actor.data.items.find(x => { return x.type == "trait" && x.name == target.text() && traitTypes.includes(x.data.traitType.value) })
            
            if (result) {
                actor.setupWeapon(result, "attack", {}, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            }
        }
    }
    _quickSP(target, actor, tokenId) {
        let types = ["ritual", "spell"]
        let result = actor.data.items.find(x => { return types.includes(x.type) && x.name == target.text() })
        if (result) {
            actor.setupSpell(result, {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
    }
    _quickLI(target, actor, tokenId) {
        let types = ["liturgy", "ceremony"]
        let result = actor.data.items.find(x => { return types.includes(x.type) && x.name == target.text() })
        if (result) {
            actor.setupSpell(result, {}, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        }
    }

}