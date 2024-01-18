import DSA5 from "../system/config-dsa5.js"

export function setEnrichers() {
    const rolls = { "Rq": "roll", "Gc": "GC", "Ch": "CH" }
    const icons = { "Rq": "dice", "Gc": "dice", "Ch": "user-shield", "AP": "trophy", "Pay": "coins", "GetPaid": "piggy-bank" }
    const titles = { "Rq": "", "Gc": `${game.i18n.localize("HELP.groupcheck")} `, "Ch": "", "AP": "", "Pay": "", "GetPaid": "" }
    const modRegex = /(-|\+)?\d+/
    const payRegex = /(-|\+)?\d+(\.\d+)?/
    const replaceRegex = /\[[a-zA-ZöüäÖÜÄ&; -]+/
    const replaceRegex2 = /[\[\]]/g
    const payStrings = {
        Pay: game.i18n.localize("PAYMENT.payButton"),
        GetPaid: game.i18n.localize("PAYMENT.getPaidButton"),
        AP: game.i18n.localize("MASTER.awardXP")
    }

    if (!DSA5.statusRegex) {
        let effects = DSA5.statusEffects.map(x => game.i18n.localize(x.name).toLowerCase())
        let keywords = ["status", "condition", "level", "levels"].map(x => game.i18n.localize(x)).join("|")
        DSA5.statusRegex = {
            effects: effects,
            regex: new RegExp(`(${keywords}) (${effects.join('|')})`, 'gi')
        }
    }


    CONFIG.TextEditor.enrichers.push(
        {
            pattern: /@(Rq|Gc|Ch)\[[a-zA-ZöüäÖÜÄ&; -]+ (-|\+)?\d+\]({[a-zA-ZöüäÖÜÄß\(\)&; -]+})?/g,
            enricher: (match, options) => {
                const str = match[0]
                const type = match[1]
                const mod = Number(str.match(modRegex)[0])
                const skill = str.replace(mod, "").match(replaceRegex)[0].replace(replaceRegex2, "").trim()
                const customText = str.match(/\{.*\}/) ? str.match(/\{.*\}/)[0].replace(/[\{\}]/g, "") : skill
                return $(`<a class="roll-button request-${rolls[type]}" data-type="skill" data-modifier="${mod}" data-name="${skill}" data-label="${customText}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${customText} ${mod}</a>`)[0]
            }
        },
        {
            pattern: /@(Pay|GetPaid|AP)\[(-|\+)?\d+(\.\d+)?\]({[a-zA-ZöüäÖÜÄß\(\)&; -]+})?/g,
            enricher: (match, options) => {
                const str = match[0]
                const type = match[1]
                const mod = Number(str.match(payRegex)[0])
                const customText = str.match(/\{.*\}/) ? str.match(/\{.*\}/)[0].replace(/[\{\}]/g, "") : payStrings[type]
                return $(`<a class="roll-button request-${type}" data-type="skill" data-modifier="${mod}" data-label="${customText}"><em class="fas fa-${icons[type]}"></em>${titles[type]}${customText} (${mod})</a>`)[0]
            }
        },
        {
            pattern: DSA5.statusRegex.regex,
            enricher: (match, options) => {
                return $(conditionsMatcher(match))[0]
            }
        },
        {
            pattern: /@Info\[[a-zA-ZöüäÖÜÄ&; -\.0-9]+\]/g,
            enricher: async(match, options) => {
                let uuid = match[0].match(/(?:\[)(.*?)(?=\])/)[0].slice(1)
                const item = await fromUuid(uuid)

                if(!item || item.type != "information") return $('<a class="content-link broken"><i class="fas fa-unlink"></i>info</a>')[0]
                if(!game.user.isGM) return $(`<a class="content-link"><i class="fas fa-mask"></i>${game.i18n.localize('GM notes')}</a>`)[0]

                const enriched = {
                    enrichedqs1: await TextEditor.enrichHTML(item.system.qs1, { async: true }),
                    enrichedqs2: await TextEditor.enrichHTML(item.system.qs2, { async: true }),
                    enrichedqs3: await TextEditor.enrichHTML(item.system.qs3, { async: true }),
                    enrichedqs4: await TextEditor.enrichHTML(item.system.qs4, { async: true }),
                    enrichedqs5: await TextEditor.enrichHTML(item.system.qs5, { async: true }),
                    enrichedqs6: await TextEditor.enrichHTML(item.system.qs6, { async: true }),
                    enrichedCrit: await TextEditor.enrichHTML(item.system.crit, { async: true }),
                    enrichedBotch: await TextEditor.enrichHTML(item.system.botch, { async: true }),
                    enrichedFail: await TextEditor.enrichHTML(item.system.fail, { async: true }),
                }

                const templ = await renderTemplate("systems/dsa5/templates/items/infopreview.html", { item, enriched })
                return $(templ)[0]
            }
        },
        {
            pattern: /@EmbedItem\[[a-zA-ZöüäÖÜÄ&ë;'\(\)„“:,’ -\.0-9›‹âïßôñé\/]+\]({[a-zA-Z=]+})?/g,
            enricher: async(match, options) => {
                let uuid = match[0].match(/(?:\[)(.*?)(?=\])/)[0].slice(1)
                let document = await fromUuid(uuid)

                if(!document) {
                    const parts = uuid.split(".")
                    const pack = game.packs.get(parts[0] + "." + parts[1])
                    if(pack){
                        document = await pack.getDocuments({name: parts[2]})
                        document = document[0]
                    }
                }

                if(!document) return $('<a class="content-link broken"><i class="fas fa-unlink"></i></a>')[0]

                const str = match[0]
                const customText = str.match(/\{.*\}/) ? str.match(/\{.*\}/)[0].replace(/[\{\}]/g, "") : ""

                let customOptions = {}
                if(customText) {
                    for(const el of customText.split(" ")) {
                        const parts = el.split("=")
                        if(parts.length == 2)
                            customOptions[parts[0]] = parts[1]
                    }
                }

                const template = `systems/dsa5/templates/items/browse/${document.type}.html`
                const item = await renderTemplate(template, { document, isGM: game.user.isGM, ...(await document.sheet.getData()), ...customOptions})
                return $(item)[0]
            }
        },
        {
            pattern: /@PostChat\[(.*?)\]/g,
            enricher: async(match, options) => {
                const content = match[1]
                return $(`<div class="row-section wrap maskfield postChatSection"><div class="col ninety"></div><div class="col ten center postContentChat" data-tooltip="SHEET.PostItem"><em class="far fa-comment-dots"></em></div><div class="col postChatContent">${content}</div></div>`)[0]
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