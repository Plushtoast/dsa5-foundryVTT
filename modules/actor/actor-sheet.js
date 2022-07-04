import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5ChatListeners from "../system/chat_listeners.js";
import DSA5StatusEffects from "../status/status_effects.js";
import DialogActorConfig from "../dialog/dialog-actorConfig.js";
import { itemFromDrop } from "../system/view_helper.js";
import Actordsa5 from "./actor-dsa5.js";
import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import RuleChaos from "../system/rule_chaos.js";
import OnUseEffect from "../system/onUseEffects.js";
import { bindImgToCanvasDragStart } from "../hooks/imgTileDrop.js";
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js";

export default class ActorSheetDsa5 extends ActorSheet {
    get actorType() {
        return this.actor.data.type;
    }

    async _render(force = false, options = {}) {
        this._saveSearchFields()
        this._saveCollapsed()
        await super._render(force, options);
        this._setCollapsed()
        this._restoreSeachFields()

        let elem = $(this._element)

        elem.find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        elem.find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        elem.find(".configure-token").attr("title", game.i18n.localize("SHEET.Token"));
        elem.find(".import").attr("title", game.i18n.localize("SHEET.Import"));
        elem.find(".locksheet").attr("title", game.i18n.localize("SHEET.Lock"));
        elem.find(".library").attr("title", game.i18n.localize("SHEET.Library"));
        elem.find(".playerview").attr("title", game.i18n.localize("SHEET.switchLimited"));
        elem.find(".actorConfig").attr("title", game.i18n.localize("SHEET.actorConfig"));

        if (this.currentFocus) {
            elem.find('[data-item-id="' + this.currentFocus + '"] input').focus().select();
            this.currentFocus = null;
        }
    }

