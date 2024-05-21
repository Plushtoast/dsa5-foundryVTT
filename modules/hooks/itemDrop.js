import DSA5 from "../system/config-dsa5.js"
import RuleChaos from "../system/rule_chaos.js"
import DSA5_Utility from "../system/utility-dsa5.js"

export const dropToGround = async(sourceActor, item, data, amount) => {
    if (game.user.isGM) {
        let items = await game.dsa5.apps.DSA5_Utility.allMoneyItems()
        let folder = await DSA5_Utility.getFolderForType("Actor", null, "Dropped Items")
        const userIds = game.users.filter(x => !x.isGM).map(x => x.id)

        const ownership = userIds.reduce((prev, cur) => {
            prev[cur] = 1
            return prev
        }, { default: 0 })

        const newItem = item.toObject()
        newItem.system.quantity.value = amount
        RuleChaos.obfuscateDropData(newItem, data.tabsinvisible)

        if (getProperty(newItem, "system.worn.value")) newItem.system.worn.value = false

        const actor = {
            type: "npc",
            name: item.name,
            img: item.img,
            prototypeToken: {
                texture: {
                    scaleX: 1,
                    scaleY: 1,
                    src: item.img,
                },
                width: 0.4,
                height: 0.4
            },
            ownership,
            items: [...items, newItem],
            flags: { core: { sheetClass: "dsa5.MerchantSheetDSA5" } },
            folder,
            system: {
                merchant: {
                    merchantType: "loot",
                    temporary: true,
                    hidePlayer: 1
                },
                status: { wounds: { value: 16 } }
            }
        };
        const finalActor = await game.dsa5.entities.Actordsa5.create(actor)
        const td = await finalActor.getTokenDocument({ x: data.x, y: data.y, hidden: false });
        if (!canvas.dimensions.rect.contains(td.x, td.y)) return false

        if (sourceActor) {
            await canvas.scene.createEmbeddedDocuments("Token", [td], { noHook: true })
            const newCount = item.system.quantity.value - amount
            if (newCount < 1) {
                await sourceActor.deleteEmbeddedDocuments("Item", [item.id])
            } else {
                await sourceActor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.quantity.value": newCount }])
            }
        }else {
            await canvas.scene.createEmbeddedDocuments("Token", [td])
        }
    } else {
        const payload = {
            itemId: item.uuid,
            sourceActorId: sourceActor?.id,
            data,
            amount
        };
        game.socket.emit("system.dsa5", {
            type: "itemDrop",
            payload
        });
    }
}

const handleItemDrop = async(canvas, data) => {
    const item = await Item.implementation.fromDropData(data);
    const sourceActor = item.parent

    if (!DSA5.equipmentCategories.has(item.type)) return

    const callback = async(count) => {
        dropToGround(sourceActor, item, data, count)
    }

    RangeSelectDialog.create(game.i18n.localize("DSASETTINGS.enableItemDropToCanvas"), game.i18n.format('MERCHANT.dropGround', {name: item.name}), item.system.quantity.value, callback)
}

const handleGroupDrop = async(canvas, data) => {
    let x = data.x
    let y = data.y
    let count = 0
    const gridSize = canvas.grid.size
    const rowLength = Math.ceil(Math.sqrt(data.ids.length))
    for(let id of data.ids){
        const actor = game.actors.get(id)
        if(!actor) continue

        const td = await actor.getTokenDocument({x, y, hidden: false});
        td.constructor.create(td, {parent: canvas.scene});
        if(rowLength % count == 0 && count > 0){
            y += gridSize
            x = data.x
        }else{
            x += gridSize
        }
        count++
    }
}

export const connectHook = () => {
    Hooks.on("dropCanvasData", async(canvas, data) => {
        if (!(game.settings.get("dsa5", "enableItemDropToCanvas") || game.user.isGM || data.tokenId)) return

        if (data.type == "Item") {
            handleItemDrop(canvas, data)
            return false
        } else if(data.type == "GroupDrop") {
            handleGroupDrop(canvas, data)
            return false
        }
    })
}

export class RangeSelectDialog extends Dialog {
    static async create(title, name, count, callback, min = 1, max = undefined) {
        max = max || count
        const content = await renderTemplate("systems/dsa5/templates/dialog/dropToGround.html", { name, min, max, count })

        new RangeSelectDialog({
            title,
            content,
            default: 'Yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: async(dlg) => callback(Number(dlg.find('[name="count"]').val()))
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('input[type="range"]').change(ev => {
            $(ev.currentTarget).closest('.row-section').find('.range-value').html($(ev.currentTarget).val())
        })
    }
}