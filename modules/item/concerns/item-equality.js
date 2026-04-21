const { duplicate } = foundry.utils;

/**
 * Handles item equality and stacking functionality
 */
export class ItemEquality {
  /**
   * Check equality based on type, name, and description
   * @param {Object} item1 - First item to compare
   * @param {Object} item2 - Second item to compare
   * @returns {boolean} True if items are equal for stacking purposes
   */
  static checkBasicEquality(item1, item2) {
    return item1.type === item2.type && 
           item1.name === item2.name && 
           item1.system.description?.value === item2.system.description?.value;
  }

  /**
   * Check equality for money items (with localization support)
   * @param {Object} item1 - First item to compare
   * @param {Object} item2 - Second item to compare
   * @returns {boolean} True if items are equal for stacking purposes
   */
  static checkMoneyEquality(item1, item2) {
    return item1.type === item2.type && 
           _loc(item1.name) === _loc(item2.name) && 
           item1.system.description?.value === item2.system.description?.value;
  }

  /**
   * Check equality for consumable items (includes quality level)
   * @param {Object} item1 - First item to compare
   * @param {Object} item2 - Second item to compare
   * @returns {boolean} True if items are equal for stacking purposes
   */
  static checkConsumableEquality(item1, item2) {
    return this.checkBasicEquality(item1, item2) && 
           item1.system.QL === item2.system.QL;
  }

  /**
   * Standard item combination by adding quantities
   * @param {Object} item1 - Target item (will be modified)
   * @param {Object} item2 - Source item (provides additional quantity)
   * @param {Object} actor - Actor that owns both items
   * @param {boolean} render - Whether to trigger UI re-rendering
   * @returns {Promise<Object>} Promise resolving to the update operation result
   */
  static async combineByQuantity(item1, item2, actor, render = true) {
    const updatedItem = duplicate(item1);
    updatedItem.system.quantity.value += item2.system.quantity.value;
    return await actor.updateEmbeddedDocuments('Item', [updatedItem], { render });
  }
}
