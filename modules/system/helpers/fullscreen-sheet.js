const { mergeObject } = foundry.utils;

/** Matches `.fullScreenApp` z-index in systems/dsa5/styles/scss/dsa5.scss */
export const FULLSCREEN_APP_Z = 5000;

let sheetOpenCount = 0;

/**
 * Raise ApplicationV2 max z-index so new windows can stack above fullscreen DSA5 apps.
 */
export function ensureAboveFullscreenApps() {
  const AppV2 = foundry.applications.api.ApplicationV2;
  AppV2._maxZ = Math.max(AppV2._maxZ, FULLSCREEN_APP_Z);
}

/**
 * Default staggered position for sheets opened above a fullscreen app.
 * @param {typeof ApplicationV2} sheetClass
 */
export function nextStackedSheetPosition(sheetClass) {
  const defaults = sheetClass?.DEFAULT_OPTIONS?.position || {};
  const stagger = (sheetOpenCount++ % 12) * 32;
  return {
    width: defaults.width ?? 500,
    height: defaults.height ?? 500,
    top: 72 + stagger,
    left: 110 + stagger,
  };
}

/**
 * Render any ApplicationV2 (e.g. DialogV2) above fullscreen DSA5 apps.
 * @param {foundry.applications.api.ApplicationV2} app
 * @param {boolean|object} [renderOptions=true]
 * @returns {Promise<foundry.applications.api.ApplicationV2>}
 */
export async function renderApplicationAboveFullscreen(app, renderOptions = true) {
  ensureAboveFullscreenApps();
  await app.render(renderOptions);
  app.bringToFront?.();
  return app;
}

/**
 * Render a document sheet above fullscreen DSA5 apps (char builder, DAG, calendar, etc.).
 * @param {foundry.abstract.Document} document
 * @param {object} [options={}]
 * @param {object} [options.position]
 * @param {object} [options.renderOptions]
 * @returns {Promise<foundry.applications.api.ApplicationV2|undefined>}
 */
export async function renderDocumentSheetAboveFullscreen(document, options = {}) {
  if (!document?.sheet) return undefined;

  const sheetClass = document.sheet.constructor;
  ensureAboveFullscreenApps();

  let sheet = document._sheet;
  if (!sheet) {
    sheet = new sheetClass({ document });
    document._sheet = sheet;
  }

  if (sheet.rendered) {
    sheet.bringToFront?.();
    return sheet;
  }

  const position = options.position ?? nextStackedSheetPosition(sheetClass);
  await sheet.render(mergeObject({ force: true, position }, options.renderOptions ?? {}));
  sheet.bringToFront?.();
  return sheet;
}
