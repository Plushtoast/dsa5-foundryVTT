const DSA5 = {}

//This cann also look like:
//{
//  id:
//    label:
//   icon: 
//}

CONFIG.statusEffects = [{
        id: "prone",
        label: "CONDITION.prone",
        icon: "icons/svg/falling.svg"
    },
    {
        id: "unconscious",
        label: "CONDITION.unconscious",
        icon: "icons/svg/unconscious.svg"
    },

    {
        id: "encumbered",
        label: "CONDITION.encumbered",
        icon: "icons/svg/anchor.svg"
    },
    {
        id: "drunken",
        label: "CONDITION.drunken",
        icon: "icons/svg/tankard.svg"
    },
    {
        id: "stunned",
        label: "CONDITION.stunned",
        icon: "icons/svg/daze.svg"
    },
    {
        id: "raptured",
        label: "CONDITION.raptured",
        icon: "icons/svg/ice-aura.svg"
    },
    {
        id: "feared",
        label: "CONDITION.feared",
        icon: "icons/svg/terror.svg"
    },
    {
        id: "paralysed",
        label: "CONDITION.paralysed",
        icon: "icons/svg/paralysis.svg"
    },
    {
        id: "inpain",
        label: "CONDITION.inpain",
        icon: "icons/svg/blood.svg"
    },
    {
        id: "tranced",
        label: "CONDITION.tranced",
        icon: "icons/svg/sun.svg"
    },
    {
        id: "overexerted",
        label: "CONDITION.overexerted",
        icon: "icons/svg/sleep.svg"
    },
    {
        id: "confused",
        label: "CONDITION.confused",
        icon: "icons/svg/stoned.svg"
    }

]
DSA5.statusEffects = [
    "CONDITION.prone",
    "CONDITION.unconscious",

    "CONDITION.encumbered",
    "CONDITION.drunken",
    "CONDITION.stunned",
    "CONDITION.raptured",
    "CONDITION.feared",
    "CONDITION.paralysed",
    "CONDITION.inpain",
    "CONDITION.tranced",
    "CONDITION.overexerted",
    "CONDITION.confused"
]

DSA5.defaultWeapon = {
    name: "default",
    data: {
        data: {

            reach: {
                value: "short"
            },
            damage: {
                value: "1d6"
            },
            atmod: {
                value: 0
            },
            pamod: {
                value: 0
            },
            guidevalue: {
                value: "ge/kk"
            },
            damageThreshold: {
                value: "5000"
            }
        }
    }
}

DSA5.characteristics = {
    "mu": "CHAR.MU",
    "kl": "CHAR.KL",
    "in": "CHAR.IN",
    "ch": "CHAR.CH",
    "ff": "CHAR.FF",
    "ge": "CHAR.GE",
    "ko": "CHAR.KO",
    "kk": "CHAR.KK"
};

DSA5.equipmentTypes = {
    "misc": "Equipment.misc",
    "clothes": "Equipment.clothes",
    "tools": "Equipment.tools",
    "light": "Equipment.light",
    "healing": "Equipment.healing",
    "bags": "Equipment.bags",
    "wealth": "Equipment.wealth",
    "writing": "Equipment.writing",
    "alchemy": "Equipment.alchemy",
    "service": "Equipment.service",
    "luxus": "Equipment.luxus"
};

DSA5.narrowSpaceModifiers = {

    "weaponshort": {
        "attack": 0,
        "parry": 0,
        "label": "NarrowSpaceModifiers.weapon.short"
    },
    "weaponmedium": {
        "attack": -4,
        "parry": -4,
        "label": "NarrowSpaceModifiers.weapon.medium"
    },
    "weaponlong": {
        "attack": -8,
        "parry": -8,
        "label": "NarrowSpaceModifiers.weapon.long"
    },

    "shieldshort": {
        "attack": -2,
        "parry": -2,
        "label": "NarrowSpaceModifiers.shield.short"
    },
    "shieldmedium": {
        "attack": -4,
        "parry": -3,
        "label": "NarrowSpaceModifiers.shield.medium"
    },
    "shieldlong": {
        "attack": -6,
        "parry": -4,
        "label": "NarrowSpaceModifiers.shield.long"
    }

}

DSA5.moneyNames = {
    "D": "Money-D",
    "S": "Money-S",
    "H": "Money-H",
    "K": "Money-K"
}

DSA5.rangeMods = {
    "short": {
        "damage": 1,
        "attack": 2
    },
    "medium": {
        "damage": 0,
        "attack": 0
    },
    "long": {
        "damage": -1,
        "attack": -2
    }

}

DSA5.regnerationCampLocations = {
    "0": "regnerationCampLocations.normal",
    "-1": "regnerationCampLocations.bad",
    "good": "regnerationCampLocations.good"
}

DSA5.regenerationInterruptOptions = {
    "0": "regenerationInterruptOptions.none",
    "-1": "regenerationInterruptOptions.small",
    "-2": "regenerationInterruptOptions.big"
}

DSA5.targetMomevementOptions = {
    "0": "rangeMovementOptions.SLOW",
    "-2": "rangeMovementOptions.FAST",
    "2": "rangeMovementOptions.STATIONARY",
}

DSA5.shooterMovementOptions = {
    "0": "rangeMovementOptions.SHOOTERSTATIONARY",
    "-2": "rangeMovementOptions.SHOOTERMOVING",
    "-4": "rangeMovementOptions.SHOOTERRUNNING"
}

