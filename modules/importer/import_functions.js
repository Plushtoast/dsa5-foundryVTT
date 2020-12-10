import DSA5Importer from "./importer.js"
import Itemdsa5 from "../item/item-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"

export default class ImportFunctions {
    static async importAdvantages() {
        //var doc = DSA5Importer.fetchFile("systems/dsa5/modules/importer/xmls/advantage.xml")
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/advantage.xml", true);
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Advantages`);
                let elems = doc.getElementsByTagName("advantage")

                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let apVal = DSA5Importer.sanitizeAPVal(elem.getElementsByTagName("APvalue")[0].textContent)
                    if (apVal.split(" ").length > 1) {
                        console.warn(elem.getElementsByTagName("name")[0].textContent + " has odd AP <" + apVal + ">")
                    }
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        type: "advantage",
                        img: ImportFunctions.getImg(elem, "advantage"),
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "APValue.value": apVal,
                            "max.value": elem.getElementsByTagName("max")[0].textContent,
                            "requirements.value": elem.getElementsByTagName("requirements")[0].textContent,
                            "effect.value": elem.getElementsByTagName("rule")[0].textContent,
                            "step.value": 1
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)
                }
            }
        };
        x.send(null);
    }

    static async importTalents() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/talents.xml", true);
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let burdenLookup = {
                    "ja": "yes",
                    "nein": "no"
                }

                const packs = game.packs.filter(p => p.metadata.tags && p.metadata.tags.includes("skill"))
                if (!packs.length)
                    return ui.notifications.error("No content found")
                let pack = packs[0];
                let elems = doc.getElementsByTagName("talents")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]

                    let burden = "maybe"
                    if (burdenLookup.hasOwnProperty(elem.getElementsByTagName("encumbrance")[0].textContent)) {
                        burden = burdenLookup[elem.getElementsByTagName("encumbrance")[0].textContent]
                    }
                    let chars = elem.getElementsByTagName("probe")[0].textContent.split("/")

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: ImportFunctions.getImg(elem, "skill"),
                        type: "skill",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "StF.value": elem.getElementsByTagName("StF")[0].textContent,
                            "characteristic1.value": chars[0].toLowerCase(),
                            "characteristic2.value": chars[1].toLowerCase(),
                            "characteristic3.value": chars[2].toLowerCase(),
                            "burden.value": burden,
                        },

                    };
                    const update = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: Itemdsa5.defaultImages["skill"],
                        type: "skill",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                        },

                    };
                    //console.log(item)
                    //await DSA5Importer.writeItem(pack, item)

                    await pack.getIndex()
                    let entry = pack.index.find((e) => e.name == item.name)

                    if (!entry) {
                        console.log(item)
                        console.warn(`Talent ${item.name} could not be found`)
                        continue
                    }
                    let skillentry = await pack.getEntity(entry._id)
                    if (skillentry.data.data.StF.value !=
                        item.data["StF.value"]) {
                        console.warn(`StF ${item.name} does not match - ${skillentry.data.data.StF.value} - ${item.data["StF.value"]}`)
                    } else if (skillentry.data.data.characteristic1.value != item.data["characteristic1.value"]) {
                        console.warn(`characteristic1 ${item.name} does not match`)
                    } else if (skillentry.data.data.characteristic2.value != item.data["characteristic2.value"]) {
                        console.warn(`characteristic2 ${item.name} does not match`)
                    } else if (skillentry.data.data.characteristic3.value != item.data["characteristic3.value"]) {
                        console.warn(`characteristic3 ${item.name} does not match`)
                    } else if (skillentry.data.data.burden.value != item.data["burden.value"]) {
                        console.warn(`burden ${item.name} does not match - ${skillentry.data.data.burden.value} - ${item.data["burden.value"]}`)
                    } else {
                        await DSA5Importer.writeItem(pack, item)
                    }

                }
            }
        };
        x.send(null);
    }



    static async updateActors() {
        const packs = game.packs.filter(p => p.metadata.tags && p.metadata.tags.includes("skill"))

        if (!packs.length)
            return ui.notifications.error("No content found")

        let pack = packs[0];
        let items
        await pack.getContent().then(content => items = content.filter(i => i.data.type == "skill"));

        for (let i of items) {
            for (let a of game.actors) {
                let entry = a.items.find(e => {
                    return e.name === i.name && e.type === i.type
                })
                if (!entry) {
                    console.warn(`Updating of item ${i.name} at ${a.data.name} failed`)
                    continue
                }
                entry = duplicate(entry)

                entry.data.description.value = i.data.data.description.value
                entry.data.StF.value = i.data.data.StF.value
                entry.data.burden.value = i.data.data.burden.value
                entry.data.characteristic1.value = i.data.data.characteristic1.value
                entry.data.characteristic2.value = i.data.data.characteristic2.value
                entry.data.characteristic3.value = i.data.data.characteristic3.value
                entry.img = i.data.img
                await a.updateEmbeddedEntity("OwnedItem", entry)
                console.log(`updating of item ${i.name} success`)
            }
        }
    }



    static async importDisadvantages() {
        //var doc = DSA5Importer.fetchFile("systems/dsa5/modules/importer/xmls/advantage.xml")
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/disadvantage.xml", true);
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Disadvantages`);
                let elems = doc.getElementsByTagName("disadvantage")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let apVal = DSA5Importer.sanitizeAPVal(elem.getElementsByTagName("APvalue")[0].textContent)
                    if (apVal.split(" ").length > 1) {
                        console.warn(elem.getElementsByTagName("name")[0].textContent + " has odd AP <" + apVal + ">")
                    }
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: ImportFunctions.getImg(elem, "disadvantage"),
                        type: "disadvantage",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "APValue.value": apVal,
                            "max.value": elem.getElementsByTagName("max")[0].textContent,
                            "requirements.value": elem.getElementsByTagName("requirements")[0].textContent,
                            "effect.value": elem.getElementsByTagName("rule")[0].textContent,
                            "step.value": 1
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static getImg(elem, std) {
        return elem.getElementsByTagName("img")[0].textContent == "" ? Itemdsa5.defaultImages[std] : elem.getElementsByTagName("img")[0].textContent
    }

