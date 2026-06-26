import DSA5 from '../../config/config-dsa5.js';
import { tinyNotification } from './view_helper.js';

export const FONT_SIZE_OPTIONS = DSA5.journalFontSizes;

export function resolveFontSizePx(index) {
  if (!index || index <= 0) return null;
  return FONT_SIZE_OPTIONS[index - 1] ?? 14;
}

export function getFontSizeLabel(index) {
  const size = resolveFontSizePx(index);
  return size ? `${size}px` : 'Default';
}

export function applyFontSize(element, index) {
  const $el = element instanceof jQuery ? element : $(element);
  const size = resolveFontSizePx(index);
  if (size) $el.css('fontSize', `${size}px`);
  else $el.css('fontSize', '');
  return size;
}

export async function setFontSizeIndex(settingKey, index) {
  await game.settings.set('dsa5', settingKey, Number(index) || 0);
}

export async function increaseFontSize(element, settingKey = 'journalFontSizeIndex') {
  new FontPicker(element, settingKey).render(true);
}

export class FontPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'SHEET.increaseFontSize',
      icon: 'fas fa-arrows-up-down',
    },
    actions: {
      changeSize: this._changeSize,
    }
  }

  constructor(element, settingKey = 'journalFontSizeIndex') {
    super();
    this.connected_element = element;
    this.settingKey = settingKey;
  }

  static PARTS = {
    size: {
      template: 'systems/dsa5/templates/dialog/fontSize.hbs',
    }
  }

  static async _changeSize(ev, target) {
    const newSize = target.dataset.size;

    if (newSize == "-1") {
      await setFontSizeIndex(this.settingKey, 0);
      this.connected_element.css('fontSize', '');
      tinyNotification(_loc('CHATNOTIFICATION.fontsize', { size: 'Default ' }));
    } else {
      const newIndex = FONT_SIZE_OPTIONS.findIndex((x) => x == newSize) + 1;
      await setFontSizeIndex(this.settingKey, newIndex);
      const size = applyFontSize(this.connected_element, newIndex);
      tinyNotification(_loc('CHATNOTIFICATION.fontsize', { size }));
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.fonts = FONT_SIZE_OPTIONS;
    data.currentSize = game.settings.get('dsa5', this.settingKey);
    return data;
  }
}
