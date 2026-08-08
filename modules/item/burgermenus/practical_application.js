import { RollDialogBurgerMenuRule } from './base-burger-menu-rule.js';

const { ApplicationV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

class PracticalApplicationApp extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "praxisbezug-app",
        classes: ["dsa5", "praxis-window"],
        window: {
            resizable: true 
        },
        position: {
            width: 550,
            height: "auto"
        },

        actions: {
            rollKnowledge: function(event, target) { this._onRollKnowledge(event, target); },
            adjustPraxis: function(event, target) { this._onAdjustPraxis(event, target); },
            confirmPraxis: function() { this._onConfirmPraxis(); },
            cancelPraxis: function() { this.close(); }
        }
    };

    constructor(actor, parentDialog, parentTestData, burgerMenuRule, options) {
        super(options);
        this.dsaActor = actor;
        this.parentDialog = parentDialog;
        this.parentTestData = parentTestData;
        this.burgerMenuRule = burgerMenuRule;
        
        this.qs = 0;
        this.rolled = false;
        this.distributionData = [0, 0, 0];
    }

    get title() {
        return _loc('LocalizedIDs.practicalApplication');
    }

    async _renderHTML(context, options) {
        return await renderTemplate('systems/dsa5/templates/dialog/practical-application.hbs', context);
    }

    _replaceHTML(result, content, options) {
        content.innerHTML = result;
    }

    async _prepareContext(options) {
        if (this.rolled) {
            const source = this.parentTestData.source;
            const attrs = [source.system.characteristic1.value, source.system.characteristic2.value, source.system.characteristic3.value];
            
            const distribution = attrs.map((attr, idx) => ({
                idx: idx,
                label: game.i18n.localize(`CHARAbbrev.${attr.toUpperCase()}`),
                value: this.distributionData[idx]
            }));

            return {
                rolled: true,
                qs: this.qs,
                instruction: game.i18n.format('PRACTICAL_APPLICATION.instruction', { qs: this.qs }),
                limitText: _loc('PRACTICAL_APPLICATION.limit'),
                maxText: game.i18n.format('PRACTICAL_APPLICATION.maxPoints', { qs: this.qs }),
                distribution: distribution
            };
        } else {
            const skills = this.dsaActor.items
                .filter(i => i.type === "skill" && i.system.group?.value === "knowledge")
                .sort((a, b) => a.name.localeCompare(b.name));
            
            return {
                rolled: false,
                description: _loc('PRACTICAL_APPLICATION.description'),
                skills: skills.map(s => ({
                    id: s.id,
                    name: s.name,
                    img: s.img || 'systems/dsa5/icons/categories/Skill.webp',
                    value: s.system.talentValue?.value ?? 0,
                }))
            };
        }
    }


    async _onRollKnowledge(event, target) {
        const skillId = target.dataset.id;
        const skill = this.dsaActor.items.get(skillId);
        if (!skill) return;

        const setupData = await this.dsaActor.setupSkill(skill, {}, 'roll');
        if (!setupData) return;

        const result = await this.dsaActor.basicTest(setupData);
        if (result?.result?.successLevel > 0) {
            this.qs = result.result.qualityStep || 0;
            this.rolled = true;
            this.render();
        }
    }

    _onAdjustPraxis(event, target) {
        const idx = parseInt(target.dataset.idx);
        const delta = parseInt(target.dataset.delta);
        
        const newVal = Math.clamp(this.distributionData[idx] + delta, 0, 2);
        const totalUsed = this.distributionData.reduce((a, b) => a + b, 0) - this.distributionData[idx];
        
        if (totalUsed + newVal <= this.qs || delta < 0) {
            this.distributionData[idx] = newVal;
            this.render();
        }
    }

    _onConfirmPraxis() {
        const tpm = `${this.distributionData[0]}|${this.distributionData[1]}|${this.distributionData[2]}`;

        this.burgerMenuRule.upsertModifier(this.parentDialog, {
            name: this.burgerMenuRule.abilityName,
            value: tpm,
            type: 'TPM',
            selected: true,
            source: _loc('TYPES.Item.specialability'),
        });

        this.close(); 
    }
}

class PracticalApplicationBurgerMenu extends RollDialogBurgerMenuRule {
    constructor() {
        super({ abilityNameKey: 'LocalizedIDs.practicalApplication' });
    }

    matches(dialogState) {
        return super.matches(dialogState)
            && dialogState?.source?.type === 'skill'
    }

    getBurgerMenuItems(dialogState) {
        return [{
            label: this.abilityName,
            icon: '<i class="fas fa-lightbulb"></i>',
            onClick: async () => this.#onClick(dialogState),
        }];
    }

    async #onClick(dialogState) {
        if (this.hasModifierApplied(dialogState.dialog, this.abilityName)) {
            ui.notifications.warn(_loc('PRACTICAL_APPLICATION.alreadyApplied'));
            return;
        }

        new PracticalApplicationApp(dialogState.actor, dialogState.dialog, dialogState.testData, this).render(true);
    }
}

export function registerPracticalApplicationHooks() {
    const practicalApplicationBurgerMenu = new PracticalApplicationBurgerMenu();

    Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
        if (!practicalApplicationBurgerMenu.matches(dialogState)) return;
        menuItems.push(...practicalApplicationBurgerMenu.getBurgerMenuItems(dialogState));
    });
}