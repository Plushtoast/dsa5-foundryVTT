import PostRollBuffs from '../../system/rolls/postroll-buffs.js';
import { RollDialogBurgerMenuRule } from './base-burger-menu-rule.js';

const VISION_DEITY_COOLDOWN_SECONDS = 24 * 60 * 60;
const VISION_DEITY_LAST_USED_FLAG = 'visionDeityLastUsed';

class VisionOfTheDeityBurgerMenu extends RollDialogBurgerMenuRule {
    constructor() {
        super({ abilityNameKey: 'LocalizedIDs.visionOfTheDeity' });
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
        await actor.setFlag('dsa5', VISION_DEITY_LAST_USED_FLAG, game.time.worldTime ?? 0);
        this.clickRollButton(dialogState);

        const setupData = await actor.setupSkill(skill, {}, dialogState.speaker?.token ?? actor.sheet?.getTokenId?.());
        if (!setupData) return;

        setupData.testData.opposable = false;
        const result = await actor.basicTest(setupData);
        const testResult = result?.result || result;

        if (testResult?.successLevel > 0) {
            const qualityStep = testResult.qs ?? testResult.qualityStep ?? 1;
            const charges = Math.ceil(qualityStep / 2);

            await actor.createEmbeddedDocuments('ActiveEffect', [this.#buildEffectData(actor, charges)]);
            ui.notifications.info(game.i18n.format('VISION_DEITY.gained', { anzahl: charges }));
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
        const lastUsed = Number(actor.getFlag('dsa5', VISION_DEITY_LAST_USED_FLAG));
        const currentTime = Number(game.time.worldTime ?? 0);

        return Number.isFinite(lastUsed) && Number.isFinite(currentTime) && currentTime - lastUsed < VISION_DEITY_COOLDOWN_SECONDS;
    }

    #buildEffectData(actor, charges) {
        return {
            name: this.abilityName,
            icon: 'icons/svg/aura.svg',
            origin: actor.uuid,
            duration: {
                value: VISION_DEITY_COOLDOWN_SECONDS,
                units: 'seconds',
            },
            system: {
                changes: [
                    {
                        key: PostRollBuffs.POST_ROLL_KEYS.REROLL,
                        type: 'custom',
                        value: 'any 3',
                    },
                ],
                charges: {
                    value: charges,
                    max: charges,
                },
            },
        };
    }
}

export function registerVisionOfTheDeityHooks() {
    const visionOfTheDeityBurgerMenu = new VisionOfTheDeityBurgerMenu();

    Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
        if (!visionOfTheDeityBurgerMenu.matches(dialogState)) return;
        menuItems.push(...visionOfTheDeityBurgerMenu.getBurgerMenuItems(dialogState));
    });
}
