export default class DSA5Importer {
    static fetchFile(path) {
        var x = new XMLHttpRequest();
        var doc
        x.open("GET", path, true);
        x.onreadystatechange = function() {
            if (x.readyState == 4 && x.status == 200) {
                doc = x.responseXML;
            }
        };
        x.send(null);
        return doc
    }

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

}