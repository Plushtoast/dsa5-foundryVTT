const DSA5 = {}

DSA5.statusEffects = [{
        icon: "icons/svg/skull.svg",
        id: "dead",
        label: "CONDITION.defeated",
        description: "CONDITIONDESCRIPTION.defeated",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }

    },
    {
        id: "inpain",
        label: "CONDITION.inpain",
        icon: "icons/svg/blood.svg",
        description: "CONDITIONDESCRIPTION.inpain",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "prone",
        label: "CONDITION.prone",
        icon: "icons/svg/falling.svg",
        description: "CONDITIONDESCRIPTION.prone",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "unconscious",
        label: "CONDITION.unconscious",
        icon: "icons/svg/unconscious.svg",
        description: "CONDITIONDESCRIPTION.unconscious",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "rooted",
        label: "CONDITION.rooted",
        icon: "icons/svg/net.svg",
        description: "CONDITIONDESCRIPTION.rooted",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "fixated",
        label: "CONDITION.fixated",
        icon: "icons/svg/padlock.svg",
        description: "CONDITIONDESCRIPTION.fixated",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "surprised",
        label: "CONDITION.surprised",
        icon: "icons/svg/hazard.svg",
        description: "CONDITIONDESCRIPTION.surprised",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "blind",
        label: "CONDITION.blind",
        icon: "icons/svg/blind.svg",
        description: "CONDITIONDESCRIPTION.blind",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "poisoned",
        label: "CONDITION.poisoned",
        icon: "icons/svg/poison.svg",
        description: "CONDITIONDESCRIPTION.poisoned",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "sick",
        label: "CONDITION.sick",
        icon: "icons/svg/biohazard.svg",
        description: "CONDITIONDESCRIPTION.sick",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "deaf",
        label: "CONDITION.deaf",
        icon: "icons/svg/deaf.svg",
        description: "CONDITIONDESCRIPTION.deaf",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "burning",
        label: "CONDITION.burning",
        icon: "icons/svg/fire.svg",
        description: "CONDITIONDESCRIPTION.burning",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 3
            }
        }
    },
    {
        id: "invisible",
        label: "CONDITION.invisible",
        icon: "icons/svg/circle.svg",
        description: "CONDITIONDESCRIPTION.invisible",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "constricted",
        label: "CONDITION.constricted",
        icon: "icons/svg/cave.svg",
        description: "CONDITIONDESCRIPTION.constricted",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "bloodrush",
        label: "CONDITION.bloodrush",
        icon: "icons/svg/bones.svg",
        description: "CONDITIONDESCRIPTION.bloodrush",
        changes: [
            { key: "data.skillModifiers.step", mode: 0, value: "Kraftakt 2;Feat of Strength 2" }
        ],
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "mute",
        label: "CONDITION.mute",
        icon: "icons/svg/silenced.svg",
        description: "CONDITIONDESCRIPTION.mute",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "incapacitated",
        label: "CONDITION.incapacitated",
        icon: "icons/svg/sleep.svg",
        description: "CONDITIONDESCRIPTION.incapacitated",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "encumbered",
        label: "CONDITION.encumbered",
        icon: "icons/svg/anchor.svg",
        description: "CONDITIONDESCRIPTION.encumbered",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "stunned",
        label: "CONDITION.stunned",
        icon: "icons/svg/daze.svg",
        description: "CONDITIONDESCRIPTION.stunned",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "raptured",
        label: "CONDITION.raptured",
        icon: "icons/svg/ice-aura.svg",
        description: "CONDITIONDESCRIPTION.raptured",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "feared",
        label: "CONDITION.feared",
        icon: "icons/svg/terror.svg",
        description: "CONDITIONDESCRIPTION.feared",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "paralysed",
        label: "CONDITION.paralysed",
        icon: "icons/svg/paralysis.svg",
        description: "CONDITIONDESCRIPTION.paralysed",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "confused",
        label: "CONDITION.confused",
        icon: "icons/svg/stoned.svg",
        description: "CONDITIONDESCRIPTION.confused",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "minorSpirits",
        label: "CONDITION.minorSpirits",
        icon: "icons/svg/terror.svg",
        description: "CONDITIONDESCRIPTION.minorSpirits",
        changes: [
            { key: "data.skillModifiers.global", mode: 0, value: -1 }
        ],
        duration: { seconds: 600 },
        flags: {
            dsa5: {
                value: null,
                editable: true,
            }
        }
    },
    {
        id: "services",
        label: "PLAYER.services",
        icon: "icons/svg/aura.svg",
        description: "CONDITIONDESCRIPTION.services",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 500,
                "hideOnToken": true
            }
        }
    }
]

