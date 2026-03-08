import { PLANT_SHELF_LIFE_MAP, SPECIFIC_PLANT_METHODS } from './plant-config.js';

export default class PlantPreservationDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    constructor(options = {}) {
        const uniqueId = `plant-preservation-details-${options.item.uuid.replaceAll(".", "-")}`;
        options = foundry.utils.mergeObject({
            id: uniqueId,
            window: { title: game.i18n.localize("PLANT.altEffectsTab") }
        }, options);

        super(options);
        this.item = options.item;
        this._activeTab = "altEffects";
    }

    static DEFAULT_OPTIONS = foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS, {
        classes: ["dsa5", "dialog", "plant-preservation-gui"],
        tag: "form",
        window: { size: { width: 600, height: 700 }, resizable: true },
        actions: {
            showItem: async function(event, target) {
                const item = await fromUuid(target.dataset.uuid);
                item?.sheet.render(true);
            }
        }
    }, { inplace: false });

    static PARTS = { main: { template: "systems/dsa5/templates/items/item-plant-preservation-details.hbs" } };

    async _prepareContext(options) {
        const checkedParts = Object.keys(this.item.system.plantPart || {}).filter(key => this.item.system.plantPart[key]);
        const methodMap = new Map();
        
        for (const partKey of checkedParts) {
            const config = PLANT_SHELF_LIFE_MAP[partKey];
            if (config?.methods) {
                for (const m of config.methods) { if (!methodMap.has(m.m)) methodMap.set(m.m, m); }
            }
        }

        const specificKey = Object.keys(SPECIFIC_PLANT_METHODS).find(k => game.i18n.localize(`PLANT.specificPlants.${k}`) === this.item.name);
        if (specificKey) {
            SPECIFIC_PLANT_METHODS[specificKey].forEach(m => { if (!methodMap.has(m.m)) methodMap.set(m.m, m); });
        }

        const storedData = this.item.system.preservationDetails?.methods || {};
        const availableMethods = Array.from(methodMap.values()).map(m => {
            const methodKey = m.m;
            const methodData = storedData[methodKey] || { alternativeEffects: [], extraProducts: [] };
            return {
                key: methodKey,
                label: game.i18n.localize(`PLANT.methods.${methodKey}`),
                alternativeEffects: methodData.alternativeEffects || [],
                extraProducts: methodData.extraProducts || []
            };
        });

        return { item: this.item, availableMethods, activeTab: this._activeTab, title: game.i18n.localize("PLANT.altEffectsTab") };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        // Wir behalten deinen Header-Fix 1:1 bei
        const windowHeader = this.element.closest('.application').querySelector('.window-title');
        if (windowHeader) windowHeader.textContent = context.title;

        new DragDrop({ dropSelector: ".drop-zone", callbacks: { drop: this._onDrop.bind(this) } }).bind(this.element);
        const tabs = new foundry.applications.ux.Tabs({ navSelector: ".sheet-tabs", contentSelector: ".content", initial: this._activeTab });
        tabs.bind(this.element);

        this.element.querySelectorAll('.sheet-tabs .item').forEach(tab => {
            tab.addEventListener('click', ev => { this._activeTab = ev.currentTarget.dataset.tab; });
        });

        this.element.querySelectorAll('.browser-item').forEach(el => {
            el.addEventListener('contextmenu', async (ev) => {
                ev.preventDefault();
                const { field, uuid, method } = ev.currentTarget.dataset;
                const methods = foundry.utils.deepClone(this.item.system.preservationDetails.methods || {});
                if (methods[method] && methods[method][field]) {
                    methods[method][field] = methods[method][field].filter(i => i.uuid !== uuid);
                    await this.item.update({ "system.preservationDetails.methods": methods });
                    this.render();
                }
            });
        });
    }

    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type !== "Item") return;
        const droppedItem = await fromUuid(data.uuid);
        if (!droppedItem) return;

        const { field, method } = event.currentTarget.dataset;
        const methods = foundry.utils.deepClone(this.item.system.preservationDetails.methods || {});
        if (!methods[method]) methods[method] = { alternativeEffects: [], extraProducts: [] };

        if (field === "alternativeEffects" && methods[method].alternativeEffects.length >= 1) return ui.notifications.warn(game.i18n.localize("PLANT.errorOnlyOneAllowed"));
        if (!methods[method][field].some(i => i.uuid === data.uuid)) {
            methods[method][field].push({ name: droppedItem.name, img: droppedItem.img, uuid: data.uuid });
            await this.item.update({ "system.preservationDetails.methods": methods });
            this.render();
        }
    }
}
