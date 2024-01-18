import Actordsa5 from "../actor/actor-dsa5.js";
import OnUseEffect from "./onUseEffects.js";
import Riding from "./riding.js";
import RuleChaos from "./rule_chaos.js";
import DSA5_Utility from "./utility-dsa5.js";
import { tinyNotification } from "./view_helper.js";
import DSA5Payment from "./payment.js"
import { Trade } from "../actor/trade.js";
import Itemdsa5 from "../item/item-dsa5.js";

export default class TokenHotbar2 extends Application {
    static attackTypes = new Set(["meleeweapon", "rangeweapon"])
    static traitTypes = new Set(["meleeAttack", "rangeAttack"])
    static spellTypes = new Set(["liturgy", "spell"])
    
    static registerTokenHotbar() {
        if (!game.dsa5.apps.tokenHotbar) {
            game.dsa5.apps.tokenHotbar = new TokenHotbar2()
            game.dsa5.apps.tokenHotbar.updateDSA5Hotbar()
            if(!game.settings.get("dsa5", "disableTokenhotbar"))
                game.dsa5.apps.tokenHotbar.render(true)

            Hooks.call("dsa5TokenHotbarReady", game.dsa5.apps.tokenHotbar)
        }
    }

    constructor(options) {
        super(options);
        this.searching = ""

        TokenHotbar2.combatSkills = ["selfControl", "featOfStrength", "bodyControl", "perception", "loyalty"].map(x => game.i18n.localize(`LocalizedIDs.${x}`))
        TokenHotbar2.defaultSkills = new Set([game.i18n.localize("LocalizedIDs.perception")])
        
        if(game.user.isGM) {
            this.callbackFunctions = {}
            const setting = game.settings.get("dsa5", "enableMasterTokenFunctions")
            this.gmItems = [
                { name: 'gmMenu', disabled: setting["masterMenu"], icon: "systems/dsa5/icons/categories/DSA-Auge.webp", id: "masterMenu", cssClass: "gm", abbrev: "", subfunction: "gm" },
                { name: 'MASTER.randomPlayer', disabled: setting["randomVictim"], iconClass: "fa fa-dice-six", id: "randomVictim", cssClass: "gm", abbrev: "", subfunction: "gm" },
                { name: "TT.tokenhotbarMoney", disabled: setting["payMoney"], icon: "systems/dsa5/icons/money-D.webp", id: "payMoney", cssClass: "gm", abbrev: "", subfunction: "gm" }
            ]
        }

        const parentUpdate = (source) => {
            const id = source.parent ? source.parent.id : undefined
            if (id) TokenHotbar2.hookUpdate(id)
        }

        Hooks.on("controlToken", (elem, controlTaken) => {
            game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar()
        })

        Hooks.on("updateActor", (actor, updates) => {
            TokenHotbar2.hookUpdate(actor.id)
        });

        Hooks.on("updateToken", (scene, token, updates) => {
            if(!game.dsa5.apps.tokenHotbar) return

            if (token._id == getProperty(game.dsa5.apps.tokenHotbar, "actor.prototypeToken.id"))
                game.dsa5.apps.tokenHotbar.updateDSA5Hotbar()
        });

        Hooks.on("updateOwnedItem", (source, item) => {
            TokenHotbar2.hookUpdate(source.data.id)
        });

        Hooks.on("createOwnedItem", (source, item) => {
            TokenHotbar2.hookUpdate(source.data.id)
        });

        Hooks.on("deleteOwnedItem", (source, item) => {
            TokenHotbar2.hookUpdate(source.data.id)
        });

        Hooks.on("updateItem", (source, item) => {
            parentUpdate(source)
        });

        Hooks.on("createItem", (source, item) => {
            parentUpdate(source)
        });

        Hooks.on("deleteItem", (source, item) => {
            parentUpdate(source)
        });

        Hooks.on("deleteActiveEffect", (effect, options) => {
            parentUpdate(effect)
        })

        Hooks.on("updateActiveEffect", (effect, options) => {
            parentUpdate(effect)
        })

        Hooks.on("createActiveEffect", (effect, options) => {
            parentUpdate(effect)
        })

        Hooks.on("canvasInit", () => {
            if(!this.rendered) return

            this.render()
        })
    }

