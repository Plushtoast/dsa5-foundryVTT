import GroupAPI from '../../actor/group-api.js';

const { ObjectField } = foundry.data.fields;

/**
 * Bag of plugin-owned master-function slices on a group actor.
 * Each registered key is cleaned and initialized as an ethereal DataModel.
 * Unregistered keys stay plain objects (leftover data from an uninstalled module).
 */
export default class MasterFunctionsField extends ObjectField {
  /** @override */
  _cleanType(data, options, _state = {}) {
    const cleaned = super._cleanType(data, options, _state) ?? {};
    const { DataFieldOperator } = foundry.data.operators;
    for (const [key, raw] of Object.entries(cleaned)) {
      if (DataFieldOperator && raw instanceof DataFieldOperator) continue;
      const Model = GroupAPI.getDataModel(key);
      if (!Model) continue;
      const plain = raw instanceof foundry.abstract.DataModel
        ? raw.toObject()
        : foundry.utils.isPlainObject(raw) ? raw : null;
      if (!plain) continue;
      // Pass the existing slice as _state.source so SchemaField honors options.partial
      // and does not fill missing keys with initials (which would zero sibling mods).
      cleaned[key] = Model.cleanData(foundry.utils.deepClone(plain), options, {
        ..._state,
        source: _state.source?.[key],
      });
    }
    return cleaned;
  }

  /** @override */
  initialize(value, model, options = {}) {
    const source = super.initialize(value, model, options);
    if (!source) return source;

    const result = {};
    for (const [key, raw] of Object.entries(source)) {
      const Model = GroupAPI.getDataModel(key);
      if (!Model) {
        result[key] = foundry.utils.deepClone(raw);
        continue;
      }
      const plain = raw instanceof foundry.abstract.DataModel
        ? raw.toObject()
        : foundry.utils.deepClone(raw) ?? {};
      result[key] = Model.cleanData(plain);
    }
    return result;
  }

  /** @override */
  _validateType(value, options) {
    super._validateType(value, options);
    if (!value) return;
    for (const [key, raw] of Object.entries(value)) {
      const Model = GroupAPI.getDataModel(key);
      if (!Model || !foundry.utils.isPlainObject(raw)) continue;
      const cleaned = Model.cleanData(foundry.utils.deepClone(raw));
      Model.validateJoint?.(cleaned);
    }
  }
}
