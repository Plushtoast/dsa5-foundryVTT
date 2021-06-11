export default class MastersMenu {
    static registerButtons() {
        CONFIG.Canvas.layers.dsamenu = DSAMenuLayer
        Hooks.on("getSceneControlButtons", btns => {

            const dasMenuOptions = [{
                    name: "JournalBrowser",
                    title: game.i18n.localize("Book.Wizard"),
                    icon: "fa fa-book",
                    button: true,
                    onClick: () => {
                        game.dsa5.apps.journalBrowser.render(true)
                    }
                },
                {
                    name: "Library",
                    title: game.i18n.localize("ItemLibrary"),
                    icon: "fas fa-university",
                    button: true,
                    onClick: () => {
                        game.dsa5.itemLibrary.render(true)
                    }
                }
            ]
            if (game.user.isGM) {

            }
            btns.push({
                name: "GM Menu",
                title: game.i18n.localize("gmMenu"),
                icon: "fas fa-dsa5",
                layer: "dsamenu",
                tools: dasMenuOptions
            })
        })
    }
}

class DSAMenuLayer extends CanvasLayer {
    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            name: "dsamenu",
            canDragCreate: false,
            controllableObjects: true,
            rotatableObjects: true,
            zIndex: 666,
        });
    }

}