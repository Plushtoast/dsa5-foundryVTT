import CompanionHotbar from './companion-hotbar.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CompanionSkillSelectionApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, companion, options = {}) {
        super(options);
        this.actor = actor;       
        this.companion = companion; 
        this.parentSheet = options.parentSheet; 
        this.options.window.title = `${_loc("COMPANIONS.SkillSelection.label")}: ${this.companion.name}`;
    }

    static DEFAULT_OPTIONS = {
        id: "companion-skill-selection",
        classes: ["dsa5", "sheet", "dsa5-companion"],
        actions: {
            openItemSheet: this.#openItemSheet,
            hotbarSlotAction: { handler: this.#onHotbarSlotAction, buttons: [0, 2] }
        },
        window: {
            title: "COMPANIONS.SkillSelection.label",
            resizable: true,
        },
        position: { width: 450, height: 650 }
    };

    static PARTS = {
        main: {
            template: "systems/dsa5/templates/actors/companions/companion-skill-selection.hbs",
            scrollable: ['.skill-selection-categories']
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.companion = this.companion;

        const savedHotbar = this._getHotbar();
        const savedHotbarIds = new Set(savedHotbar.filter(Boolean));
        const hotbarItems = new Map();

        context.categories = [
            { label: 'COMPANIONS.SkillSelection.FamiliarAbilities', items: [] },
            { label: 'COMPANIONS.SkillSelection.HomunculusAbilities', items: [] },
            { label: 'COMPANIONS.Trick.label', items: [] },
            { label: 'specialAbilities', items: [] },
            ...Object.values(CompanionHotbar.ROLLABLE_CATEGORIES).map(({ label }) => ({ label, items: [] }))
        ];

        const categoryMap = {
            'trait:familiar': context.categories[0],
            'specialability:homunculus': context.categories[1],
            'trait:trick': context.categories[2],
            'specialability:animal': context.categories[3],
        };

        const rollableCategoryMap = Object.keys(CompanionHotbar.ROLLABLE_CATEGORIES).reduce((categories, type, index) => {
            categories[type] = context.categories[index + 4];
            return categories;
        }, {});

        for (const item of this.companion.items) {
            if (savedHotbarIds.has(item.id)) hotbarItems.set(item.id, item);

            const subType = item.type === 'trait' ? item.system?.traitType?.value : item.system?.category?.value;
            categoryMap[`${item.type}:${subType}`]?.items.push(item);
            rollableCategoryMap[item.type]?.items.push(item);
        }

        context.hotbarRows = [[], []];
        for (let i = 0; i < savedHotbar.length; i++) {
            const itemId = savedHotbar[i];
            context.hotbarRows[i < 7 ? 0 : 1].push({
                index: i,
                item: itemId ? hotbarItems.get(itemId) ?? null : null
            });
        }

        return context;
    }

    _getHotbar() {
        return this.companion.system.companionData.skillHotbar;
    }

    _canDragStart() {
        return true;
    }

    _canDragDrop() {
        return true;
    }

    _onRender(context, options) {
        super._onRender(context, options);

        new foundry.applications.ux.DragDrop.implementation({
            dragSelector: '.skill-drag',
            dropSelector: '.hotbar-slot',
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                drop: this._onDrop.bind(this)
            }
        }).bind(this.element);
    }

    _onDragStart(event) {
        event.dataTransfer.setData('text/plain', JSON.stringify({ id: event.currentTarget.dataset.itemId }));
    }

    async _onDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        const index = Number.parseInt(event.currentTarget.dataset.index, 10);

        const hotbar = this._getHotbar();
        hotbar[index] = data.id;

        await this.companion.update({ 'system.companionData.skillHotbar': hotbar });
        this.render({ force: true });
    }

    _showItemSheet(target) {
        const item = this.companion.items.get(target.dataset.itemId);
        if (item) item.sheet.render(true);
    }

    static async #openItemSheet(event, target) {
        this._showItemSheet(target);
    }

    static async #onHotbarSlotAction(event, target) {
        event.preventDefault();

        if (event.button === 2) {
            const index = Number.parseInt(target.dataset.index, 10);
            const hotbar = this._getHotbar();
            if (!hotbar[index]) return;

            hotbar[index] = null;
            await this.companion.update({ 'system.companionData.skillHotbar': hotbar });
            this.render({ force: true });
            return;
        }

        this._showItemSheet(target);
    }
}


