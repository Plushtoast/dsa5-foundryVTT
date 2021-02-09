function addThirdBarToHUD(html, actor, app) {
    if (actor.data.isPriest && actor.data.isMage) {
        let currentKaP = actor.data.data.status.karmaenergy.value
        let attrBar = `<div class="attribute bar3"><input type="text" name="data.status.karmaenergy.value" value="${currentKaP}"></div>`
        html.find('.col.middle').prepend(attrBar)
        html.find('.bar3 input')
            .change(async ev => {
                const input = ev.currentTarget;
                let strVal = input.value.trim();
                let isDelta = strVal.startsWith("+") || strVal.startsWith("-");
                if (strVal.startsWith("=")) strVal = strVal.slice(1);
                let value = Number(strVal);
                const current = input.name.split('.').reduce((o, i) => o[i], actor.data)
                await actor.update({
                    [input.name]: isDelta ? current + value : value
                });
                app.clear()
            })
    }
}

export default function() {
    Hooks.on('renderTokenHUD', (app, html, data) => {
        let actor = canvas.tokens.get(data._id).actor
        if (actor) {
            addThirdBarToHUD(html, actor, app)
        }
    })
}