    registerMasterFunction(entry, callback) {
        const setting = game.settings.get("dsa5", "enableMasterTokenFunctions")
        entry.disabled = setting[entry.id]
        this.gmItems.push(entry)
        this.callbackFunctions[entry.id] = callback
    }

    async prepareSkills(){
        const skills = await DSA5_Utility.allSkills()
        this.skills = skills.map(x => {
            return { name: x.name, icon: x.img, id: x.name, cssClass: "skillgm", addClass: x.system.group.value, abbrev: x.name[0], subfunction: "skillgm"}
        })
        this.skills = this.skills.sort((a, b) => { return a.addClass.localeCompare(b.addClass) || a.name.localeCompare(b.name) })
        return this.skills
    }

    static hookUpdate(changeId) {
        if (changeId == game.dsa5.apps.tokenHotbar?.actor?.id)
            game.dsa5.apps.tokenHotbar.updateDSA5Hotbar()
        else if(ui.hotbar.token?.actor?.id == changeId)
            ui.hotbar.updateDSA5Hotbar()    
    }

    resetPosition() {
        const hotbarPosition = $('#hotbar').first().position()
        const itemWidth = game.settings.get("dsa5", "tokenhotbarSize")
        this.position.left = hotbarPosition.left + 8
        this.position.top = hotbarPosition.top - itemWidth - 25
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        const hotbarPosition = $('#hotbar').first().position()
        const itemWidth = game.settings.get("dsa5", "tokenhotbarSize")
        const position = game.settings.get("dsa5", "tokenhotbarPosition")

        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "tokenQuickHot"]),
            itemWidth,
            resizable: false,
            height: itemWidth + 45,
            zIndex: 61,
            left: hotbarPosition.left + 8,
            top: hotbarPosition.top - itemWidth - 25,
            template: "systems/dsa5/templates/status/tokenHotbar.html",
            title: "TokenHotbar"
        });
        mergeObject(options, position)
        return options;
    }

    async _onWheelResize(ev) {
        let newVal = game.settings.get("dsa5", "tokenhotbarSize")
        if (ev.originalEvent.deltaY > 0) {
            newVal = Math.min(100, newVal + 5)
        } else {
            newVal = Math.max(15, newVal - 5)
        }
        await game.settings.set("dsa5", "tokenhotbarSize", newVal)
        await this.render(true)
    }

    async _cycleLayout(ev) {
        if (ev.button == 2) {
            let newVal = game.settings.get("dsa5", "tokenhotbarLayout") + 1
            if (newVal == 4) newVal = 0
            await game.settings.set("dsa5", "tokenhotbarLayout", newVal)
            await this.render(true)
        }
    }

    changeDarkness(ev){
        const darkness = Number(ev.currentTarget.value)
        if (canvas.scene) canvas.scene.update({ darkness }, { animateDarkness: 3000 })

        tinyNotification(darkness)
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        const container = html.find(".dragHandler");
        if(container[0])
            new Draggable(this, html, container[0], this.options.resizable);

        container.on('wheel', async(ev) => {
            ev.stopPropagation()
            ev.preventDefault()
            await this._onWheelResize(ev)
            return false
        })        

        html.find('.itdarkness input').change(ev => this.changeDarkness(ev))

        const that = this
        const fn = function(ev) {
            that.filterButtons(ev)
            return false
        }
        html.find('.filterable').hover(function() {
            $(document).on("keydown", fn)
        }, function() {
            $(document).off("keydown", fn)
        })

        html.find('.quantity-click').mousedown(ev => RuleChaos.quantityClick(ev))

        html.on('mousedown', 'li', async(ev) => {
            ev.stopPropagation()
            await this.executeQuickButton(ev)
            return false
        })

        html.on('mouseenter', 'li.primary', ev => {
            const cat = ev.currentTarget.dataset.category

            this.category = cat
            setTimeout(() => {
                html.find('.secondary').removeClass('shown')
                if(cat==this.category)
                    html.find(`.secondary[data-category="${cat}"]`).addClass("shown")
            }, 700)
        })

        html.on('mouseleave', 'li.primary', ev => {
            const cat = ev.currentTarget.dataset.category
            this.category = undefined

            setTimeout(()=>{
                if(cat!=this.category) {
                    that.searching = ""
                    $(ev.currentTarget).find('.secondary').removeClass("dsahidden")
                    html.find(`.secondary[data-category="${cat}"]`).removeClass("shown")
                }
            },50)
        })
    }

    async handleEffect(ev, actor, id, tokenId){
        const effect = actor.effects.get(id)
        const isSystemEffect = [...effect.statuses][0]
        if (ev.button == 0) {
            if (isSystemEffect) await actor.addCondition(isSystemEffect, 1, false, false)
            else effect.sheet.render(true)
        } else if (ev.button == 2) {
            if (isSystemEffect) await actor.removeCondition(isSystemEffect, 1, false)
            else await actor.sheet._deleteActiveEffect(id)
        }
    }

    async handleGMRoll(ev){
        const skill = ev.currentTarget.dataset.id
        const mod = Math.round($(ev.currentTarget).closest('.tokenHotbarInner,#hotbar').find(".modifierVal").val())
        if(ev.ctrlKey){
            game.dsa5.apps.DSA5ChatListeners.check3D20(undefined, skill, { modifier: mod })
        }
        else if(ev.button == 2){
            game.dsa5.macro.requestGC(skill, mod, {maxRolls: 7})
        }else{
            game.dsa5.macro.requestRoll(skill, mod)
        }
    }

    async handleSkillRoll(ev, actor, id, tokenId){
        const options = {}
        if(ev.button == 2) options.rollMode = "blindroll"

        if("rideLoyaltyID" == id){
            Riding.rollLoyalty(actor, options)
        }
        else if ("attackWeaponless" == id) {
            actor.setupWeaponless("attack", options, tokenId).then(setupData => {
                actor.basicTest(setupData)
            });
        } else {
            let result = actor.items.get(id)
            if (result) {
                if(ev.originalEvent.ctrlKey) return result.sheet.render(true)

                switch (result.type) {
                    case "meleeweapon":
                    case "rangeweapon":
                        if(ev.originalEvent.altKey) {
                            result.update({"system.worn.value": false })
                        }
                        else if(result.system.worn.value) {
                            actor.setupWeapon(result, "attack", options, tokenId).then(setupData => { actor.basicTest(setupData) });
                        }
                        else {
                            actor.exclusiveEquipWeapon(result.id, ev.button == 2)
                        }
                        break
                    case "trait":
                        actor.setupWeapon(result, "attack", options, tokenId).then(setupData => { actor.basicTest(setupData) });
                        break
                    case "liturgy":
                    case "spell":
                        actor.setupSpell(result, options, tokenId).then(setupData => { actor.basicTest(setupData) });
                        break
                    case "skill":
                        actor.setupSkill(result, options, tokenId).then(setupData => { actor.basicTest(setupData) })
                        break
                    case "consumable":
                        new Dialog({
                            title: game.i18n.localize("SHEET.ConsumeItem") + ": " + result.name,
                            content: game.i18n.localize("SHEET.ConsumeItem") + ": " + result.name,
                            default: 'yes',
                            buttons: {
                                Yes: {
                                    icon: '<i class="fa fa-check"></i>',
                                    label: game.i18n.localize("yes"),
                                    callback: async() => {
                                        await result.setupEffect(null, {}, tokenId)
                                        await this.updateDSA5Hotbar()
                                    }
                                },
                                cancel: {
                                    icon: '<i class="fas fa-times"></i>',
                                    label: game.i18n.localize("cancel"),
                                }
                            }
                        }).render(true)
                        break
                }

            }
        }
    }

    async handleTradeStart(ev, actor, id, tokenId) {
        if(!game.user.targets.size) return ui.notifications.error(game.i18n.localize("DIALOG.noTarget"))

        for(const target of game.user.targets) {
            if(target.actor) {
                const app = new Trade(Itemdsa5.buildSpeaker(actor, tokenId), Itemdsa5.buildSpeaker(target.actor, target.id))
                app.startTrade()
            }
        }
    }

    async handleOnUse(ev, actor, id, tokenId){
        let item = actor.items.get(id)
        const onUse = new OnUseEffect(item)
        await onUse.executeOnUseEffect()
    }

    async handleGM(ev, actor, id, tokenId){
        switch(id){
            case "masterMenu":
                DSA5_Utility.renderToggle(game.dsa5.apps.gameMasterMenu)
                break
            case "payMoney":
                this.payMoney(ev)
                break
            case "randomVictim":
                this.handleGMRandomVictim(ev)
                break
            default:
                if(id in this.callbackFunctions) this.callbackFunctions[id](ev, actor, id, tokenId)
        }
    }

    payMoney(ev){
        const money = `${$(ev.currentTarget).closest('.tokenHotbarInner,#hotbar').find(".modifierVal").val()}`

        if(ev.button == 2){
            DSA5Payment.createGetPaidChatMessage(money)
        } else{
            DSA5Payment.createPayChatMessage(money)
        }
    }

    async handleGMRandomVictim(ev){
        const randomPlayer = await game.dsa5.apps.gameMasterMenu.rollRandomPlayer(ev.button == 2)
        const actor = game.actors.get(randomPlayer)
        if(actor){
            const k = await DSA5_Utility.showArtwork(actor)
            if(!ev.originalEvent.ctrlKey) setTimeout(() => { k.close() }, 2000)
        }
    }

    async handleSharedEffect(ev) {
        for(let token of canvas.tokens.controlled) {
            const actor = token.actor
            const tokenId = token.id
            const id = actor.effects.find(x => x.name == ev.currentTarget.dataset.name)?.id
            await this.handleEffect(ev, actor, id, tokenId)
        }
    }

    async executeQuickButton(ev) {
        const actor = canvas.tokens.controlled[0]?.actor
        const tokenId = canvas.tokens.controlled[0]?.id
        const id = ev.currentTarget.dataset.id
        const subFunction = ev.currentTarget.dataset.subfunction

        switch (subFunction) {
            case "trade":
                this.handleTradeStart(ev, actor, id, tokenId)
                break
            case "addEffect":
                AddEffectDialog.showDialog()
                break
            case "effect":
                this.handleEffect(ev, actor, id, tokenId)
                break
            case "sharedEffect":
                this.handleSharedEffect(ev)
                break
            case "onUse":
                this.handleOnUse(ev, actor, id, tokenId)
                break
            case "gm":
                this.handleGM(ev, actor, id, tokenId)
                break
            case "none":
            case "darkness":
                break
            case "skillgm":
                this.handleGMRoll(ev)
                break
            default:
                this.handleSkillRoll(ev, actor, id, tokenId)
        }
    }

    subWidth(items, itemWidth, defaultCount = 7) {
        return `style="width:${Math.ceil(items.length / defaultCount) * 200}px"`
    }

    async getData() {
        const data = await super.getData()
        const actor = this.actor
        const items = {
            attacks: [],
            spells: [],
            default: [],
            skills: [],
            functions: [],
            gm: []
        }
        let consumable
        let onUse
        const consumables = []
        const onUsages = []
        let effects = []
        const direction = game.settings.get("dsa5", "tokenhotbarLayout")
        const vertical = direction % 2
        const itemWidth = TokenHotbar2.defaultOptions.itemWidth
        
        let gmMode = false
        if (actor) {
            const moreSkills = []
            let moreSpells = []
            const isRiding = Riding.isRiding(actor)
            const rideName = game.i18n.localize("LocalizedIDs.riding")

            effects = await this._effectEntries(actor)
            if (game.combat) {
                const combatskills = actor.items.filter(x => x.type == "combatskill").map(x => Actordsa5._calculateCombatSkillValues(x.toObject(), actor.system))
                const brawl = this._brawlEntry(combatskills)

                if(brawl) items.attacks.push(brawl)

                for (const x of actor.items) {
                    if ("skill" == x.type && (TokenHotbar2.combatSkills.some(y => x.name.startsWith(y)) || (isRiding && rideName == x.name))) {
                        items.default.push(this._skillEntry(x, "skill filterable"))
                    }

                    if (x.type == "trait" && TokenHotbar2.traitTypes.has(x.system.traitType.value)) {
                        items.attacks.push(this._traitEntry(x))
                    }
                    else if (TokenHotbar2.attackTypes.has(x.type) && x.system.worn.value == true) {
                        items.attacks.push(this._combatEntry(x, combatskills, actor))
                    } else if (TokenHotbar2.spellTypes.has(x.type)) {
                        if (x.system.effectFormula.value) items.spells.push(this._skillEntry(x, "spell filterable"))
                        else moreSpells.push(this._skillEntry(x, "spell filterable"))
                    }
                    else if ("skill" == x.type){
                        moreSkills.push(this._skillEntry(x, "skill filterable", { addClass: x.system.group.value}))
                    }
                    else if (x.type == "consumable") {
                        consumables.push(this._actionEntry(x, "consumable", { abbrev: x.system.quantity.value }))
                    }

                    if (x.getFlag("dsa5", "onUseEffect")) {
                        onUsages.push(this._actionEntry(x, "onUse", { subfunction: "onUse" }))
                    }
                }
                consumable = consumables.pop()

                if(isRiding) {
                    const ridingEnttry = this._ridingEntry(actor)

                    if(ridingEnttry) items.default.push(ridingEnttry)
                }
                
            } else {
                const descendingSkills = []
                for (const x of actor.items) {
                    if ("skill" == x.type && (TokenHotbar2.defaultSkills.has(x.name)  || (isRiding && rideName == x.name))) {
                        items.default.push(this._skillEntry(x, "skill filterable"))
                    }
                    if ("skill" == x.type) {
                        const elem = this._skillEntry(x, "skill filterable", { addClass: x.system.group.value})
                        if(x.system.talentValue.value > 0) {
                            descendingSkills.push(elem)
                        }

                        moreSkills.push(elem)
                    } else if (TokenHotbar2.spellTypes.has(x.type)) {
                        if (x.system.effectFormula.value) items.spells.push(this._actionEntry(x, "spell filterable"))
                        else moreSpells.push(this._actionEntry(x, "spell filterable"))
                    }

                    if (x.getFlag("dsa5", "onUseEffect")) {
                        onUsages.push(this._actionEntry(x, "onUse", { subfunction: "onUse" }))
                    }
                }
                items.skills.push(...descendingSkills.sort((a, b) => { return b.tw - a.tw }).slice(0, 5))
            }

            onUse = onUsages.pop()

            items.functions = this._functionEntries()

            if (items.spells.length == 0 && moreSpells.length > 0) {
                items.spells.push(moreSpells.pop())
            }
            if (items.spells.length > 0 && moreSpells.length > 0) {
                items.spells[0].more = moreSpells.sort((a, b) => { return a.name.localeCompare(b.name) })
                items.spells[0].subwidth = this.subWidth(moreSpells, itemWidth)
            }
            if (items.default.length > 0 && moreSkills.length > 0) {
                items.default[0].more = moreSkills.sort((a, b) => { return a.addClass.localeCompare(b.addClass) || a.name.localeCompare(b.name) })
                items.default[0].subwidth = this.subWidth(moreSkills, itemWidth, 20)
            }

            if (consumable) {
                if (consumables.length > 0) {
                    consumable.more = consumables
                    consumable.subwidth = this.subWidth(consumables, itemWidth)
                }
                items.consumables = [consumable]
            }

            if (onUse) {
                if (onUsages.length > 0) {
                    onUse.more = onUsages
                    onUse.subwidth = this.subWidth(onUsages, itemWidth)
                }
                items.onUsages = [onUse]
            }
        } else if(game.user.isGM && !game.settings.get("dsa5", "disableTokenhotbarMaster")){
            gmMode = true
            const skills = this.skills || await this.prepareSkills()
            items.gm = this._gmEntries().concat([
                { name: "TT.tokenhotbarSkill", id: "skillgm", icon: "systems/dsa5/icons/categories/Skill.webp", cssClass: "skillgm filterable", abbrev: "", subfunction: "none", more: skills, subwidth: this.subWidth(skills, itemWidth, 20) },
        ])
        }

        if (this.showEffects) {
            const label = game.i18n.localize("CONDITION.add")
            const effect = { name: "CONDITION.add", id: "", icon: "icons/svg/aura.svg", cssClass: "effect", abbrev: label[0], subfunction: "addEffect" }
            if (effects.length > 0) {
                effect.more = effects
                effect.subwidth = this.subWidth(effects, itemWidth)
            } else if(canvas.tokens.controlled.length > 1) {
                let sharedEffects = await this.tokenHotbar._effectEntries(canvas.tokens.controlled[0].actor, { subfunction: "sharedEffect"})

                for(let token of canvas.tokens.controlled){
                    const tokenEffects = (await token.actor.actorEffects()).map(x => x.name)
                    sharedEffects = sharedEffects.filter(x => tokenEffects.includes(x.name))
                }
                effect.more = sharedEffects
                effect.subwidth = this.subWidth(sharedEffects, itemWidth)
            }
            items.effects = [effect]
        }

        const count = Object.keys(items).reduce((prev, cur) => { return prev + items[cur].length }, 0) + (gmMode ? 3 : 0)

        if (vertical) {
            this.position.width = itemWidth
            this.position.height = itemWidth * count + 14
        } else {
            this.position.width = itemWidth * count + 14
            this.position.height = itemWidth
        }

        mergeObject(data, { items, itemWidth, direction, count, gmMode, darkness: canvas?.scene?.darkness || 0, opacity: game.settings.get("dsa5", "tokenhotbaropacity") })
        return data
    }

    _functionEntries() {
        const trade = game.i18n.localize('MERCHANT.exchangeWithTarget')
        return [
                { name: trade, id: "trade", cssClass: "function", abbrev: trade[0], iconClass: "fas fa-coins", subfunction: "trade" }
        ]
    }

    _brawlEntry(combatskills) {
        const brawl = combatskills.find(x => x.name == game.i18n.localize('LocalizedIDs.wrestle'))
        if(brawl) {
            return {
                name: game.i18n.localize("attackWeaponless"),
                id: "attackWeaponless",
                icon: "systems/dsa5/icons/categories/attack_weaponless.webp",
                attack: brawl.system.attack.value,
                damage: "1d6",
                cssClass: "zbrawl"
            }
        }
    }

    _ridingEntry(actor) {
        if(isRiding){
            const horse = Riding.getHorse(actor)
            if(horse){
                const x = Riding.getLoyaltyFromHorse(horse)
                if(x){
                    return { name: `${x.name} (${x.system.talentValue.value})`, id: "rideLoyaltyID", icon: x.img, cssClass: "skill", abbrev: x.name[0] }
                }
            }
        }
    }

    _gmEntries() {        
        return this.gmItems.filter(x => !x.disabled)
    }
    
    _actionEntry(x, cssClass, options = {}) {
        return { name: x.name, id: x.id, icon: x.img, cssClass, abbrev: x.name[0], ...options }
    }

    _skillEntry(x, cssClass, options = {}) {
        const tw = x.system?.talentValue.value
        const name = tw ? `${x.name} (${tw})` : x.name
        return { name: name, id: x.id, icon: x.img, cssClass, addClass: x.system?.group?.value, abbrev: x.name[0], tw, ...options }
    }

    _traitEntry(x) {
        const preparedItem = Actordsa5._parseDmg(x.toObject())
        return { name: x.name, id: x.id, icon: x.img, cssClass: "weapon", abbrev: x.name[0], attack: x.system.at.value, damage: preparedItem.damagedie, dadd: preparedItem.damageAdd}
    }

    _combatEntry(x, combatskills, actor, options = []) {
        const preparedItem = x.type == "meleeweapon" ? Actordsa5._prepareMeleeWeapon(x.toObject(), combatskills, actor) : Actordsa5._prepareRangeWeapon(x.toObject(), [], combatskills, actor)

        return { name: x.name, id: x.id, icon: x.img, cssClass: "weapon", abbrev: x.name[0], attack: preparedItem.attack, damage: preparedItem.damagedie, dadd: preparedItem.damageAdd, ...options }
    }

    async _effectEntries(actor, options = {}) {
        return (await actor.actorEffects()).map(x => { 
            const level = x.getFlag("dsa5","value") || ""
            const name = level ? `${x.name} (${level})` : x.name
            return { name: name, id: x.id, icon: x.icon, cssClass: "effect", abbrev: `${x.name[0]} ${level}`, subfunction: "effect", indicator: level, ...options } 
        })
    }

    filterButtons(ev){
        switch(ev.which){
            case 8:
                this.searching = this.searching.slice(0, -1)
                break
            default:
                if(!ev.key.match(/[a-zA-Z0-9öäüÖÄÜ]/)) return

                this.searching += ev.key
        }
        ev.preventDefault()
        ev.stopPropagation()
        const search = this.searching.toLowerCase()
        tinyNotification(search)
        let btns = $(ev.currentTarget).find('.subbuttons li')
        btns.find('.dsahidden').removeClass('dsahidden')
        btns.filter(function() {
            return $(this).find('label').text().toLowerCase().trim().indexOf(search) == -1
        }).addClass('dsahidden')
    }

    async render(force, options = {}) {
        const rend = await super.render(force, options)
        if (this._element) {
            this._element.css({ zIndex: 61 });
        }
        return rend
    }

    setPosition({ left, top, width, height, scale } = {}) {
        const currentPosition = super.setPosition({ left, top, width, height, scale })
        const el = this.element[0];

        if (!el.style.width || width) {
            const tarW = width || el.offsetWidth;
            const maxW = el.style.maxWidth || window.innerWidth;
            currentPosition.width = width = Math.clamped(tarW, 0, maxW);
            el.style.width = width + "px";
            if ((width + currentPosition.left) > window.innerWidth) left = currentPosition.left;
        }
        game.settings.set("dsa5", "tokenhotbarPosition", { left: currentPosition.left, top: currentPosition.top })
        return currentPosition
    }

    async updateDSA5Hotbar() {
        ui.hotbar.updateDSA5Hotbar()

        if(game.settings.get("dsa5", "disableTokenhotbar")) return

        const controlled = canvas.tokens.controlled
        this.actor = undefined
        this.showEffects = false
        if (controlled.length === 1) {
            const actor = controlled[0].actor
            if (actor && actor.isOwner) {
                this.actor = actor
            }
        }

        if (controlled.length >= 1) {
            this.showEffects = true
        }
        await this.render(true, { focus: false })
    }
}