    static
    get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "skills" }]
        mergeObject(options, {
            width: 770,
            height: 740,
            scrollY: [".save-scroll"]
        });
        return options;
    }

    _saveSearchFields() {
        if (this.form === null)
            return;
        const html = $(this.form).parent()
        this.searchFields = {
            talentFiltered: $(html.find(".filterTalents")).hasClass("filtered"),
            searchText: $(html.find(".talentSearch")).val(),
            gearSearch: $(html.find(".gearSearch")).val()
        }
    }

    _restoreSeachFields() {
        if (this.searchFields != undefined) {
            const html = $(this.form).parent();
            if (this.searchFields.talentFiltered) {
                $(html.find(".filterTalents")).addClass("filtered")
                $(html.find(".allTalents")).removeClass("showAll")
            }
            const talentSearchInput = $(html.find(".talentSearch"))
            talentSearchInput.val(this.searchFields.searchText)
            if (this.searchFields.searchText != "") {
                this._filterTalents(talentSearchInput)
            }
            const gearSearchInput = $(html.find(".gearSearch"))
            gearSearchInput.val(this.searchFields.gearSearch)
            if (this.searchFields.searchText != "") {
                this._filterGear(gearSearchInput)
            }
        }
    }

    _saveCollapsed() {
        if (this.form === null)
            return;

        const html = $(this.form).parent();
        this.collapsedBoxes = [];
        this.openDetails = []
        let boxes = html.find(".ch-collapse i");
        for (let box of boxes) {
            this.collapsedBoxes.push($(box).attr("class"));
        }
        for (const detail of $(html.find('.expandDetails.shown'))) {
            this.openDetails.push($(detail).closest('.item').attr("data-item-id"))
        }
    }

    _setCollapsed() {
        const html = $(this.form).parent();
        if (this.collapsedBoxes) {
            let boxes = html.find(".ch-collapse i");
            for (let i = 0; i < boxes.length; i++) {
                $(boxes[i]).attr("class", this.collapsedBoxes[i]);
                if (this.collapsedBoxes[i] && this.collapsedBoxes[i].indexOf("fa-angle-down") != -1)
                    $(boxes[i]).closest('.groupbox').find('.row-section:nth-child(2)').hide()
            }
        }
    }

    async getData(options) {
        const baseData = await super.getData(options);
        const sheetData = { actor: baseData.actor.data, editable: baseData.editable, limited: baseData.limited, owner: baseData.owner }
        const prepare = this.actor.prepareSheet({ details: this.openDetails })
        mergeObject(sheetData.actor, prepare)

        sheetData.isGM = game.user.isGM;
        sheetData["initDies"] = { "": "-", "1d6": "1d6", "2d6": "2d6", "3d6": "3d6", "4d6": "4d6" }
        DSA5StatusEffects.prepareActiveEffects(this.actor, sheetData)
        return sheetData;
    }

    _onItemCreate(event) {
        event.preventDefault();
        let header = event.currentTarget,
            data = duplicate(header.dataset);

        if (DSA5.equipmentTypes[data.type]) {
            data.type = "equipment"
            data = mergeObject(data, {
                "data.equipmentType.value": event.currentTarget.attributes["item-section"].value,
                "data.effect.value": ""
            })
        }
        if (data.type == "aggregatedTest") {} else if (data.type == "spell" || data.type == "liturgy") {} else {
            data["data.weight.value"] = 0
            data["data.quantity.value"] = 0
        }

        Itemdsa5.defaultIcon(data)
        data["name"] = game.i18n.localize(data.type);
        this.actor.createEmbeddedDocuments("Item", [data]);
    }

    _handleAggregatedProbe(ev) {
        const itemId = this._getItemId(ev);
        let aggregated = duplicate(this.actor.items.get(itemId));
        let skill = this.actor.items.find(i => i.data.name == aggregated.data.talent.value && i.type == "skill")
        let infoMsg = `<h3 class="center"><b>${game.i18n.localize("aggregatedTest")}</b></h3>`
        if (aggregated.data.usedTestCount.value >= aggregated.data.allowedTestCount.value) {
            infoMsg += `${game.i18n.localize("Aggregated.noMoreAllowed")}`;
            ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        } else {
            this.actor.setupSkill(skill.data, {
                moreModifiers: [
                    { name: game.i18n.localize("failedTests"), value: -1 * aggregated.data.previousFailedTests.value, selected: true },
                    { name: game.i18n.localize("Modifier"), value: aggregated.data.baseModifier, selected: true }
                ]
            }, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData).then(res => {
                    if (res.result.successLevel > 0) {
                        aggregated.data.cummulatedQS.value = res.result.qualityStep + aggregated.data.cummulatedQS.value
                        aggregated.data.cummulatedQS.value = Math.min(10, aggregated.data.cummulatedQS.value)
                    } else {
                        aggregated.data.previousFailedTests.value += 1
                    }
                    aggregated.data.usedTestCount.value += 1
                    this.actor.updateEmbeddedDocuments("Item", [aggregated]).then(x =>
                        this.actor.items.get(itemId).postItem()
                    )
                })
            });
        }
    }

    async consumeItem(item) {
        new Dialog({
            title: game.i18n.localize("SHEET.ConsumeItem") + ": " + item.name,
            content: game.i18n.localize("SHEET.ConsumeItem") + ": " + item.name,
            default: 'yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: () => {
                        item.setupEffect(null, {}, this.getTokenId())
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel"),
                }
            }
        }).render(true)
    }

    async _advanceAttribute(attr) {
        const advances = Number(this.actor.data.data.characteristics[attr].advances) + Number(this.actor.data.data.characteristics[attr].initial)
        const cost = DSA5_Utility._calculateAdvCost(advances, "E")
        if (await this._checkEnoughXP(cost)) {
            await this._updateAPs(cost, {
                [`data.characteristics.${attr}.advances`]: Number(this.actor.data.data.characteristics[attr].advances) + 1
            })
        }
    }

    async _refundAttributeAdvance(attr) {
        const advances = Number(this.actor.data.data.characteristics[attr].advances) + Number(this.actor.data.data.characteristics[attr].initial)
        if (Number(this.actor.data.data.characteristics[attr].advances) > 0) {
            const cost = DSA5_Utility._calculateAdvCost(advances, "E", 0) * -1
            await this._updateAPs(cost, {
                [`data.characteristics.${attr}.advances`]: Number(this.actor.data.data.characteristics[attr].advances) - 1
            })
        }
    }

    async _advancePoints(attr) {
        const advances = Number(this.actor.data.data.status[attr].advances)
        const cost = DSA5_Utility._calculateAdvCost(advances, "D")
        if (await this._checkEnoughXP(cost) && this._checkMaximumPointAdvancement(attr, advances + 1)) {
            await this._updateAPs(cost, {
                [`data.status.${attr}.advances`]: Number(this.actor.data.data.status[attr].advances) + 1
            })
        }
    }

    async _refundPointsAdvance(attr) {
        const advances = Number(this.actor.data.data.status[attr].advances)
        if (advances > 0) {
            const cost = DSA5_Utility._calculateAdvCost(advances, "D", 0) * -1
            await this._updateAPs(cost, {
                [`data.status.${attr}.advances`]: Number(this.actor.data.data.status[attr].advances) - 1
            })
        }
    }

    async _advanceItem(itemId) {
        let item = duplicate(this.actor.items.get(itemId))
        let cost = DSA5_Utility._calculateAdvCost(Number(item.data.talentValue.value), item.data.StF.value)
        if (await this._checkEnoughXP(cost) && this._checkMaximumItemAdvancement(item, Number(item.data.talentValue.value) + 1)) {
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.talentValue.value": item.data.talentValue.value + 1 }])
            await this._updateAPs(cost)
        }
    }

    async _refundItemAdvance(itemId) {
        let item = duplicate(this.actor.items.get(itemId))
        if (item.data.talentValue.value > 0) {
            let cost = DSA5_Utility._calculateAdvCost(Number(item.data.talentValue.value), item.data.StF.value, 0) * -1
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.talentValue.value": item.data.talentValue.value - 1 }])
            await this._updateAPs(cost)
        }
    }

    _checkMaximumPointAdvancement(attr, newValue) {
        let result = false
        switch (attr) {
            case "wounds":
                result = newValue <= this.actor.data.data.characteristics["ko"].value
                break
            case "astralenergy":
                result = newValue <= (this.actor.data.data.characteristics[this.actor.data.data.guidevalue.magical] == undefined ? 0 : this.actor.data.data.characteristics[this.actor.data.data.guidevalue.magical].value * this.actor.data.data.energyfactor.magical)
                break
            case "karmaenergy":
                result = newValue <= (this.actor.data.data.characteristics[this.actor.data.data.guidevalue.clerical] == undefined ? 0 : this.actor.data.data.characteristics[this.actor.data.data.guidevalue.clerical].value * this.actor.data.data.energyfactor.clerical)
                break
        }
        if (!result)
            ui.notifications.error(game.i18n.localize("DSAError.AdvanceMaximumReached"))

        return result
    }

    _checkMaximumItemAdvancement(item, newValue) {
        let result = false
        switch (item.type) {
            case "combatskill":
                result = newValue <= Math.max(...(item.data.guidevalue.value.split("/").map(x => this.actor.data.data.characteristics[x].value))) + 2 + AdvantageRulesDSA5.vantageStep(this.actor, `${game.i18n.localize('LocalizedIDs.exceptionalCombatTechnique')} (${item.name})`)
                break
            case "spell":
            case "ritual":
                let focusValue = 0
                for (const feature of item.data.feature.replace(/\(a-z äöü\-\)/gi, "").split(",").map(x => x.trim())) {
                    if (SpecialabilityRulesDSA5.hasAbility(this.actor, `${game.i18n.localize('LocalizedIDs.propertyKnowledge')} (${feature})`)) {
                        focusValue = this.maxByAttr(item)
                        break
                    }
                }
                result = newValue <= Math.max(14 + AdvantageRulesDSA5.vantageStep(this.actor, `${game.i18n.localize('LocalizedIDs.exceptionalSkill')} (${item.name})`), focusValue)
                break
            case "liturgy":
            case "ceremony":
                const aspect = new RegExp(`^${game.i18n.localize("LocalizedIDs.aspectKnowledge")}`)
                let aspectValue = 0
                if (this.actor.items.filter(x => x.type == "specialability" && aspect.test(x.name)).some(x => item.data.distribution.value.includes(x.name.split("(")[1].split(")")[0]))) {
                    aspectValue = this.maxByAttr(item)
                }
                result = newValue <= Math.max(14 + AdvantageRulesDSA5.vantageStep(this.actor, `${game.i18n.localize('LocalizedIDs.exceptionalSkill')} (${item.name})`), aspectValue)
                break
            case "skill":
                result = newValue <= this.maxByAttr(item)
                break
        }
        if (!result)
            ui.notifications.error(game.i18n.localize("DSAError.AdvanceMaximumReached"))

        return result
    }

    maxByAttr(item) {
        return Math.max(...[this.actor.data.data.characteristics[item.data.characteristic1.value].value, this.actor.data.data.characteristics[item.data.characteristic2.value].value, this.actor.data.data.characteristics[item.data.characteristic3.value].value]) + 2 + AdvantageRulesDSA5.vantageStep(this.actor, `${game.i18n.localize('LocalizedIDs.exceptionalSkill')} (${item.name})`)
    }

    async _openLibrary() {
        game.dsa5.itemLibrary.render(true)
    }

    async _configActor() {
        DialogActorConfig.buildDialog(this.actor)
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "library",
            icon: `fas fa-university`,
            onclick: async() => this._openLibrary()
        })
        if (this.actor.isOwner) {
            buttons.unshift({
                class: "actorConfig",
                icon: `fas fa-link`,
                onclick: async() => this._configActor()
            })
        }
        if (this.actor.data.canAdvance) {
            buttons.unshift({
                class: "locksheet",
                icon: `fas fa-${this.actor.data.data.sheetLocked.value ? "" : "un"}lock`,
                onclick: async ev => this._changeAdvanceLock(ev)
            })
        }
        return buttons
    }

    async _changeAdvanceLock(ev) {
        await this.actor.update({ "data.sheetLocked.value": !this.actor.data.data.sheetLocked.value })
        $(ev.currentTarget).find("i").toggleClass("fa-unlock fa-lock")
    }

    async _checkEnoughXP(cost) {
        return await this.actor.checkEnoughXP(cost)
    }

    async advanceWrapper(ev, funct, param) {
        let elem = $(ev.currentTarget)
        let i = elem.find('i')
        if (!i.hasClass("fa-spin")) {
            i.addClass("fa-spin fa-spinner")
            await this[funct](param)
            i.removeClass("fa-spin fa-spinner")
        }
    }

    showLimited() {
        return !game.user.isGM && this.actor.limited
    }

    getTokenId() {
        return this.token ? this.token.id : undefined
    }

    rollDisease(itemId) {
        const item = this.actor.items.get(itemId)
        const SKModifier = this.actor.data.data.status.soulpower.max * -1
        const ZKModifier = this.actor.data.data.status.toughness.max * -1
        item.setupEffect(undefined, { rollMode: "gmroll", manualResistance: { SKModifier, ZKModifier } }).then(async(setupData) => {
            const result = await item.itemTest(setupData)
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "data.duration.resolved": result.result.duration }])
        });
    }

    activateListeners(html) {
        super.activateListeners(html);

        const posthand = ev => { this.actor.items.get(this._getItemId(ev)).postItem() }

        html.find('.roll-disease').click(ev => this.rollDisease(this._getItemId(ev)))

        html.find('.schip').click(ev => {
            ev.preventDefault()
            let val = Number(ev.currentTarget.getAttribute("data-val"))
            let elem = $(this.form).parent().find('[name="data.status.fatePoints.value"]')

            if (val == 1 && $(this.form).find(".fullSchip").length == 1) val = 0

            elem.val(val)
            elem.trigger("change")
        })

        html.find('.defenseToggle').click(() => this.actor.update({ "data.config.defense": !this.actor.data.data.config.defense }))

        html.find('.loadWeapon').mousedown(async(ev) => {
            const itemId = this._getItemId(ev)
            const item = this.actor.items.get(itemId).toObject()

            if (getProperty(item, "data.currentAmmo.value") === "" && this.actor.type != "creature") return

            const lz = item.type == "trait" ? item.data.reloadTime.value : Actordsa5.calcLZ(item, this.actor)

            if (ev.button == 0)
                item.data.reloadTime.progress = Math.min(item.data.reloadTime.progress + 1, lz)
            else if (ev.button == 2)
                item.data.reloadTime.progress = 0

            await this.actor.updateEmbeddedDocuments("Item", [item]);
        })

        html.find('.chargeSpell').mousedown(async(ev) => {
            const itemId = this._getItemId(ev)
            const item = this.actor.items.get(itemId).toObject()
            const lz = Number(item.data.castingTime.modified)
            if (ev.button == 0)
                item.data.castingTime.progress = Math.min(item.data.castingTime.progress + 1, lz)
            else if (ev.button == 2) {
                item.data.castingTime.progress = 0
                item.data.castingTime.modified = 0
            }
            await this.actor.updateEmbeddedDocuments("Item", [item]);
        })

        html.find('.item-swapMag').click(async(ev) => {
            await this.actor.swapMag(this._getItemId(ev))
        })

        html.find('.ammo-selector').change(async(ev) => {
            ev.preventDefault()
            const itemId = this._getItemId(ev);
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.currentAmmo.value": $(ev.currentTarget).val() }]);
        })

        html.find('.condition-edit').click(ev => {
            const effect = this.actor.effects.get($(ev.currentTarget).attr("data-id"))
            effect.sheet.render(true)
        })

        html.find('.ch-collapse').click(ev => {
            $(ev.currentTarget).find('i').toggleClass("fa-angle-up fa-angle-down")
            $(ev.currentTarget).closest(".groupbox").find('.row-section:nth-child(2)').fadeToggle()
        })

        html.find('.item-toggle').click(ev => {
            const itemId = this._getItemId(ev);
            let item = this.actor.items.get(itemId).toObject()

            switch (item.type) {
                case "armor":
                case "rangeweapon":
                case "meleeweapon":
                case "equipment":
                    this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.worn.value": !item.data.worn.value }]);
                    DSA5SoundEffect.playEquipmentWearStatusChange(item)
                    break;
            }
        });

        html.find(".status-create").click(ev => {
            let menu = $(ev.currentTarget).closest(".statusEffectMenu").find('ul')
            menu.fadeIn('fast', () => { menu.find('input').focus() })
        })
        html.find(".statusEffectMenu ul").mouseleave(ev => $(ev.currentTarget).fadeOut())
        html.find(".status-add").click(async(ev) => {
            let status = $(ev.currentTarget).attr("data-id")
            if (status == "custom") {
                DSA5StatusEffects.createCustomEffect(this.actor)
            } else
                await this.actor.addCondition(status, 1, false, false)
        })

        html.find('.roll-aggregated').mousedown(ev => this._handleAggregatedProbe(ev))

        html.find('.skill-select').mousedown(ev => {
            const itemId = this._getItemId(ev);
            let skill = this.actor.items.get(itemId);

            if (ev.button == 0)
                this.actor.setupSkill(skill.data, {}, this.getTokenId()).then(setupData => {
                    this.actor.basicTest(setupData)
                });
            else if (ev.button == 2)
                skill.sheet.render(true);
        });

        html.find(".advance-attribute").mousedown(ev => this.advanceWrapper(ev, "_advanceAttribute", $(ev.currentTarget).attr("data-attr")))
        html.find(".refund-attribute").mousedown(ev => this.advanceWrapper(ev, "_refundAttributeAdvance", $(ev.currentTarget).attr("data-attr")))
        html.find(".advance-item").mousedown(ev => this.advanceWrapper(ev, "_advanceItem", this._getItemId(ev)))
        html.find(".refund-item").mousedown(ev => this.advanceWrapper(ev, "_refundItemAdvance", this._getItemId(ev)))
        html.find(".advance-points").mousedown(ev => this.advanceWrapper(ev, "_advancePoints", $(ev.currentTarget).attr("data-attr")))
        html.find(".refund-points").mousedown(ev => this.advanceWrapper(ev, "_refundPointsAdvance", $(ev.currentTarget).attr("data-attr")))

        html.find('.spell-select').mousedown(ev => {
            const itemId = this._getItemId(ev);
            let skill = this.actor.items.get(itemId);

            if (ev.button == 0)
                this.actor.setupSpell(skill.data, {}, this.getTokenId()).then(setupData => this.actor.basicTest(setupData));

            else if (ev.button == 2)
                skill.sheet.render(true);
        });

        html.find('.quantity-click').mousedown(ev => {
            const itemId = this._getItemId(ev);
            let item = this.actor.items.get(itemId).toObject()
            RuleChaos.increment(ev, item, "data.quantity.value", 0)
            this.actor.updateEmbeddedDocuments("Item", [item]);
        });

        html.find(".item-post").click(ev => posthand(ev))

        html.find('.item-dropdown').click(ev => {
            ev.preventDefault()
            $(ev.currentTarget).closest('.item').find('.expandDetails:first').toggleClass('shown')
        })

        html.find('.condition-show').mousedown(ev => {
            ev.preventDefault()
            const id = ev.currentTarget.dataset.id
            const descriptor = $(ev.currentTarget).parents(".statusEffect").attr("data-descriptor")
            if (ev.button == 0) {
                const origin = $(ev.currentTarget).parents(".statusEffect").attr("data-origin")
                if (origin) {
                    fromUuid(origin).then(document => document.sheet.render(true))
                } else {
                    let effect
                    let text
                    if (descriptor) {
                        effect = CONFIG.statusEffects.find(x => x.id == descriptor)
                        text = $(`<div style="padding:5px;"><b><a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.icon}"/>${game.i18n.localize(effect.label)}</a></b>: ${game.i18n.localize(effect.description)}</div>`)
                    } else {
                        //search temporary effects
                        effect = this.actor.data.effects.find(x => x.id == id)
                        if (effect) {
                            text = $(`<div style="padding:5px;"><b><a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.icon}"/>${game.i18n.localize(effect.label)}</a></b>: ${game.i18n.localize(effect.data.flags.dsa5.description)}</div>`)
                        }
                    }
                    const elem = $(ev.currentTarget).closest('.groupbox').find('.effectDescription')
                    elem.fadeOut('fast', function() { elem.html(text).fadeIn('fast') })
                }
            } else if (ev.button == 2 && !ev.currentTarget.dataset.locked) {
                this._deleteActiveEffect(id)
            }
        })
        html.on('click', '.chat-condition', ev => DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id")))
        html.find('.money-change, .skill-advances').focusin(ev => {
            this.currentFocus = $(ev.currentTarget).closest('[data-item-id]').attr('data-item-id');;
        })
        html.find('.money-change').change(async ev => {
            const itemId = this._getItemId(ev);
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.quantity.value": Number(ev.target.value) }]);
        })
        html.find('.skill-advances').change(async ev => {
            const itemId = this._getItemId(ev);
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.talentValue.value": Number(ev.target.value) }]);
        });
        html.find('.item-edit').click(ev => {
            ev.preventDefault()
            const itemId = this._getItemId(ev);
            const item = this.actor.items.get(itemId)
            item.sheet.render(true);
        });
        html.find('.showApplication').mousedown(ev => {
            ev.preventDefault()

            if (ev.button == 2) {
                this._deleteItem(ev)
            } else {
                const itemId = this._getItemId(ev);
                const item = this.actor.items.get(itemId)
                item.sheet.render(true);
            }
        })
        html.find(".consume-item").mousedown(ev => {
            if (ev.button == 2) {
                const itemId = this._getItemId(ev);
                const item = this.actor.items.get(itemId)
                this.consumeItem(item)
            }
        })
        html.find('.ch-value').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupCharacteristic(characteristic, {}, this.getTokenId()).then(setupData => this.actor.basicTest(setupData))
        });
        html.find('.ch-status').click(event => {
            event.preventDefault();
            this.actor.setupDodge({}, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });
        html.find('.ch-regenerate').click(event => {
            event.preventDefault();
            this.actor.setupRegeneration("regenerate", {}, this.getTokenId()).then(setupData => this.actor.basicTest(setupData))
        });
        html.find('.ch-weaponless').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupWeaponless(characteristic, {}, this.getTokenId()).then(setupData => this.actor.basicTest(setupData))
        });

        html.find('.item-create').click(ev => this._onItemCreate(ev));

        html.find('.ch-rollCombat').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const mode = $(event.currentTarget).attr("data-mode")
            const item = this.actor.items.get(itemId)
            this.actor.setupWeapon(item, mode, {}, this.getTokenId()).then(setupData => this.actor.basicTest(setupData))
        });

        const deletehand = ev => this._deleteItem(ev)
        html.find('.onUseItem').click(ev => this._onMacroUseItem(ev))

        html.find(".cards .item").mouseenter(ev => {

            if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
                const div = document.createElement('div')
                div.classList.add("hovermenu")
                const del = document.createElement('i')
                del.classList.add("fas", "fa-times")
                del.title = game.i18n.localize('SHEET.DeleteItem')
                del.addEventListener('click', deletehand, false)
                const post = document.createElement('i')
                post.classList.add("fas", "fa-comment")
                post.title = game.i18n.localize('SHEET.PostItem')
                post.addEventListener('click', posthand, false)
                div.appendChild(post)
                div.appendChild(del)
                ev.currentTarget.appendChild(div)
            }
        });
        html.find(".cards .item").mouseleave(ev => {
            let e = ev.toElement || ev.relatedTarget;
            if (!e || e.parentNode == this || e == this)
                return;

            ev.currentTarget.querySelectorAll('.hovermenu').forEach(e => e.remove());
        });

        const id = this.actor.id
        html.find('.actorDrag').each(function(i, cond) {
            cond.setAttribute("draggable", true);
            cond.addEventListener("dragstart", ev => {
                let dataTransfer = {
                    type: "Actor",
                    id
                }
                ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
            });
        })

        let handler = ev => this._onDragItemStart(ev);
        html.find('.content .item').each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", handler, false);
        });

        html.find('.item-delete').click(ev => this._deleteItem(ev))

        html.find('.filterTalents').click(event => {
            $(event.currentTarget).closest('.content').find('.allTalents').toggleClass('showAll')
            $(event.currentTarget).toggleClass("filtered")
        })

        html.find(".condition-value").mousedown(async(ev) => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-descriptor")
            if (ev.button == 0)
                await this.actor.addCondition(condKey, 1, false, false)
            else if (ev.button == 2)
                await this.actor.removeCondition(condKey, 1, false)
        })

        html.find(".condition-toggle").mousedown(async(ev) => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-id")
            let ef = this.actor.effects.get(condKey)
            await ef.update({ disabled: !ef.disabled })
        })

        html.find('.charimg').mousedown(ev => {
            if (ev.button == 2) DSA5_Utility.showArtwork(this.actor, true)
        })

        DSA5ChatAutoCompletion.bindRollCommands(html)

        let filterTalents = ev => this._filterTalents($(ev.currentTarget))
        let talSearch = html.find('.talentSearch')
        talSearch.keyup(event => this._filterTalents($(event.currentTarget)))
        talSearch[0] && talSearch[0].addEventListener("search", filterTalents, false);

        let filterConditions = ev => this._filterConditions($(ev.currentTarget))
        let condSearch = html.find('.conditionSearch')
        condSearch.keyup(event => this._filterConditions($(event.currentTarget)))
        condSearch[0] && condSearch[0].addEventListener("search", filterConditions, false);

        let filterGear = ev => this._filterGear($(ev.currentTarget))
        let gearSearch = html.find('.gearSearch')
        gearSearch.keyup(event => this._filterGear($(event.currentTarget)))
        gearSearch[0] && gearSearch[0].addEventListener("search", filterGear, false);

        bindImgToCanvasDragStart(html, "img.charimg")
    }

    _onMacroUseItem(ev) {
        const item = this.actor.items.get(this._getItemId(ev))
        const onUse = new OnUseEffect(item)
        onUse.executeOnUseEffect()
    }

    _filterGear(tar) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let gear = $(this.element).find('.inventory .item')
            gear.removeClass('filterHide')
            gear.filter(function() {
                return $(this).find('a.item-edit').text().toLowerCase().trim().indexOf(val) == -1
            }).addClass('filterHide')
        }
    }

    //TODO replace this with foundry SearchFilter
    _filterTalents(tar) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let talents = $(this.form).parent().find('.allTalents')
            talents.find('.item, .table-header, .table-title').removeClass('filterHide')
            talents.addClass('showAll').find('.item').filter(function() {
                return $(this).find('.talentName').text().toLowerCase().trim().indexOf(val) == -1
            }).addClass('filterHide')
            if (val.length > 0) {
                talents.find('.table-header, .table-title:not(:eq(0))').addClass("filterHide")
                talents.addClass("filterfull")
            } else
                talents.removeClass("filterfull")
        }
    }

    _filterConditions(tar) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let conditions = $(this.form).find('.statusEffectMenu li:not(.search)')
            conditions.removeClass('filterHide')
            conditions.filter(function() {
                return $(this).find('a').attr('title').toLowerCase().trim().indexOf(val) == -1
            }).addClass('filterHide')
        }
    }

    async _deleteActiveEffect(id) {
        if (!this.isEditable) return

        let item = this.actor.effects.find(x => x.id == id)

        if (item) {
            let actor = this.token ? this.token.actor : this.actor

            if (actor) await this.actor.deleteEmbeddedDocuments("ActiveEffect", [item.id])

            //Hooks.call("deleteActorActiveEffect", this.actor, item)
        }
    }

    _deleteItem(ev) {
        if (!this.isEditable) return

        const itemId = this._getItemId(ev);
        let item = this.actor.items.get(itemId)
        let message = game.i18n.format("DIALOG.DeleteItemDetail", { item: item.name })
        renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html', { message }).then(html => {
            new Dialog({
                title: game.i18n.localize("Delete Confirmation"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: () => this._cleverDeleteItem(itemId)
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    }
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async _cleverDeleteItem(itemId) {
        let item = this.actor.items.get(itemId)
        let itemsToDelete = [itemId]
        switch (item.type) {
            case "advantage":
            case "disadvantage":
                {
                    await AdvantageRulesDSA5.vantageRemoved(this.actor, item)
                    let xpCost = item.data.data.APValue.value * item.data.data.step.value
                    if (/;/.test(item.data.data.APValue.value)) {
                        const steps = item.data.data.APValue.value.split(";").map(x => Number(x.trim()))
                        xpCost = 0
                        for (let i = 0; i < item.data.data.step.value; i++)
                            xpCost += steps[i]
                    }
                    await this._updateAPs(-1 * xpCost)
                }
                break;
            case "specialability":
                await SpecialabilityRulesDSA5.abilityRemoved(this.actor, item)
                break;
            case "blessing":
            case "magictrick":
                await this._updateAPs(-1)
                break
            case "ritual":
            case "ceremony":
            case "liturgy":
            case "spell":
                {
                    let xpCost = 0
                    for (let i = 0; i <= item.data.data.talentValue.value; i++) {
                        xpCost += DSA5_Utility._calculateAdvCost(i, item.data.data.StF.value, 0)
                    }
                    const extensions = this.actor.data.items.filter(i => i.type == "spellextension" && item.type == i.data.data.category && item.name == i.data.data.source)
                    if (extensions) {
                        xpCost += extensions.reduce((a, b) => { return a + b.data.data.APValue.value }, 0)
                        itemsToDelete.push(...extensions.map(x => x.id))
                    }
                    await this._updateAPs(xpCost * -1)
                }
                break
        }
        await this.actor.deleteEmbeddedDocuments("Item", itemsToDelete);
    }

    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

    async _addMoney(item) {
        let money = duplicate(this.actor.data.items.filter(i => i.type == "money"));
        let moneyItem = money.find(i => i.name == item.name)

        if (moneyItem) {
            moneyItem.data.quantity.value += item.data.quantity.value
            await this.actor.updateEmbeddedDocuments("Item", [moneyItem]);
        } else {
            await this.actor.createEmbeddedDocuments("Item", [item]);
        }
    }

    async _updateAPs(APValue, update = {}) {
        await this.actor._updateAPs(APValue, update)
    }

    async _addVantage(item, typeClass) {
        AdvantageRulesDSA5.needsAdoption(this.actor, item, typeClass)
    }

    async _addSpecialAbility(item, typeClass) {
        SpecialabilityRulesDSA5.needsAdoption(this.actor, item, typeClass)
    }

    _onDragItemStart(event) {
        let tar = event.currentTarget
        let itemId = tar.getAttribute("data-item-id");
        let mod = tar.getAttribute("data-mod");
        const item = itemId ? this.actor.items.get(itemId).toObject() : {}

        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "Item",
            sheetTab: this.actor.data.flags["_sheetTab"],
            actorId: this.actor.id,
            tokenId: this.token ? this.token.data._id : null,
            mod: mod,
            data: item,
            root: tar.getAttribute("root")
        }));
        event.stopPropagation()
    }

    async _handleSpellExtension(item) {
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name);
        if (!res) {
            item = duplicate(item)
            let spell = this.actor.data.items.find(i => i.type == item.data.category && i.name == item.data.source)
            if (!spell) {
                ui.notifications.error(game.i18n.localize("DSAError.noSpellForExtension"))
            } else {
                if (spell.data.data.talentValue.value < item.data.talentValue) {
                    ui.notifications.error(game.i18n.localize("DSAError.talentValueTooLow"))
                    return
                }
                let apCost = item.data.APValue.value
                if (await this.actor.checkEnoughXP(apCost)) {
                    await this._updateAPs(apCost)
                    await this.actor.createEmbeddedDocuments("Item", [item])
                }
            }
        }
    }

    async _addSpellOrLiturgy(item) {
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name);
        let apCost
        item = duplicate(item)
        if (!res) {
            switch (item.type) {
                case "spell":
                case "liturgy":
                case "ceremony":
                case "ritual":
                    apCost = DSA5_Utility._calculateAdvCost(0, item.data.StF.value, 0)
                    break
                case "blessing":
                case "magictrick":
                    apCost = 1
                    break
                case "magicalsign":
                    apCost = item.data.APValue.value
                    break
                default:
                    return
            }
            if (await this.actor.checkEnoughXP(apCost)) {
                await this._updateAPs(apCost)
                await this.actor.createEmbeddedDocuments("Item", [item])
            }
        }
    }

    async _addLoot(item) {
        item = duplicate(item)
        let res = this.actor.data.items.find(i => Itemdsa5.areEquals(item, i));
        if (!res) {
            if (this._tabs[0].active == "combat" && item.data.worn) item.data.worn.value = true

            return (await this.actor.createEmbeddedDocuments("Item", [item]))[0];
        } else {
            return (await Itemdsa5.stackItems(res, item, this.actor))[0]
        }
    }

    async _addUniqueItem(item) {
        item = duplicate(item)
        if (!this.actor.data.items.some(i => Itemdsa5.areEquals(item, i)))
            return (await this.actor.createEmbeddedDocuments("Item", [item]))[0];
    }

    async _addDemonMarkOrPatron(item) {
        return await this._addUniqueItem(item)
    }

    async _addDisease(item) {
        item.data.duration.resolved = "?"
        return await this._addUniqueItem(item)
    }

    async _addSkill(item) {
        item = duplicate(item)
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name && i.data.data.description.value == item.data.description.value);
        if (!res) await this.actor.createEmbeddedDocuments("Item", [item])
    }

    async _onDrop(event) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        this._handleDragData(dragData, event, await itemFromDrop(dragData, this.actor.id))
    }

    async handleItemCopy(item, typeClass) {
        if (DSA5.equipmentCategories.includes(typeClass)) {
            item.name += " (Copy)"
            return await this._addLoot(item)
        }
    }

    async _addFullPack(item) {
        let docs = await game.packs.get(item.name).getDocuments()
        let newAppls = docs.filter(x => !this.actor.items.find(y => y.type == x.type && y.name == x.name))
        await this.actor.createEmbeddedDocuments("Item", newAppls.map(x => x.toObject()))
    }

    async _manageDragItems(item, typeClass) {
        switch (typeClass) {
            case "disease":
                await this._addDisease(item)
                break
            case "meleeweapon":
            case "rangeweapon":
            case "equipment":
            case "ammunition":
            case "armor":
            case "poison":
            case "consumable":
            case "plant":
                return await this._addLoot(item)
            case "disadvantage":
            case "advantage":
                await this._addVantage(item, typeClass)
                break;
            case "specialability":
                await this._addSpecialAbility(item, typeClass)
                break;
            case "money":
                await this._addMoney(item)
                break;
            case "skill":
                await this._addSkill(item)
                break
            case "ritual":
            case "ceremony":
            case "blessing":
            case "magictrick":
            case "liturgy":
            case "spell":
            case "magicalsign":
                await this._addSpellOrLiturgy(item)
                break;
            case "effectwrapper":
                await this._handleEffectWrapper(item)
                break
            case "lookup":
                await this._handleLookup(item)
                break
            case "fullpack":
                await this._addFullPack(item)
                break
            case "application":
                await this._handleApplication(item)
                break
            case "spellextension":
                await this._handleSpellExtension(item)
                break
            case "condition":
                await this.actor.addCondition(item.payload.id, 1, false, false)
                break
            case "creature":
                const shapeshift = game.dsa5.config.hooks.shapeshift
                if (shapeshift) {
                    shapeshift.setShapeshift(this.actor, item)
                    shapeshift.render(true)
                    break
                }
            case "patron":
            case "demonmark":
                await this._addDemonMarkOrPatron(item)
                break
            default:
                ui.notifications.error(game.i18n.format("DSAError.canNotBeAdded", { item: item.name, category: game.i18n.localize(item.type) }))
        }
    }

    async _handleEffectWrapper(item) {
        this.actor.createEmbeddedDocuments("ActiveEffect", item.effects.map(x => {
            x.origin = null
            return x
        }))
    }

    async _handleLookup(item) {
        let lookup = (await DSA5_Utility.findAnyItem(item.items))
        if (lookup) {
            for (let thing of item.items) {
                if (thing.count) {
                    let elem = lookup.find(x => x.name == thing.name && x.type == thing.type)
                    elem.data.quantity.value = thing.count
                    if (thing.qs && thing.type == "equipment") elem.data.QL = thing.qs
                }
            }
            //we should improve that so it stacks items
            await this.actor.createEmbeddedDocuments("Item", lookup)
                //for (let thing of lookup) {
                //    await this._manageDragItems(thing, thing.type)
                //}
        } else {
            ui.notifications.error(game.i18n.format("DSAError.notFound", { category: thing.type, name: thing.name }))
        }
    }

    async _handleApplication(item) {
        item = duplicate(item)
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name);
        if (!res) await this.actor.createEmbeddedDocuments("Item", [item])
    }

    async _handleRemoveSourceOnDrop(dragData, item) {
        let sourceActor
        if (dragData.tokenId) sourceActor = game.actors.tokens[dragData.tokenId];
        if (!sourceActor) sourceActor = game.actors.get(dragData.actorId)

        if (sourceActor && sourceActor.isOwner) await sourceActor.deleteEmbeddedDocuments("Item", [item._id])
    }

    async _handleDragData(dragData, originalEvent, { item, typeClass, selfTarget }) {
        if (!item) return

        let container_id
        let parentItem = $(originalEvent.target).parents(".item")

        if (parentItem && parentItem.attr("data-category") == "bags" && DSA5.equipmentCategories.includes(typeClass)) {
            if (parentItem.attr("data-item-id") != item._id) {
                container_id = parentItem.attr("data-item-id")

                item.data.parent_id = container_id
                if (item.data.worn && item.data.worn.value)
                    item.data.worn.value = false
            }
        }

        if (originalEvent.ctrlKey && selfTarget) {
            await this.handleItemCopy(item, typeClass)
        } else if (!selfTarget) {
            await this._manageDragItems(item, typeClass)
        } else if (selfTarget && container_id) {
            await this.actor.updateEmbeddedDocuments("Item", [item])
        } else if (selfTarget && DSA5.equipmentCategories.includes(typeClass)) {
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: item._id, data: { parent_id: 0 } }])
        }

        if (originalEvent.altKey && !selfTarget && DSA5.equipmentCategories.includes(typeClass))
            await this._handleRemoveSourceOnDrop(dragData, item)

    }
}