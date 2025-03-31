export const AppV2Mixin = (superclass) =>
  class extends superclass {
    static DEFAULT_OPTIONS = {
      ownerActions: {},
      majorButtons: [],
    };

    async _renderFrame(options) {
      const frame = await super._renderFrame(options);
      if (!this.hasFrame) return frame;

      for (const btn of this.options.majorButtons) {
        const visible = typeof btn.visible === 'function' ? btn.visible.call(this) : (btn.visible ?? true);
        if (!visible) continue;

        const icon = typeof btn.icon === 'function' ? btn.icon.call(this) : btn.icon;
        const button = `<button type="button" class="header-control ${icon} icon" data-action="${btn.action}"
                data-tooltip="${btn.label}"></button>`;
        this.window.title.insertAdjacentHTML('beforebegin', button);
      }
      return frame;
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
      } else if (handler) {
        ui.notifications.warn('DSAError.DamagePermission', { localize: true });
      } else {
        super._onClickAction(event, target);
      }
    }
  };
