const { renderTemplate } = foundry.applications.handlebars;

export class GlobalToolTipHandler {
    static async handleTooltip(ev, actor) {
        const target = ev.currentTarget;
        const data = target.dataset;

        if ('tooltipClass' in target.dataset) return;

        const category = data.category?.split(' ')[0];
        let tooltip;
        let name = data.name;
        let description;

        switch (category) {
            case 'skillgm':
                ({ tooltip } = await this._handleSkillGmTooltip(data));
                break;
            case 'effect':
                ({ description, name } = await this._handleEffectTooltip(data, actor));
                break;
            case 'onUse':
                ({ description } = await this._handleOnUseTooltip(data, actor));
                break;
            case 'unequipped':
            case 'consumable':
            case 'weapon':
            case 'spell':
                ({ description } = await this._handleItemTooltip(data, actor));
                break;
            case 'enchantment':
                ({ description, name } = await this._handleEnchantmentTooltip(data, actor));
                break;
            default:
                return;
        }

        if (description) {
            tooltip = `<div class="itemTooltip"><h1>${name}</h1>${description}</div>`;
        }

        if (!tooltip) return;

        game.tooltip.activate(target, {
            html: tooltip,
            cssClass: 'dsatooltip'
        });
        target.dataset.tooltip = tooltip;
        target.dataset.tooltipClass = 'dsatooltip';
    }

    static async _handleSkillGmTooltip(data) {
        return {
            tooltip: game.i18n.format('TT.skillgm', { name: data.name })
        };
    }

    static async _handleEffectTooltip(data, actor) {
        let effect = actor?.effects.get(data.id);
        let description;
        let name;

        if (!effect) {
            effect = CONFIG.statusEffects.find(x => x.id === data.id);
            if (effect) {
                description = game.i18n.localize(effect.description);
                name = game.i18n.localize(effect.name);
            }
        } else {
            description = game.i18n.has(effect.description) ? game.i18n.localize(effect.description) : effect.description;
            name = effect.name;
        }

        return { description, name };
    }

    static async _handleOnUseTooltip(data, actor) {
        const item = actor?.items.get(data.id);
        let description;

        switch (item.type) {
            case 'specialability':
                description = item.system.rule?.value;
                break;
            case 'advantage':
            case 'disadvantage':
                break;
            default:
                description = item.system.description?.value;
        }

        return { description };
    }

    static async _handleItemTooltip(data, actor) {
        const item = actor?.items.get(data.id);
        const itemData = await item.sheet._prepareContext();
        let description;

        if (!game.user.isGM && itemData.document.system.obfuscation?.details) {
            description = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.hbs', itemData);
        } else {
            description = $(
                await renderTemplate(`systems/dsa5/templates/items/browse/${item.type}.hbs`, {
                    isGM: game.user.isGM,
                    ...itemData,
                    document: item,
                    skipHeader: true,
                    hint: true,
                }),
            )
                .find('.groupbox')
                .html();
        }

        return { description };
    }

    static async _handleEnchantmentTooltip(data, actor) {
        const ids = data.id.split('_');
        const item = actor?.items.get(ids[0]);
        let description;
        let name;

        if (item.system.obfuscation?.enchantment) {
            description = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.hbs', item);
            name = `${game.i18n.localize('enchantment')} (${item.name})`;
        } else {
            const enchantment = item.getFlag('dsa5', 'enchantments').find((x) => x.id == ids[1]);
            name = `${enchantment.name} (${item.name})`;
            description = await renderTemplate('systems/dsa5/templates/items/enchantment-preview.hbs', { enchantment, document: item });
        }

        return { description, name };
    }
}