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
        const combatants = html.find('.combatant')
        combatants.click(ev => this.setTargets(ev))
        combatants.hover(this._onCombatantHoverIn.bind(this), this._onCombatantHoverOut.bind(this));
        combatants.mousedown(ev => this._onRightClick(ev))
    }

    _onCombatantHoverOut(ev) {
        this._getCombatApp()._onCombatantHoverOut(ev)
    }

    _onCombatantHoverIn(ev) {
        this._getCombatApp()._onCombatantHoverIn(ev)
    }

    _onRightClick(ev){
        if(ev.button == 2){
            const combatant = game.combat.combatants.get(ev.currentTarget.dataset.combatantId)
            if ( combatant.token) {
                return canvas.animatePan({x: combatant.token.data.x, y: combatant.token.data.y});
            }
        }
    }

    _getCombatApp() {
        return game.combats.apps[0]
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
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5Decent"]),
        });
        return options;
    }

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