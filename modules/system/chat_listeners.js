import DSA5 from "./config-dsa5.js"
import DSA5_Utility from "./utility-dsa5.js"

export default class DSA5ChatListeners {
    static chatListeners(html) {
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })
        let helpButton = $(`<a class="button showHelp" title="${game.i18n.localize('HELP.showHelp')}"><i class="fas fa-question"></i></a>`)
        helpButton.click(() => { DSA5ChatListeners.getHelp() })
        $(html.find('.control-buttons')).prepend(helpButton)
    }

    static postStatus(id) {
        let effect = CONFIG.statusEffects.find(x => x.id == id)
        let msg = `<h2><a class="chat-condition chatButton" data-id="${id}"><img class="sender-image" style="background-color:black;margin-right: 8px;" src="${effect.icon}"/>${game.i18n.localize(effect.label)}</h2></a><p>${game.i18n.localize(effect.description)}</p>`
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
    }

    static getHelp() {
            let msg = DSA5.helpContent.map(x => `<h2>${game.i18n.localize(`HELP.${x.name}`)}</h2>
            <p><b>${game.i18n.localize("HELP.command")}</b>: ${x.command}</p>
            <p><b>${game.i18n.localize("HELP.example")}</b>: ${x.example}</p>
            <p><b>${game.i18n.localize("Description")}</b>: ${game.i18n.localize(`HELP.descr${x.name}`)}`).join("") + `<br>
            <p>${game.i18n.localize("HELP.default")}</p>`
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
    }

    static showConditions(){
        let effects = duplicate(CONFIG.statusEffects).map(x => {
            x.label = game.i18n.localize(x.label)
            return x
        }).sort((a, b) => { return a.label.localeCompare(b.label) })
        let msg = effects.map(x => `<a class="chat-condition chatButton" data-id="${x.id}"><img src="${x.icon}"/>${x.label}</a>`).join(" ")
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
    }

    static async check3D20(){
        let skill = {
            name: "3d20",
            type: "skill",
            data: {
                "talentValue": { "value": 0 },
                "characteristic1": { "value": "mu" },
                "characteristic2": { "value": "kl" },
                "characteristic3": { "value": "in" },
                "RPr": { "value": "no" },
                "burden": { "value": "no" }
            }
        }
       
        let actor = await Actor.create({
            name: "Alrik",
            type: "npc",
            items:[],
            data: {
                status:{wounds: {value:50}},
                characteristics: {
                    mu: {initial: 12},kl: {initial: 12},in: {initial: 12}, ch: {initial: 12},
                     ff: {initial: 12},ge: {initial: 12},ko: {initial: 12},kk: {initial: 12}
                }
            }
        },{temporary: true, noHook: true})

        actor.setupSkill(skill).then(setupData => {
            actor.basicTest(setupData)
        })      
    }

    static showTables(){
        let msg = `<a class="roll-button defense-botch" data-weaponless="false"><i class="fas fa-dice"></i>${game.i18n.localize('TABLENAMES.Defense')}</a>
        <a class="roll-button melee-botch" data-weaponless="false"><i class="fas fa-dice"></i>${game.i18n.localize('TABLENAMES.Melee')}</a>
        <a class="roll-button range-botch" data-weaponless="false"><i class="fas fa-dice"></i>${game.i18n.localize('TABLENAMES.Range')}</a>
        <a class="roll-button liturgy-botch"><i class="fas fa-dice"></i>${game.i18n.localize('TABLENAMES.Liturgy')}</a>
        <a class="roll-button spell-botch"><i class="fas fa-dice"></i>${game.i18n.localize('TABLENAMES.Spell')}</a>`
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
    }
}