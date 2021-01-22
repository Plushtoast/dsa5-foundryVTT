import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";

import Itemdsa5 from "../item/item-dsa5.js";

import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";


export default class ActorSheetDsa5 extends ActorSheet {

    get actorType() {
        return this.actor.data.type;
    }

    async _render(force = false, options = {}) {
        this._saveScrollPos();
        this._saveSearchFields()
        await super._render(force, options);
        this._setScrollPos();
        this._restoreSeachFields()

        $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".configure-token").attr("title", game.i18n.localize("SHEET.Token"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
        $(this._element).find(".locksheet").attr("title", game.i18n.localize("SHEET.Lock"));
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
            if (existing) {
                condition.value = existing.flags.dsa5.value
                condition.existing = true
            } else {
                condition.value = 0;
                condition.existing = false
            }

            if (condition.flags.dsa5.value == null)
                condition.boolean = true;

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
                    this.actor.updateEmbeddedEntity("OwnedItem", aggregated);
                    this.actor.items.find(i => i.data._id == itemId).postItem()
                })
            });
        }
    }

    async _advanceAttribute(attr) {
        let advances = Number(this.actor.data.data.characteristics[attr].advances) + Number(this.actor.data.data.characteristics[attr].initial)
        let cost = DSA5_Utility._calculateAdvCost(advances, "E")
        if (this._checkEnoughXP(cost)) {
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
        if (this._checkEnoughXP(cost) && this._checkMaximumPointAdvancement(attr, advances + 1)) {
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
        if (this._checkEnoughXP(cost) && this._checkMaximumItemAdvancement(item, Number(item.data.talentValue.value) + 1)) {
            item.data.talentValue.value += 1
            this.actor.updateEmbeddedEntity("OwnedItem", item)
            await this.actor.update({
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) + cost
            })
        }
    }

    async _refundItemAdvance(itemId) {
        let item = duplicate(this.actor.items.find(i => i.data._id == itemId))
        if (item.data.talentValue.value > 0) {
            let cost = DSA5_Utility._calculateAdvCost(Number(item.data.talentValue.value), item.data.StF.value, 0)
            item.data.talentValue.value -= 1
            this.actor.updateEmbeddedEntity("OwnedItem", item)
            await this.actor.update({
                "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) - cost
            })
        }
    }

    _checkMaximumPointAdvancement(attr, newValue) {
        let result = false
        switch (attr) {
            case "wounds":
                result = newValue <= this.actor.data.data.characteristics["ko"].value
                break
            case "astralenergy":
            case "karmaenergy":
                result = newValue <= this.actor.data.data.characteristics[this.actor.data.data.guidevalue.value].value
                break
        }
        if (!result)
            ui.notifications.error(game.i18n.localize("Error.AdvanceMaximumReached"))

        return result
    }

    _checkMaximumItemAdvancement(item, newValue) {
        let result = false
        switch (item.type) {
            case "combatskill":
                result = newValue <= Math.max(...(item.data.guidevalue.value.split("/").map(x => this.actor.data.data.characteristics[x].value))) + 2 + AdvantageRulesDSA5.vantageStep(this.actor, `Herausragende Kampftechnik (${item.name})`)
                break
            case "spell":
            case "ritual":
            case "liturgy":
            case "ceremnoy":
                result = newValue <= 14 + AdvantageRulesDSA5.vantageStep(this.actor, `Herausragende Fertigkeit (${item.name})`)
                break
            case "skill":
                result = newValue <= Math.max(...[this.actor.data.data.characteristics[item.data.characteristic1.value].value, this.actor.data.data.characteristics[item.data.characteristic2.value].value, this.actor.data.data.characteristics[item.data.characteristic3.value].value]) + 2 + AdvantageRulesDSA5.vantageStep(this.actor, `Herausragende Fertigkeit (${item.name})`)
                break
        }
        if (!result)
            ui.notifications.error(game.i18n.localize("Error.AdvanceMaximumReached"))

        return result
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.actor.data.canAdvance) {
            buttons.unshift({
                class: "locksheet",
                icon: `fas fa-${this.actor.data.data.sheetLocked.value ? "" : "un"}lock`,
                onclick: async ev => this.changeAdvanceLock(ev)
            })
        }
        return buttons
    }

    async changeAdvanceLock(ev) {
        this.actor.update({ "data.sheetLocked.value": !this.actor.data.data.sheetLocked.value })
        $(ev.currentTarget).find("i").toggleClass("fa-unlock fa-lock")
    }

    _checkEnoughXP(cost) {
        return this.actor.checkEnoughXP(cost)
    }

    activateListeners(html) {
        super.activateListeners(html);

        let posthand = ev => {
            this.actor.items.find(i => i.data._id == this._getItemId(ev)).postItem()
        }

        html.find('.ammo-selector').change(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            item.data.currentAmmo.value = $(ev.currentTarget).val()
            this.actor.updateEmbeddedEntity("OwnedItem", item);
        })

        html.find('.item-toggle').click(ev => {
            let itemId = this._getItemId(ev);
            let item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            let equippedState;

            switch (item.type) {
                case "armor":
                case "rangeweapon":
                case "meleeweapon":
                    item.data.worn.value = !item.data.worn.value;
                    equippedState = item.data.worn.value
                    break;

            }
            this.actor.updateEmbeddedEntity("OwnedItem", item);
        });

        html.find(".status-create").click(ev => {
            $(ev.currentTarget).closest(".statusEffectMenu").find('ul').fadeIn()
        })
        html.find(".statusEffectMenu ul").mouseleave(ev => {
            $(ev.currentTarget).fadeOut()
        })
        html.find(".status-add").click(ev => {
            this.actor.addCondition($(ev.currentTarget).attr("data-id"))
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
            this._advanceAttribute($(ev.currentTarget).attr("data-attr"))
        })
        html.find(".refund-attribute").mousedown(ev => {
            this._refundAttributeAdvance($(ev.currentTarget).attr("data-attr"))
        })
        html.find(".advance-item").mousedown(ev => {
            this._advanceItem(this._getItemId(ev))
        })
        html.find(".refund-item").mousedown(ev => {
            this._refundItemAdvance(this._getItemId(ev))
        })
        html.find(".advance-points").mousedown(ev => {
            this._advancePoints($(ev.currentTarget).attr("data-attr"))
        })
        html.find(".refund-points").mousedown(ev => {
            this._refundPointsAdvance($(ev.currentTarget).attr("data-attr"))
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

        html.find('.skill-advances').keydown(async event => {
            this.skillUpdateFlag = event.keyCode == 9

            if (event.keyCode == 13) // Enter
            {
                if (!this.skillsToEdit)
                    this.skillsToEdit = []

                let itemId = this._getItemId(event);
                let itemToEdit = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
                itemToEdit.data.talentValue.value = Number(event.target.value);
                this.skillsToEdit.push(itemToEdit);

                await this.actor.updateEmbeddedEntity("OwnedItem", this.skillsToEdit);

                this.skillsToEdit = [];
            }
        });

        html.find('.item-dropdown').click(ev => {
            ev.preventDefault()
            $(ev.currentTarget).closest('.item').find('.expandDetails').fadeToggle()
        })

        html.find('.condition-show').click(ev => {
            ev.preventDefault()
            let id = ev.currentTarget.getAttribute("data-id")
            let effect = CONFIG.statusEffects.find(x => x.id == id)
            if (effect) {
                let text = `<div style="padding:5px;"><b>${game.i18n.localize(effect.label)}</b>: ${game.i18n.localize(effect.description)}</div>`
                let elem = $(ev.currentTarget).closest('.groupbox').find('.effectDescription')
                elem.fadeOut('fast', function() {
                    elem.html(text).fadeIn('fast')
                })
            } else {
                //search temporary effects
            }
        })

        html.find('.skill-advances').focusout(async event => {
            //event.preventDefault()
            if (!this.skillsToEdit)
                this.skillsToEdit = []
            let itemId = this._getItemId(event);
            let itemToEdit = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            itemToEdit.data.talentValue.value = Number(event.target.value);
            this.skillsToEdit.push(itemToEdit);

            if (!this.skillUpdateFlag)
                return;

            await this.actor.updateEmbeddedEntity("OwnedItem", this.skillsToEdit);
            this.skillsToEdit = [];
        });

        html.find('.item-edit').click(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev);
            const item = this.actor.items.find(i => i.data._id == itemId)
            item.sheet.render(true);
        });

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
                var div = document.createElement('div')
                div.classList.add("hovermenu")
                var del = document.createElement('i')
                del.classList.add("fas", "fa-times")
                del.title = game.i18n.localize('SHEET.DeleteItem')
                del.addEventListener('click', deletehand, false)
                var post = document.createElement('i')
                post.classList.add("fas", "fa-comment")
                post.title = game.i18n.localize('SHEET.PostItem')
                post.addEventListener('click', posthand, false)
                div.appendChild(post)
                div.appendChild(del)
                ev.currentTarget.appendChild(div)
            }
        });
        html.find(".cards .item").mouseleave(ev => {
            var e = ev.toElement || ev.relatedTarget;
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
                this.actor.addCondition(condKey)
            else if (ev.button == 2)
                this.actor.removeCondition(condKey)
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
                this.actor.addCondition(condKey)
            else if (ev.button == 2)
                this.actor.removeCondition(condKey)
        })

        html.find('.talentSearch').keydown(event => {
            this._filterTalents($(event.currentTarget))
        });
        let filterTalents = ev => this._filterTalents($(ev.currentTarget))
        html.find('.talentSearch')[0].addEventListener("search", filterTalents, false);
    }

    _filterTalents(tar) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let talents = $(this.form).parent().find('.allTalents')
            talents.find('.item, .table-header, .table-title').removeClass('filterHide')
            if (val.length > 1) {
                talents.addClass('showAll').find('.item').filter(function() {
                    return $(this).find('.talentName').text().toLowerCase().trim().indexOf(val) == -1
                }).addClass('filterHide')
                talents.find('.table-header, .table-title:not(:eq(0))').addClass("filterHide")
            }
        }
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
                    },
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async _cleverDeleteItem(itemId) {
        let item = this.actor.data.items.find(x => x._id == itemId)
        switch (item.type) {
            case "advantage":
            case "disadvantage":
                await AdvantageRulesDSA5.vantageRemoved(this.actor, item)
                await this._updateAPs(-1 * item.data.APValue.value * item.data.step.value)
                break;
            case "specialability":
                await SpecialabilityRulesDSA5.abilityRemoved(this.actor, item)
                await this._updateAPs(-1 * item.data.APValue.value)
                break;
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

    async _updateAPs(apValue) {
        await this.actor._updateAPs(apValue)
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
            mod: mod,
            data: item,
            root: tar.getAttribute("root")
        }));
        event.stopPropagation()
    }

    async _addSpellOrLiturgy(item) {
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name);
        let apCost
        if (!res) {
            switch (item.type) {
                case "spell":
                case "liturgy":
                case "ceremony":
                case "ritual":
                    apCost = DSA5_Utility._calculateAdvCost(0, item.data.data.StF.value, 0)
                    break
                case "blessing":
                case "magictrick":
                    apCost = 1
                    break
                default:
                    return
            }
            if (this.actor.checkEnoughXP(apCost)) {
                this._updateAPs(apCost)
                await this.actor.createEmbeddedEntity("OwnedItem", item)
            }
        }
    }

    async _addLoot(item) {
        let res = this.actor.data.items.find(i => i.type == item.type && i.name == item.name && i.data.description.value == item.data.data.description.value);
        if (!res) {
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        } else {
            res = duplicate(res)
            res.data.quantity.value += item.data.data.quantity.value
            await this.actor.updateEmbeddedEntity("OwnedItem", res)
        }

    }

    async _onDrop(event) {
        this._handleDragData(JSON.parse(event.dataTransfer.getData("text/plain")))
    }

    async _manageDragItems(item, typeClass) {
        switch (typeClass) {
            case "meleeweapon":
            case "rangeweapon":
            case "equipment":
            case "ammunition":
            case "armor":
            case "poison":
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
            default:
                ui.notifications.error(game.i18n.format("Error.canNotBeAdded", { item: item.name, category: game.i18n.localize(item.type) }))
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
            for (let thing of lookup) {
                this._manageDragItems(thing, thing.type)
            }
        } else {
            ui.notifications.error(game.i18n.format("Error.notFound", { category: thing.type, name: thing.name }))
        }
    }

    async _handleDragData(dragData) {
        let item
        let typeClass

        if (dragData.actorId && dragData.actorId == this.actor.data._id) {
            return
        } else if (dragData.id && dragData.pack) {
            item = await DSA5_Utility.findItembyIdAndPack(dragData.id, dragData.pack);
            typeClass = item.data.type
        } else if (dragData.id) {
            item = DSA5_Utility.findItembyId(dragData.id);
            typeClass = item.data.type
        } else {
            item = dragData.data
            typeClass = item.type
        }

        await this._manageDragItems(item, typeClass)
    }
}