import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DSA5StatusEffects from "../status/status_effects.js";
import DSA5ChatListeners from "../system/chat_listeners.js";


export default class ItemSheetdsa5 extends ItemSheet {
    constructor(item, options) {
        super(item, options);
        this.mce = null;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "item"]),
            width: 450,
            height: 500,
        });
        return options;
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
        $(this._element).find(".rolleffect").attr("title", game.i18n.localize("SHEET.RollEffect"));
        $(this._element).find(".showItemHead").attr("title", game.i18n.localize("SHEET.PostItem"));
        $(this._element).find(".consumeItem").attr("title", game.i18n.localize("SHEET.ConsumeItem"));
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "showItemHead",
            icon: `fas fa-comment`,
            onclick: async() => this.item.postItem()
        })
        return buttons
    }

    setupEffect(ev) {
        this.item.setupEffect().then(setupData => {
            this.item.itemTest(setupData)
        });
    }


    get template() {
        let type = this.item.type;
        return `systems/dsa5/templates/items/item-${type}-sheet.html`;
    }

    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

    _advanceStep() {}

    _refundStep() {}

    async advanceWrapper(ev, funct) {
        let elem = $(ev.currentTarget)
        let i = elem.find('i')
        if (!i.hasClass("fa-spin")) {
            i.addClass("fa-spin fa-spinner")
            await this[funct]()
            i.removeClass("fa-spin fa-spinner")
        }
    }


    activateListeners(html) {
        super.activateListeners(html);

        html.find(".advance-step").mousedown(ev => {
            this.advanceWrapper(ev, "_advanceStep")
        })
        html.find(".refund-step").mousedown(ev => {
            this.advanceWrapper(ev, "_refundStep")
        })

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })
    }

    async getData() {
        const data = super.getData();

        switch (this.item.type) {
            case "skill":
                data['characteristics'] = DSA5.characteristics;
                data['skillGroups'] = DSA5.skillGroups;
                data['skillBurdens'] = DSA5.skillBurdens;
                data['StFs'] = DSA5.StFs;
                break;
            case "combatskill":
                data['weapontypes'] = DSA5.weapontypes;
                data['guidevalues'] = DSA5.combatskillsGuidevalues;
                data['StFs'] = DSA5.StFs;
                break;
            case "rangeweapon":
                data['ammunitiongroups'] = DSA5.ammunitiongroups;
                data['combatskills'] = await DSA5_Utility.allCombatSkillsList("range");
                break;
            case "ammunition":
                data['ammunitiongroups'] = DSA5.ammunitiongroups;
                break;
            case "trait":
                data["traitCategories"] = DSA5.traitCategories
                data['ranges'] = DSA5.meleeRanges;
                break
            case "equipment":
                data['equipmentTypes'] = DSA5.equipmentTypes;
                break;
            case "aggregatedTest":
                data["allSkills"] = await DSA5_Utility.allSkillsList()
                break
        }
        data.isOwned = this.item.isOwned
        if (data.isOwned) {
            data.canAdvance = this.item.options.actor.data.canAdvance && this._advancable()
        }
        return data;
    }

    _advancable() {
        return false
    }
}