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
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        type: "advantage",
                        img: Itemdsa5.advantageImg,
                        data: {
                            "description.value": elem.getElementsByTagName("description")[0].textContent.replace("\n", "<br/><br/>"),
                            "APValue.value": elem.getElementsByTagName("APvalue")[0].textContent.split(" ")[0],
                            "max.value": elem.getElementsByTagName("max")[0].textContent,
                            "requirements.value": elem.getElementsByTagName("requirements")[0].textContent,
                            "effect.value": elem.getElementsByTagName("rule")[0].textContent,
                            "step.value": 1
                        },
                    };


                    let compendiumItem;
                    await pack.getIndex();
                    let entry = pack.index.find((e) => e.name === item.name);

                    if (!entry) {
                        console.log(`Importing ${item.type} - ${item.name}`);
                        compendiumItem = new Item(item, { temporary: true });

                        pack.importEntity(compendiumItem);
                    } else {
                        console.log(`Update ${item.type} - ${item.name}`);
                        //let updateData = ImportHelpers.buildUpdateData(item);
                        let updateData = item;
                        updateData["_id"] = entry._id;

                        pack.updateEntity(updateData);
                    }
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
                    const item = {
                        name: elem.getElementsByTagName("name")[0].textContent,
                        img: Itemdsa5.disadvantageImg,
                        type: "disadvantage",
                        data: {
                            "description.value": elem.getElementsByTagName("description")[0].textContent.replace("\n", "<br/><br/>"),
                            "APValue.value": elem.getElementsByTagName("APvalue")[0].textContent.split(" ")[0],
                            "max.value": elem.getElementsByTagName("max")[0].textContent,
                            "requirements.value": elem.getElementsByTagName("requirements")[0].textContent,
                            "effect.value": elem.getElementsByTagName("rule")[0].textContent,
                            "step.value": 1
                        },
                    };



                    let compendiumItem;
                    await pack.getIndex();
                    let entry = pack.index.find((e) => e.name === item.name);

                    if (!entry) {
                        console.log(`Importing ${item.type} - ${item.name}`);
                        compendiumItem = new Item(item, { temporary: true });

                        pack.importEntity(compendiumItem);
                    } else {
                        console.log(`Update ${item.type} - ${item.name}`);
                        //let updateData = ImportHelpers.buildUpdateData(item);
                        let updateData = item;
                        updateData["_id"] = entry._id;

                        pack.updateEntity(updateData);
                    }
                }
            }
        };
        x.send(null);
    }
}