export class PlayerMenuSubApp {
    static template = ""
    static rulePath = {}

    async _getData(data) {
        return {}
    }

    activateListeners(html) {}

    async _renderData(data) {
        const renderData = await this._getData(data)
        mergeObject(renderData, data)
        const template = await renderTemplate(this.constructor.template, renderData)
        return template
    }

    async prepareApp(data) {
        return {
            name: game.i18n.localize(`PLAYER.${this.constructor.name}`),
            view: await this._renderData(data)
        }
    }

    async render() {
        await game.dsa5.apps.playerMenu.render(true)
    }

    get actor() {
        return game.dsa5.apps.playerMenu.actor
    }
}

export class AlchimieHelper extends PlayerMenuSubApp {
    //TODO
}