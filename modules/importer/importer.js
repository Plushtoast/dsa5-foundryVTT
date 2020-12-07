import Actordsa5 from '../actor/actor-dsa5.js'
export default class DSA5Importer {

    static async getCompendiumPack(type, name) {
        console.log(`Checking for existing compendium pack ${name}`);
        let pack = game.packs.find((p) => {
            return p.metadata.label === name;
        });
        if (!pack) {
            pack = await Compendium.create({ entity: type, label: name });
            console.log(`Creating compendium pack ${name} found`);
        } else {
            console.log(`Existing compendium pack ${name} found`);
        }

        return pack;
    }

    static prettyDescription(str) {
        return str.split("\n").map(x => {
            var r = x.split(":")
            if (r.length > 1) {
                let title = r[0]
                r.shift()

                return `<p><b>${title}</b>: ${r.join(":")}</p>`
            } else {
                return `<p>${x}</p>`
            }

        }).join("")
    }

    static async writeItem(pack, item) {
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

    static async writeCreature(pack, item) {
        let compendiumItem;
        await pack.getIndex();
        let entry = pack.index.find((e) => e.name === item.name);

        if (!entry) {
            console.log(`Importing ${item.type} - ${item.name}`);
            compendiumItem = await new Actordsa5(item, { temporary: true });


            await pack.importEntity(compendiumItem);

        } else {
            console.log(`Update ${item.type} - ${item.name}`);
            //let updateData = ImportHelpers.buildUpdateData(item);
            let updateData = item;
            updateData["_id"] = entry._id;

            await pack.updateEntity(updateData);

        }

    }



    static sanitizeAPVal(val) {
        return val.replace(" AP", "")
            .replace(" Abenteuerpunkte", "")
            .replace(" Abenteuerpunkt", "")
            .replace(" pro Stufe", "")
            .replace(" pro Schlechter Angewohnheit", "")
            .replace(" (wird automatisch über das Paktgeschenk Zauberei mit Lebenskraft vergeben)", '')
            .trim()

    }

    static ImportVars = {
        meleeImages: {
            de: {
                "Hiebwaffen": "icons/weapons/maces/mace-spiked-wood-grey.webp",
                "Schwerter": "icons/weapons/swords/greatsword-blue.webp",
                "Dolche": "icons/weapons/daggers/dagger-straight-blue.webp",
                "Fechtwaffen": "icons/weapons/swords/sword-guard-engraved.webp",
                "Kettenwaffen": "icons/weapons/maces/flail-spiked-grey.webp",
                "Lanzen": "icons/weapons/polearms/spear-flared-blue.webp",
                "Raufen": "icons/weapons/fist/fist-knuckles-spiked-blue.webp",
                "Schilde": "icons/equipment/shield/round-wooden-boss-steel-yellow-blue.webp",
                "Stangenwaffen": "icons/weapons/polearms/halberd-crescent-small-spiked.webp",
                "Zweihandhiebwaffen": "icons/weapons/hammers/hammer-double-steel.webp",
                "Zweihandschwerter": "icons/weapons/swords/greatsword-sheathed.webp",
                "Fächer": "",
                "Peitschen": "icons/sundries/survival/leather-strap-brown.webp",
                "Spießwaffen": "icons/weapons/polearms/pike-flared-red.webp",
            }
        },
        rangeImages: {
            de: {
                "Armbrüste": "icons/weapons/crossbows/crossbow-purple.webp",
                "Blasrohre": "icons/weapons/guns/gun-worn-gold.webp",
                "Bögen": "icons/weapons/bows/longbow-recurve-leather-brown.webp",
                "Diskusse": "icons/weapons/thrown/shuriken-blue.webp",
                "Feuerspeien": "",
                "Schleudern": "icons/weapons/slings/slingshot-wood.webp",
                "Wurfwaffen": "icons/weapons/thrown/daggers-guard-green.webp",

            }
        }
    };


}