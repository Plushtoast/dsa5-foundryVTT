import { DefaultAppv2 } from "./baseapp.js";

export class SpeedSelector extends DefaultAppv2 {
    static DEFAULT_OPTIONS = {
        window: {
            title: "SPEEDSELECTOR.title",
        },
        position: {
            width: 300
        },
        actions: {
            saveThis: this.saveThis
        }
    }

    static PARTS = {
        main: {
            template: "systems/dsa5/templates/actors/parts/speed-selector.hbs",
            classes: ["standard-form"]
        }
    }

    get id() {
        return `speed-selector-${this.actor.id}`;
    }

    constructor(actor) {
        super();
        this.actor = actor;
    }

    async _prepareContext(_options) {
        const data = await super._prepareContext(_options);
        data.fields = this.actor.system.schema.fields.status.fields.speed.fields;
        data.values = this.actor.system.status.speed;
        return data;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

    }

    static async saveThis(ev, target) {
        if(!this.actor.isOwner) return this.close();

        const form = this.element.querySelector("form");
        const update = new foundry.applications.ux.FormDataExtended(form).object;

        await this.actor.update(update);
        this.close();
    }
}