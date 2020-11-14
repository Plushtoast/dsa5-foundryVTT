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

DSA5.skillDifficultyModifiers = {
    "eeasy": 5,
    "veasy": 3,
    "easy": 1,
    "challenging": 0,
    "difficult": -1,
    "hard": -3,
    "vhard": -5
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
    "yes" : "yes",
    "no" : "no",
    "maybe" : "maybe"
}

DSA5.StFs = {
    "A" : "A",
    "B" : "B",
    "C" : "C"
}


export default DSA5