DSA5.armorSubcategories = {
    "0": 4,
    "1": 5,
    "2": 6,
    "3": 8,
    "4": 9,
    "5": 13,
    "6": 12,
    "7": 11,
    "8": 10
}

DSA5.weaponStabilities = {
    "Blowpipes": 10,
    "Bows": 4,
    "Brawling": 12,
    "Chain Weapons": 10,
    "Crossbows": 6,
    "Daggers": 14,
    "Discuses": 12,
    "Fans": 13,
    "Fencing Weapons": 8,
    "Impact Weapons": 12,
    "Lances": 6,
    "Pikes": 12,
    "Polearms": 12,
    "Shields": 10,
    "Slingshots": 4,
    "Swords": 13,
    "Throwing Weapons": 10,
    "Two-Handed Impact Weapons": 11,
    "Two-Handed Swords": 12,
    "Whips": 4
}

DSA5.localizedCompendiums = {
    de: [
        "dsa5.skills",
        "dsa5.combatskills",
        "dsa5.species"
    ],
    en: [
        "dsa5.skillsen",
        "dsa5.combatskillsen",
        "dsa5.speciesen"
    ]
}

DSA5.combatSkillSubCategories = {
    "0": "COMBATSKILLCATEGORY.0",
    "1": "COMBATSKILLCATEGORY.1",
    "2": "COMBATSKILLCATEGORY.2",
    "3": "COMBATSKILLCATEGORY.3",
    "4": "COMBATSKILLCATEGORY.4"
}


DSA5.effectTextStyle = CONFIG.canvasTextStyle.clone();
DSA5.effectTextStyle.fontSize = "30";
DSA5.effectTextStyle.fontFamily = "GentiumBasic"

DSA5.knownShortcuts = {}

DSA5.gearModifyableCalculatedAttributes = ["fatePoints", "initiative", "speed", "astralenergy", "karmaenergy", "wounds", "dodge", "soulpower", "toughness"]

DSA5.defaultWeapon = {
    name: "default",
    type: "meleeweapon",
    effects: [],
    data: {
        type: "meleeweapon",
        reach: {
            value: "short"
        },
        damage: {
            value: "1d6"
        },
        atmod: {
            value: 0,
            offHandMod: 0
        },
        pamod: {
            value: 0,
            offHandMod: 0
        },
        guidevalue: {
            value: "ge/kk"
        },
        damageThreshold: {
            value: "5000"
        },
        worn: {
            offhand: false
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
    "luxus": "Equipment.luxus",
    "blessed": "Equipment.blessed"
};

DSA5.equipmentCategories = ["meleeweapon", "rangeweapon", "equipment", "ammunition", "armor", "poison", "consumable", "plant"]

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
    },
    "rangesense": {
        "damage": -1,
        "attack": -1
    }
}

