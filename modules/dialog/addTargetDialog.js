import DPS from "../system/derepositioningsystem.js"

export class AddTargetDialog extends Dialog{
    static async getDialog(speaker){
        const targets = Array.from(game.user.targets).map(x => x.id)
        const selectables = []
        const token = canvas.scene ? canvas.scene.tokens.get(speaker.token).object : undefined
        if(game.combat){
            game.combat.combatants.forEach(combatant => {
                if (!combatant.visible ) return

                combatant.isSelected = targets.includes(combatant.token.id)
                if(token && combatant.token){
                    const combatantToken = canvas.scene.tokens.get(combatant.token.id).object
                    combatant.distance = DPS.rangeFinder(token, combatantToken)
                    combatant.distance.distanceSum = Number(combatant.distance.distanceSum.toFixed(1))
                }
                selectables.push(combatant)
            })
        }
        return new AddTargetDialog({
            title: game.i18n.localize("DIALOG.addTarget"),
            content: await renderTemplate('systems/dsa5/templates/dialog/addTarget-dialog.html', { selectables }),
            default: "yes",
                buttons: {},
        })
    }

    activateListeners(html){
        super.activateListeners(html)
        html.find('.combatant').click(ev => this.setTargets(ev))
    }

    async setTargets(ev){
        const isShift = ev.originalEvent.shiftKey
        if(!isShift)
            $(ev.currentTarget).closest('.directory').find('.combatant').removeClass('selectedTarget')

        $(ev.currentTarget).addClass("selectedTarget")
        const combatantId = ev.currentTarget.dataset.combatantId
        const combatant = game.combat.combatants.get(combatantId)
        
        combatant.token.object.setTarget(true, {user: game.user, releaseOthers: !isShift, groupSelection: true });
    }
}

export class SelectUserDialog extends Dialog{
    static async getDialog(){
        const users = game.users.filter(x => x.active && !x.isGM)
        return new SelectUserDialog({
            title: game.i18n.localize("DIALOG.setTargetToUser"),
            content: await renderTemplate('systems/dsa5/templates/dialog/selectForUserDialog.html', { users }),
            default: "yes",
            buttons: {},
        })
    }

    static registerButtons(){
        Hooks.on("getSceneControlButtons", btns => {
            if(!game.user.isGM) return

            const userSelect = {
                name: "targetUser",
                title: game.i18n.localize("CONTROLS.targetForUser"),
                icon: "fa fa-bullseye",
                button: true,
                onClick: async() => { (await SelectUserDialog.getDialog()).render(true) }
            }
            btns[0].tools.splice(2, 0, userSelect)
        })
    }

    activateListeners(html){
        super.activateListeners(html)
        html.find('.combatant').click(ev => this.setTargetToUser(ev))
    }

    setTargetToUser(ev){
        const targetIds = Array.from(game.user.targets).map(x => x.id)
        const userId = ev.currentTarget.dataset.userId
        const user = game.users.get(userId)
        user.updateTokenTargets(targetIds)
        game.socket.emit('userActivity', userId, { targets: targetIds})
        this.close()
    }
}