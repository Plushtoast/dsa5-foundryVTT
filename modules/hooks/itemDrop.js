import DSA5 from "../system/config-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"

//TODO update to v10 standard https://gitlab.com/foundrynet/foundryvtt/-/issues/6990

export const dropToGround = async(sourceActor, item, data, amount) => {
    if (game.user.isGM) {
        let items = await game.dsa5.apps.DSA5_Utility.allMoneyItems()
        let folder = await DSA5_Utility.getFolderForType("Actor", null, "Dropped Items")
        const userIds = game.users.filter(x => !x.isGM).map(x => x.id)

        const permission = userIds.reduce((prev, cur) => {
            prev[cur] = 1
            return prev
        }, { default: 0 })

        const newItem = item.toObject()
        newItem.data.quantity.value = amount
        if (getProperty(newItem, "data.worn.value")) newItem.data.worn.value = false

        const actor = {
            type: "npc",
            name: item.name,
            img: item.img,
            token: {
                img: item.img,
                width: 0.4,
                height: 0.4
            },
            permission,
            items: [...items, newItem],
            flags: { core: { sheetClass: "dsa5.MerchantSheetDSA5" } },
            folder,
            data: {
                merchant: {
                    merchantType: "loot",
                    temporary: true,
                    hidePlayer: 1
                },
                status: { wounds: { value: 16 } }
            }
        };
        const finalActor = await game.dsa5.entities.Actordsa5.create(actor)
        const td = await finalActor.getTokenData({ x: data.x, y: data.y, hidden: false });
        if (!canvas.dimensions.rect.contains(td.x, td.y)) return false

        const cls = getDocumentClass("Token");
        await cls.create(td, { parent: canvas.scene });

        if (sourceActor) {
            const newCount = item.data.data.quantity.value - amount
            if (newCount <= 0) {
                await sourceActor.deleteEmbeddedDocuments("Item", [data.data._id])
            } else {
                await sourceActor.updateEmbeddedDocuments("Item", [{
                    _id: data.data._id,
                    "data.quantity.value": newCount
                }])
            }

        }
    } else {
        const payload = {
            itemId: item.uuid,
            sourceActorId: sourceActor.id,
            data,
            amount
        };
        game.socket.emit("system.dsa5", {
            type: "itemDrop",
            payload
        });
    }
}

export const connectHook = () => {
    Hooks.on("dropCanvasData", async(canvas, data) => {
        if (!(game.settings.get("dsa5", "enableItemDropToCanvas") || game.user.isGM || data.tokenId)) return

        if (data.type == "Item") {
            let item
            let sourceActor
            if (data.uuid) {
                item = await fromUuid(data.uuid)
                if (item.parent) sourceActor = item.parent
                if (data.amount) item.data.data.quantity.value = Number(data.amount)
            } else if (data.pack) {
                let dataPack = game.packs.get(data.pack)
                item = await dataPack.getDocument(data.id)
            } else if (data.tokenId || data.actorId) {
                sourceActor = DSA5_Utility.getSpeaker({ actor: data.actorId, token: data.tokenId, scene: canvas.scene.id })
                if (!sourceActor.isOwner) return ui.notifications.error(game.i18n.localize('DSAError.notOwner'))

                item = sourceActor.items.get(data.data._id)
            } else {
                item = game.items.get(data.id)
            }

            if (!DSA5.equipmentCategories.includes(item.data.type)) return

            const content = await renderTemplate("systems/dsa5/templates/dialog/dropToGround.html", { name: item.name, count: item.data.data.quantity.value })

            new DropToGroundDialog({
                title: data.name,
                content,
                default: 'yes',
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: async(dlg) => dropToGround(sourceActor, item, data, Number(dlg.find('[name="count"]').val()))
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    }
                }
            }).render(true)
        }
    })
}

class DropToGroundDialog extends Dialog {
    activateListeners(html) {
        super.activateListeners(html)
        html.find('input[type="range"]').change(ev => {
            $(ev.currentTarget).closest('.row-section').find('.range-value').html($(ev.currentTarget).val())
        })
    }
}