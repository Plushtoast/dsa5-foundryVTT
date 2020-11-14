
import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";


export default class ActorSheetDsa5 extends ActorSheet {
    get actorType() {
        return this.actor.data.type;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
        options.width = 576;
        return options;
    }

    async _render(force = false, options = {}) {
        this._saveScrollPos(); // Save scroll positions
        await super._render(force, options);
        this._setScrollPos();  // Set scroll positions

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
        console.log("preparing")
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


        html.find('.skill-select').mousedown(ev => {
            let itemId = this._getItemId(ev);
            let skill = this.actor.items.find(i => i.data._id == itemId);

            if (ev.button == 0)
                this.actor.setupSkill(skill.data).then(setupData => {
                    this.actor.basicTest(setupData)
                });

            else if (ev.button == 2)
                skill.sheet.render(true);
        })

        html.find('.skill-advances').keydown(async event => {
            // Wait to update if user tabbed to another skill
            if (event.keyCode == 9) // Tab
            {
                this.skillUpdateFlag = false;
            }
            else {
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

        html.find('.ch-value').click(event => {
            event.preventDefault();
            let characteristic = event.currentTarget.attributes["data-char"].value;
            this.actor.setupCharacteristic(characteristic, event).then(setupData => {
                this.actor.basicTest(setupData)
            });
        });

    }

    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

}