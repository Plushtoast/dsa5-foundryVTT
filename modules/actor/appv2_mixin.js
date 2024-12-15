export const AppV2Mixin = (superclass) =>
    class extends superclass {
        static TABS = []

        prepareTabs() {
            return this.constructor.TABS.reduce((tabs, tab) => {
            tab.active = this.tabGroups.sheet === tab.id;
            tab.cssClass = tab.active ? "active" : "";
            tabs[tab.id] = tab;
            return tabs;
            }, {});
        }

        async _prepareContext(_options) {
            const data = await super._prepareContext(_options);
            data.tabs = this.prepareTabs();
            return data;
        }

        async _onRender(context, options) {
            await super._onRender((context, options));
        
            new DragDrop({
              callbacks: {
                drop: this._onDrop.bind(this)
              }
            }).bind(this.element);
        }

        async _onDrop(event) {}
    }
