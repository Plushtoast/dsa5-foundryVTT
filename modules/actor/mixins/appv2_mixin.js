import { pushInitiatingApp, popInitiatingApp } from '../../mixins/detached-window-mixin.js';

const { TextEditor } = foundry.applications.ux;

export const AppV2Mixin = (superclass) =>
  class extends superclass {
    static dragHighlightCleanupBound = false;
    static dragHighlightData = null;

    static DEFAULT_OPTIONS = {
      ownerActions: {},
      ownerRollActions: {},
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

      const seen = new Set();

      for (const btn of this.options.majorButtons) {
        if (seen.has(btn.action)) continue;
        seen.add(btn.action);

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
      if (!game.settings.get('dsa5', 'tabsOutsideSheet')) return;

      if (this.window.windowId) {
        requestAnimationFrame(() => this._ensureVerticalTabSpace());
        setTimeout(() => this._ensureVerticalTabSpace(), 50);
      } else if (this._detachedResizeHandler) {
        this.element?.ownerDocument?.defaultView?.removeEventListener('resize', this._detachedResizeHandler);
        this._detachedResizeHandler = null;
      }
    }

    /**
     * Narrow the sheet in a detached popup so vertical tabs (positioned outside .window-content)
     * stay visible. Foundry's ResizeManager fills the window width on resize — re-run via listener.
     */
    _ensureVerticalTabSpace() {
      if (!this.window.windowId || !game.settings.get('dsa5', 'tabsOutsideSheet')) return;
      if (this.window.windowId !== this.id) return;

      const el = this.element;
      const view = el?.ownerDocument?.defaultView;
      const tabs = el?.querySelector('.tabs.right');
      const content = el?.querySelector('.window-content');
      if (!tabs || !content || !view) return;

      const left = Number(this.position?.left) || 0;
      const contentRect = content.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const gutter = Math.max(
        Math.ceil(tabsRect.right - contentRect.right + 8),
        Math.ceil(tabsRect.width + 8),
      );

      const targetWidth = view.innerWidth - left - gutter;
      if (targetWidth > 0) this.setPosition({ width: targetWidth });

      if (!this._detachedResizeHandler) {
        this._detachedResizeHandler = () => this._ensureVerticalTabSpace();
        view.addEventListener('resize', this._detachedResizeHandler, { passive: true });
      }
    }

    _onDetach(from, to) {
      this._updateDetachedTabLayout();
    }

    _onAttach(from, to) {
      from.defaultView?.removeEventListener('resize', this._detachedResizeHandler);
      this._detachedResizeHandler = null;
    }

    async _onRender(context, options) {
      this.constructor.ensureDragHighlightCleanup();
      this.constructor.clearDragHighlights();
      await super._onRender(context, options);
      this._updateDetachedTabLayout();
    }

    _tearDown(options) {
      this.element?.ownerDocument?.defaultView?.removeEventListener('resize', this._detachedResizeHandler);
      this._detachedResizeHandler = null;
      this.constructor.clearDragHighlights();
      return super._tearDown(options);
    }

    async _onClickAction(event, target) {
      const action = target.dataset.action;
      const restrictedActions = [
        [this.options.ownerActions, 'DSAError.DamagePermission'],
        [this.options.ownerRollActions, 'DSAError.RollPermission'],
      ];

      for (const [actions, notificationKey] of restrictedActions) {
        let handler = actions?.[action];
        if (!handler) continue;

        if (this.isEditable) {
          let buttons = [0];
          if (typeof handler === 'object') {
            buttons = handler.buttons;
            handler = handler.handler;
          }
          if (buttons.includes(event.button)) {
            pushInitiatingApp(this);
            try {
              await handler?.call(this, event, target);
            } finally {
              popInitiatingApp();
            }
          }
        } else {
          ui.notifications.warn(notificationKey, { localize: true });
        }
        return;
      }

      return super._onClickAction(event, target);
    }

    async _onDrop(event) {
      this.constructor.clearDragHighlights();
      event.dsaDropData ??= TextEditor.getDragEventData(event);
      return await super._onDrop(event);
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
