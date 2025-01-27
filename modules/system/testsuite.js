import DSA5_Utility from './utility-dsa5.js';
import { delay } from './view_helper.js';

export default class TestSuite {
  static async #renderAll(documentType, hideAgain, onlyType) {
    const folder = await DSA5_Utility.getFolderForType(documentType, null, `${documentType} Test`);
    const items = {
      Item: game.items,
      Actor: game.actors,
     }[documentType].filter((x) => x.folder?.id == folder.id);

    const cls = getDocumentClass(documentType);
    await cls.deleteDocuments(
      items.map((x) => x.id),
      {},
    );

    const types = {
      Item: Item.TYPES.filter((x) => x != 'base'),
      Actor: Actor.TYPES.filter((x) => x != 'base'),
    }

    for (const type of types[documentType]) {
      if (type == 'base') continue;
      if (onlyType && type != onlyType) continue;

      const item = await cls.create({ name: type, type, folder: folder.id });
      await item.sheet.render(true);
    }

    await delay(2000);

    if (hideAgain) {
      const items = {
        Item: game.items,
        Actor: game.actors,
       }[documentType].filter((x) => x.folder?.id == folder.id);

      for (let item of items) {
        item.sheet.close();
      }
    }

    console.log(`All ${documentType} are checked`);
  }

  static async test(hideAgain = true) {
    await TestSuite.renderAllItems({ hideAgain });
    await TestSuite.renderAllActors({ hideAgain });
  }

  static async renderAllItems({ hideAgain, onlyType } = { hideAgain: true, onlyType: null }) {
    TestSuite.#renderAll('Item', hideAgain, onlyType);
  }

  static async renderAllActors({ hideAgain, onlyType } = { hideAgain: true, onlyType: null }) {
    TestSuite.#renderAll('Actor', hideAgain, onlyType);
  }

  //static async checkDataModels(templateJsonPath = 'systems/dsa5/template.json') {
  static async checkDataModels(templateJsonPath = undefined) {
    const types = {
      Item: Item.TYPES.filter((x) => x != 'base'),
      Actor: Actor.TYPES.filter((x) => x != 'base'),
    };
    const templateJson = templateJsonPath ? await foundry.utils.fetchJsonWithTimeout(templateJsonPath) : null;

    for (let documentName of ['Item', 'Actor']) {
      for (let type of types[documentName]) {
        if (!game.dsa5.dataModels[documentName][type]) {
          console.error(`No model for ${type}`);
        }
      }

      if (templateJson) {
        for (let type of templateJson[documentName].types) {
          if (!game.dsa5.dataModels[documentName][type]) {
            console.error(`No template model for ${type}`);
          }

          let objectFromTemplate = {};

          for (let temp of templateJson[documentName][type].templates || []) {
            objectFromTemplate = foundry.utils.mergeObject(objectFromTemplate, templateJson[documentName].templates[temp]);
          }
          const objectFromTemplateWithoutTemplates = foundry.utils.duplicate(templateJson[documentName][type]);
          delete objectFromTemplateWithoutTemplates.templates;
          objectFromTemplate = foundry.utils.mergeObject(objectFromTemplate, objectFromTemplateWithoutTemplates);
          const objectFromModel = new game.dsa5.dataModels[documentName][type]().toObject();

          const areEqual = TestSuite.#deepEqual(objectFromTemplate, objectFromModel);
          if (!areEqual) {
            console.error(`Template and model for ${type} are not equal`, objectFromTemplate, objectFromModel);
          }
        }
      }
    }

    console.log('All data models are checked');
  }

  static #deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
      return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      const diff1 = keys1.filter((x) => !keys2.includes(x));
      if (diff1.length) console.error(`Keys in obj1 but not in obj2: ${diff1}`);
      const diff2 = keys2.filter((x) => !keys1.includes(x));
      if (diff2.length) console.error(`Keys in obj2 but not in obj1: ${diff2}`);

      return false;
    }

    return keys1.every((key) => {
      const areEqual = TestSuite.#deepEqual(obj1[key], obj2[key]);
      if (!areEqual) {
        console.error(`Values for key ${key} are not equal`, obj1[key], obj2[key]);
      }
      return areEqual;
    });
  }

  static buildDocumentTypes() {
    const types = {
      documentTypes: {
        Actor: {
          ...Actor.TYPES.filter((x) => x != 'base').reduce((acc, x) => {
            acc[x] = {
              htmlFields: [],
            };
            return acc;
          }, {}),
        },
        Item: {
          ...Item.TYPES.filter((x) => x != 'base').reduce((acc, x) => {
            acc[x] = {
              htmlFields: [
                'description.value',
                'gmdescription.value'
              ],
            };
            return acc;
          }, {}),
        },
      },
    };
    console.log(JSON.stringify(types, null, 2));
  }
}