export class AddEffectDialog extends Dialog {
    static async showDialog() {
        const effects = duplicate(CONFIG.statusEffects).map(x => {
            return {
                name: game.i18n.localize(x.name),
                icon: x.icon,
                description: game.i18n.localize(x.description),
                id: x.id
            }
        }).sort((a, b) => a.name.localeCompare(b.name))

        const dialog = new AddEffectDialog({
            title: game.i18n.localize("CONDITION.add"),
            content: await renderTemplate('systems/dsa5/templates/dialog/addstatusdialog.html', { effects }),
            buttons: {}
        })
        dialog.position.height = Math.ceil(effects.length / 3) * 36 + 170
        dialog.render(true)
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.reactClick').mouseenter((ev) => {
            if (ev.currentTarget.getElementsByClassName("hovermenu").length == 0) {
                let div = document.createElement("div")
                div.classList.add("hovermenu")
                div.style.cssText = "font-size: var(--font-size-20);"
                let conf = document.createElement("i")
                conf.classList.add("fas", "fa-cogs")
                conf.title = game.i18n.localize("ActiveEffects.custom")
                conf.addEventListener("click", async ev => this.configureEffect(ev), false)
                div.appendChild(conf)
                ev.currentTarget.appendChild(div)
            }
        })
        html.find('.reactClick').mouseleave((ev) => {
            let e = ev.toElement || ev.relatedTarget;
            if (e.parentNode == this || e == this) return;

            ev.currentTarget.querySelectorAll(".hovermenu").forEach((e) => e.remove());
        })

        html.find('.quantity-click').mousedown(ev => RuleChaos.quantityClick(ev));

        html.find('.reactClick').click(ev => this.addEffect(ev.currentTarget.dataset.value))

        let filterConditions = ev => this._filterConditions($(ev.currentTarget), html)

        let search = html.find('.conditionSearch')
        search.keyup(event => this._filterConditions($(event.currentTarget), html))
        search[0] && search[0].addEventListener("search", filterConditions, false);
    }

    _filterConditions(tar, html) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let conditions = html.find('.filterable')
            html.find('.filterHide').removeClass('filterHide')
            conditions.filter(function() {
                return $(this).find('span').text().toLowerCase().trim().indexOf(val) == -1
            }).addClass('filterHide')
        }
    }

    static async modifyEffectDialog(id, callback){
        new AddEffectDialog({
            title: game.i18n.localize("CONDITION." + id),
            content: await renderTemplate('systems/dsa5/templates/dialog/configurestatusdialog.html'),
            default: 'add',
            buttons: {
                add: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("CONDITION.add"),
                    callback: async(html) => {
                        const options = {}
                        const duration = html.find('[name=unit]:checked').val() == "seconds" ? Math.round(html.find('.duration').val() / 5) : html.find('.duration').val()
                        const label = html.find('.effectname').val()
                        if (duration > 0) {
                            mergeObject(options, RuleChaos._buildDuration(duration))
                        }
                        if (label) {
                            options.name = label
                        }
                        await callback(id, options)
                    }
                }
            }
        }).render(true, { width: 400, resizable: false, classes: ["dsa5", "dialog"] })
    }

    async configureEffect(ev) {
        ev.stopPropagation()
        const elem = $(ev.currentTarget).closest(".reactClick");
        const id = elem.attr("data-value")
        this.close()
        AddEffectDialog.modifyEffectDialog(id, async(id, options) => this.addEffect(id, options))
    }

    async addEffect(id, options = {}) {
        for (let token of canvas.tokens.controlled) {
            await token.actor.addTimedCondition(id, 1, false, false, options)
        }
        this.close()
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        //const height = Math.ceil(CONFIG.statusEffects.length / 3) * 32
        mergeObject(options, {
            classes: ["dsa5", "tokenStatusEffects"],
            width: 700,
            resizable: true,
           // height
        });
        return options;
    }
}