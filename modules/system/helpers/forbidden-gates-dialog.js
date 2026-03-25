const { ApplicationV2 } = foundry.applications.api;

export default class ForbiddenGatesDialog extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "forbidden-gates-app",
        classes: ["dsa5"],
        window: { 
            title: "FORBIDDENGATES.dialogTitle", 
            resizable: true 
        },
        position: { width: 520, height: "auto" },
        actions: {
            adjustCosts: function(e, t) { this._onAdjustCosts(e, t); },
            confirm: function() { this._onConfirm(); },
            cancel: function() { this.close(); }
        }
    };

    constructor(actor, totalCost, message, isPowerful, options) {
        super(options);
        this.actor = actor;
        this.totalCost = totalCost;
        this.message = message;
        this.minAsP = isPowerful ? 0 : 1;

        this.aspCost = this.totalCost;
        this.lepCost = 0;
        this._validateCosts();
    }

    get title() {
        return game.i18n.localize("FORBIDDENGATES.dialogTitle");
    }

    async _renderHTML(context, options) {
        return await renderTemplate("systems/dsa5/templates/dialog/forbidden-gates-dialog.hbs", context);
    }

    _replaceHTML(result, content, options) {
        content.innerHTML = result;
    }

    async _prepareContext(options) {
        return {
            currentLeP: this.actor.system.status.wounds.value,
            currentAsP: this.actor.system.status.astralenergy.value,
            totalCost: this.totalCost,
            lepCost: this.lepCost,
            aspCost: this.aspCost
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;

        const inputs = html.querySelectorAll('input');
        inputs.forEach(inp => {
            inp.addEventListener('change', (ev) => this._onManualInput());
            inp.addEventListener('keydown', (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    this._onManualInput();
                }
            });
        });
    }

    _onManualInput() {
        const html = this.element;
        this.lepCost = parseInt(html.querySelector('.fg-lep-cost').value) || 0;
        this.aspCost = parseInt(html.querySelector('.fg-asp-cost').value) || 0;
        
        this._validateCosts();
        this.render();
    }

    _onAdjustCosts(event, target) {
        const dir = target.dataset.dir;
        
        if (dir === "left") {
            if (this.aspCost > this.minAsP) { 
                this.aspCost--; 
                this.lepCost++; 
            }
        } else {
            if (this.aspCost < this.totalCost) { 
                this.aspCost++; 
                this.lepCost--; 
            }
        }
        
        this._validateCosts();
        this.render();
    }

    _validateCosts() {
        if (this.lepCost + this.aspCost !== this.totalCost || (this.aspCost < this.minAsP && this.totalCost >= this.minAsP)) {
            this.aspCost = Math.max(this.minAsP, this.totalCost - this.lepCost);
            this.lepCost = this.totalCost - this.aspCost;
            
            if (this.aspCost < this.minAsP && this.totalCost >= this.minAsP) {
                this.aspCost = this.minAsP;
                this.lepCost = this.totalCost - this.minAsP;
            }
        }
    }

    async _onConfirm() {
        if (this.actor.system.status.astralenergy.value < this.aspCost) {
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughAsP"));
        }

        if (this.aspCost > 0) {
            await this.actor.update({
                "system.status.astralenergy.value": this.actor.system.status.astralenergy.value - this.aspCost
            });
        }
        if (this.lepCost > 0) {
            await this.actor.applyDamage(this.lepCost);
        }

        const { ForbiddenGatesHandler } = await import('./forbidden-gates-handler.js');
        await ForbiddenGatesHandler.updateMessage(this.message, this.aspCost, this.lepCost);

        this.close();
    }
}
