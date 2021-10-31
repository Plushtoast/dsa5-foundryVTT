export default class DidYouKnow {
    static async showOneMessage() {
        if (game.settings.get("dsa5","disableDidYouKnow")) return

        fetch(`systems/dsa5/lazy/didyouknow/${game.i18n.lang}.json`).then(async r => r.json()).then(async json => {
            const msg = json.data[Math.floor(Math.random() * json.data.length)];
            const didYouKnow = `
                <div class="didYouKnow">
                    <div class="row-section">
                        <div class="col five">
                            <img src="systems/dsa5/icons/categories/DSA-Auge.webp" height="40px" width="40px"/>
                        </div>
                        <div class="col eighty">
                            <div class="row-section">
                                <div class="col ninety">
                                <h3>${game.i18n.localize('didyouknow')}</h3>
                                </div>
                                <div class="col ten right">
                                    <a class="closeDidYou"><i class="fas fa-times"></i></a>
                                </div>
                            </div>
                            <div class="row-section">
                                <div class="col">
                                <p>${msg}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
            $('body').append(didYouKnow)
            $('.didYouKnow').click(() => $('.didYouKnow').remove())
            $('.didYouKnow').fadeIn()
            setTimeout(function() {
                $('.didYouKnow').fadeOut(1000, () => {
                    $('.didYouKnow').remove()
                });
            }, 4000);
        })

    }
}