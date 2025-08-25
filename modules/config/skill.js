const SOCIAL_MODIFIERS = [
    {
        label: 'SKILL_CHECK_MODIFIERS.SOCIAL.otherSpecies',
        min: -3,
        max: 0
    },
    {
        label: 'SKILL_CHECK_MODIFIERS.SOCIAL.socialState',
        min: 0,
        max: 1
    }
]

export const SKILL = {
    "Persuasion": [
        {
            group: 'SKILL_CHECK_MODIFIERS.GROUPS.socialconflict',
            modifiers: [
                ...SOCIAL_MODIFIERS,
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.holyLocation',
                    min: 0,
                    max: 3
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.holySymbol',
                    min: 0,
                    max: 2
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.passiveDonation',
                    min: 0,
                    max: 2
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.commonInterest',
                    min: 0,
                    max: 2
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.enemyImage',
                    min: -3,
                    max: 0
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.moralConflict',
                    min: -3,
                    max: 0
                }
            ]
        }
    ],
    "Seduction": [
        {
            group: 'SKILL_CHECK_MODIFIERS.GROUPS.socialconflict',
            modifiers: [
                ...SOCIAL_MODIFIERS,
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.interest',
                    min: 0,
                    max: 2
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.rahjaglaeubig',
                    min: 0,
                    max: 3
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.enthaltsam',
                    min: -3,
                    max: 0
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.married',
                    min: -3,
                    max: 0
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.forbiddenContact',
                    min: -2,
                    max: 0
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.badHabbit',
                    min: -2,
                    max: 0
                }
            ]
        }],
    "Fast-Talk": [
        {
            group: 'SKILL_CHECK_MODIFIERS.GROUPS.socialconflict',
            modifiers: [
                ...SOCIAL_MODIFIERS,
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.reputation',
                    min: -3,
                    max: 3
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.truthful',
                    min: 0,
                    max: 2
                },
                {
                    label: 'SKILL_CHECK_MODIFIERS.SOCIAL.knownLiar',
                    min: -2,
                    max: 0
                }
            ]
        }
    ]
}