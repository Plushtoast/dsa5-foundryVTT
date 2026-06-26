export const AppV2Mixin = (superclass) =>
  class extends superclass {
    static dragHighlightCleanupBound = false;
    static dragHighlightData = null;

    static DEFAULT_OPTIONS = {
      ownerActions: {},
      majorButtons: [],
    };

    static clearDragHighlights() {
      document.querySelectorAll('.window-content.dsaDraggedOver').forEach((el) => {
        el.classList.remove('dsaDraggedOver');
        delete el.dataset.dragHint;
      });
    }

    static ensureDragHighlightCleanup() {
      if (this.dragHighlightCleanupBound) return;

      const clear = () => {
        this.clearDragHighlights();
        this.dragHighlightData = null;
      };
      window.addEventListener('dragend', clear, true);
      window.addEventListener('drop', clear, true);
      window.addEventListener('blur', clear, true);
      window.addEventListener('dragleave', (event) => {
        if (!event.relatedTarget) clear();
      }, true);
      this.dragHighlightCleanupBound = true;
    }

    _dragHighlightHint(event) {
      let data;
      try {
        data = JSON.parse(event.dataTransfer?.getData('text/plain') || '{}');
      } catch {
        data = {};
      }

      if (!data.type) data = this.constructor.dragHighlightData || {};

      if (data.type !== 'Item' || !data.uuid || !this.actor) return '';

      const item = fromUuidSync(data.uuid);
      if (!item || item.parent?.uuid === this.actor.uuid || !game.dsa5.config.equipmentCategories.has(item.type)) return '';

      return game.i18n.localize('SHEET.DropMoveFromSourceHint');
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

    _updateDetachedTabLayout() {
      if (!this.element?.classList.contains('actor')) return;

      const detached = !!this.window.windowId;
      this.element.classList.toggle('sheet-detached', detached);
      if (detached && game.settings.get('dsa5', 'tabsOutsideSheet')) {
        requestAnimationFrame(() => this._ensureVerticalTabSpace());
      }
    }

    _ensureVerticalTabSpace() {
      if (!this.window.windowId || !game.settings.get('dsa5', 'tabsOutsideSheet')) return;

      const el = this.element;
      const view = el?.ownerDocument?.defaultView;
      const tabs = el?.querySelector('.tabs.right');
      if (!tabs || !view) return;

      const deficit = Math.ceil(tabs.getBoundingClientRect().right - view.innerWidth + 8);
      if (deficit <= 0) return;

      const width = Number(this.position?.width) || el.getBoundingClientRect().width;
      this.setPosition({ width: width + deficit });

      if (this.window.windowId === this.id) view.resizeBy?.(deficit, 0);
    }

    _onDetach(from, to) {
      this._updateDetachedTabLayout();
    }

    _onAttach(from, to) {
      this._updateDetachedTabLayout();
    }

    async _onRender(context, options) {
      this.constructor.ensureDragHighlightCleanup();
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
          delete hovered.dataset.dragHint;
        } else {
          hovered.classList.add('dsaDraggedOver');
          const hint = this._dragHighlightHint(event);
          if (hint) hovered.dataset.dragHint = hint;
          else delete hovered.dataset.dragHint;
        }
      } else {
        this.constructor.clearDragHighlights();
      }
    }
  };
