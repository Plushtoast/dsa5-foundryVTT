function dispositionKey(disposition) {
  return Object.entries(CONST.TOKEN_DISPOSITIONS).find(([, value]) => value === disposition)?.[0];
}

function dispositionColor(disposition) {
  const key = dispositionKey(disposition);
  return key ? CONFIG.Canvas.dispositionColors[key] : undefined;
}

function colorToRgba(color, alpha) {
  const n = Number(color);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

export function dispositionBackgroundStyle(disposition, alpha = 0.12) {
  const color = dispositionColor(disposition);
  return color ? `background-color: ${colorToRgba(color, alpha)};` : '';
}

export function dispositionBorderStyle(disposition) {
  const color = dispositionColor(disposition);
  if (!color) return '';
  return `border-color: ${colorToRgba(color, 0.55)}; box-shadow: inset 0 0 10px ${colorToRgba(color, 0.25)};`;
}

export function getDispositionOptions() {
  const icons = {
    SECRET: 'fas fa-mask',
    HOSTILE: 'fas fa-skull',
    NEUTRAL: 'fas fa-minus',
    FRIENDLY: 'fas fa-handshake',
  };

  return Object.entries(CONST.TOKEN_DISPOSITIONS).map(([key, value]) => ({
    value,
    label: game.i18n.localize(`TOKEN.DISPOSITION.${key}`),
    icon: icons[key],
  }));
}

export async function applyTokenDisposition(tokens, disposition) {
  if (!tokens?.length || !canvas?.scene) return;

  const updates = tokens.map((token) => ({ _id: token.id, disposition }));
  await canvas.scene.updateEmbeddedDocuments('Token', updates);
}
