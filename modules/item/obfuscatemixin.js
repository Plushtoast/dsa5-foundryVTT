export const ItemSheetObfuscation = (superclass) => class extends superclass {
    async obfuscateItem(ev){
        ev.stopPropagation()
        ev.preventDefault()
        const section = ev.currentTarget.dataset.obfuscate
        await this.item.update({[`system.obfuscation.${section}`]: !this.isObfuscated(section)})
    }

    isObfuscated(section){
        return getProperty(this.item, `system.obfuscation.${section}`)
    }

    activateListeners(html){
        super.activateListeners(html)
        html.on('click', '.obfuscateSection', (ev) => this.obfuscateItem(ev))
    }

    obfuscationCss(section){
        return this.isObfuscated(section) ? "" : " pale"
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        const tabs = ["details", "effects", "description", "enchantment"]
        let swaptab = false
        for(let tab of tabs){
            const ele = $(this._element).find(`nav [data-tab="${tab}"]`)
            if(!ele.length) continue

            const invisible = options.tabsinvisible ||this.isObfuscated(tab)
            const tooltip = game.i18n.localize(`SHEET.${invisible ? "deobfuscateItem" : "obfuscateItem"}`)
            if(game.user.isGM){
                ele.append(` <a data-tooltip="${tooltip}" class="obfuscateSection${this.obfuscationCss(tab)}" data-obfuscate="${tab}"><i class="fas fa-mask"></i></a>`)
            }else if(invisible){
                if(ele.hasClass('active')) swaptab = true
                ele.remove()

                if(tab == "details"){
                    $(this._element).find('[name="system.price.value"],[name="system.price.raw"]').replaceWith('<label>?</label>')
                }
            }
            
        }
        if(swaptab){
            const tabs = $(this._element).find('nav .item:first-child')
            if(tabs.length){
                this.activateTab(tabs.attr("data-tab"))
            }else {
                const templ = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.html', {item: this.item})
                $(this._element).find('.content').html(templ)
            }
        }
        
    }
}