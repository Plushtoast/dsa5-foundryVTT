const DSA5 = {}


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