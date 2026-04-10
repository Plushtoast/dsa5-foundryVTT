const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CompanionSkillSelectionApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, companion, options = {}) {
        super(options);
        this.actor = actor;       
        this.companion = companion; 
        this.parentSheet = options.parentSheet; 
        this.options.window.title = `${_loc("SHEET.SkillSelection")}: ${this.companion.name}`;
    }

    static DEFAULT_OPTIONS = {
        id: "companion-skill-selection",
        classes: ["dsa5", "sheet"],
        actions: {
            openItemSheet: this.#openItemSheet,
            hotbarSlotAction: { handler: this.#onHotbarSlotAction, buttons: [0, 2] }
        },
        window: {
            title: "SHEET.SkillSelection",
            resizable: true,
        },
        position: { width: 450, height: 650 }
    };

    static PARTS = {
        main: {
            template: "systems/dsa5/templates/actors/companions/companion-skill-selection.hbs"
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.companion = this.companion;

        const savedHotbar = this._getHotbar();
        const savedHotbarIds = new Set(savedHotbar.filter(Boolean));
        const hotbarItems = new Map();
        const categories = {
            familiarAbilities: [],
            homunculusAbilities: [],
            tricks: [],
            animalSpecialAbilities: []
        };

        for (const item of this.companion.items) {
            if (savedHotbarIds.has(item.id)) hotbarItems.set(item.id, item);

            if (item.type === 'trait') {
                const traitType = item.system?.traitType?.value;
                if (traitType === 'familiar') categories.familiarAbilities.push(item);
                else if (traitType === 'trick') categories.tricks.push(item);
                continue;
            }

            if (item.type === 'specialability') {
                const category = item.system?.category?.value;
                if (category === 'homunculus') categories.homunculusAbilities.push(item);
                else if (category === 'animal') categories.animalSpecialAbilities.push(item);
            }
        }

        context.categories = [
            { label: 'SHEET.FamiliarAbilities', items: categories.familiarAbilities },
            { label: 'SHEET.HomunculusAbilities', items: categories.homunculusAbilities },
            { label: 'SHEET.Tricks', items: categories.tricks },
            { label: 'SHEET.AnimalSpecialAbilities', items: categories.animalSpecialAbilities }
        ];

        context.hotbar = savedHotbar.map((itemId, idx) => {
            return {
                index: idx,
                item: itemId ? hotbarItems.get(itemId) ?? null : null
            };
        });

        context.hotbarRows = [context.hotbar.slice(0, 7), context.hotbar.slice(7, 14)];

        return context;
    }

    _getHotbar() {
        return this.companion.getFlag('dsa5', 'skillHotbar') || Array(14).fill(null);
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

        await this.companion.setFlag('dsa5', 'skillHotbar', hotbar);
        await this._refreshSheets();
    }

    async _refreshSheets() {
        this.render({ force: true });
        if (this.parentSheet?.rendered) this.parentSheet.render({ force: true });
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
            await this.companion.setFlag('dsa5', 'skillHotbar', hotbar);
            await this._refreshSheets();
            return;
        }

        this._showItemSheet(target);
    }
}


