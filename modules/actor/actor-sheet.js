import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";



export default class ActorSheetDsa5 extends ActorSheet {
    static
    get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
        mergeObject(options, {
            width: 680,
            height: 740
        });
        return options;
    }
    get actorType() {
        return this.actor.data.type;
    }



    async _render(force = false, options = {}) {
        this._saveScrollPos(); // Save scroll positions
        await super._render(force, options);
        this._setScrollPos(); // Set scroll positions

        // Add Tooltips
        /*$(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".configure-token").attr("title", game.i18n.localize("SHEET.Token"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));*/
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
        return sheetData;
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

        if (data.type == "spell" || data.type == "liturgy") {

        } else {
            data["data.weight.value"] = 0
            data["data.quantity.value"] = 0
        }


        //data["img"] = "systems/wfrp4e/icons/blank.png";
        data["name"] = `New ${data.type.capitalize()}`;
        this.actor.createEmbeddedEntity("OwnedItem", data);
    }

    activateListeners(html) {
        super.activateListeners(html);


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
            let itemId = this._getItemId(ev);
            const item = this.actor.items.find(i => i.data._id == itemId)
            item.postItem();
        });

        html.find('.skill-advances').keydown(async event => {
            // Wait to update if user tabbed to another skill
            if (event.keyCode == 9) // Tab
            {
                this.skillUpdateFlag = false;
            } else {
                this.skillUpdateFlag = true;
            }
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


        html.find('.skill-advances').focusout(async event => {
            //event.preventDefault()
            if (!this.skillsToEdit)
                this.skillsToEdit = []
            let itemId = this._getItemId(event);
            let itemToEdit = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
            itemToEdit.data.talentValue.value = Number(event.target.value);
            this.skillsToEdit.push(itemToEdit);

            // Wait for the listener above to set this true before updating - allows for tabbing through skills
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

        html.find('.ch-rollCombat').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeapon(item, "attack", event).then(setupData => {
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

        html.find('.ch-rollDamage').click(event => {
            event.preventDefault();
            let itemId = this._getItemId(event);
            const item = this.actor.items.find(i => i.data._id == itemId)
            this.actor.setupWeapon(item, "damage", event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

        let hand = ev => this._deleteItem(ev);
        html.find(".cards .item").mouseenter(ev => {
            if (ev.currentTarget.getElementsByClassName('delButton').length == 0) {
                var div = document.createElement('div')
                div.classList.add("delButton")

                div.innerHTML = "<i class=\"fas fa-times\"></i>"
                div.addEventListener('click', hand, false)
                ev.currentTarget.appendChild(div)

            }
        });
        html.find(".cards .item").mouseleave(ev => {
            var e = ev.toElement || ev.relatedTarget;
            if (e.parentNode == this || e == this) {
                return;
            }
            ev.currentTarget.querySelectorAll('.delButton').forEach(e => e.remove());
        });

        let handler = ev => this._onDragItemStart(ev);
        html.find('.content .item').each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", handler, false);
        });

        html.find('.item-delete').click(ev => {
            this._deleteItem(ev)
        });
    }

    _deleteItem(ev) {
        let itemId = this._getItemId(ev);

        renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html').then(html => {
            new Dialog({
                title: game.i18n.localize("Delete Confirmation"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: "Yes",
                        callback: dlg => {
                            this._cleverDeleteItem(itemId)
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel"
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
                await this._updateAPs(-1 * item.data.APValue.value * item.data.step.value)
                break;
            case "specialability":
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
            await this.actor.updateEmbeddedEntity("OwnedItem", money);
        } else {
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        }
    }

    async _updateAPs(apValue) {
        if (this.actor.data.type == "character") {
            if (!isNaN(apValue) && !(apValue == null)) {
                await this.actor.update({
                    "data.details.experience.spent": Number(this.actor.data.data.details.experience.spent) + Number(apValue),
                });
            } else {
                ui.notifications.warn(game.i18n.localize("Error.APUpdateError"))
            }
        }
    }

    async _addVantage(item, typeClass) {
        let res = this.actor.data.items.find(i => {
            return i.type == typeClass && i.name == item.name
        });
        if (res) {
            let vantage = duplicate(res)
            if (vantage.data.step.value + 1 <= vantage.data.max.value) {
                vantage.data.step.value += 1
                await this._updateAPs(vantage.data.APValue.value)
                await this.actor.updateEmbeddedEntity("OwnedItem", vantage);
            }


        } else {
            await AdvantageRulesDSA5.addvantageAdded(this.actor, item)
            await this._updateAPs(item.data.data.APValue.value)
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        }
    }

    async _addCareer(item) {
        let update = {
            "data.details.career.value": item.data.name,
            "data.details.culture.value": ""
        }
        await this._updateAPs(item.data.data.APValue.value)
        if (item.data.mageLevel != "mundane") {
            update["data.guidevalue.value"] = game.i18n.localize("CHAR." + item.data.data.guidevalue.value)
            update["data.tradition.value"] = item.data.data.tradition.value
            update["data.feature.value"] = item.data.data.feature.value
            update["data.happyTalents.value"] = item.data.data.happyTalents.value
        }
        await this.actor.update(update);
        for (let skill of item.data.data.skills.value.split(",")) {
            let vars = skill.trim().split(" ")
            let name = vars.slice(0, -1).join(' ')
            let step = vars[vars.length - 1]
            let res = this.actor.data.items.find(i => {
                return i.type == "skill" && i.name == name
            });
            if (res) {
                let skillUpdate = duplicate(res)
                skillUpdate.data.talentValue.value = step
                await this.actor.updateEmbeddedEntity("OwnedItem", skillUpdate);
            }
        }
    }

    async _addCulture(item) {
        let update = {
            "data.details.culture.value": item.data.name
        }
        await this._updateAPs(item.data.data.APValue.value)
        await this.actor.update(update);
        for (let skill of item.data.data.skills.value.split(",")) {
            let vars = skill.trim().split(" ")
            let name = vars.slice(0, -1).join(' ')
            let step = vars[vars.length - 1]
            let res = this.actor.data.items.find(i => {
                return i.type == "skill" && i.name == name
            });
            if (res) {
                let skillUpdate = duplicate(res)
                skillUpdate.data.talentValue.value = skillUpdate.data.talentValue.value + step
                await this.actor.updateEmbeddedEntity("OwnedItem", skillUpdate);
            }
        }
    }

    async _addSpecialAbility(item, typeClass) {
        let res = this.actor.data.items.find(i => {
            return i.type == typeClass && i.name == item.name
        });

        if (!res) {
            await this._updateAPs(item.data.data.APValue.value)
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        }
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

    async _addSpecies(item) {
        let update = {
            "data.details.species.value": item.data.name,
            "data.status.speed.initial": item.data.data.baseValues.speed.value,
            "data.status.soulpower.initial": item.data.data.baseValues.soulpower.value,
            "data.status.toughness.initial": item.data.data.baseValues.toughness.value,
            "data.status.wounds.initial": item.data.data.baseValues.wounds.value,
            "data.status.wounds.value": this.actor.data.data.status.wounds.current + this.actor.data.data.status.wounds.modifier + this.actor.data.data.status.wounds.advances
        };
        await this._updateAPs(item.data.data.APValue.value)
        await this.actor.update(update);
    }

    async _addSpellOrLiturgy(item) {
        await this.actor.createEmbeddedEntity("OwnedItem", item);
    }

    async _onDrop(event) {
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
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


        switch (typeClass) {
            case "species":
                await this._addSpecies(item)
                break;
            case "meleeweapon":
            case "rangeweapon":
            case "equipment":
            case "ammunition":
            case "armor":
                await this.actor.createEmbeddedEntity("OwnedItem", item);
                break;
            case "disadvantage":
            case "advantage":
                await this._addVantage(item, typeClass)
                break;
            case "specialability":
                await this._addSpecialAbility(item, typeClass)
                break;
            case "career":
                await this._addCareer(item)
                break;
            case "money":
                await this._addMoney(item)
                break;
            case "blessing":
            case "magictrick":
            case "liturgy":
            case "spell":
                await this._addSpellOrLiturgy(item)
                break;

        }

    }
}