DSA5.mountedRangeOptions = {
    "0": "mountedRangeOptions.STATIONARY",
    "-4": "mountedRangeOptions.SCHRITT",
    "-8": "mountedRangeOptions.GALOPP",
}

DSA5.traitCategories = {
    "meleeAttack": "closeCombatAttacks",
    "rangeAttack": "rangeCombatAttacks",
    "armor": "armor",
    "general": "general"
}

DSA5.ritualLocationModifiers = {
    "-": 0,
    "RITUALMODIFIER.holysite": 1,
    "RITUALMODIFIER.wrongsite": -3
}

DSA5.ritualTimeModifiers = {
    "-": 0,
    "RITUALMODIFIER.matchingConstellation": 1,
    "RITUALMODIFIER.wrongConstellation": -1
}

DSA5.ceremonyLocationModifiers = {
    "-": 0,
    "CEREMONYMODIFIER.holysite": 2,
    "CEREMONYMODIFIER.temple": 1,
    "CEREMONYMODIFIER.otherTemple": -1,
    "CEREMONYMODIFIER.enemyGod": -2,
    "CEREMONYMODIFIER.archDemon": -3,
    "CEREMONYMODIFIER.nameless": -4,
    "CEREMONYMODIFIER.nemesis": -5
}

DSA5.ceremonyTimeModifiers = {
    "-": 0,
    "CEREMONYMODIFIER.monthGod": 1,
    "CEREMONYMODIFIER.celebration": 2,
    "CEREMONYMODIFIER.namelessDays": -5
}


DSA5.mageLevels = {
    "mundane": "mundane",
    "clerical": "clerical",
    "magical": "magical"
}

DSA5.specialAbilityCategories = {
    "general": "general",
    "Combat": "Combat",
    "fatePoints": "fatePoints",
    "magical": "magical",
    "clerical": "clerical"
}

DSA5.dieColors = {
    "dodge": "ge"
}

DSA5.rangeWeaponModifiers = {
    "short": "RangeMod.short",
    "medium": "RangeMod.medium",
    "long": "RangeMod.long"
}

DSA5.meleeRangesArray = [
    "short",
    "medium",
    "long"
]

DSA5.meleeRanges = {
    "short": "Range-short",
    "medium": "Range-medium",
    "long": "Range-long"
};

DSA5.weapontypes = {
    "melee": "meleeweapon",
    "range": "rangeweapon"
}

DSA5.ammunitiongroups = {
    "-": "-",
    "arrow": "arrow",
    "bolt": "bolt",
    "bullet": "bullet",
    "stone": "stone"
}

DSA5.combatskillsGuidevalues = {
    "ff": "CHAR.FF",
    "ge": "CHAR.GE",
    "kk": "CHAR.KK",
    "ge/kk": "CHAR.GEKK"
}

DSA5.skillDifficultyModifiers = {
    "eeasy": 5,
    "veasy": 3,
    "easy": 1,
    "challenging": 0,
    "difficult": -1,
    "hard": -3,
    "vhard": -5
}

DSA5.magicResistanceModifiers = {
    "-": "-",
    "SK": "soulpower",
    "ZK": "toughness"
}

DSA5.sizeCategories = {
    "tiny": "SIZE.tiny",
    "small": "SIZE.small",
    "average": "SIZE.average",
    "big": "SIZE.big",
    "giant": "SIZE.giant"
}

DSA5.tokenSizeCategories = {
    "tiny": 0.5,
    "small": 0.8,
    "average": 1,
    "big": 2,
    "giant": 4
}

DSA5.rangeSizeCategories = {
    "tiny": "RANGESIZE.tiny",
    "small": "RANGESIZE.small",
    "average": "RANGESIZE.average",
    "big": "RANGESIZE.big",
    "giant": "RANGESIZE.giant"
}

DSA5.rangeSizeModifier = {
    "tiny": -8,
    "small": -4,
    "average": 0,
    "big": 4,
    "giant": 8
}

DSA5.rangeVision = {
    "0": "VisionDisruption.step0",
    "-2": "VisionDisruption.step1",
    "-4": "VisionDisruption.step2",
    "-6": "VisionDisruption.step3",
    "-5000": "VisionDisruption.step4"
}


DSA5.attributeDifficultyModifiers = {
    "eeasy": 6,
    "veasy": 4,
    "easy": 2,
    "challenging": 0,
    "difficult": -2,
    "hard": -4,
    "vhard": -6
}

DSA5.skillDifficultyLabels = {
    "eeasy": "Skill-eeasy",
    "veasy": "Skill-veasy",
    "easy": "Skill-easy",
    "challenging": "Skill-challenging",
    "difficult": "Skill-difficult",
    "hard": "Skill-hard",
    "vhard": "Skill-vhard"
}

DSA5.attributeDifficultyLabels = {
    "eeasy": "Attribute-eeasy",
    "veasy": "Attribute-veasy",
    "easy": "Attribute-easy",
    "challenging": "Attribute-challenging",
    "difficult": "Attribute-difficult",
    "hard": "Attribute-hard",
    "vhard": "Attribute-vhard"
}

DSA5.skillGroups = {
    "body": "SKILL.body",
    "social": "SKILL.social",
    "knowledge": "SKILL.knowledge",
    "trade": "SKILL.trade",
    "nature": "SKILL.nature"
};

DSA5.skillBurdens = {
    "yes": "yes",
    "no": "no",
    "maybe": "maybe"
}

DSA5.StFs = {
    "A": "A",
    "B": "B",
    "C": "C",
    "D": "D"
}


export default DSA5