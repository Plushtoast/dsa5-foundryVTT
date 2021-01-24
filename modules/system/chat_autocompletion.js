import DSA5_Utility from "./utility-dsa5.js"

export default class DSA5ChatAutoCompletion {
    constructor() {
        this.skills = []
        DSA5_Utility.allSkills().then(res => {
            this.skills = res.map(x => x.name)
        })
        this.regex = /^\/sk /
    }
    async chatListeners(html) {
        let target = this
        html.on('keyup', '#chat-message', async function(ev) {
            target._filterSkills(ev)
        })
        html.on('click', '.quick-skill', async function(ev) {
            target._quickSkill(ev)
        })
    }

    _filterSkills(ev) {
        let val = ev.target.value
        if (regex.test(val)) {
            let search = val.substring(3).toLowerCase().trim()
            let result = this.skills.filter(x => { return x.toLowerCase().trim().indexOf(search) != -1 }).slice(0, 5)
            let html = `<div class="quickfind dsalist"><ul><li><a class="quick-skill">${result.join("</li><li>")}</a></li></ul></div>`
            let quick = $(ev.currentTarget).parent().find(".quickfind")
            if (quick.length) {
                quick.replaceWith($(html))
            } else {
                $(ev.currentTarget).parent().append($(html))
            }

        } else {
            $(ev.currentTarget).parent().find(".quickfind").remove()
        }
    }

    _quickSkill(ev) {
        let skillName = $(ev.currentTarget).text()
        $(ev.currentTarget).closest('.quickfind').remove()
        $('#chat-message').val("")

        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        if (!actor) {
            ui.notifications.error(game.i18n.localize("Error.noProperActor"))
            return
        }

        let skill = actor.items.find(i => i.name == skillName && i.type == "skill")
        actor.setupSkill(skill.data).then(setupData => {
            actor.basicTest(setupData)
        });
    }

}