DSA5.regnerationCampLocations = {
    "0": "regnerationCampLocations.normal",
    "-1": "regnerationCampLocations.bad",
    "1": "regnerationCampLocations.good"
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

DSA5.drivingArcherOptions = {
    "0": "mountedRangeOptions.STATIONARY",
    "-2": "mountedRangeOptions.SCHRITT",
    "-4": "mountedRangeOptions.GALOPP",
}
DSA5.aimOptions = {
    "0": "aimOptions.0",
    "2": "aimOptions.1",
    "4": "aimOptions.2"
}

DSA5.traitCategories = {
    "meleeAttack": "closeCombatAttacks",
    "rangeAttack": "rangeCombatAttacks",
    "armor": "armor",
    "general": "general",
    "familiar": "familiar",
    "trick": "trick",
    "training": "training",
    "entity": "entityAbility",
    "summoning": "summoningPackage"
}

DSA5.ritualLocationModifiers = {
    "0": "-",
    "1": "RITUALMODIFIER.holysite",
    "-3": "RITUALMODIFIER.wrongsite"
}

DSA5.ritualTimeModifiers = {
    "0": "-",
    "1": "RITUALMODIFIER.matchingConstellation",
    "-1": "RITUALMODIFIER\.wrongConstellation"
}

DSA5.ceremonyLocationModifiers = {
    "0": "-",
    "2": "CEREMONYMODIFIER.holysite",
    "1": "CEREMONYMODIFIER.temple",
    "-1": "CEREMONYMODIFIER.otherTemple",
    "-2": "CEREMONYMODIFIER.enemyGod",
    "-3": "CEREMONYMODIFIER.archDemon",
    "-4": "CEREMONYMODIFIER.nameless",
    "-5": "CEREMONYMODIFIER.nemesis"
}

DSA5.advancementCosts = {
    "A": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    "B": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
    "C": [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42],
    "D": [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56],
    "E": [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180],
}

DSA5.hooks = {}

DSA5.startXP = {
    "900": "EXP.inexperienced",
    "1000": "EXP.average",
    "1100": "EXP.experienced",
    "1200": "EXP.competent",
    "1400": "EXP.masterful",
    "1700": "EXP.brillant",
    "2100": "EXP.legendary"
}

DSA5.helpContent = [{
        name: "pay",
        command: "/pay [0-9]+",
        example: "/pay 5.03",
    }, {
        name: "getPaid",
        command: "/getPaid [0-9]+",
        example: "/getPaid 5.03",
    },
    {
        name: "quickAbility",
        command: "/sk [a-z]*, /sp [a-z]*, /li [a-z]*, /at [a-z]*, /pa [a-z]*",
        example: "/sk betören",
    },
    {
        name: "conditions",
        command: "/conditions",
        example: "/conditions"
    },
    {
        name: "tables",
        command: "/tables",
        example: "/tables"
    },
    {
        name: "request",
        command: "/rq",
        example: "/rq betören"
    },
    {
        name: "threeD20Check",
        command: "/ch",
        example: "/ch"
    },
    {
        name: "groupcheck",
        command: "/gc",
        example: "/gc"
    }
]

DSA5.ceremonyTimeModifiers = {
    "0": "-",
    "1": "CEREMONYMODIFIER.monthGod",
    "2": "CEREMONYMODIFIER.celebration",
    "-5": "CEREMONYMODIFIER.namelessDays"
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
    "clerical": "clerical",
    "language": "language",
    "animal": "animal",
    "staff": "traditionArtifact",
    "ceremonial": "ceremonialItem",
    "pact": "pactgift"
}

DSA5.addvantageRules = {}
DSA5.removevantageRules = {}
DSA5.vantagesNeedingAdaption = {}

DSA5.addAbilityRules = {}
DSA5.removeAbilityRules = {}
DSA5.AbilitiesNeedingAdaption = {}
DSA5.addTraitRules = {}

DSA5.rangeWeaponModifiers = {
    "short": "RangeMod.short",
    "medium": "RangeMod.medium",
    "long": "RangeMod.long",
    "rangesense": "RangeMod.rangesense"
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
    "stone": "stone",
    "dart": "dart"
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

DSA5.shieldSizes = {
    "short": "SIZE.small",
    "medium": "SIZE.average",
    "long": "SIZE.big"
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

DSA5.meleeRangeVision = (mode) => {
    return {
        "+0": "meleeVisionDisruption.0",
        "-1": "meleeVisionDisruption.1",
        "-2": "meleeVisionDisruption.2",
        "-3": "meleeVisionDisruption.3",
        [mode == "attack" ? "*0,5" : "-5000"]: "meleeVisionDisruption.4"
    }
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

DSA5.features = [
    "Object",
    "Spheres",
    "Influence",
    "Clairvoyance",
    "Healing",
    "Transformation",
    "Telekinesis",
    "Elemental",
    "Illusion",
    "Anti-Magic",
    "Demonic",
    "Temporal"
]

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

CONFIG.time.roundTime = 5
CONFIG.time.turnTime = 0

export default DSA5