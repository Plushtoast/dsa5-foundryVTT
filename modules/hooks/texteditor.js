import DSA5 from "../system/config-dsa5.js"

export function setEnrichers() {
    const rolls = { "Rq": "roll", "Gc": "GC", "Ch": "CH" }
    const icons = { "Rq": "dice", "Gc": "dice", "Ch": "user-shield" }
    const titles = { "Rq": "", "Gc": `${game.i18n.localize("HELP.groupcheck")} `, "Ch": "" }
    const modRegex = /(-|\+)?\d+/
    const replaceRegex = /\[[a-zA-zöüäÖÜÄ&; -]+/
    const replaceRegex2 = /[\[\]]/g

    if (!DSA5.statusRegex) {
        let effects = DSA5.statusEffects.map(x => game.i18n.localize(x.label).toLowerCase())
        let keywords = ["status", "condition", "level", "levels"].map(x => game.i18n.localize(x)).join("|")
        DSA5.statusRegex = {
            effects: effects,
            regex: new RegExp(`(${keywords}) (${effects.join('|')})`, 'gi')
        }
    }

    CONFIG.TextEditor.enrichers.push(
        {
            pattern: /@(Rq|Gc|Ch)\[[a-zA-zöüäÖÜÄ&; -]+ (-|\+)?\d+\]/g,
            enricher: (match, options) => {
                const str = match[0]
                const type = match[1]
                const mod = Number(str.match(modRegex)[0])
                const skill = str.replace(mod, "").match(replaceRegex)[0].replace(replaceRegex2, "").trim()
                return $(`<a class="roll-button request-${rolls[type]}" data-type="skill" data-modifier="${mod}" data-name="${skill}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${skill} ${mod}</a>`)[0]
            }
        },
        {
            pattern: DSA5.statusRegex.regex,
            enricher: (match, options) => {
                return $(conditionsMatcher(match))[0]
            }
        },
        {
            pattern: /@Info\[[a-zA-zöüäÖÜÄ&; -\.0-9]+\]/g,
            enricher: async(match, options) => {
                let uuid = match[0].match(/(?<=\[)(.*?)(?=\])/)[0]
                const item = await fromUuid(uuid)
                if(!item || item.type != "information") return $('<a class="content-link broken"><i class="fas fa-unlink"></i>info</a>')[0]
                if(!game.user.isGM) return $(`<a class="content-link"><i class="fas fa-mask"></i>${game.i18n.localize('GM notes')}</a>`)[0]

                const templ = await renderTemplate("systems/dsa5/templates/items/infopreview.html", { item })
                return $(templ)[0]
            }
        })
}

export function conditionsMatcher(match){
    const str = match[0]
    let parts = str.split(" ")
    const elem = parts.shift()
    parts = parts.join(" ")
    const cond = DSA5.statusEffects[DSA5.statusRegex.effects.indexOf(parts.toLowerCase())]
    return `<span>${elem} <a class="chatButton chat-condition" data-id="${cond.id}"><img src="${cond.icon}"/>${parts}</a></span>`
}