import DSA5Payment from "../system/payment.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export class DSADataModel extends foundry.abstract.TypeDataModel {
  static _schemaTemplates = [];

  static _immiscible = new Set(["length", "mixed", "name", "prototype", "cleanData", "_cleanData",
    "_initializationOrder", "validateJoint", "_validateJoint", "migrateData", "_migrateData",
    "shimData", "_shimData", "defineSchema"]);

  static defineSchema() {
    const schema = {};
    for ( const template of this._schemaTemplates ) {
      if ( !template.defineSchema ) {
        throw new Error(`Invalid dsa5 template mixin ${template} defined on class ${this.constructor}`);
      }
      this.mergeSchema(schema, template.defineSchema());
    }
    return schema;
  }

  static get _schemaTemplateFields() {
    const fieldNames = Object.freeze(new Set(this._schemaTemplates.map(t => t.schema.keys()).flat()));
    Object.defineProperty(this, "_schemaTemplateFields", {
      value: fieldNames,
      writable: false,
      configurable: false
    });
    return fieldNames;
  }

  static *_initializationOrder() {
    for ( const template of this._schemaTemplates ) {
      for ( const entry of template._initializationOrder() ) {
        entry[1] = this.schema.get(entry[0]);
        yield entry;
      }
    }
    for ( const entry of this.schema.entries() ) {
      if ( this._schemaTemplateFields.has(entry[0]) ) continue;
      yield entry;
    }
  }

  static mergeSchema(a, b) {
    Object.assign(a, b);
    return a;
  }

  static cleanData(source, options) {
    this._cleanData(source, options);
    return super.cleanData(source, options);
  }

  static _cleanData(source, options) {
    for ( const template of this._schemaTemplates ) {
      template._cleanData(source, options);
    }
  }

  static validateJoint(data) {
    this._validateJoint(data);
    return super.validateJoint(data);
  }

  static _validateJoint(data) {
    for ( const template of this._schemaTemplates ) {
      template._validateJoint(data);
    }
  }

  static migrateData(source) {
    this._migrateData(source);
    return super.migrateData(source);
  }

  static _migrateData(source) {
    for ( const template of this._schemaTemplates ) {
      template._migrateData(source);
    }
  }

  static mixin(...templates) {
    for ( const template of templates ) {
      if ( !(template.prototype instanceof DSADataModel) ) {
        throw new Error(`${template.name} is not a subclass of DSADataModel`);
      }
    }

    const Base = class extends this {};
    Object.defineProperty(Base, "_schemaTemplates", {
      value: Object.seal([...this._schemaTemplates, ...templates]),
      writable: false,
      configurable: false
    });

    for ( const template of templates ) {
      for ( const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(template)) ) {
        if ( this._immiscible.has(key) ) continue;
        Object.defineProperty(Base, key, descriptor);
      }

      for ( const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(template.prototype)) ) {
        if ( ["constructor"].includes(key) ) continue;
        Object.defineProperty(Base.prototype, key, descriptor);
      }
    }

    return Base;
  }

  // todo toembed
}

export class ItemDataModel extends DSADataModel {
  async getSheetData(data) {}

  prepareDomains() {
    let dom = this.effect.attributes;
    if (dom) {
      const magical = new RegExp(game.i18n.localize('WEAPON.magical'), 'i');
      const blessed = new RegExp(game.i18n.localize('WEAPON.clerical'), 'i');
      dom = dom
        .split(',')
        .map((x) => {
          let cssclass = '';
          if (magical.test(x)) cssclass = 'magical';
          else if (blessed.test(x)) cssclass = 'blessed';
          return `<li class="${cssclass}">${x}</li>`;
        })
        .join('');
    }
    return dom;
  }

  static _chatLineHelper({ key, val, localizeVal}  = { localizeVal: false }) {
    if (localizeVal) val = game.i18n.localize(val);
    return `<b>${game.i18n.localize(key)}</b>: ${val ? val : '-'}`;
  }

  static chatData(data, name) {
    return [];
  }

  static async _postItem(item) {
    let chatData = foundry.utils.duplicate(item);

    const detailsObfuscated = getProperty(chatData, 'system.obfuscation.details');
    const descriptionObfuscated = getProperty(chatData, 'system.obfuscation.description');

    mergeObject(chatData, {
      properties: detailsObfuscated ? [] : this.chatData(chatData.system, item.name).map(x => this._chatLineHelper(x)),
      descriptionObfuscated,
    });

    chatData.hasPrice = 'price' in chatData.system && !detailsObfuscated;
    if (chatData.hasPrice) {
      let price = chatData.system.price.value;
      if (chatData.system.QL) price = Itemdsa5.getSubClass(chatData.type).consumablePrice(chatData);

      const prices = await DSA5Payment._moneyToString(price);
      chatData.properties.push(`<b>${game.i18n.localize('price')}</b>: ${prices}`);
    }

    if (item.pack) chatData.itemLink = item.link;

    if (chatData.img.includes('/blank.webp')) chatData.img = null;

    const html = await renderTemplate('systems/dsa5/templates/chat/post-item.html', chatData);
    const chatOptions = DSA5_Utility.chatDataSetup(html);
    ChatMessage.create(chatOptions);
  }
}