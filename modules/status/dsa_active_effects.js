import Actordsa5 from "../actor/actor-dsa5.js";

export default class DSAActiveEffect extends ActiveEffect {
    static itemChangeRegex = /^@/

    apply(actor, change) {
        if (DSAActiveEffect.itemChangeRegex.test(change.key)) {
            const modifiedItems = this._getModifiedItems(actor, change)

            for (let item of modifiedItems.items) {
                const overrides = foundry.utils.flattenObject(item.overrides || {});
                overrides[modifiedItems.key] = Number.isNumeric(item.value) ? Number(modifiedItems.value) : modifiedItems.value;
                const newChange = { ...change, key: modifiedItems.key, value: modifiedItems.value };
                super.apply(item, newChange);
                item.overrides = foundry.utils.expandObject(overrides);
            }
        } else {
            return super.apply(actor, change);
        }
    }

    static async _onCreateDocuments(documents, context) {
        for(let doc of documents) {
            if(doc.parent.documentName == "Actor")
                await Actordsa5.postUpdateConditions(doc.parent)
        }
        return super._onCreateDocuments(documents, context);
      }
    
    static async _onUpdateDocuments(documents, context) {
        for(let doc of documents) {
            if(doc.parent.documentName == "Actor")
                await Actordsa5.postUpdateConditions(doc.parent)
        }
        return super._onUpdateDocuments(documents, context);
    }

    static async _onDeleteDocuments(documents, context) {
        for(let doc of documents) {
            if(doc.parent.documentName == "Actor")
                await Actordsa5.postUpdateConditions(doc.parent)
        }
        return super._onDeleteDocuments(documents, context);
    }

    isVisibleEffect() {
        return !this.disabled && !this.notApplicable && (game.user.isGM || !this.getFlag("dsa5", "hidePlayers")) && !this.getFlag("dsa5", "hideOnToken") && (this.origin == this.target?.uuid || !this.origin)
    }

    _displayScrollingStatus(enabled) {
        const allowedEffects = ["dead"];
        const isAllowedToSeeEffects = game.user.isGM || this.target?.testUserPermission(game.user, "OBSERVER") || !(game.settings.get("dsa5", "hideEffects"));
        const visibleEffect = isAllowedToSeeEffects ? this.isVisibleEffect() : allowedEffects.some(y => this.statuses.has(y))

        if(!visibleEffect) return

        super._displayScrollingStatus(enabled);
    }

    _getModifiedItems(actor, change) {
        const data = change.key.split(".")
        let type = data.shift()
        type = type.replace("@", "").toLowerCase()
        const itemName = data.shift()
        const key = data.join(".")
        const value = change.value
        const items = actor?.items?.filter(x => x.type == type && (x.name == itemName || x.id == itemName)) || []
        return { items, key, value }
    }

    async _preUpdate(changed, options, user) {
        super._preUpdate(changed, options, user);
        this._clearModifiedItems()
    }

    _clearModifiedItems() {
        if (!(this.parent instanceof CONFIG.Actor.documentClass)) return

        for (let change of this.changes) {
            if (DSAActiveEffect.itemChangeRegex.test(change.key)) {
                const itemsToClear = this._getModifiedItems(this.parent, change)

                for (const item of itemsToClear.items) {
                    const overrides = foundry.utils.flattenObject(item.overrides || {});
                    
                    const key = itemsToClear.key;
                    delete overrides[key];
                    const source = getProperty(item._source, key);
                    setProperty(item, key, source);

                    item.overrides = foundry.utils.expandObject(overrides);
                    if (item.sheet?.rendered) item.sheet.render(true);
                }
            }
        }
    }

    async _preDelete(options, user) {
        super._preDelete(options, user);
        this._clearModifiedItems()
    }
}

const applyCustomEffect = (elem, change) => {
    let current = getProperty(elem, change.key) || null
    if (current == null && /^system\.(vulnerabilities|resistances)/.test(change.key)) {
        current = []
        setProperty(elem, change.key, current)
    }
    const ct = getType(current)
    let update = null
    switch (ct) {
        case "Array":
            let newElems = []
            const source = change.effect.name
            for (let elem of `${change.value}`.split(/[;,]+/)) {
                let vals = elem.split(" ")
                const value = vals.pop()
                const target = vals.join(" ")
                newElems.push({ source, value, target })
            }
            update = current.concat(newElems)
    }
    if (update !== null) setProperty(elem, change.key, update)
    return update
}

Hooks.on("applyActiveEffect", (actor, change) => {
    return applyCustomEffect(actor, change)
})