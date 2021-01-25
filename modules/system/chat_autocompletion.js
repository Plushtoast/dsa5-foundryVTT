import DSA5_Utility from "./utility-dsa5.js"

export default class DSA5ChatAutoCompletion {
    //Special thanks to BlueBirdBlackSky and DJ Addi

    constructor() {
        this.skills = []
        DSA5_Utility.allSkills().then(res => {
            this.skills = res.map(x => x.name)
        })
        this.regex = /^\/sk /
        this.filtering = false
    }
    async chatListeners(html) {
        let target = this
        this.anchor = $('#chat-message').parent()
        $('#chat-message').off('keydown')
        html.on('keyup', '#chat-message', async function(ev) {
            target._filterSkills(ev)
        })
        html.on('click', '.quick-skill', async function(ev) {
            target._quickSkill($(ev.currentTarget).text())
        })
        html.on('keydown', '#chat-message', function(ev) {
            target._navigateQuickFind(ev)
        })

    }

    _filterSkills(ev) {
        let val = ev.target.value
        if (this.regex.test(val)) {
            if ([38, 40, 13].includes(ev.which))
                return false

            let search = val.substring(3).toLowerCase().trim()
            let result = this.skills.filter(x => { return x.toLowerCase().trim().indexOf(search) != -1 }).slice(0, 5)
            if (!result.length)
                result.push(game.i18n.localize("Error.noMatch"))

            let html = $(`<div class="quickfind dsalist"><ul><li class="quick-skill">${result.join("</li><li class=\"quick-skill\">")}</li></ul></div>`)
            html.find('.quick-skill:first').addClass("focus")
            let quick = this.anchor.find(".quickfind")
            if (quick.length) {
                quick.replaceWith(html)
            } else {
                this.anchor.append(html)
            }
            this.filtering = true
        } else {
            this.filtering = false
            this.anchor.find(".quickfind").remove()
        }
    }

    _navigateQuickFind(ev) {
        if (this.filtering) {
            let target = this.anchor.find('.focus')
            switch (ev.which) {
                case 38: // Up
                    if (target.prev(".quick-skill").length)
                        target.removeClass("focus").prev(".quick-skill").addClass("focus")
                    return false;
                case 40: // Down
                    if (target.next(".quick-skill").length)
                        target.removeClass("focus").next(".quick-skill").addClass("focus")
                    return false;
                case 13: // Enter
                    ev.stopPropagation()
                    ev.preventDefault()
                    this._quickSkill(target.text());
                    return false;
            }
        }
        ui.chat._onChatKeyDown(ev);
    }

    _quickSkill(skillName) {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        if (!actor) {
            ui.notifications.error(game.i18n.localize("Error.noProperActor"))
            return
        }

        $('#chat-message').val("")
        this.anchor.find(".quickfind").remove()

        let skill = actor.items.find(i => i.name == skillName && i.type == "skill")
        if (skill) {
            actor.setupSkill(skill.data).then(setupData => {
                actor.basicTest(setupData)
            });
        }
    }

}