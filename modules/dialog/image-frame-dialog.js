import { DefaultAppv2 } from '../actor/baseapp.js';
import ImageFramePicker from '../system/helpers/image-frame-picker.js';

/**
 * Dialog to pan/zoom an image into a target frame (hotbar portrait / Ladenschild).
 */
export default class ImageFrameDialog extends DefaultAppv2 {
  #picker;

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'image-frame-dialog'],
    window: {
      title: 'IMAGEFRAME.title',
      icon: 'fa-solid fa-crop-simple',
      resizable: true,
      contentClasses: ['standard-form', 'flexcol', 'gap5px'],
    },
    position: {
      width: 520,
      height: 'auto',
    },
    actions: {
      save: this.#onSave,
      reset: this.#onReset,
      cancel: this.#onCancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/image-frame-dialog.hbs',
      templates: ['systems/dsa5/templates/system/parts/image-frame-picker.hbs'],
    },
  };

  /**
   * @param {object} options
   * @param {string} options.imageSrc
   * @param {{ offsetX?: number, offsetY?: number, zoom?: number }} [options.frame]
   * @param {'portrait'|'banner'|object} [options.preset='portrait']
   * @param {string} [options.title]
   * @param {(frame: object) => void|Promise<void>} options.onSave
   */
  constructor(options = {}) {
    const { imageSrc, frame, preset = 'portrait', title, onSave, ...rest } = options;
    super(rest);
    if (title) this.options.window.title = title;
    this.imageSrc = imageSrc;
    this.onSave = onSave;
    this.preset = preset;
    this.#picker = new ImageFramePicker({
      preset,
      frame,
      isInteractive: () => true,
      onChange: () => {
        this._frameDirty = true;
      },
    });
    this._frameDirty = false;
  }

  static async configure(options = {}) {
    if (!options.imageSrc) {
      ui.notifications.warn('IMAGEFRAME.noImage', { localize: true });
      return null;
    }
    const dialogId = options.id || `dsa-image-frame-${foundry.utils.randomID(8)}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return existing;
    }
    const app = new this({ id: dialogId, ...options });
    app.render(true);
    return app;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    Object.assign(data, this.#picker.templateContext, {
      imageSrc: this.imageSrc,
      interactive: true,
      isDirty: this._frameDirty,
    });
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#picker.bind(this.element);
  }

  _tearDown(options) {
    this.#picker.unbind();
    super._tearDown(options);
  }

  static async #onSave() {
    await this.onSave?.(this.#picker.frame);
    this.close();
  }

  static #onReset() {
    this.#picker.reset();
    this._frameDirty = true;
    this.render({ parts: ['main'] });
  }

  static #onCancel() {
    this.close();
  }
}
