export class MeasuredTemplateDSA extends MeasuredTemplate {
    #initialLayer;
    #moveTime = 0;
    #events;

    
    static async placeTemplateFromChat(ev){
        const id = $(ev.currentTarget).parents(".message").attr("data-message-id")
        const message = game.messages.get(id);
        const source = message.flags.data.preData.source;
        const testData = message.flags.data.postData;

        const template = this.fromItem(source, testData.successLevel)
        if ( template ) template.drawPreview();
    }

    static fromItem(item, qs) {
        const target = item.system.target || {};
        const templateShape = game.dsa5.config.areaTargetTypes[target.type];
        if (!templateShape || !target.value) return null;

        const distance = Number(Roll.safeEval(`${target.value}`.replace(/(qs|ql)/gi, qs))) || 1
        const templateData = {
            t: templateShape,
            user: game.user.id,
            distance,
            direction: 0,
            x: 0,
            y: 0,
            fillColor: game.user.color,
            flags: { dsa5: { origin: item.uuid } },
        };

        switch (templateShape) {
            case "cone":
                templateData.angle = CONFIG.MeasuredTemplate.defaults.angle;
                break;
            case "rect":
                templateData.distance = Math.hypot(distance, distance);
                templateData.width = distance;
                templateData.direction = 45;
                break;
            case "ray":
                templateData.width = target.width ? (Number(Roll.safeEval(`${target.width}`.replace(/(qs|ql)/gi, qs))) || canvas.dimensions.distance) : canvas.dimensions.distance;
                break;
        }

        const cls = CONFIG.MeasuredTemplate.documentClass;
        const template = new cls(templateData, { parent: canvas.scene });
        const object = new this(template);
        object.item = item;
        object.actorSheet = item.actor?.sheet || null;
        return object;
    }

    drawPreview() {
        const initialLayer = canvas.activeLayer;

        this.draw();
        this.layer.activate();
        this.layer.preview.addChild(this);

        return this.activatePreviewListeners(initialLayer);
    }

    activatePreviewListeners(initialLayer) {
        return new Promise((resolve, reject) => {
            this.#initialLayer = initialLayer;
            this.#events = {
                cancel: this._onCancelPlacement.bind(this),
                confirm: this._onConfirmPlacement.bind(this),
                move: this._onMovePlacement.bind(this),
                resolve,
                reject,
                rotate: this._onRotatePlacement.bind(this),
            };

            canvas.stage.on("mousemove", this.#events.move);
            canvas.stage.on("mousedown", this.#events.confirm);
            canvas.app.view.oncontextmenu = this.#events.cancel;
            canvas.app.view.onwheel = this.#events.rotate;
        });
    }

    async _finishPlacement(event) {
        this.layer._onDragLeftCancel(event);
        canvas.stage.off("mousemove", this.#events.move);
        canvas.stage.off("mousedown", this.#events.confirm);
        canvas.app.view.oncontextmenu = null;
        canvas.app.view.onwheel = null;
        this.#initialLayer.activate();
        await this.actorSheet?.maximize();
    }

    _onMovePlacement(event) {
        event.stopPropagation();
        let now = Date.now();
        if (now - this.#moveTime <= 20) return;
        const center = event.data.getLocalPosition(this.layer);
        const snapped = canvas.grid.getSnappedPosition(center.x, center.y, 2);
        this.document.updateSource({ x: snapped.x, y: snapped.y });
        this.refresh();
        this.#moveTime = now;
    }

    _onRotatePlacement(event) {
        if (event.ctrlKey) event.preventDefault();
        event.stopPropagation();
        let delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
        let snap = event.shiftKey ? delta : 5;
        const update = {
            direction: this.document.direction + snap * Math.sign(event.deltaY),
        };
        this.document.updateSource(update);
        this.refresh();
    }

    async _onConfirmPlacement(event) {
        await this._finishPlacement(event);
        const destination = canvas.grid.getSnappedPosition(
            this.document.x,
            this.document.y,
            2
        );
        this.document.updateSource(destination);
        this.#events.resolve(
            canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [
                this.document.toObject(),
            ])
        );
    }

    async _onCancelPlacement(event) {
        await this._finishPlacement(event);
        this.#events.reject();
    }
}
