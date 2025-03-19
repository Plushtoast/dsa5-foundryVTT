export const AppV2Mixin = (superclass) =>
  class extends superclass {
    static DEFAULT_OPTIONS = {
      ownerActions: {},
    };

    async _onRender(context, options) {
      await super._onRender((context, options));

      //todo: add drag handler dragSelector, dropSelector
      new foundry.applications.ux.DragDrop({ 
        callbacks: { drop: this._onDrop.bind(this)},
        permissions: { drop: this._canDragDrop.bind(this) }
      }).bind(this.element);
    }

    _canDragDrop(event) {
      return this.isEditable;
    }

    async _onDrop(event) {

    }

    _onClickAction(event, target) {
      const action = target.dataset.action;
      let handler = this.options.ownerActions[action];
      if (this.isEditable && handler) {
        let buttons = [0];
        if (typeof handler === 'object') {
          buttons = handler.buttons;
          handler = handler.handler;
        }
        if (buttons.includes(event.button)) handler?.call(this, event, target);
      }
      else if (handler) {
        ui.notifications.warn('DSAError.DamagePermission', { localize: true });
      } else {
        super._onClickAction(event, target);
      }      
    }
  };
