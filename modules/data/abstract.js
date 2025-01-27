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
