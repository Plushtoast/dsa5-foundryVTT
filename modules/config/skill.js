const SOCIAL_MODIFIERS = [
    {
        label: 'SKILL_CHECK_MODIFIERS.SOCIAL.otherSpecies',
        collection: [0, -1, -2, -3]
    },
    {
        label: 'SKILL_CHECK_MODIFIERS.SOCIAL.socialState',
        collection: [0, 1]
    }
]

export const SKILL = {
    "Persuasion": {
        modifiers: [
            ...SOCIAL_MODIFIERS,
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.holyLocation',
                collection: [0, 1, 2, 3]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.holySymbol',
                collection: [0, 1, 2]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.passiveDonation',
                collection: [0, 1, 2]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.commonInterest',
                collection: [0, 1, 2]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.enemyImage',
                collection: [0, -1, -2, -3]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.moralConflict',
                collection: [0, -1, -2, -3]
            }
        ]
    },
    "Seduction": {
        modifiers: [
            ...SOCIAL_MODIFIERS,
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.interest',
                collection: [0, 1, 2]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.rahjaglaeubig',
                collection: [0, 1, 2, 3]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.enthaltsam',
                collection: [0, -1, -2, -3]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.married',
                collection: [0, -1, -2, -3]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.forbiddenContact',
                collection: [0, -1, -2]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.badHabbit',
                collection: [0, -1, -2]
            }
        ]
    },
    "Fast-Talk": {
        modifiers: [
            ...SOCIAL_MODIFIERS,
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.reputation',
                collection: [-3, -2, -1, 0, 1, 2, 3]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.truthful',
                collection: [0, 1, 2]
            },
            {
                label: 'SKILL_CHECK_MODIFIERS.SOCIAL.knownLiar',
                collection: [0, -1, -2]
            }
        ]
    }
}