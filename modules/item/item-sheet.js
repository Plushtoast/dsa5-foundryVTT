import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"



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

    }

    setupEffect(ev) {
        this.item.setupEffect().then(setupData => {
            this.item.itemTest(setupData)
        });
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (["poison", "disease"].includes(this.item.type)) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }

    get template() {
        let type = this.item.type;
        return `systems/dsa5/templates/items/item-${type}-sheet.html`;
    }

    _advanceStep() {
        switch (this.item.type) {
            case "advantage":
            case "disadvantage":
                if (this.item.data.data.step.value < this.item.data.data.max.value) {
                    this.item.options.actor._updateAPs(this.item.data.data.APValue.value)
                    this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
                }
                break
            case "specialability":
                if (this.item.data.data.step.value < this.item.data.data.maxRank.value) {
                    this.item.options.actor._updateAPs(this.item.data.data.APValue.value)
                    this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
                }
                break
        }

    }

    _refundStep() {
        switch (this.item.type) {
            case "advantage":
            case "disadvantage":
            case "specialability":
                if (this.item.data.data.step.value > 1) {
                    if (this.item.options.actor.checkEnoughXP(this.item.data.data.APValue.value)) {
                        this.item.options.actor._updateAPs(this.item.data.data.APValue.value * -1)
                        this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
                    }
                }
                break
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find(".advance-step").mousedown(ev => {
            this._advanceStep()
        })
        html.find(".refund-step").mousedown(ev => {
            this._refundStep()
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
            case "ritual":
            case "ceremony":
            case "liturgy":
            case "spell":
                data['characteristics'] = DSA5.characteristics;
                data['StFs'] = DSA5.StFs;
                data['resistances'] = DSA5.magicResistanceModifiers
                break;
            case "combatskill":
                data['weapontypes'] = DSA5.weapontypes;
                data['guidevalues'] = DSA5.combatskillsGuidevalues;
                data['StFs'] = DSA5.StFs;
                break;
            case "meleeweapon":
                let chars = DSA5.characteristics;
                chars["ge/kk"] = game.i18n.localize("CHAR.GEKK")
                chars["-"] = "-";
                data['characteristics'] = chars;
                data['combatskills'] = await DSA5_Utility.allCombatSkillsList("melee");
                data['ranges'] = DSA5.meleeRanges;
                data['canBeOffHand'] = !(this.item.options.actor.data.items.find(x => x.type == "combatskill" && x.name == this.item.data.data.combatskill.value).data.weapontype.twoHanded) && this.item.data.data.worn.value
                break;
            case "rangeweapon":
                data['ammunitiongroups'] = DSA5.ammunitiongroups;
                data['combatskills'] = await DSA5_Utility.allCombatSkillsList("range");
                break;
            case "ammunition":
                data['ammunitiongroups'] = DSA5.ammunitiongroups;
                break;
            case "specialability":
                data['categories'] = DSA5.specialAbilityCategories;
                break;
            case "armor":
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
            case "disease":
            case "poison":
                data["resistances"] = DSA5.resistanceMods
                break
        }
        data.isOwned = this.item.isOwned
        if (data.isOwned) {
            data.canAdvance = this.item.options.actor.data.canAdvance && this._advancable()
        }
        return data;
    }

    _advancable() {
        switch (this.item.type) {
            case "advantage":
            case "disadvantage":
                return this.item.data.data.max.value > 0
            case "specialability":
                return this.item.data.data.maxRank.value > 0
            default:
                return false
        }
    }


}