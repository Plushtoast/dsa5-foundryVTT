export default class DidYouKnow {
    static async showOneMessage() {
        if (game.settings.get("dsa5","disableDidYouKnow")) return

        fetch(`systems/dsa5/lazy/didyouknow/${game.i18n.lang}.json`).then(async r => r.json()).then(async json => {
            const msg = json.data[Math.floor(Math.random() * json.data.length)];
            const didYouKnow = await renderTemplate("systems/dsa5/templates/system/didyouknow.html", { msg })
            $('body').append(didYouKnow)
            $('.didYouKnow').click(() => $('.didYouKnow').remove())
            $('.didYouKnow').fadeIn()
            setTimeout(function() {
                $('.didYouKnow').fadeOut(1000, () => $('.didYouKnow').remove());
            }, 4000);
        })
    }
}