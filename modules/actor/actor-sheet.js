import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5ChatListeners from "../system/chat_listeners.js";


export default class ActorSheetDsa5 extends ActorSheet {

    get actorType() {
        return this.actor.data.type;
    }

    async _render(force = false, options = {}) {
        this._saveScrollPos();
        this._saveSearchFields()
        this._saveCollapsed()
        await super._render(force, options);
        this._setCollapsed()
        this._setScrollPos();
        this._restoreSeachFields()

        $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".configure-token").attr("title", game.i18n.localize("SHEET.Token"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
        $(this._element).find(".locksheet").attr("title", game.i18n.localize("SHEET.Lock"));
        $(this._element).find(".library").attr("title", game.i18n.localize("SHEET.Library"));

        if (this.currentFocus) {
            $(this._element).find('[data-item-id="' + this.currentFocus + '"] input').focus().select();
            this.currentFocus = null;
        }
    }

    static
    get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "skills" }]
        mergeObject(options, {
            width: 770,
            height: 740
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
        let boxes = $(html.find(".ch-collapse i"));
        for (let box of boxes) {
            this.collapsedBoxes.push($(box).attr("class"));
        }
    }

    _setCollapsed() {
        if (this.collapsedBoxes) {
            const html = $(this.form).parent();
            let boxes = $(html.find(".ch-collapse i"));
            for (let i = 0; i < boxes.length; i++) {
                $(boxes[i]).attr("class", this.collapsedBoxes[i]);
                if (this.collapsedBoxes[i].indexOf("fa-angle-down") != -1)
                    $(boxes[i]).closest('.groupbox').find('.row-section:nth-child(2)').hide()
            }
        }
    }

    _saveScrollPos() {
        if (this.form === null)
            return;

        const html = $(this.form).parent();
        this.scrollPos = [];
        let lists = $(html.find(".save-scroll"));
        for (let list of lists) {
            this.scrollPos.push($(list).scrollTop());
        }
    }

    _setScrollPos() {
        if (this.scrollPos) {
            const html = $(this.form).parent();
            let lists = $(html.find(".save-scroll"));
            for (let i = 0; i < lists.length; i++) {
                $(lists[i]).scrollTop(this.scrollPos[i]);
            }
        }
    }

    getData() {
        const sheetData = super.getData();
        mergeObject(sheetData.actor, this.actor.prepare())
        sheetData.isGM = game.user.isGM;
        this._addDefaultActiveEffects(sheetData)
        return sheetData;
    }

    _addDefaultActiveEffects(data) {
        let conditions = duplicate(CONFIG.statusEffects) //.filter(x => x.flags.dsa5.editable)
        for (let condition of conditions) {
            let existing = this.actor.data.effects.find(e => e.flags.core != undefined && e.flags.core.statusId == condition.id)
            condition.editable = condition.flags.dsa5.editable

            if (condition.flags.dsa5.value == null)
                condition.boolean = true;

            if (existing) {
                condition.value = existing.flags.dsa5.value
                condition.existing = true
                condition.manual = existing.flags.dsa5.manual
            } else {
                condition.value = 0;
                condition.existing = false
            }
        }
        data.conditions = conditions.filter(x => x.existing)
        data.manualConditions = conditions.filter(x => !x.existing)
    }


    _onItemCreate(event) {
        event.preventDefault();
        let header = event.currentTarget,
            data = duplicate(header.dataset);

        if (DSA5.equipmentTypes[data.type]) {
            data.type = "equipment"
            data = mergeObject(data, {
                "data.equipmentType.value": event.currentTarget.attributes["item-section"].value
            })
        }
        if (data.type == "aggregatedTest") {} else if (data.type == "spell" || data.type == "liturgy") {} else {
            data["data.weight.value"] = 0
            data["data.quantity.value"] = 0
        }

        Itemdsa5.defaultIcon(data)
        data["name"] = game.i18n.localize(data.type);
        this.actor.createEmbeddedEntity("OwnedItem", data);
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
            this.actor.setupSkill(skill.data, { moreModifiers: [{ name: game.i18n.localize("failedTests"), value: -1 * aggregated.data.previousFailedTests.value, selected: true }] }).then(setupData => {
                this.actor.basicTest(setupData).then(res => {
                    if (res.result.successLevel > 0) {
                        aggregated.data.cummulatedQS.value = res.result.qualityStep + aggregated.data.cummulatedQS.value
                        aggregated.data.cummulatedQS.value = Math.min(10, aggregated.data.cummulatedQS.value)
                    } else {
                        aggregated.data.previousFailedTests.value += 1
                    }
                    aggregated.data.usedTestCount.value += 1
                    this.actor.updateEmbeddedEntity("OwnedItem", aggregated).then(x =>
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
                    callback: dlg => {
                        item.setupEffect(null, {})
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
            item.data.talentValue.value += 1
            await this.actor.update({
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) + cost
            })
            await this.actor.updateEmbeddedEntity("OwnedItem", item)
        }
    }

    async _refundItemAdvance(itemId) {
        let item = duplicate(this.actor.items.find(i => i.data._id == itemId))
        if (item.data.talentValue.value > 0) {
            let cost = DSA5_Utility._calculateAdvCost(Number(item.data.talentValue.value), item.data.StF.value, 0)
            item.data.talentValue.value -= 1
            await this.actor.update({
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) - cost
            })
            await this.actor.updateEmbeddedEntity("OwnedItem", item)
        }
    }

    _checkMaximumPointAdvancement(attr, newValue) {
        let result = false
        switch (attr) {
            case "wounds":
                result = newValue <= this.actor.data.data.characteristics["ko"].value
                break
            case "astralenergy":
                result = newValue <= (this.actor.data.data.characteristics[this.actor.data.data.guidevalue.magical] == undefined ? 0 : this.actor.data.data.characteristics[this.actor.data.data.guidevalue.magical].value)
                break
            case "karmaenergy":
                result = newValue <= (this.actor.data.data.characteristics[this.actor.data.data.guidevalue.clerical] == undefined ? 0 : this.actor.data.data.characteristics[this.actor.data.data.guidevalue.clerical].value)
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

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.actor.data.canAdvance) {
            buttons.unshift({
                class: "library",
                icon: `fas fa-university`,
                onclick: async ev => this._openLibrary(ev)
            })
            buttons.unshift({
                class: "locksheet",
                icon: `fas fa-${this.actor.data.data.sheetLocked.value ? "" : "un"}lock`,
                onclick: async ev => this._changeAdvanceLock(ev)
            })

        }
        return buttons
    }

    async _changeAdvanceLock(ev) {
        this.actor.update({ "data.sheetLocked.value": !this.actor.data.data.sheetLocked.value })
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

        html.find('.ammo-selector').change(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            item.data.currentAmmo.value = $(ev.currentTarget).val()
            this.actor.updateEmbeddedEntity("OwnedItem", item);
        })

        html.find('.ch-collapse').click(ev => {
            $(ev.currentTarget).find('i').toggleClass("fa-angle-up fa-angle-down")
            $(ev.currentTarget).closest(".groupbox").find('.row-section:nth-child(2)').fadeToggle()
        })

        html.find('.item-toggle').click(ev => {
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))

            switch (item.type) {
                case "armor":
                case "rangeweapon":
                case "meleeweapon":
                    item.data.worn.value = !item.data.worn.value;
                    break;
            }
            this.actor.updateEmbeddedEntity("OwnedItem", item);
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
        html.find(".status-add").click(ev => {
            this.actor.addCondition($(ev.currentTarget).attr("data-id"), 1, false, false)
        })

        html.find('.roll-aggregated').mousedown(ev => {
            this._handleAggregatedProbe(ev)
        })

        html.find('.skill-select').mousedown(ev => {
            let itemId = this._getItemId(ev);
            let skill = this.actor.items.find(i => i.data._id == itemId);

            if (ev.button == 0)
                this.actor.setupSkill(skill.data).then(setupData => {
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
                this.actor.setupSpell(skill.data).then(setupData => {
                    this.actor.basicTest(setupData)
                });

            else if (ev.button == 2)
                skill.sheet.render(true);
        });

        html.find('.quantity-click').mousedown(ev => {
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId));
            switch (ev.button) {
                case 0:
                    if (ev.ctrlKey)
                        item.data.quantity.value += 10;
                    else
                        item.data.quantity.value++;
                    break;
                case 2:
                    if (ev.ctrlKey)
                        item.data.quantity.value -= 10;
                    else
                        item.data.quantity.value--;

                    if (item.data.quantity.value < 0)
                        item.data.quantity.value = 0;
                    break;
            }
            this.actor.updateEmbeddedEntity("OwnedItem", item);
        });

        html.find(".item-post").click(ev => {
            posthand(ev)
        });

        html.find('.item-dropdown').click(ev => {
            ev.preventDefault()
            $(ev.currentTarget).closest('.item').find('.expandDetails').fadeToggle()
        })

        html.find('.condition-show').mousedown(ev => {
            ev.preventDefault()
            let id = ev.currentTarget.getAttribute("data-id")
            if (ev.button == 0) {
                let effect = CONFIG.statusEffects.find(x => x.id == id)
                if (effect) {
                    let text = $(`<div style="padding:5px;"><b><a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.icon}"/>${game.i18n.localize(effect.label)}</a></b>: ${game.i18n.localize(effect.description)}</div>`)
                    text.find('.chat-condition').on('click', ev => {
                        DSA5ChatListeners.postStatus($(ev.currentTarget).attr('data-id'))
                    })
                    let elem = $(ev.currentTarget).closest('.groupbox').find('.effectDescription')
                    elem.fadeOut('fast', function() {
                        elem.html(text).fadeIn('fast')
                    })

                } else {
                    //search temporary effects
                }
            } else if (ev.button == 2) {
                this._deleteActiveEffect(id)
            }
        })

        html.find('.money-change').change(async ev => {
            let itemId = this._getItemId(ev);
            let itemToEdit = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            itemToEdit.data.quantity.value = Number(ev.target.value);
            await this.actor.updateEmbeddedEntity("OwnedItem", itemToEdit);
            this.currentFocus = $(document.activeElement).closest('.item').attr('data-item-id');;
        })

        html.find('.skill-advances').change(async ev => {
            let itemId = this._getItemId(ev);
            let itemToEdit = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            itemToEdit.data.talentValue.value = Number(ev.target.value);
            await this.actor.updateEmbeddedEntity("OwnedItem", itemToEdit);
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
            this.actor.setupCharacteristic(characteristic, event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });
        html.find('.ch-status').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupStatus(characteristic, event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });
        html.find('.ch-regenerate').click(event => {
            event.preventDefault();
            this.actor.setupRegeneration("regenerate", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-weaponless').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupWeaponless(characteristic, event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-combatskill-attack').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupCombatskill(item, "attack", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-combatskill-parry').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupCombatskill(item, "parry", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.item-create').click(ev => this._onItemCreate(ev));

        html.find('.ch-rollCombatParry').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeapon(item, "parry", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-rollCombat').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeapon(item, "attack", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        html.find('.ch-rollDamage').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeapon(item, "damage", event).then(setupData => {
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

        html.find(".condition-value").mousedown(ev => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-id")
            if (ev.button == 0)
                this.actor.addCondition(condKey, 1, false, false)
            else if (ev.button == 2)
                this.actor.removeCondition(condKey, 1, false)
        })

        html.find(".condition-toggle").mousedown(ev => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-id")

            if (CONFIG.statusEffects.find(e => e.id == condKey).flags.dsa5.value == null) {
                if (this.actor.hasCondition(condKey))
                    this.actor.removeCondition(condKey)
                else
                    this.actor.addCondition(condKey)
                return
            }

            if (ev.button == 0)
                this.actor.addCondition(condKey, 1, false, false)
            else if (ev.button == 2)
                this.actor.removeCondition(condKey, 1, false)
        })

        html.find('.talentSearch').keyup(event => {
            this._filterTalents($(event.currentTarget))
        });
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

    _deleteActiveEffect(id) {
        let item = this.actor.data.effects.find(x => x.flags.core.statusId == id)
        if (item)
            this.actor.deleteEmbeddedEntity("ActiveEffect", item._id)
    }

    _deleteItem(ev) {
        let itemId = this._getItemId(ev);
        let item = this.actor.data.items.find(x => x._id == itemId)
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
        let item = this.actor.data.items.find(x => x._id == itemId)
        let steps, xpCost
        switch (item.type) {
            case "advantage":
            case "disadvantage":
                await AdvantageRulesDSA5.vantageRemoved(this.actor, item)
                xpCost = item.data.APValue.value * item.data.step.value
                if (/;/.test(item.data.APValue.value)) {
                    steps = item.data.APValue.value.split(";").map(x => Number(x.trim()))
                    xpCost = 0
                    for (let i = 0; i < item.data.step.value; i++)
                        xpCost += steps[i]
                }
                await this._updateAPs(-1 * xpCost)
                break;
            case "specialability":
                await SpecialabilityRulesDSA5.abilityRemoved(this.actor, item)
                break;
            case "blessing":
            case "magictrick":
                this._updateAPs(-1)
                break
            case "ritual":
            case "ceremony":
            case "liturgy":
            case "spell":
                let apVal = DSA5_Utility._calculateAdvCost(0, item.data.StF.value, 0)
                let extensions = this.actor.data.items.filter(i => i.type == "spellextension" && item.type == i.data.category && item.name == i.data.source)
                if (extensions) {
                    apVal += extensions.reduce((a, b) => { return a + b.data.APValue.value }, 0)
                    await this.actor.deleteEmbeddedEntity("OwnedItem", extensions.map(x => x._id))
                }
                this._updateAPs(apVal * -1)
                break
        }
        this.actor.deleteEmbeddedEntity("OwnedItem", itemId);
    }


    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

    async _addMoney(item) {
        let money = duplicate(this.actor.data.items.filter(i => i.type == "money"));
        let moneyItem = money.find(i => i.name == item.name)

        if (moneyItem) {
            moneyItem.data.quantity.value += item.data.quantity.value
            await this.actor.updateEmbeddedEntity("OwnedItem", moneyItem);
        } else {
            await this.actor.createEmbeddedEntity("OwnedItem", item);
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
        const item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "Item",
            sheetTab: this.actor.data.flags["_sheetTab"],
            actorId: this.actor._id,
            tokenId: this.token ? this.token.data._id : null,
            mod: mod,
            data: item,
            root: tar.getAttribute("root")
        }));
        event.stopPropagation()
    }

    async _handleSpellExtension(item) {
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name);
        item = duplicate(item)
        if (!res) {
            let spell = this.actor.data.items.find(i => i.type == item.data.category && i.name == item.data.source)
            if (!spell) {
                ui.notifications.error(game.i18n.localize("DSAError.noSpellForExtension"))
            } else {
                if (spell.data.talentValue.value < item.data.talentValue) {
                    ui.notifications.error(game.i18n.localize("DSAError.talentValueTooLow"))
                    return
                }
                let apCost = item.data.APValue.value
                if (await this.actor.checkEnoughXP(apCost)) {
                    this._updateAPs(apCost)
                    await this.actor.createEmbeddedEntity("OwnedItem", item)
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
                this._updateAPs(apCost)
                await this.actor.createEmbeddedEntity("OwnedItem", item)
            }
        }
    }

    async _addLoot(item) {
        item = duplicate(item)
        let res = this.actor.data.items.find(i => Itemdsa5.areEquals(item, i));
        if (!res) {
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        } else {
            Itemdsa5.stackItems(res, item, this.actor)
        }
    }

    async _addSkill(item) {
        item = duplicate(item)
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name && i.data.description.value == item.data.description.value);
        if (!res) {
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        }
    }

    async _onDrop(event) {
        this._handleDragData(JSON.parse(event.dataTransfer.getData("text/plain")), event)
    }

    handleItemCopy(item, typeClass) {
        if (["meleeweapon", "rangeweapon", "equipment", "ammunition", "armor", "poison"].includes(typeClass)) {
            item.name += " (Copy)"
            this._addLoot(item)
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
                await this._addLoot(item)
                break;
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
                this.actor.addCondition(item.payload.id)
                break
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
                    elem.data.data.quantity.value = thing.count
                }
            }
            //we should improve that so it stacks items
            await this.actor.createEmbeddedEntity("OwnedItem", lookup)
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

        if (sourceActor && sourceActor.permission == ENTITY_PERMISSIONS.OWNER) sourceActor.deleteEmbeddedEntity("OwnedItem", item._id)
    }

    async _handleDragData(dragData, originalEvent) {
        let item
        let typeClass
        let selfTarget = dragData.actorId && dragData.actorId == this.actor.data._id


        if (selfTarget && !originalEvent.ctrlKey) {
            return
        } else if (dragData.id && dragData.pack) {
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
        if (originalEvent.ctrlKey && selfTarget) {
            this.handleItemCopy(item, typeClass)
        } else {
            await this._manageDragItems(item, typeClass)
        }
        if (originalEvent.altKey && !selfTarget && ["meleeweapon", "rangeweapon", "equipment", "ammunition", "armor", "poison", "consumable"].includes(typeClass))
            await this._handleRemoveSourceOnDrop(dragData, item)

    }
}