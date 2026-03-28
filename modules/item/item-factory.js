/**
 * Factory for managing item subclasses and instantiation
 */
export class ItemFactory {
    /**
     * Register an item subclass
     * @param {string} type - Item type
     * @param {Class} subclass - Subclass constructor
     */
    static registerSubclass(type, subclass) {
        game.dsa5.config.ItemSubclasses.set(type, subclass);
    }

    /**
     * Get subclass for item type
     * @param {string} type - Item type
     * @returns {Class} Subclass constructor
     */
    static getSubClass(type) {
        return game.dsa5.config.ItemSubclasses.get(type) || game.dsa5.entities.Itemdsa5;
    }

    /**
     * Check if two items are equal for stacking purposes
     * @param {Object} item1 - First item
     * @param {Object} item2 - Second item
     * @returns {boolean} Whether items are equal
     */
    static areEquals(item1, item2) {
        if (item1.type !== item2.type || item1.id === item2.id) {
            return false;
        }

        return this.getSubClass(item1.type).checkEquality(item1, item2);
    }

    /**
     * Setup all item subclasses
     */
    static setupSubclasses(classes) {
        game.dsa5.config.ItemSubclasses = new Map(Object.entries(classes));
    }
}