export default class RollMemory {
    constructor() {
        this.tokens = {}
        this.actors = {}
    }

    static get wantedKeys() {
        const wantedKeys = ["vision", "targetMovement", "shooterMovement",
            "quickChange", "mountOptions", "narrowSpace", "advantageousPosition", "doubleAttack",
            "reduceCostSpell", "forceSpell", "increaseCastingTime", "decreaseCastingTime", "removeGesture", "removeFormula"
        ]
        if (!game.settings.get("dsa5", "enableDPS")) wantedKeys.push("distance")
        return wantedKeys
    }

    getPath(speaker, source, mode) {
        let subMod = mode || ""
        const itemId = source._id || source.type
        return speaker.token ? `tokens.${speaker.token || speaker.actor}.${itemId}${subMod}` : `actors.${speaker.actor}.${itemId}${subMod}`
    }

    remember(speaker, source, mode, formData) {
        const data = this.formDataSerialize(formData)
        if (Object.entries(data).length > 0)
            setProperty(this, this.getPath(speaker, source, mode), data)

    }

    recall(speaker, source, mode) {
        return getProperty(this, this.getPath(speaker, source, mode))
    }

    formDataSerialize(html) {
        let form = html.find("form")
        let object = {};
        form.find('select').each(function() {
            let key = $(this).attr("name")
            if (RollMemory.wantedKeys.includes(key)) {
                object[key] = $(this).val()
            }
        })
        form.find('input[type="checkbox"]').each(function() {
            let key = $(this).attr("name")
            if (RollMemory.wantedKeys.includes(key)) {
                object[key] = this.checked
            }
        })

        form.find('.specAbs.active').each(function() {
            if (!object.specAbs) object.specAbs = []

            object.specAbs.push({ id: $(this).attr("data-id"), step: $(this).attr("data-step") })
        })

        html.find('[name="situationalModifiers"] option').each(function() {
            if (!object.situationalModifiers) object.situationalModifiers = []

            object.situationalModifiers.push({ name: $(this).text().trim(), selected: this.selected })
        })

        return object
    }
}