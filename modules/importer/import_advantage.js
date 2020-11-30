import DSA5Importer from "./importer.js"
import Itemdsa5 from "./../item/item-dsa5.js"

export default class ImportAdvantage {
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
                        img: Itemdsa5.defaultImages["advantage"],
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
                        img: Itemdsa5.defaultImages["disadvantage"],
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
                        img: Itemdsa5.defaultImages["armor"],
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
                    let img = Itemdsa5.defaultImages["equipment"];
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
                    let img = Itemdsa5.defaultImages["spell"];
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
                            "talentValue.value": 0
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
                    let img = Itemdsa5.defaultImages["liturgy"];
                    /*let caregory = elem.getElementsByTagName("category")[0].textContent
                    if (caregory in DSA5Importer.ImportVars.rangeImages.de) {
                        img = DSA5Importer.ImportVars.rangeImages.de[caregory]
                    }*/
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
                            "distribution.value": elem.getElementsByTagName("feature")[0].textContent,
                            "StF.value": elem.getElementsByTagName("Stf")[0].textContent,
                            "duration.value": elem.getElementsByTagName("duration")[0].textContent,
                            "targetCategory.value": elem.getElementsByTagName("targetCategory")[0].textContent,
                            "range.value": elem.getElementsByTagName("range")[0].textContent,
                            "talentValue.value": 0
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
                    let img = Itemdsa5.defaultImages["spelltrick"];
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
                    let img = Itemdsa5.defaultImages["blessing"];
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
}