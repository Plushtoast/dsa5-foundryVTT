import DSA5StatusEffects from "../../status/status_effects.js";
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
            case 'systemEffect':
                ({ description, name } = await GlobalToolTipHandler._handleEffectTooltip(data, actor));
                break;
            case 'skillgm':
                ({ tooltip } = await GlobalToolTipHandler._handleSkillGmTooltip(data));
                break;
            case 'effect':
                ({ description, name } = await GlobalToolTipHandler._handleEffectTooltip(data, actor));
                break;
            case 'onUse':
                ({ description } = await GlobalToolTipHandler._handleOnUseTooltip(data, actor));
                break;
            case 'zbrawl':
                tooltip = name;
                break;
            case 'skill':
            case 'unequipped':
            case 'consumable':
            case 'weapon':
            case 'spell':
                ({ description } = await GlobalToolTipHandler._handleItemTooltip(data, actor));
                break;
            case 'enchantment':
                ({ description, name } = await GlobalToolTipHandler._handleEnchantmentTooltip(data, actor));
                break;
            case 'plain':
                description = data.betterTooltip;
                break;
            case 'actorSummary':
                description = await GlobalToolTipHandler._actorSummaryTooltip(data, actor);
                break;
            case 'rangeweaponDetails':
                description = await GlobalToolTipHandler._rangeweaponDetailsTooltip(data, actor);
                break;
            default:
                return;
        }
        if (name || description) {
            const parts = [];
            if (name) parts.push(`<h1>${name}</h1>`);
            if (description) parts.push(description);
            tooltip = `<div class="itemTooltip">${parts.join('')}</div>`;
        }

        if (!tooltip) return;

        const tooltipConnector = target.closest('.tooltipConnector');
        game.tooltip.activate(tooltipConnector || target, {
            html: tooltip,
            cssClass: 'dsatooltip'
        });

        if (tooltipConnector) return;

        target.dataset.tooltipHtml = tooltip;
        target.dataset.tooltipClass = 'dsatooltip';
    }

    static async _handleSkillGmTooltip(data) {
        return {
            tooltip: _loc('TT.skillgm', { name: data.name })
        };
    }

    static async _handleEffectTooltip(data, actor) {
        let effect = actor?.effects.get(data.id);
        let description;
        let name;
        if (!effect) {
            effect = CONFIG.statusEffects.find(x => x.id === data.id);
            if (effect) {
                description = _loc(effect.description || effect.name);
                name = _loc(effect.name);
            }
        } else {
            const pips = {};
            await DSA5StatusEffects.enrichSheetEffect(pips, effect);
            description = game.i18n.has(effect.description) ? _loc(effect.description) : effect.description;
            if (pips.pips.length) {
                description = `
                <small class="flexrow gap2px ellipsis">
                    ${pips.pips.map(pip => `<small class="smallBoxItem flex0">${pip.content}</small>`).join('')}
                </small>
                <p>${description}</p>`;
            }
            name = effect.name;
        }
        return { description, name };
    }

    static async _actorSummaryTooltip(data, actor) {
        const attributes = [
            { label: _loc('actionCount'), value: actor.system.actionCount?.value, icon: 'fas fa-fist-raised' },
            { label: _loc('speed'), value: actor.system.status.speed.max, icon: 'fas fa-running' },
            { label: _loc('soulpower'), value: actor.system.status.soulpower.max, icon: 'fas fa-sun' },
            { label: _loc('toughness'), value: actor.system.status.toughness.max, icon: 'fas fa-shield-alt' },
        ];
        const effects = await actor.actorEffects();
        return await renderTemplate('systems/dsa5/templates/tooltips/actor_summary.hbs', { actor, attributes, effects });
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
        if (!item) return {};
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
                    hint: !data.skipHint,
                }),
            )
                .find('.groupbox')
                .html();
        }
        return { description };
    }

    static async _rangeweaponDetailsTooltip(data, actor) {
        const item = actor?.items.get(data.id);
        if (!item) return;

        let resolved = item.toObject();
        if (data.subweapon) {
            resolved = actor.constructor.buildSubweapon(resolved, data.subweapon);
        }

        let calculatedRange = resolved.system.reach.value;
        if (resolved.system.ammunitiongroup.value !== '-') {
            const currentAmmo = actor.items.get(resolved.system.currentAmmo.value);
            if (currentAmmo) {
                const rangeMultiplier = Number(currentAmmo.system.rangeMultiplier) || 1;
                calculatedRange = calculatedRange
                    .split('/')
                    .map((x) => Math.round(Number(x) * rangeMultiplier))
                    .join('/');
            }
        }

        const LZ = actor.constructor.calcLZ(resolved, actor);

        return await renderTemplate('systems/dsa5/templates/tooltips/rangeweapon_details.hbs', {
            calculatedRange,
            LZ,
            reloadProgress: resolved.system.reloadTime.progress,
        });
    }

    static async _handleEnchantmentTooltip(data, actor) {
        const ids = data.id.split('_');
        const item = actor?.items.get(ids[0]);
        let description;
        let name;
        if (item.system.obfuscation?.enchantment) {
            description = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.hbs', item);
            name = `${_loc('enchantment')} (${item.name})`;
        } else {
            const enchantment = item.getFlag('dsa5', 'enchantments').find((x) => x.id == ids[1]);
            name = `${enchantment.name} (${item.name})`;
            description = await renderTemplate('systems/dsa5/templates/items/enchantment-preview.hbs', { enchantment, document: item });
        }
        return { description, name };
    }
}