import DPS from "../system/derepositioningsystem.js"
import DSA5_Utility from "../system/utility-dsa5.js"

export class AddTargetDialog extends Dialog{
    static async getDialog(speaker){
        const targets = Array.from(game.user.targets).map(x => x.id)
        const selectables = []
        const token = canvas.scene ? canvas.scene.tokens.get(speaker.token)?.object : undefined
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
                return canvas.animatePan({x: combatant.token.x, y: combatant.token.y});
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

export class UserMultipickDialog extends Dialog{
    static async getDialog(content){
        const users = game.users.filter(x => x.active && !x.isGM)

        new UserMultipickDialog({
            title: game.i18n.localize("SHEET.PostItem"),
            content: await renderTemplate('systems/dsa5/templates/dialog/usermultipickdialog.html', { users }),
            default: "Yes",
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: (dlg) => {
                        this.postContent(dlg, content)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            },
        }).render(true)
    }

    static async postContent(dlg, content){
        const chatOptions = DSA5_Utility.chatDataSetup(content)
        if(!dlg.find('#sel_all').is(':checked')){
            const ids = []
            dlg.find('.usersel:checked').each(function(){
                ids.push($(this).val());
            });
            chatOptions.whisper = ids
        }

        ChatMessage.create(chatOptions)
    }

    activateListeners(html){
        super.activateListeners(html)

        html.find('[name="sel_all"]').change(ev => {
            html.find('.usersel').prop('disabled', ev.currentTarget.checked).prop('checked', ev.currentTarget.checked)
        })
    }
}