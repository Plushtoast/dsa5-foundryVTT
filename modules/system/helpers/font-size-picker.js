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

function buildFontSizeMenuItems(element, settingKey, onSelect) {
  const $el = element instanceof jQuery ? element : $(element);
  const currentIndex = game.settings.get('dsa5', settingKey);

  const items = [
    {
      name: 'font-default',
      label: getFontSizeLabel(0),
      icon: `<i class="fas ${currentIndex === 0 ? 'fa-check' : 'fa-font'}"></i>`,
      onClick: async () => {
        await setFontSizeIndex(settingKey, 0);
        $el.css('fontSize', '');
        tinyNotification(_loc('CHATNOTIFICATION.fontsize', { size: getFontSizeLabel(0) }));
        onSelect?.(0);
      },
    },
  ];

  for (let i = 0; i < FONT_SIZE_OPTIONS.length; i++) {
    const size = FONT_SIZE_OPTIONS[i];
    const index = i + 1;
    items.push({
      name: `font-${size}`,
      label: `${size}px`,
      icon: `<i class="fas ${currentIndex === index ? 'fa-check' : 'fa-font'}"></i>`,
      onClick: async () => {
        await setFontSizeIndex(settingKey, index);
        const applied = applyFontSize($el, index);
        tinyNotification(_loc('CHATNOTIFICATION.fontsize', { size: applied }));
        onSelect?.(index);
      },
    });
  }

  return items;
}

export async function showFontSizeContextMenu(element, settingKey = 'journalFontSizeIndex', anchor, { onSelect } = {}) {
  const $el = element instanceof jQuery ? element : $(element);
  const menuAnchor = anchor ?? $el[0];
  if (!menuAnchor) return;

  const host = menuAnchor.closest?.('.window-app, .application') ?? menuAnchor;
  const menu = new foundry.applications.ux.ContextMenu(host, '', buildFontSizeMenuItems($el, settingKey, onSelect), {
    jQuery: false,
    fixed: true,
    eventName: 'none',
  });
  ui.context?.close();
  await menu.render(menuAnchor, { animate: true });
  ui.context = menu;
}

export async function increaseFontSize(element, settingKey = 'journalFontSizeIndex', anchor, options = {}) {
  await showFontSizeContextMenu(element, settingKey, anchor, options);
}
