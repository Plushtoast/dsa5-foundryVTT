export const AppV2Mixin = (superclass) =>
  class extends superclass {
    async _onRender(context, options) {
      await super._onRender((context, options));
      new DragDrop({ callbacks: { drop: this._canDragDrop.bind(this) } }).bind(this.element);
    }

    _canDragDrop(event) {
      if(this.isEditable) this._onDrop(event);
    }

    async _onDrop(event) {}
  };
