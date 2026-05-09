import { RollDialogBurgerMenuRule } from './base-burger-menu-rule.js';

const VISION_FAITH_COOLDOWN_SECONDS = 24 * 60 * 60;
const VISION_FAITH_DURATION_SECONDS = 12 * 60 * 60;
const VISION_FAITH_LAST_USED_FLAG = 'visionFaithLastUsed';

class VisionOfTrueFaithBurgerMenu extends RollDialogBurgerMenuRule {
    constructor() {
        super({ abilityNameKey: 'LocalizedIDs.visionOfTrueFaith' });
    }

    matches(dialogState) {
        return super.matches(dialogState) && dialogState?.source?.type === 'regenerate';
    }

    getBurgerMenuItems(dialogState) {
        return [
            {
                label: this.abilityName,
                icon: '<span class="schip tiny fullSchip"></span>',
                onClick: async () => this.#onClick(dialogState),
            },
        ];
    }

    async #onClick(dialogState) {
        const actor = dialogState.actor;
        if (!actor) return;

        const currentFate = foundry.utils.getProperty(actor.system, 'status.fatePoints.value') ?? 0;
        if (currentFate <= 0) {
            ui.notifications.warn(this.#formatVisionMessage('noFate', actor));
            return;
        }

        if (this.#isOnCooldown(actor)) {
            ui.notifications.warn(this.#formatVisionMessage('alreadyUsed', actor));
            return;
        }

        const skill = this.#getReligionsSkill(actor);
        if (!skill) {
            ui.notifications.error(this.#formatVisionMessage('noSkill', actor));
            return;
        }

        await actor.update({ 'system.status.fatePoints.value': currentFate - 1 });
        await actor.setFlag('dsa5', VISION_FAITH_LAST_USED_FLAG, game.time.worldTime ?? 0);
        if (!this.clickRollButton(dialogState)) ui.notifications.warn(_loc('VISIONS.autoRollFailed'));

        const setupData = await actor.setupSkill(skill, {}, dialogState.speaker?.token ?? actor.sheet?.getTokenId?.());
        if (!setupData) return;

        setupData.testData.opposable = false;
        const result = await actor.basicTest(setupData);
        const testResult = result?.result || result;

        if (testResult?.successLevel > 0) {
            const qualityStep = testResult.qs ?? testResult.qualityStep ?? 1;
            const bonuses = this.#getBonuses(qualityStep);
            const effectData = this.#buildEffectData(actor, bonuses);

            if (effectData.system.changes.length > 0) {
                await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
                ui.notifications.info(game.i18n.format('VISION_FAITH.gained', { name: actor.name, wp: bonuses.willpower, sk: bonuses.soulpower }));
            } else {
                ui.notifications.info(game.i18n.format('VISION_FAITH.noBonus', { qs: qualityStep, name: actor.name }));
            }
        } else {
            ui.notifications.warn(this.#formatVisionMessage('testFailed', actor));
        }
    }

    #formatVisionMessage(key, actor) {
        return game.i18n.format(`VISIONS.${key}`, {
            name: actor.name,
            vision: this.abilityName,
            skill: this.#getSkillName(),
        });
    }

    #getSkillName() {
        return _loc('LocalizedIDs.religions');
    }

    #getReligionsSkill(actor) {
        const skillName = this.#getSkillName();
        return actor.items.find(item => item.type === 'skill' && item.name === skillName);
    }

    #isOnCooldown(actor) {
        const lastUsed = Number(actor.getFlag('dsa5', VISION_FAITH_LAST_USED_FLAG));
        const currentTime = Number(game.time.worldTime ?? 0);

        return Number.isFinite(lastUsed) && Number.isFinite(currentTime) && currentTime - lastUsed < VISION_FAITH_COOLDOWN_SECONDS;
    }

    #getBonuses(qualityStep) {
        return {
            willpower: [1, 2, 4, 5].filter(threshold => qualityStep >= threshold).length,
            soulpower: [3, 6].filter(threshold => qualityStep >= threshold).length,
        };
    }

    #buildEffectData(actor, bonuses) {
        const effectData = {
            name: this.abilityName,
            icon: 'icons/svg/aura.svg',
            origin: actor.uuid,
            duration: {
                value: VISION_FAITH_DURATION_SECONDS,
                units: 'seconds',
            },
            system: {
                changes: [],
            },
        };

        if (bonuses.willpower > 0) {
            effectData.system.changes.push({
                key: 'system.skillModifiers.step',
                type: 'custom',
                value: `${_loc('LocalizedIDs.willpower')} ${bonuses.willpower}`,
            });
        }

        if (bonuses.soulpower > 0) {
            effectData.system.changes.push({
                key: 'system.status.soulpower.modifier',
                type: 'add',
                value: bonuses.soulpower,
            });
        }

        return effectData;
    }
}

export function registerVisionOfTrueFaithHooks() {
    const visionOfTrueFaithBurgerMenu = new VisionOfTrueFaithBurgerMenu();

    Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
        if (!visionOfTrueFaithBurgerMenu.matches(dialogState)) return;
        menuItems.push(...visionOfTrueFaithBurgerMenu.getBurgerMenuItems(dialogState));
    });
}