export const DragMixin = (superclass) =>
  class extends superclass {
    _canDragStart() {
      return true;
    }

    _canDragDrop() {
      return true;
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      
      new foundry.applications.ux.DragDrop.implementation({
        dragSelector: ".item",
        dropSelector: ".window-content",
        permissions: {
          dragstart: this._canDragStart.bind(this),
          drop: this._canDragDrop.bind(this)
        },
        callbacks: {
          dragstart: this._onDragStart.bind(this),
          dragover: this._onDragOver.bind(this),
          drop: this._onDrop.bind(this)
        }
      }).bind(this.element);
    }

    async _onDragStart(event) {

    }

    _onDragOver(event) {
      
    }

    async _onDrop(event) {
    }
  };
