function addThirdBarToHUD(html, actor, app) {
    if (actor.system.isPriest && actor.system.isMage) {
        let currentKaP = actor.system.status.karmaenergy.value
        let attrBar = `<div class="attribute bar3"><input type="text" name="system.status.karmaenergy.value" value="${currentKaP}"></div>`
        html.find('.col.middle').prepend(attrBar)
        html.find('.bar3 input').change(async ev => {
            const input = ev.currentTarget;
            let strVal = input.value.trim();
            let isDelta = strVal.startsWith("+") || strVal.startsWith("-");
            if (strVal.startsWith("=")) strVal = strVal.slice(1);
            let value = Number(strVal);
            const current = input.name.split('.').reduce((o, i) => o[i], actor)
            await actor.update({
                [input.name]: isDelta ? current + value : value
            });
            app.clear()
        })
    }
}

export default function() {
    Hooks.on('renderTokenHUD', (app, html, data) => {
        const actor = app.object.actor
        if (actor) {
            addThirdBarToHUD(html, actor, app)
            if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.lightHud(html, actor, data)
        }
        html.find('.control-icon[data-action="target"]').mousedown(ev => {
                if (ev.button == 2) {
                    game.user.updateTokenTargets([]);
                    $(ev.currentTarget).click()
                    ev.preventDefault()
                }
            })
            // Prevent double calling of modifytokenattribute
        html.find(".attribute input").off('change')
    })
}