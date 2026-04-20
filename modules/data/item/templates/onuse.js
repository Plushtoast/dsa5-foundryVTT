import { DSADataModel } from '../../abstract.js';
import { onUseActionsField, OnUseActionMixin } from '../../shared/onuse-action-schema.js';

export default class OnUseTemplate extends OnUseActionMixin(DSADataModel) {
  static get implementsOnUseEffect() {
    return true;
  }

  get implementsOnUseEffect() {
    return true;
  }

  static defineSchema() {
    return {
      onUseActions: onUseActionsField(),
    };
  }
}