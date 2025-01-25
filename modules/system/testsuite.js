import DSA5_Utility from "./utility-dsa5.js";
import { delay } from "./view_helper.js";

export default class TestSuite {
    static async #renderAll(documentType, hideAgain, onlyType) {
        const folder = await DSA5_Utility.getFolderForType(documentType, null, `${documentType} Test`)
        const items = game.items.filter(x => x.folder?.id == folder.id);

        const cls = getDocumentClass(documentType);
        await cls.deleteDocuments(items.map(x => x.id), {  });

        for(const type of Item.TYPES.sort()) {
            if (type == 'base') continue;
            if (onlyType && type != onlyType) continue;

            const item = await cls.create({ name: type, type, folder: folder.id });
            await item.sheet.render(true);
        }

        await delay(2000);

        if (hideAgain) {
            const items = game.items.filter(x => x.folder?.id == folder.id);

            for(let item of items) {
                item.sheet.close();
            }
        }
    }

    static async test(hideAgain = true) {
        await TestSuite.renderAllItems({hideAgain});
        await TestSuite.renderAllActors({hideAgain});
    }

    static async renderAllItems({hideAgain, onlyType} = {hideAgain: true, onlyType: null}) {
        TestSuite.#renderAll('Item', hideAgain, onlyType);
    }

    static async renderAllActors({hideAgain, onlyType} = {hideAgain: true, onlyType: null}) {
        TestSuite.#renderAll('Actor', hideAgain, onlyType);
    }
}