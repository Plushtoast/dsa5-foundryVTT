import DSA5 from '../../config/config-dsa5.js';
import DiceDSA5 from '../../system/rolls/dice-dsa5.js';
import { RollDialogBurgerMenuRule } from './base-burger-menu-rule.js';
import { getSkillDialogEffectiveModifier } from './skill-dialog-roll-snapshot.js';

const { mergeObject } = foundry.utils;

const COMMON_KNOWLEDGE_PREDEFINED_RESULT = [
    { val: 2, index: 0 },
    { val: 2, index: 1 },
    { val: 2, index: 2 },
];

class CommonKnowledgeBurgerMenu extends RollDialogBurgerMenuRule {
    constructor() {
        super({ abilityNameKey: 'LocalizedIDs.commonKnowledge' });
    }

    matches(dialogState) {
        return super.matches(dialogState) && dialogState?.source?.type === 'skill' && dialogState.source.system?.group?.value === 'knowledge';
    }

    getBurgerMenuItems(dialogState) {
        return [
            {
                label: this.getMenuLabel(),
                icon: '<i class="fa-solid fa-book-open"></i>',
                onClick: async () => this.#onClick(dialogState),
            },
        ];
    }

    async #onClick(dialogState) {
        const effectiveModifier = await getSkillDialogEffectiveModifier(dialogState);
        if (effectiveModifier == null) return;

        if (effectiveModifier < -3) {
            ui.notifications.warn(_loc('COMMON_KNOWLEDGE.tooDifficult'));
            return;
        }

        const { testData } = dialogState;
        testData.extra ??= {};
        testData.extra.options ??= {};

        mergeObject(testData.extra.options, {
            cheat: true,
            commonKnowledge: true,
            predefinedResult: COMMON_KNOWLEDGE_PREDEFINED_RESULT.map(result => ({ ...result })),
        });
        testData.opposable = false;

        this.clickRollButton(dialogState);
    }
}

function createBurgerMenus(dialogState) {
    const handler = new CommonKnowledgeBurgerMenu();
    return handler.matches(dialogState) ? [handler] : [];
}

async function postProcessCommonKnowledgeRoll(testData) {
    if (!testData?.preData?.extra?.options?.commonKnowledge) return;

    testData.successLevel = 1;
    testData.qualityStep = 1;
    testData.result = 0;
    testData.description = DiceDSA5.getSuccessDescription(1);
    testData.other ??= [];

    const note = _loc('COMMON_KNOWLEDGE.applied');
    if (!testData.other.includes(note)) testData.other.push(note);
}

export function registerCommonKnowledgeHooks() {
    Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
        const handlers = createBurgerMenus(dialogState);
        for (const handler of handlers) menuItems.push(...handler.getBurgerMenuItems(dialogState));
    });

    if (!DSA5.asyncHooks.postProcessDSARoll.includes(postProcessCommonKnowledgeRoll)) {
        DSA5.asyncHooks.postProcessDSARoll.push(postProcessCommonKnowledgeRoll);
    }
}