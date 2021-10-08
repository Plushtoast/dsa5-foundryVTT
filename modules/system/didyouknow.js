export default class DidYouKnow {
    static messages = {
        de: [
            "Du kannst Gegenstände verzaubern, indem du Zauber aus Kompendien auf das Gegenstandsblatt ziehst.",
            "Du kannst Gegenstände in deinem Inventar duplizieren, wenn du STRG hälst und den Gegenstand auf deinem Char Blatt bewegst.",
            "Du kannst die Fähigkeiten und Gegenstände deines Charakters aktualisieren, indem du auf das Kettensymbol auf deinem Charakterblatt klickst.",
            "Du kannst Gegenstände in Taschen ziehen, um dein Inventar sauber zu halten oder die Tasche samt Gewicht schnell abzulegen",
            "Du kannst Schicksalspunkte verwenden, indem du mit der rechten Maustaste auf die Chatnachrichten klickst.",
            "Du kannst Verbrauchsgegenstände benutzen indem du mit der rechten Maustaste im Inventar darauf klickst.",
            "Im Chat /help einzugeben, zeigt dir ein paar nützliche Befehle.",
            "Mit /w im Chat kannst du Spieler anflüstern.",
            "Du kännst Händler- und Schatzcharaktere anlegen, mit denen Spielern direkt Gegenstände tauschen können.",
            "Der Gehirn Button in der Bibliothek stellt ein paar verbesserte Filter zur Verfügung.",
            "Ausrüstung vom Typ Dienstleistung wird bei Händlern nicht ins Spielerinventar übertragen (z.b. der Haarschnitt).",
            "Begleiter und Verbündete lassen sich durch hinzufügen der gleichnamigen Fähigkeit zu Kreaturen erstellen.",
            "Im Spielleitermenü kann man sich ein zufälliges Spieleropfer auswürfeln.",
            "Du kannst temporäre Modifikatoren zur Regeneration im Tab Eigenschaften hinzufügen.",
            "Die Systemeinstellungen erlauben die Verwendung einiger optionaler Regeln.",
            "Du kannst Fähigkeiten deines Charakters in die Hotbar ziehen, indem du auf deinem Charakterblatt den zugehörigen Würfel in die Leiste ziehst.",
            "Einige Module erlauben dem Spielleiter die Gestaltwandlung. Dazu muss die jeweilige Kreatur auf das Charakterblatt gezogen werden.",
            "Du kannst Gifte und Krankheiten auswürfeln, indem du auf dem Gegenstandsblatt das Würfelicon anklickst.",
            "Du kannst Segen und Zaubertricks benutzen indem du den Würfelbutton auf dem Gegenstandsblatt anklickst.",
            "Die Sichtautomatisierung setzt Sichtmodifikatoren für den Kampf (inklusive Dunkelsicht).",
            "Du kannst deine Waffe vergiften, indem du Gift auf das Gegenstandsblatt ziehst. Jedes mal wenn du die Giftprobe durchführst, wird eine Ladung abgezogen.",
            "ALT halten, während du einen Token auf die Map ziehst, platziert diesen unsichtbar.",
            "Rechtsklick auf Grafiken auf den Sheets, in Journals, Bibliothek und Journalbrowser exponiert die Grafik, um sie anschließend den Spielern zu zeigen.",
            "Journals auf den Journalbrowser zu ziehen erzeugt ein Bookmark.",
            "Der Namenlose wird dich heute holen.",
            "Du hast heute ein Vorstellungsgespräch als Futter beim Drachen von nebenan.",
            "Eine Begabung lässt sich durch Rechtsklick auf die passende Chatnachricht verwenden.",
            "Du kannst mit allem parieren...sogar Zaubern (dem System ist das Wurst).",
            "Du kannst einen Vertrauten erstellen, indem du ihm die gleichnamige Eigenschaft gibst (AP/Bonuswerte)",
            "Das Modul \"times-up\" kann Active Effects automatisch nach Ablauf ihrer Wirkungsdauer entfernen."
        ],
        esclusivede: [
            "Im Kompendium kannst du Regeln für Trefferzonen aktivieren."
        ],
        en: [
            "You can enchant items by dragging spells from compendiums to the item sheet.",
            "You can duplicate items in your inventory by dragging and dropping them on your sheet while holding CTRL",
            "You can update your skills and items by clicking the chains symbol on your character sheet.",
            "You can drag items into bags to keep your inventory clean and drop bags quickly reducing your overall weight.",
            "You can use fate points by right clicking on roll messages in the chat.",
            "You can use consumables by right clicking in the inventory on those.",
            "Typing /help in the chat shows some quick commands.",
            "You can whisper to players by typing /w in the chat.",
            "You can create merchant and loot actors, which can exchange items with players directly.",
            "The brain button in the library provides some more advanced filtering options.",
            "Equipment of category service is not transferred to players for merchant sheets (e.g. for hair cuts)",
            "Companions and familiars can be created by adding the corresponding ability to the creature sheet.",
            "The game master's menu can roll a random player victim.",
            "You can add temporary modifiers to regeneration in the tab attributes.",
            "The system settings allow the usage of some optional rules.",
            "You can drop skills to the hotbar, by dragging them from your charactersheet onto the hotbar slots.",
            "Some modules provide the possibility to shapeshift for the GM. Drag and drop the creature onto the target character sheet.",
            "You can roll poisons and diseases by clicking on the dice icon on the item sheet.",
            "You can use blessings and cantrips by clicking the dice button on the item sheet.",
            "The sight automation adjusts vision modifiers in the combat (including dark sight).",
            "You can poison your weapon by dragging poison onto the item sheet. This will deduct one charge of poison each time you roll on it.",
            "Holding ALT while dragging a token onto the map results in placing the token invisibly.",
            "Right clicking on images on sheets, journals, library and journalbrowser opens those in a separate window ready to be shown to players.",
            "Dropping journal entries onto the journal browser bookmarks those.",
            "The Nameless One is going to catch you today.",
            "You've got a job interview today as fodder for the dragon from next door.",
            "Your aptitude can be used via a right click on the corresponding chat message.",
            "You can parry with anything...even spells if you have to (the system doesn't care).",
            "You can create familiars by adding the trait familiar to a creature (AP/Bonus values)",
            "The module \"times-up\" can automatically remove active effects once they expired."
        ],
        esclusiveen: []
    }

    static showOneMessage() {
        const lang = ["de", "en"].includes(game.i18n.lang) ? game.i18n.lang : "en"
        const aMsg = this.messages[lang].concat(this.messages[`exclusive${lang}`])
        const msg = aMsg[Math.floor(Math.random() * aMsg.length)];
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
        $('.closeDidYou').click(() => $('.didYouKnow').remove())
        $('.didYouKnow').fadeIn()
        setTimeout(function() {
            $('.didYouKnow').fadeOut(1000, () => {
                $('.didYouKnow').remove()
            });
        }, 5000);
    }
}