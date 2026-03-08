const PLANT_SHELF_LIFE_MAP = {
    leaves: { raw: "1w", methods: [{ m: "dryCut", v: "1m" }] },
    blossom: { raw: "24h", methods: [{ m: "dryFull", v: "1m" }, { m: "oilAlcohol", v: "3m" }] },
    thorns: { raw: "1m", methods: [{ m: "dryFull", v: "3m" }, { m: "thornEssence", v: "6m" }] },
    fibers: { raw: "1w", methods: [{ m: "dryFull", v: "3m" }, { m: "oilAlcohol", v: "6m" }] },
    fruitingBody: { raw: "1w", methods: [{ m: "boilAirtight", v: "12m" }, { m: "dryFull", v: "6m" }, { m: "boilMassAirtight", v: "12m" }] },
    resin: { raw: "6m", methods: [{ m: "harden", v: "years" }] },
    woodBark: { raw: "2m", methods: [{ m: "portionDry", v: "12m" }, { m: "powderDry", v: "8m" }, { m: "powderPaste", v: "10m" }] },
    juice: { raw: "3d", methods: [{ m: "boilAirtightGel", v: "6m" }] },
    seeds: { raw: "6m", methods: [{ m: "dryPeel", v: "12m" }] },
    stem: { raw: "1m", methods: [{ m: "boilEssence", v: "6m" }, { m: "portionDryStem", v: "9m" }] },
    shoots: { raw: "12h", methods: [{ m: "oilAlcohol", v: "1m" }] },
    oil: { raw: "3m", methods: [{ m: "boilSieve", v: "12m" }] },
    roots: { raw: "6m", methods: [{ m: "rootComplex", v: "12m" }] },
    bulbs: { raw: "1m", methods: [{ m: "coolDark", v: "6m" }] },
    rush_cucumber: { raw: "1w", methods: [{ m: "oilSpice", v: "033h" }, { m: "mash", v: "22h" }, { m: "mashBuns", v: "003h" }, { m: "fireRoast", v: "222y" }, { m: "breadedFry", v: "22d" }, { m: "alcoholCup", v: "2m" }] }
};

const SPECIFIC_PLANT_METHODS = {
    "Alraune": [{ m: "alcoholSoak1", v: "12m" }],
    "Arganstrauch": [{ m: "decoction1", v: "12d" }],
    "Nothilf": [{ m: "oilSoak1", v: "12m", p: "Brandhilf" }, { m: "solution1", v: "6m" }],
    "Carlog": [{ m: "essence1", v: "12m" }],
    "Kairan": [{ m: "soaked", v: "1m" }],
    "Finage": [{ m: "decoction2", v: "12m" }],
    "Libellengras": [{ m: "dried1", v: "6m" }],
    "MenchalBlüten": [{ m: "dried2", v: "1m" }],
    "Thonnys": [{ m: "rubbed", v: "1m" }],
    "Gulmond": [{ m: "tea1", v: "6m" }],
    "Ilmenblatt": [{ m: "essence2", v: "6m" }],
    "Kajubo": [{ m: "oilSoak2", v: "12m" }],
    "Malomis": [{ m: "alcoholSoak2", v: "8w", p: "MalomisWasser" }],
    "Olginwurz": [{ m: "decoction3", v: "12m" }],
    "RotePfeilblüte": [{ m: "tea2", v: "6m" }, { m: "punch", v: "2m" }],
    "RoterDrachenschlund": [{ m: "dried3", v: "120m", p: "RedDragon-Breath" }],
    "Satuariensbusch": [{ m: "tea3", v: "6m" }],
    "Orazal": [{ m: "solution2", v: "45y", formula: "(1d6+1)*10", unit: "years", p: "SchwefligerOrazal" }],
    "Ulmenwürger": [{ m: "tea4", v: "1m" }],
    "AxordaBaum": [{ m: "decoction4", v: "12m", p: "Xordai" },{ m: "decoction5", v: "12m", p: "Xordai" } ],
    "Zwölfblatt": [{ m: "tea5", v: "6m" }]
};

export { PLANT_SHELF_LIFE_MAP, SPECIFIC_PLANT_METHODS };
