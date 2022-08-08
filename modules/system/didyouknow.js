export default class DidYouKnow {
    static fadeOut = true

    static async stopFade(ev){
        ev.stopPropagation()
        ev.preventDefault()
        if(this.fadeOut){
            this.fadeOut = false
            $(ev.currentTarget).find('i').removeClass("fa-stop").addClass("fa-angle-right")
            $('.didYouKnow').off('click')
            $('.didYouKnow .closeDidYou').click(() => $('.didYouKnow').remove())
        }else{
            fetch(`systems/dsa5/lazy/didyouknow/${game.i18n.lang}.json`).then(async r => r.json()).then(async json => {
                const msg = json.data[Math.floor(Math.random() * json.data.length)];
                const didYouKnow = await renderTemplate("systems/dsa5/templates/system/didyouknow.html", { msg, fadeOut: DidYouKnow.fadeOut })
                $('body').find('.didYouKnow').replaceWith(didYouKnow)
                DidYouKnow.activateListeners()
            })
        }
    }

    static activateListeners(){
        $('.didYouKnow .stopFade').click(async(ev) => await this.stopFade(ev))
        $('.didYouKnow').click(() => $('.didYouKnow').remove())
        $('.didYouKnow').fadeIn()
    }

    static async showOneMessage(timeout = 8000) {
        if (game.settings.get("dsa5","disableDidYouKnow")) return

        fetch(`systems/dsa5/lazy/didyouknow/${game.i18n.lang}.json`).then(async r => r.json()).then(async json => {
            const msg = json.data[Math.floor(Math.random() * json.data.length)];
            const didYouKnow = await renderTemplate("systems/dsa5/templates/system/didyouknow.html", { msg, fadeOut: DidYouKnow.fadeOut })
            $('body').append(didYouKnow)
            this.activateListeners()
            setTimeout(function() {
                if(DidYouKnow.fadeOut) $('.didYouKnow').fadeOut(1000, () => $('.didYouKnow').remove());
            }, timeout);
        })
    }
}