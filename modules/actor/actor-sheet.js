import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";


export default class ActorSheetDsa5 extends ActorSheet {
    get actorType() {
        return this.actor.data.type;
    }

    static
    get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
        options.width = 576;
        return options;
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

        if (this.actor.data.type == "character")
            this.addCharacterData(sheetData.actor)

        sheetData.isGM = game.user.isGM;
        return sheetData;
    }

    addCharacterData(actorData) {

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

        html.find('.item-edit').click(ev => {
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

        let handler = ev => this._onDragItemStart(ev);
        html.find('.item').each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", handler, false);
        });

        html.find('.item-delete').click(ev => {
            let itemId = this._getItemId(ev);

            renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html').then(html => {
                new Dialog({
                    title: "Delete Confirmation",
                    content: html,
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: "Yes",
                            callback: dlg => {
                                this.actor.deleteEmbeddedEntity("OwnedItem", itemId);
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
        });
    }

    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

    async _addMoney(item) {
        let money = duplicate(this.actor.data.items.filter(i => i.type === "money"));

        let moneyItem = money.find(i => i.name == item.name)

        if (moneyItem) {
            console.log("adding")
            moneyItem.data.quantity.value += item.data.quantity.value
            await this.actor.updateEmbeddedEntity("OwnedItem", money);
        } else {
            console.log("more money")
            await this.actor.createEmbeddedEntity("OwnedItem", item);
        }
    }

    _onDragItemStart(event) {
        let itemId = event.currentTarget.getAttribute("data-item-id");
        const item = duplicate(this.actor.getEmbeddedEntity("OwnedItem", itemId))
        event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "Item",
            sheetTab: this.actor.data.flags["_sheetTab"],
            actorId: this.actor._id,
            data: item,
            root: event.currentTarget.getAttribute("root")
        }));
    }

    async _onDrop(event) {
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
        let item
        let typeClass
        if (dragData.id) {
            item = DSA5_Utility.findItembyId(dragData.id);
            typeClass = item.data.type
        } else {
            item = dragData.data
            typeClass = item.type
        }

        console.log(item)

        switch (typeClass) {
            case "species":
                await this.actor.update({
                    "data.details.species.value": item.data.name,
                    "data.details.experience.spent": this.actor.data.data.details.experience.spent + item.data.data.APValue.value,
                    "data.status.speed.initial": item.data.data.baseValues.speed.value,
                    "data.status.soulpower.initial": item.data.data.baseValues.soulpower.value,
                    "data.status.toughness.initial": item.data.data.baseValues.toughness.value,
                    "data.status.wounds.initial": item.data.data.baseValues.wounds.value,
                    "data.status.wounds.current": this.actor.data.data.status.wounds.value + this.actor.data.data.status.wounds.modifier + this.actor.data.data.status.wounds.advances
                });
                break;
            case "meleeweapon":
            case "rangeweapon":
            case "equipment":
            case "ammunition":
            case "armor":
                await this.actor.createEmbeddedEntity("OwnedItem", item);
                break;
            case "money":
                await this._addMoney(item)
                break;

        }

        /*if (dragData.type == "species") {
            await this.actor.update({ 
                "details": {
                    "species" : dragData
                }
             })
        }*/
    }
}