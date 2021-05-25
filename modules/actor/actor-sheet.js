import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5ChatListeners from "../system/chat_listeners.js";
import DSA5StatusEffects from "../status/status_effects.js";
import DialogActorConfig from "../dialog/dialog-actorConfig.js";

export default class ActorSheetDsa5 extends ActorSheet {
    static equipment = ["meleeweapon", "rangeweapon", "equipment", "ammunition", "armor", "poison", "consumable"]

    get actorType() {
        return this.actor.data.type;
    }

    async _render(force = false, options = {}) {
       // this._saveScrollPos();
        this._saveSearchFields()
        this._saveCollapsed()
        await super._render(force, options);
        this._setCollapsed()
        //this._setScrollPos();
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
            searchText: $(html.find(".talentSearch")).val()
        }
    }

    _restoreSeachFields() {
        if (this.searchFields != undefined) {
            const html = $(this.form).parent();
            if (this.searchFields.talentFiltered) {
                $(html.find(".filterTalents")).addClass("filtered")
                $(html.find(".allTalents")).removeClass("showAll")
            }
            let talentSearchInput = $(html.find(".talentSearch"))
            talentSearchInput.val(this.searchFields.searchText)
            if (this.searchFields.searchText != "") {
                this._filterTalents(talentSearchInput)
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
        for (const detail of $(html.find('.expandDetails.shown'))){
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
        const sheetData = { actor: baseData.actor.data }
        const prepare = this.actor.prepareSheet({details: this.openDetails})
        mergeObject(sheetData.actor, prepare)

        sheetData.isGM = game.user.isGM;
        sheetData["initDies"] = { "-": "", "1d6": "1d6", "2d6": "2d6", "3d6": "3d6", "4d6": "d6" }
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
        let itemId = this._getItemId(ev);
        let aggregated = duplicate(this.actor.items.find(i => i.data._id == itemId));
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
                        this.actor.items.find(i => i.data._id == itemId).postItem()
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
        let advances = Number(this.actor.data.data.characteristics[attr].advances) + Number(this.actor.data.data.characteristics[attr].initial)
        let cost = DSA5_Utility._calculateAdvCost(advances, "E")
        if (await this._checkEnoughXP(cost)) {
            let attrJs = `data.characteristics.${attr}.advances`
            await this.actor.update({
                [attrJs]: Number(this.actor.data.data.characteristics[attr].advances) + 1,
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) + cost
            })
        }
    }

    async _refundAttributeAdvance(attr) {
        let advances = Number(this.actor.data.data.characteristics[attr].advances) + Number(this.actor.data.data.characteristics[attr].initial)
        if (Number(this.actor.data.data.characteristics[attr].advances) > 0) {
            let cost = DSA5_Utility._calculateAdvCost(advances, "E", 0)
            let attrJs = `data.characteristics.${attr}.advances`
            await this.actor.update({
                [attrJs]: Number(this.actor.data.data.characteristics[attr].advances) - 1,
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) - cost
            })
        }
    }

    async _advancePoints(attr) {
        let advances = Number(this.actor.data.data.status[attr].advances)
        let cost = DSA5_Utility._calculateAdvCost(advances, "D")
        if (await this._checkEnoughXP(cost) && this._checkMaximumPointAdvancement(attr, advances + 1)) {
            let attrJs = `data.status.${attr}.advances`
            await this.actor.update({
                [attrJs]: Number(this.actor.data.data.status[attr].advances) + 1,
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) + cost
            })
        }
    }

    async _refundPointsAdvance(attr) {
        let advances = Number(this.actor.data.data.status[attr].advances)
        if (advances > 0) {
            let cost = DSA5_Utility._calculateAdvCost(advances, "D", 0)
            let attrJs = `data.status.${attr}.advances`
            await this.actor.update({
                [attrJs]: Number(this.actor.data.data.status[attr].advances) - 1,
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) - cost
            })
        }
    }

    async _advanceItem(itemId) {
        let item = duplicate(this.actor.items.find(i => i.data._id == itemId))
        let cost = DSA5_Utility._calculateAdvCost(Number(item.data.talentValue.value), item.data.StF.value)
        if (await this._checkEnoughXP(cost) && this._checkMaximumItemAdvancement(item, Number(item.data.talentValue.value) + 1)) {
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.talentValue.value": item.data.talentValue.value + 1 }])
            await this.actor.update({ "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) + cost })
        }
    }

    async _refundItemAdvance(itemId) {
        let item = duplicate(this.actor.items.find(i => i.data._id == itemId))
        if (item.data.talentValue.value > 0) {
            let cost = DSA5_Utility._calculateAdvCost(Number(item.data.talentValue.value), item.data.StF.value, 0)
            await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "data.talentValue.value": item.data.talentValue.value - 1 }])
            await this.actor.update({ "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) - cost })
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
            case "liturgy":
            case "ceremony":
                result = newValue <= 14 + AdvantageRulesDSA5.vantageStep(this.actor, `${game.i18n.localize('LocalizedIDs.exceptionalSkill')} (${item.name})`)
                break
            case "skill":
                result = newValue <= Math.max(...[this.actor.data.data.characteristics[item.data.characteristic1.value].value, this.actor.data.data.characteristics[item.data.characteristic2.value].value, this.actor.data.data.characteristics[item.data.characteristic3.value].value]) + 2 + AdvantageRulesDSA5.vantageStep(this.actor, `${game.i18n.localize('LocalizedIDs.exceptionalSkill')} (${item.name})`)
                break
        }
        if (!result)
            ui.notifications.error(game.i18n.localize("DSAError.AdvanceMaximumReached"))

        return result
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
        }, {
            class: "actorConfig",
            icon: `fas fa-link`,
            onclick: async() => this._configActor()
        })
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

    activateListeners(html) {
        super.activateListeners(html);

        let posthand = ev => { this.actor.items.find(i => i.data._id == this._getItemId(ev)).postItem() }

        html.find('.schip').click(ev => {
            ev.preventDefault()
            let val = Number(ev.currentTarget.getAttribute("data-val"))
            let elem = $(this.form).parent().find('[name="data.status.fatePoints.value"]')

            if (val == 1 && $(this.form).find(".fullSchip").length == 1) val = 0

            elem.val(val)
            elem.trigger("change")
        })

        html.find('.ammo-selector').change(async(ev) => {
            ev.preventDefault()
            let itemId = this._getItemId(ev);
            let item = (await this.actor.getEmbeddedDocument("Item", itemId)).toObject()
            item.data.currentAmmo.value = $(ev.currentTarget).val()
            await this.actor.updateEmbeddedDocuments("Item", [item]);
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
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedDocument("Item", itemId))

            switch (item.type) {
                case "armor":
                case "rangeweapon":
                case "meleeweapon":
                case "equipment":
                    this.actor.updateEmbeddedDocuments("Item", [{ _id: item._id, "data.worn.value": !item.data.worn.value }]);
                    break;
            }

        });

        html.find(".status-create").click(ev => {
            let menu = $(ev.currentTarget).closest(".statusEffectMenu").find('ul')
            menu.fadeIn('fast', function() {
                menu.find('input').focus()
            })
        })
        html.find(".statusEffectMenu ul").mouseleave(ev => {
            $(ev.currentTarget).fadeOut()
        })
        html.find(".status-add").click(async(ev) => {
            let status = $(ev.currentTarget).attr("data-id")
            if (status == "custom") {
                DSA5StatusEffects.createCustomEffect(this.actor)
            } else
                await this.actor.addCondition(status, 1, false, false)
        })

        html.find('.roll-aggregated').mousedown(ev => {
            this._handleAggregatedProbe(ev)
        })

        html.find('.skill-select').mousedown(ev => {
            let itemId = this._getItemId(ev);
            let skill = this.actor.items.find(i => i.data._id == itemId);

            if (ev.button == 0)
                this.actor.setupSkill(skill.data, {}, this.getTokenId()).then(setupData => {
                    this.actor.basicTest(setupData)
                });
            else if (ev.button == 2)
                skill.sheet.render(true);
        });

        html.find(".advance-attribute").mousedown(ev => {
            this.advanceWrapper(ev, "_advanceAttribute", $(ev.currentTarget).attr("data-attr"))
        })
        html.find(".refund-attribute").mousedown(ev => {
            this.advanceWrapper(ev, "_refundAttributeAdvance", $(ev.currentTarget).attr("data-attr"))
        })
        html.find(".advance-item").mousedown(ev => {
            this.advanceWrapper(ev, "_advanceItem", this._getItemId(ev))
        })
        html.find(".refund-item").mousedown(ev => {
            this.advanceWrapper(ev, "_refundItemAdvance", this._getItemId(ev))
        })
        html.find(".advance-points").mousedown(ev => {
            this.advanceWrapper(ev, "_advancePoints", $(ev.currentTarget).attr("data-attr"))
        })
        html.find(".refund-points").mousedown(ev => {
            this.advanceWrapper(ev, "_refundPointsAdvance", $(ev.currentTarget).attr("data-attr"))
        })
        html.find('.spell-select').mousedown(ev => {
            let itemId = this._getItemId(ev);
            let skill = this.actor.items.find(i => i.data._id == itemId);

            if (ev.button == 0)
                this.actor.setupSpell(skill.data, {}, this.getTokenId()).then(setupData => {
                    this.actor.basicTest(setupData)
                });

            else if (ev.button == 2)
                skill.sheet.render(true);
        });

        html.find('.quantity-click').mousedown(ev => {
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedDocument("Item", itemId));
            let factor = ev.ctrlKey ? 10 : 1
            switch (ev.button) {
                case 0:
                    item.data.quantity.value += factor;
                    break;
                case 2:
                    item.data.quantity.value -= factor

                    if (item.data.quantity.value < 0)
                        item.data.quantity.value = 0;
                    break;
            }
            this.actor.updateEmbeddedDocuments("Item", [item]);
        });

        html.find(".item-post").click(ev => {
            posthand(ev)
        });

        html.find('.item-dropdown').click(ev => {
            ev.preventDefault()
            $(ev.currentTarget).closest('.item').find('.expandDetails:first').toggleClass('shown')
        })

        html.find('.condition-show').mousedown(ev => {
            ev.preventDefault()
            let id = ev.currentTarget.getAttribute("data-id")
            let descriptor = $(ev.currentTarget).parents(".statusEffect").attr("data-descriptor")
            if (ev.button == 0) {
                let effect
                let text
                if (descriptor) {
                    let effect = CONFIG.statusEffects.find(x => x.id == descriptor)
                    text = $(`<div style="padding:5px;"><b><a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.icon}"/>${game.i18n.localize(effect.label)}</a></b>: ${game.i18n.localize(effect.description)}</div>`)
                    text.find('.chat-condition').on('click', ev => {
                        DSA5ChatListeners.postStatus($(ev.currentTarget).attr('data-id'))
                    })
                } else {
                    //search temporary effects
                    effect = this.actor.data.effects.find(x => x.id == id)
                    if (effect) {
                        text = $(`<div style="padding:5px;"><b><a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.icon}"/>${game.i18n.localize(effect.label)}</a></b>: ${game.i18n.localize(effect.data.flags.dsa5.description)}</div>`)
                    }
                }
                let elem = $(ev.currentTarget).closest('.groupbox').find('.effectDescription')
                elem.fadeOut('fast', function() {
                    elem.html(text).fadeIn('fast')
                })
            } else if (ev.button == 2 && !ev.currentTarget.getAttribute("data-locked")) {
                this._deleteActiveEffect(id)
            }
        })

        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })

        html.find('.money-change').change(async ev => {
            let itemId = this._getItemId(ev);
            let itemToEdit = duplicate(this.actor.getEmbeddedDocument("Item", itemId))
            itemToEdit.data.quantity.value = Number(ev.target.value);
            await this.actor.updateEmbeddedDocuments("Item", [itemToEdit]);
            this.currentFocus = $(document.activeElement).closest('.item').attr('data-item-id');;
        })

        html.find('.skill-advances').change(async ev => {
            let itemId = this._getItemId(ev);
            let itemToEdit = duplicate(this.actor.getEmbeddedDocument("Item", itemId))
            itemToEdit.data.talentValue.value = Number(ev.target.value);
            await this.actor.updateEmbeddedDocuments("Item", [itemToEdit]);
            this.currentFocus = $(document.activeElement).closest('.row-section').attr('data-item-id');;
        });

        html.find('.item-edit').click(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev);
            const item = this.actor.items.find(i => i.data._id == itemId)
            item.sheet.render(true);
        });

        html.find(".consume-item").mousedown(ev => {
            if (ev.button == 2) {
                let itemId = this._getItemId(ev);
                const item = this.actor.items.find(i => i.data._id == itemId)
                this.consumeItem(item)
            }
        })

        html.find('.ch-value').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupCharacteristic(characteristic, {}, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });
        html.find('.ch-status').click(event => {
            event.preventDefault();
            this.actor.setupDodge({}, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });
        html.find('.ch-regenerate').click(event => {
            event.preventDefault();
            this.actor.setupRegeneration("regenerate", {}, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-weaponless').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupWeaponless(characteristic, {}, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.item-create').click(ev => this._onItemCreate(ev));

        html.find('.ch-rollCombat').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const mode = $(event.currentTarget).attr("data-mode")
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeapon(item, mode, {}, this.getTokenId()).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        let deletehand = ev => this._deleteItem(ev);

        html.find(".cards .item").mouseenter(ev => {
            if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
                let div = document.createElement('div')
                div.classList.add("hovermenu")
                let del = document.createElement('i')
                del.classList.add("fas", "fa-times")
                del.title = game.i18n.localize('SHEET.DeleteItem')
                del.addEventListener('click', deletehand, false)
                let post = document.createElement('i')
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
            if (e.parentNode == this || e == this)
                return;

            ev.currentTarget.querySelectorAll('.hovermenu').forEach(e => e.remove());
        });

        let handler = ev => this._onDragItemStart(ev);
        html.find('.content .item').each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", handler, false);
        });

        html.find('.item-delete').click(ev => {
            this._deleteItem(ev)
        });

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

        html.find(".condition-toggle").mousedown(ev => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-id")
            let ef = this.actor.effects.get(condKey)
            ef.update({ disabled: !ef.data.disabled })
        })

        html.find('.talentSearch').keyup(event => {
            this._filterTalents($(event.currentTarget))
        });

        html.find('.charimg').mousedown(ev => {
            if (ev.button == 2) DSA5_Utility.showArtwork(this.actor)
        })

        let filterTalents = ev => this._filterTalents($(ev.currentTarget))
        let talSearch = html.find('.talentSearch')
        talSearch[0] && talSearch[0].addEventListener("search", filterTalents, false);

        html.find('.conditionSearch').keyup(event => {
            this._filterConditions($(event.currentTarget))
        });
        let filterConditions = ev => this._filterConditions($(ev.currentTarget))
        let condSearch = html.find('.conditionSearch')
        condSearch[0] && condSearch[0].addEventListener("search", filterConditions, false);
    }

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
        let item = this.actor.data.effects.find(x => x.id == id)

        if (item) {
            let actor = this.actor
            if (this.token) actor = this.token.actor

            if (actor) await this.actor.deleteEmbeddedDocuments("ActiveEffect", [item.id])

            Hooks.call("deleteActorActiveEffect", this.actor, item)
        }
    }

    _deleteItem(ev) {
        let itemId = this._getItemId(ev);
        let item = this.actor.data.items.find(x => x.id == itemId)
        let message = game.i18n.format("DIALOG.DeleteItemDetail", { item: item.name })
        renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html', { message: message }).then(html => {
            new Dialog({
                title: game.i18n.localize("Delete Confirmation"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: dlg => {
                            this._cleverDeleteItem(itemId)
                        }
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
        let item = this.actor.data.items.find(x => x.id == itemId)
        let steps, xpCost
        switch (item.type) {
            case "advantage":
            case "disadvantage":
                await AdvantageRulesDSA5.vantageRemoved(this.actor, item)
                xpCost = item.data.data.APValue.value * item.data.data.step.value
                if (/;/.test(item.data.data.APValue.value)) {
                    steps = item.data.data.APValue.value.split(";").map(x => Number(x.trim()))
                    xpCost = 0
                    for (let i = 0; i < item.data.data.step.value; i++)
                        xpCost += steps[i]
                }
                await this._updateAPs(-1 * xpCost)
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
                //TODO improve ap cost calculation
                let apVal = DSA5_Utility._calculateAdvCost(0, item.data.data.StF.value, 0)
                let extensions = this.actor.data.items.filter(i => i.type == "spellextension" && item.type == i.data.data.category && item.name == i.data.data.source)
                if (extensions) {
                    apVal += extensions.reduce((a, b) => { return a + b.data.data.APValue.value }, 0)
                    await this.actor.deleteEmbeddedDocuments("Item", extensions.map(x => x.id))
                }
                await this._updateAPs(apVal * -1)
                break
        }
        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
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

    async _updateAPs(APValue) {
        await this.actor._updateAPs(APValue)
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
        const item = itemId ? duplicate(this.actor.getEmbeddedDocument("Item", itemId)) : {}

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

            return await this.actor.createEmbeddedDocuments("Item", [item])[0];
        } else {
            return await Itemdsa5.stackItems(res, item, this.actor)[0]
        }
    }

    async _addSkill(item) {
        item = duplicate(item)
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name && i.data.data.description.value == item.data.description.value);
        if (!res) {
            await this.actor.createEmbeddedDocuments("Item", [item]);
        }
    }

    async _onDrop(event) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        this._handleDragData(dragData, event, await this._itemFromDrop(dragData, event))
    }

    async handleItemCopy(item, typeClass) {

        if (ActorSheetDsa5.equipment.includes(typeClass)) {
            item.name += " (Copy)"
            return await this._addLoot(item)
        }
    }

    async _manageDragItems(item, typeClass) {
        switch (typeClass) {
            case "meleeweapon":
            case "rangeweapon":
            case "equipment":
            case "ammunition":
            case "armor":
            case "poison":
            case "consumable":
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
                await this._addSpellOrLiturgy(item)
                break;
            case "lookup":
                await this._handleLookup(item)
                break
            case "spellextension":
                await this._handleSpellExtension(item)
                break
            case "condition":
                await this.actor.addCondition(item.payload.id)
                break
            case "creature":
                const shapeshift = game.dsa5.config.hooks.shapeshift
                if (shapeshift) {
                    shapeshift.setShapeshift(this.actor, item)
                    shapeshift.render(true)
                    break
                }
            default:
                ui.notifications.error(game.i18n.format("DSAError.canNotBeAdded", { item: item.name, category: game.i18n.localize(item.type) }))
        }
    }

    async _handleLookup(item) {
        let lookup = await DSA5_Utility.findAnyItem(item.items)
        if (lookup) {
            for (let thing of item.items) {
                if (thing.count) {
                    let elem = lookup.find(x => x.name == thing.name && x.type == thing.type)
                    elem.data.quantity.value = thing.count
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

    async _handleRemoveSourceOnDrop(dragData, item) {
        let sourceActor
        if (dragData.tokenId) sourceActor = game.actors.tokens[dragData.tokenId];
        if (!sourceActor) sourceActor = game.actors.get(dragData.actorId)

        if (sourceActor && sourceActor.isOwner) sourceActor.deleteEmbeddedDocuments("Item", [item._id])
    }

    async _itemFromDrop(dragData, originalEvent){
        let item
        let typeClass
        let selfTarget = dragData.actorId && dragData.actorId == this.actor.id

        if (dragData.id && dragData.pack) {
            item = await DSA5_Utility.findItembyIdAndPack(dragData.id, dragData.pack);
            typeClass = item.data.type
        } else if (dragData.id && dragData.type == "Actor") {
            item = DSA5_Utility.findActorbyId(dragData.id);
            typeClass = item.data.type
        } else if (dragData.id) {
            item = DSA5_Utility.findItembyId(dragData.id);
            typeClass = item.data.type
        } else {
            item = dragData.data
            typeClass = item.type
        }

        //TODO might not need the creature filter here
        // also might use ToObject(false)
        if (typeof item.toObject === 'function' && typeClass != 'creature'){
            item = item.toObject(true)
        }

        return {item, typeClass, selfTarget}
    }

    async _handleDragData(dragData, originalEvent, {item, typeClass, selfTarget}) {
        if(!item) return

        let container_id
        let parentItem = $(originalEvent.target).parents(".item")
        while (parentItem.parents(".item").attr("data-category") == "bags"){
            parentItem = parentItem.parents(".item")
        }
        if (parentItem && parentItem.attr("data-category") == "bags" && ActorSheetDsa5.equipment.includes(typeClass)) {
            if (parentItem.attr("data-item-id") != item._id) {
                container_id = parentItem.attr("data-item-id")

                item.data.parent_id = container_id
                if(item.data.worn && item.data.worn.value)
                    item.data.worn.value = false
            }
        }

        if (originalEvent.ctrlKey && selfTarget) {
            await this.handleItemCopy(item, typeClass)
        } else if(!selfTarget) {
            await this._manageDragItems(item, typeClass)
        } else if (selfTarget && container_id){
            await this.actor.updateEmbeddedDocuments("Item", [item])
        } else if (selfTarget && ActorSheetDsa5.equipment.includes(typeClass)){
            await this.actor.updateEmbeddedDocuments("Item",[ { _id: item._id, data: {parent_id: 0}}])
        }

        if (container_id && getProperty(item, "data.equipmentType.value") == "bags"){
            let itemsToMove = this.actor.items.filter(x => ActorSheetDsa5.equipment.includes(x.type) && x.data.data.parent_id == item._id)
            await this.actor.updateEmbeddedDocuments("Item", itemsToMove.map(x=> {return {_id: x.id, data: {parent_id: container_id}}}))
        }

        if (originalEvent.altKey && !selfTarget && ActorSheetDsa5.equipment.includes(typeClass))
            await this._handleRemoveSourceOnDrop(dragData, item)

    }
}