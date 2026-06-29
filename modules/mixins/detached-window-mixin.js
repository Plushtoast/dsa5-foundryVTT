import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const initiatingAppStack = [];

export function pushInitiatingApp(app) {
  if (app) initiatingAppStack.push(app);
}

export function popInitiatingApp() {
  initiatingAppStack.pop();
}

export function getInitiatingApp() {
  return initiatingAppStack.at(-1) ?? null;
}

export function isDetachedApp(app) {
  return Boolean(app?.rendered && app?.window?.windowId);
}

export function resolveDetachedParent({ parent, actor, speaker, item } = {}) {
  const speakerActor = speaker ? DSA5_Utility.getSpeaker(speaker) : null;
  const resolvedActor = actor ?? speakerActor;

  for (const candidate of [parent, getInitiatingApp(), item?.sheet, resolvedActor?.sheet]) {
    if (isDetachedApp(candidate)) return candidate;
  }

  return null;
}

export function renderApplication(app, { parent, actor, speaker, item, renderOptions = {} } = {}) {
  const resolvedParent = resolveDetachedParent({ parent, actor, speaker, item });
  if (resolvedParent?.renderChild) resolvedParent.renderChild(app, renderOptions);
  else app.render(true, renderOptions);
  return app;
}

export const DetachedWindowMixin = (superclass) =>
  class extends superclass {
    static pushInitiatingApp = pushInitiatingApp;
    static popInitiatingApp = popInitiatingApp;
    static getInitiatingApp = getInitiatingApp;
    static isDetachedApp = isDetachedApp;
    static resolveDetachedParent = resolveDetachedParent;
    static renderApplication = renderApplication;
  };
