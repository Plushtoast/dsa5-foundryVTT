import { getProperty, mergeObject } from "../system/foundry.js"

export default class ForeignFieldEditor extends FormApplication{
    constructor(actorId, field, name){
        super()
        this.editfield = field
        this.actorId = actorId
        this.fieldname = name
        const actor = game.actors.get(this.actorId)
        this.object = {
            fieldContent: getProperty(actor, this.editfield)
        }
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            resizable: true,
            width: 600,
            height: 600
        });
        return options;
    }

    isEditable(){
        return true
    }

    get title(){
        const actor = game.actors.get(this.actorId)
        return `${actor.name} - ${game.i18n.localize(this.fieldname)}`
    }

    async _updateObject(event, formData) {
        game.socket.emit("system.dsa5", {
            type: "updateKeepField",
            payload: {
                actorId: this.actorId,
                field: this.editfield,
                updateData: formData.fieldContent
            }
        })
    }

    async getData(options){
        const data = super.getData(options)
        mergeObject(data, {
            fieldContent: this.object.fieldContent
        })
        return data
    }

    get template(){
        return "systems/dsa5/templates/dialog/foreignfieldeditor.html"
    }

    activateListeners(html){
        super.activateListeners(html)
    }
}