    static async importArmor() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/armor.xml", true);
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Armor`);
                let elems = doc.getElementsByTagName("armor")
                for (let i = 0; i < elems.length; i++) {

                    let elem = elems[i]
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: ImportFunctions.getImg(elem, "armor"),
                        type: "armor",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "protection.value": elem.getElementsByTagName("protection")[0].textContent.split(" ")[0],
                            "worn.value": false,
                            "encumbrance.value": elem.getElementsByTagName("encumbrance")[0].textContent,
                            "price.value": elem.getElementsByTagName("price")[0].textContent,
                            "quantity.value": 1,
                            "weight.value": elem.getElementsByTagName("weight")[0].textContent,
                            "effect.value": elem.getElementsByTagName("effect")[0].textContent,
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importMelee() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/meleeweapon.xml", true);
        let rangeTranslation = {
            "kurz": "short",
            "mittel": "medium",
            "lang": "long"
        }
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Weapons`);
                let elems = doc.getElementsByTagName("meleeweapon")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = Itemdsa5.defaultImages["meleeweapon"];
                    let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.meleeImages.de) {
                        img = DSA5Importer.ImportVars.meleeImages.de[caregory]
                    }

                    if (elem.getElementsByTagName("img")[0].textContent != "")
                        img = ImportFunctions.getImg(elem, "meleeweapon")

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "meleeweapon",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "worn.value": false,
                            "price.value": elem.getElementsByTagName("price")[0].textContent,
                            "quantity.value": 1,
                            "weight.value": elem.getElementsByTagName("weight")[0].textContent,
                            "effect.value": "",
                            "damage.value": elem.getElementsByTagName("damage")[0].textContent,
                            "atmod.value": elem.getElementsByTagName("ATPA")[0].textContent.split("/")[0],
                            "pamod.value": elem.getElementsByTagName("ATPA")[0].textContent.split("/")[1],
                            "reach.value": rangeTranslation[elem.getElementsByTagName("range")[0].textContent],
                            "damageThreshold.value": elem.getElementsByTagName("guideValue")[0].textContent.split(" ")[1],
                            "guidevalue.value": elem.getElementsByTagName("guideValue")[0].textContent.split(" ")[0].toLowerCase(),
                            "combatskill.value": caregory
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importRange() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/rangeweapon.xml", true);
        let ammunitionTranslation = {
            "Kugeln": "bullet",
            "Bolzen": "bolt",
            "Pfeile": "arrow",
            "Steine": "stone",
            "-": "-"
        }
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Weapons`);
                let elems = doc.getElementsByTagName("rangeweapon")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = Itemdsa5.defaultImages["rangeweapon"];
                    let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }
                    if (elem.getElementsByTagName("img")[0].textContent != "")
                        img = ImportFunctions.getImg(elem, "rangeweapon")
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "rangeweapon",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "worn.value": false,
                            "price.value": elem.getElementsByTagName("price")[0].textContent,
                            "quantity.value": 1,
                            "weight.value": elem.getElementsByTagName("weight")[0].textContent,
                            "effect.value": "",
                            "damage.value": elem.getElementsByTagName("damage")[0].textContent,
                            "reloadTime.value": elem.getElementsByTagName("loadingTime")[0].textContent.split(" ")[0],
                            "ammunitiongroup.value": ammunitionTranslation[elem.getElementsByTagName("ammunition")[0].textContent],
                            "reach.value": elem.getElementsByTagName("range")[0].textContent,
                            "currentAmmo.value": 0,
                            "combatskill.value": caregory
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }


    static async importCulture() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/culture.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Cultures`);
                let elems = doc.getElementsByTagName("culture")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "culture");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "culture",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "APValue.value": elem.getElementsByTagName("APvalue")[0].textContent,
                            "language.value": elem.getElementsByTagName("language")[0].textContent,
                            "writing.value": elem.getElementsByTagName("writing")[0].textContent,
                            "localKnowledge.value": elem.getElementsByTagName("localKnowledge")[0].textContent,
                            "suitableProfessions.value": elem.getElementsByTagName("suitableProfessions")[0].textContent,
                            "recommendedAdvantages.value": elem.getElementsByTagName("recommendedAdvantages")[0].textContent,
                            "recommendedDisadvantages.value": elem.getElementsByTagName("recommendedDisadvantages")[0].textContent,
                            "recommendedTalents.value": elem.getElementsByTagName("recommendedTalents")[0].textContent,
                            "notsuitableAdvantages.value": elem.getElementsByTagName("notsuitableAdvantages")[0].textContent,
                            "notsuitableTalents.value": elem.getElementsByTagName("notsuitableTalents")[0].textContent,
                            "notsuitableDisadvantages.value": elem.getElementsByTagName("notsuitableDisadvantages")[0].textContent,
                            "socialstate.value": elem.getElementsByTagName("socialstate")[0].textContent,
                            "skills.value": elem.getElementsByTagName("skills")[0].textContent
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }


    static async importEquipment() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/equipment.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Equipment`);
                let elems = doc.getElementsByTagName("equipment")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "equipment");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "equipment",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "price.value": elem.getElementsByTagName("price")[0].textContent,
                            "quantity.value": 1,
                            "weight.value": elem.getElementsByTagName("weight")[0].textContent,
                            "equipmentType.value": "misc"
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importSpells() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/spells.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Spells`);
                let elems = doc.getElementsByTagName("spells")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "spell");
                    let resist = "-"
                    if (elem.getElementsByTagName("probe")[0].textContent.includes("SK")) {
                        resist = "SK"
                    } else if (elem.getElementsByTagName("probe")[0].textContent.includes("ZK")) {
                        resist = "ZK"
                    }
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    let characteristics = elem.getElementsByTagName("probe")[0].textContent.split(" ")[0].split("/").map(x => x.toLowerCase())
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "spell",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "characteristic1.value": characteristics[0],
                            "characteristic2.value": characteristics[1],
                            "characteristic3.value": characteristics[2],
                            "effect.value": elem.getElementsByTagName("effect")[0].textContent,
                            "castingTime.value": elem.getElementsByTagName("castingTime")[0].textContent,
                            "AsPCost.value": elem.getElementsByTagName("AsPCost")[0].textContent,
                            "distribution.value": elem.getElementsByTagName("distribution")[0].textContent,
                            "StF.value": elem.getElementsByTagName("Stf")[0].textContent,
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "talentValue.value": 0,

                            "resistanceModifier.value": resist,
                            "canChangeCastingTime.value": elem.getElementsByTagName("canChangeCastingTime")[0].textContent,
                            "canChangeCost.value": elem.getElementsByTagName("canChangeCost")[0].textContent,
                            "canChangeRange.value": elem.getElementsByTagName("canChangeRange")[0].textContent,
                            "AsPCostDetail.value": elem.getElementsByTagName("AspCostDetail")[0].textContent

                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importRituals() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/rituals.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Rituals`);
                let elems = doc.getElementsByTagName("rituals")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "ritual");
                    let resist = "-"
                    if (elem.getElementsByTagName("probe")[0].textContent.includes("SK")) {
                        resist = "SK"
                    } else if (elem.getElementsByTagName("probe")[0].textContent.includes("ZK")) {
                        resist = "ZK"
                    }
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    let characteristics = elem.getElementsByTagName("probe")[0].textContent.split(" ")[0].split("/").map(x => x.toLowerCase())
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "ritual",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "characteristic1.value": characteristics[0],
                            "characteristic2.value": characteristics[1],
                            "characteristic3.value": characteristics[2],
                            "effect.value": elem.getElementsByTagName("effect")[0].textContent,
                            "castingTime.value": elem.getElementsByTagName("ritualTime")[0].textContent,
                            "AsPCost.value": elem.getElementsByTagName("AsPCost")[0].textContent,
                            "distribution.value": elem.getElementsByTagName("distribution")[0].textContent,
                            "StF.value": elem.getElementsByTagName("Stf")[0].textContent,
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "talentValue.value": 0,
                            "permanentCost.value": elem.getElementsByTagName("permanentCost")[0].textContent,
                            "resistanceModifier.value": resist,
                            "canChangeCastingTime.value": elem.getElementsByTagName("canChangeCastingTime")[0].textContent,
                            "canChangeCost.value": elem.getElementsByTagName("canChangeCost")[0].textContent,
                            "canChangeRange.value": elem.getElementsByTagName("canChangeRange")[0].textContent,
                            "AsPCostDetail.value": elem.getElementsByTagName("AspCostDetail")[0].textContent

                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importLiturgies() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/liturgies.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Liturgies`);
                let elems = doc.getElementsByTagName("liturgies")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "liturgy");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    let resist = "-"
                    if (elem.getElementsByTagName("probe")[0].textContent.includes("SK")) {
                        resist = "SK"
                    } else if (elem.getElementsByTagName("probe")[0].textContent.includes("ZK")) {
                        resist = "ZK"
                    }
                    let characteristics = elem.getElementsByTagName("probe")[0].textContent.split(" ")[0].split("/").map(x => x.toLowerCase())

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "liturgy",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "characteristic1.value": characteristics[0],
                            "characteristic2.value": characteristics[1],
                            "characteristic3.value": characteristics[2],
                            "effect.value": elem.getElementsByTagName("effect")[0].textContent,
                            "castingTime.value": elem.getElementsByTagName("castingTime")[0].textContent,
                            "AsPCost.value": elem.getElementsByTagName("KaPCost")[0].textContent,
                            "distribution.value": elem.getElementsByTagName("distribution")[0].textContent,
                            "StF.value": elem.getElementsByTagName("Stf")[0].textContent,
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "talentValue.value": 0,
                            "resistanceModifier.value": resist,
                            "canChangeCastingTime.value": elem.getElementsByTagName("canChangeCastingTime")[0].textContent,
                            "canChangeCost.value": elem.getElementsByTagName("canChangeCost")[0].textContent,
                            "canChangeRange.value": elem.getElementsByTagName("canChangeRange")[0].textContent,
                            "AsPCostDetail.value": elem.getElementsByTagName("KaPCostDetail")[0].textContent
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importCeremonies() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/ceremonies.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Ceremonies`);
                let elems = doc.getElementsByTagName("ceremonies")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "ceremony");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    let resist = "-"
                    if (elem.getElementsByTagName("probe")[0].textContent.includes("SK")) {
                        resist = "SK"
                    } else if (elem.getElementsByTagName("probe")[0].textContent.includes("ZK")) {
                        resist = "ZK"
                    }
                    let characteristics = elem.getElementsByTagName("probe")[0].textContent.split(" ")[0].split("/").map(x => x.toLowerCase())

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "ceremony",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "characteristic1.value": characteristics[0],
                            "characteristic2.value": characteristics[1],
                            "characteristic3.value": characteristics[2],
                            "effect.value": elem.getElementsByTagName("effect")[0].textContent,
                            "castingTime.value": elem.getElementsByTagName("castingTime")[0].textContent,
                            "AsPCost.value": elem.getElementsByTagName("KaPCost")[0].textContent,
                            "distribution.value": elem.getElementsByTagName("distribution")[0].textContent,
                            "StF.value": elem.getElementsByTagName("Stf")[0].textContent,
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "talentValue.value": 0,
                            "permanentCost.value": elem.getElementsByTagName("permanentCost")[0].textContent,
                            "resistanceModifier.value": resist,
                            "canChangeCastingTime.value": elem.getElementsByTagName("canChangeCastingTime")[0].textContent,
                            "canChangeCost.value": elem.getElementsByTagName("canChangeCost")[0].textContent,
                            "canChangeRange.value": elem.getElementsByTagName("canChangeRange")[0].textContent,
                            "AsPCostDetail.value": elem.getElementsByTagName("KaPCostDetail")[0].textContent
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }


    static async importSpellTrick() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/spelltrick.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Spelltricks`);
                let elems = doc.getElementsByTagName("spelltrick")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "spelltrick");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "magictrick",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "feature.value": elem.getElementsByTagName("feature")[0].textContent,
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importBlessings() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/blessing.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `Blessings`);
                let elems = doc.getElementsByTagName("blessing")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = ImportFunctions.getImg(elem, "blessing");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "blessing",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "feature.value": elem.getElementsByTagName("feature")[0].textContent,
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importBestiary() {
        let types = ["Tiere"]
        for (let k of types) {
            await this._importBestiary(k)
        }
    }

    static async _importBestiary(k) {
        var x = new XMLHttpRequest();
        x.open("GET", "systems/dsa5/modules/importer/xmls/" + k + ".xml", true);
        let pack = await DSA5Importer.getCompendiumPack("Actor", `BestiaryTemp`);

        let items = []
        let skills = await DSA5_Utility.allSkills() || [];

        let combatskills = await DSA5_Utility.allCombatSkills() || [];
        let moneyItems = await DSA5_Utility.allMoneyItems() || [];

        let sizeClasses = {
            "winzig": "tiny",
            "klein": "small",
            "mittel": "average",
            "groß": "big",
            "riesig": "giant"
        }
        let traitrange = {
            "kurz": "short",
            "mittel": "medium",
            "lang": "long"
        }

        moneyItems = moneyItems.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        //if (data.type == "character" || data.type == "npc") {

        items = items.concat(combatskills);
        //}

        items = items.concat(moneyItems.map(m => {
            m.data.quantity.value = 0
            return m
        }));
        for (let i of skills) {
            i.data.description.value = ""
        }
        for (let i of items) {
            i.data.description.value = ""
        }
        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                var doc = x.responseXML;


                let elems = doc.getElementsByTagName(k)
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = Itemdsa5.defaultImages[k];

                    if (elem.getElementsByTagName("img")[0].textContent != "")
                        img = ImportFunctions.getImg(elem, "biest");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]


                    }*/
                    let size = elem.getElementsByTagName("sizeCategory")[0].textContent
                    if (sizeClasses[size] != undefined) {
                        size = sizeClasses[size]
                    } else {
                        console.warn("can not parse size: " + size)
                        size = "average"
                    }


                    let talents = {}
                    let talS = elem.getElementsByTagName("talents")[0].textContent
                    if (talS != "") {
                        for (var t of talS.split(",")) {
                            let v = t.trim().replace("&nbsp;", " ").split(" ")
                            if (!isNaN(v[1])) {
                                talents[v[0].trim()] = Number(v[1].trim())
                            } else {
                                console.warn("<" + t + ">" + " can not be parsed")
                            }
                        }
                    }
                    for (let k of skills) {
                        if (talents[k.name] != undefined) {
                            k.data.talentValue.value = talents[k.name]
                            delete talents[k.name]
                        } else {
                            k.data.talentValue.value = 0
                        }
                    }
                    Object.keys(talents).forEach(function(key) {
                        var value = talents[key]
                        console.warn(key + " could not be found")
                    })
                    let finalItems = items.concat(skills)

                    let attackItems = []
                    let atts = elem.getElementsByTagName("attack")
                    for (let attack of atts) {

                        let weapon
                        let stat = attack.getElementsByTagName("stat")[0].textContent.replace("&nbsp;", " ")
                        if (stat.includes("LZ")) {
                            weapon = {
                                name: attack.getElementsByTagName("name")[0].textContent,
                                img: Itemdsa5.defaultImages["trait"],
                                type: "trait",
                                data: {
                                    traitType: {
                                        value: "rangeAttack"
                                    },
                                    at: {
                                        value: stat.split("FK")[1].trim().split("LZ")[0].trim()
                                    },
                                    damage: {
                                        value: stat.split("TP")[1].trim().split("RW")[0].trim().replace("keine", 0)
                                    },
                                    reloadTime: {
                                        value: stat.split("LZ")[1].split("TP")[0].trim()
                                    },
                                    reach: {
                                        value: stat.split("RW")[1].trim()
                                    }
                                }

                            }
                        } else {
                            weapon = {
                                name: attack.getElementsByTagName("name")[0].textContent,
                                img: Itemdsa5.defaultImages["trait"],
                                type: "trait",
                                data: {
                                    traitType: {
                                        value: "meleeAttack"
                                    },
                                    at: {
                                        value: stat.split("AT")[1].trim().split("TP")[0].trim()
                                    },
                                    damage: {
                                        value: stat.split("TP")[1].trim().split("RW")[0].trim().replace("keine", 0)
                                    },
                                    reach: {
                                        value: traitrange[stat.split("RW")[1].trim()]
                                    }
                                }

                            }
                        }

                        attackItems.push(new Item(weapon, { temporary: true }))
                    }

                    let rsbe = elem.getElementsByTagName("rsbe")[0].textContent.split("/")
                    finalItems.push(new Item({
                        name: "Schutz",
                        img: Itemdsa5.defaultImages["armor"],
                        type: "trait",
                        data: {
                            traitType: {
                                value: "armor"
                            },
                            at: {
                                value: rsbe[0]
                            }
                        }
                    }, { temporary: true }))

                    let loot = []
                    let loots = elem.getElementsByTagName("loot")[0].textContent
                    if (loots != "") {
                        loots = loots.split(",")
                        for (let l of loots) {
                            let eq = {
                                name: l,
                                img: Itemdsa5.defaultImages["equipment"],
                                type: "equipment",
                                data: {
                                    equipmentType: {
                                        value: "misc"
                                    }
                                }
                            }
                            loot.push(new Item(eq, { temporary: true }))
                        }
                        finalItems = finalItems.concat(loot)
                    }
                    finalItems = finalItems.concat(attackItems)

                    let bar2 = {}
                    let isMage = (Number(elem.getElementsByTagName("AsP")[0].textContent) || 0) > 0
                    let isPriest = ((Number(elem.getElementsByTagName("KaP")[0].textContent) || 0) > 0) && !isMage

                    if (isMage) {
                        bar2 = { "attribute": "status.astralenergy" }
                    } else if (isPriest) {
                        bar2 = { "attribute": "status.karmaenergy" }
                    }

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        items: finalItems,
                        type: "creature",
                        token: {
                            bar1: { "attribute": "status.wounds" },
                            bar2: bar2,
                            displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                            displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                            disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
                            name: elem.getElementsByTagName("name")[0].textContent
                        },

                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            characteristics: {
                                mu: {
                                    initial: Number(elem.getElementsByTagName("MU")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                kl: {
                                    initial: Number(elem.getElementsByTagName("KL")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                in: {
                                    initial: Number(elem.getElementsByTagName("IN")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                ch: {
                                    initial: Number(elem.getElementsByTagName("CH")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                ff: {
                                    initial: Number(elem.getElementsByTagName("FF")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                ge: {
                                    initial: Number(elem.getElementsByTagName("GE")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                ko: {
                                    initial: Number(elem.getElementsByTagName("KO")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                                kk: {
                                    initial: Number(elem.getElementsByTagName("KK")[0].textContent),
                                    advances: 0,
                                    modifier: 0
                                },
                            },
                            creatureClass: {
                                value: elem.getElementsByTagName("typus")[0].textContent
                            },
                            actionCount: {
                                value: Number(elem.getElementsByTagName("actions")[0].textContent)
                            },
                            count: {
                                value: elem.getElementsByTagName("count")[0].textContent
                            },
                            behaviour: {
                                value: elem.getElementsByTagName("fight")[0].textContent
                            },
                            flight: {
                                value: elem.getElementsByTagName("flight")[0].textContent
                            },
                            flags: {},
                            status: {
                                wounds: {
                                    initial: Number(elem.getElementsByTagName("LeP")[0].textContent),
                                    value: Number(elem.getElementsByTagName("LeP")[0].textContent),
                                    advances: 0,
                                    modifier: 0,
                                    current: 0
                                },
                                astralenergy: {
                                    initial: Number(elem.getElementsByTagName("AsP")[0].textContent) || 0,
                                    value: Number(elem.getElementsByTagName("AsP")[0].textContent) || 0,
                                    advances: 0,
                                    modifier: 0,
                                    current: 0
                                },
                                karmaenergy: {
                                    initial: Number(elem.getElementsByTagName("KaP")[0].textContent) || 0,
                                    value: Number(elem.getElementsByTagName("KaP")[0].textContent) || 0,
                                    advances: 0,
                                    modifier: 0,
                                    current: 0
                                },
                                soulpower: {
                                    value: 0,
                                    initial: Number(elem.getElementsByTagName("SK")[0].textContent) || 0,
                                    modifier: 0
                                },
                                toughness: {
                                    value: 0,
                                    initial: Number(elem.getElementsByTagName("ZK")[0].textContent) || 0,
                                    modifier: 0
                                },
                                initiative: {
                                    current: Number(elem.getElementsByTagName("INI")[0].textContent.split("+")[0])
                                },
                                dodge: {
                                    modifier: 0,
                                    value: Number(elem.getElementsByTagName("VW")[0].textContent) || 0
                                },
                                size: {
                                    value: size
                                },
                                speed: {
                                    initial: Number(elem.getElementsByTagName("GS")[0].textContent.split("/")[0]) || 0
                                }
                            }


                        },
                    };

                    await DSA5Importer.writeCreature(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importCareer() {
        let types = ["Weltliche", "Geweihte", "Zauberer"]
        for (let k of types) {
            await this._importCareer(k)
        }
    }


    static async _importCareer(k) {


        //somehow interferes with each other
        //let types = ["Geweihte", "Weltliche", "Zauberer"]
        let mageLevels = {
            "Geweihte": "clerical",
            "Zauberer": "magical",
            "Weltliche": "mundane"
        }
        let pack = await DSA5Importer.getCompendiumPack("Item", `Careers`);

        var x = new XMLHttpRequest();
        x.open("GET", "systems/dsa5/modules/importer/xmls/" + k + ".xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                var doc = x.responseXML;


                let elems = doc.getElementsByTagName(k)
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = Itemdsa5.defaultImages[k];

                    if (elem.getElementsByTagName("img")[0].textContent != "")
                        img = ImportFunctions.getImg(elem, "career");
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
                    let apVal = DSA5Importer.sanitizeAPVal(elem.getElementsByTagName("APvalue")[0].textContent)
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "career",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "APValue.value": apVal,
                            "requirements.value": elem.getElementsByTagName("requirements")[0].textContent,
                            "recommendedAdvantages.value": elem.getElementsByTagName("recommendedAdvantages")[0].textContent,
                            "recommendedDisadvantages.value": elem.getElementsByTagName("recommendedDisadvantages")[0].textContent,
                            "notsuitableAdvantages.value": elem.getElementsByTagName("notsuitableAdvantages")[0].textContent,
                            "notsuitableDisadvantages.value": elem.getElementsByTagName("notsuitableDisadvantages")[0].textContent,
                            "mageLevel.value": mageLevels[k],
                            "skills.value": [
                                elem.getElementsByTagName("talentsBody")[0].textContent,
                                elem.getElementsByTagName("talentsSocial")[0].textContent,
                                elem.getElementsByTagName("talentsNature")[0].textContent,
                                elem.getElementsByTagName("talentsKnowledge")[0].textContent,
                                elem.getElementsByTagName("talentsTrade")[0].textContent
                            ].join(", "),
                            "guidevalue.value": elem.getElementsByTagName("guideValue")[0].textContent,
                            "combatSkills.value": elem.getElementsByTagName("combatSkills")[0].textContent,
                            "tradition.value": elem.getElementsByTagName("tradition")[0].textContent,
                            "feature.value": elem.getElementsByTagName("feature")[0].textContent,
                            "happyTalents.value": elem.getElementsByTagName("happyTalents")[0].textContent,
                            "spells.value": elem.getElementsByTagName("spells")[0].textContent,
                            "spelltricks.value": elem.getElementsByTagName("spelltricks")[0].textContent,
                            "liturgies.value": elem.getElementsByTagName("liturgies")[0].textContent,
                            "blessings.value": elem.getElementsByTagName("blessings")[0].textContent,
                            "specialAbilities.value": elem.getElementsByTagName("specialAbilities")[0].textContent
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);

    }

    static async importCombatskill() {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", "systems/dsa5/modules/importer/xmls/combatskill.xml", true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;
                let translateGuide = {
                    "Fingerfertigkeit": "ff",
                    "Gewandheit": "ge",
                    "GE": "ge",
                    "Körperkraft": "kk",
                    "Gewandtheit/Körperkraft": "ge/kk",
                    "KK": "kk"
                }
                let pack = await DSA5Importer.getCompendiumPack("Item", `Combatskill`);
                let elems = doc.getElementsByTagName("combatskill")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let img = Itemdsa5.defaultImages["combatskill"];
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/

                    let descr = `Spezialität: ${elem.getElementsByTagName("specialty")[0].textContent}\n` + elem.getElementsByTagName("description")[0].textContent

                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "combatskill",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(descr),
                            "StF.value": elem.getElementsByTagName("Stf")[0].textContent,
                            "guidevalue.value": translateGuide[elem.getElementsByTagName("guidevalue")[0].textContent],
                            "attack.value": 0,
                            "parry.value": 0,
                            "talentValue.value": 6,
                            "weapontype.value": (elem.getElementsByTagName("category")[0].textContent == "Nahkampftechniken" ? "melee" : "range")
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }

    static async importSpecialAbilities() {
        let cats = [
            "clerical",
            "Combat",
            "fatePoints",
            "general",
            "magical"
        ]
        for (let k of cats) {
            await this._importSpecialAbilities(k)
        }
    }

    static async _importSpecialAbilities(cat) {
        var x = new XMLHttpRequest();
        var doc

        x.open("GET", `systems/dsa5/modules/importer/xmls/specialability${cat}.xml`, true);

        x.onreadystatechange = await async function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;

                let pack = await DSA5Importer.getCompendiumPack("Item", `SpecialAbilities2`);
                let elems = doc.getElementsByTagName("specialability")
                for (let i = 0; i < elems.length; i++) {
                    let elem = elems[i]
                    let category = elem.getElementsByTagName("category")[0].textContent
                    let apVal = DSA5Importer.sanitizeAPVal(elem.getElementsByTagName("APvalue")[0].textContent)
                    let img = Itemdsa5.defaultImages["ability" + category];
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/


                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: img,
                        type: "specialability",
                        data: {
                            "description.value": DSA5Importer.prettyDescription(elem.getElementsByTagName("description")[0].textContent),
                            "category.value": category,
                            "APValue.value": apVal,
                            "maxRank.value": elem.getElementsByTagName("maxRank")[0].textContent,
                            "requirements.value": elem.getElementsByTagName("requirements")[0].textContent,
                            "rule.value": elem.getElementsByTagName("rule")[0].textContent,
                            "list.value": elem.getElementsByTagName("combatskills")[0].textContent
                        },
                    };

                    await DSA5Importer.writeItem(pack, item)

                }
            }
        };
        x.send(null);
    }
}