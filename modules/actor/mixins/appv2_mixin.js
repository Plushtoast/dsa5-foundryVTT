export const AppV2Mixin = (superclass) =>
  class extends superclass {
    static DEFAULT_OPTIONS = {
      ownerActions: {},
      majorButtons: [],
    };

    static clearDragHighlights() {
      document.querySelectorAll('.window-content.dsaDraggedOver').forEach((el) => {
        el.classList.remove('dsaDraggedOver');
      });
    }

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

    async _onRender(context, options) {
      this.constructor.clearDragHighlights();
      await super._onRender(context, options);
    }

    _tearDown(options) {
      this.constructor.clearDragHighlights();
      return super._tearDown(options);
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

    async _onDrop(event) {
      this.constructor.clearDragHighlights();
      super._onDrop(event);
    }

    _onDragOver(event) {
      super._onDragOver(event);

      const hovered = event.target.closest('.window-content');

      if (hovered) {
        const padding = 30;
        const rect = hovered.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const isInBorder = x < padding || x > rect.width - padding || y < padding || y > rect.height - padding;
        this.constructor.clearDragHighlights();
        if (isInBorder) {
          hovered.classList.remove('dsaDraggedOver');
        } else {
          hovered.classList.add('dsaDraggedOver');
        }
      } else {
        this.constructor.clearDragHighlights();
      }
    }
  };
