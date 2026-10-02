const { renderTemplate } = foundry.applications.handlebars;

export default class AlmanacNotification {
  static SETTING = 'calendarFeatureVisibility';
  static HOST_ID = 'dsa-almanac-toasts';
  static HOLD_MS = 7000;
  static FADE_MS = 420;
  static TEMPLATE = 'systems/dsa5/templates/system/calendar/almanac-toast.hbs';
  static FALLBACK_PERSONA_IMG = 'icons/svg/mystery-man.svg';
  static FALLBACK_QUEST_IMG = 'icons/svg/book.svg';

  static #queue = [];
  static #active = null;
  static #holdId = 0;
  static #showToken = 0;

  static OPTION_DEFAULTS = {
    notifyPersonae: true,
    notifyEvents: true,
    notifyQuestlog: true,
    notifySound: '',
  };

  static options() {
    const stored = game.settings.get('dsa5', this.SETTING) ?? {};
    return {
      notifyPersonae: stored.notifyPersonae !== false,
      notifyEvents: stored.notifyEvents !== false,
      notifyQuestlog: stored.notifyQuestlog !== false,
      notifySound: String(stored.notifySound || ''),
    };
  }

  static mergeVisibility(stored = {}) {
    return {
      calendar: true,
      events: true,
      personae: true,
      questlog: true,
      ...this.OPTION_DEFAULTS,
      ...stored,
    };
  }

  static enabled(kind) {
    const options = this.options();
    if (kind === 'personae') return options.notifyPersonae;
    if (kind === 'events') return options.notifyEvents;
    if (kind === 'questlog') return options.notifyQuestlog;
    return false;
  }

  static shouldSkip(options = {}) {
    return !!(options.dsaSkipAlmanacToast || options.dsaSkipPersonaFill || options.dsaSkipPersonaRefresh);
  }

  static capture(options, toasts) {
    if (this.shouldSkip(options) || !toasts?.length) return;
    options.dsaAlmanacToasts = [...(options.dsaAlmanacToasts || []), ...toasts];
  }

  static capturePersonae(model, changed, options) {
    this.capture(options, this.collectPersonae(model, changed));
  }

  static captureEvents(model, changed, options) {
    this.capture(options, this.collectEvents(model, changed));
  }

  static captureQuests(model, changed, options) {
    this.capture(options, this.collectQuests(model, changed));
  }

  static deliver(options) {
    if (this.shouldSkip(options)) return;
    this.enqueueAll(options?.dsaAlmanacToasts);
  }

  static collectPersonae(model, changed) {
    const toasts = [];
    for (const [key, patch] of this.#patches(changed, 'personae')) {
      const previous = model.personae?.[key];
      const next = this.#merged(previous, patch);
      if (!next) continue;
      const unlocked = next.visible === true && (!previous || previous.visible !== true);
      if (!unlocked) continue;
      const isCreature = Number(next.type) === 1;
      toasts.push(this.#toast({
        kind: 'personae',
        tab: 'personae',
        title: next.name || _loc('PERSONAE.ImportantPersons'),
        change: _loc(isCreature ? 'CALENDAR.DSA.notifications.personaeUnlocked' : 'CALENDAR.DSA.notifications.personaeMet'),
        kicker: _loc('PERSONAE.ImportantPersons'),
        image: next.img || this.FALLBACK_PERSONA_IMG,
        icon: isCreature ? 'fas fa-paw' : 'fas fa-user',
        visible: true,
      }));
    }
    return toasts;
  }

  static collectEvents(model, changed) {
    const toasts = [];
    const icons = model.constructor.CATEGORY_ICONS || {};
    const colors = model.constructor.CATEGORY_COLORS || {};
    for (const [key, patch] of this.#patches(changed, 'calendarentries')) {
      const previous = model.calendarentries?.[key];
      const next = this.#merged(previous, patch);
      if (!next) continue;
      const revealed = next.visible !== false && (!previous || previous.visible === false);
      if (!revealed) continue;
      const category = Number(next.category) || 0;
      toasts.push(this.#toast({
        kind: 'events',
        tab: 'events',
        title: next.title || _loc('CALENDAR.DSA.events'),
        change: _loc('CALENDAR.DSA.notifications.eventAdded'),
        kicker: _loc('CALENDAR.DSA.events'),
        icon: icons[category] || 'fas fa-calendar',
        color: colors[category] || '',
        visible: true,
      }));
    }
    return toasts;
  }

  static collectQuests(model, changed) {
    const toasts = [];
    const choices = model.constructor.STATUS_CHOICES || {};
    for (const [questKey, patch] of this.#patches(changed, 'quests')) {
      const previous = model.quests?.[questKey];
      const next = this.#merged(previous, patch);
      if (!next) continue;

      const payload = {
        kind: 'questlog',
        tab: 'questlog',
        kicker: _loc('DSAQUESTLOG.title'),
        title: next.title || _loc('DSAQUESTLOG.newEntryPlaceholder'),
        image: next.image || this.FALLBACK_QUEST_IMG,
        icon: 'fas fa-scroll',
        visible: next.visible !== false,
        audience: Number(next.audience) || 0,
        playerOwners: Array.isArray(next.playerOwners) ? [...next.playerOwners] : [],
      };

      const revealed = payload.visible && (!previous || previous.visible === false);
      const statusChanged = previous && patch.status !== undefined && Number(patch.status) !== Number(previous.status);

      if (revealed) {
        toasts.push(this.#toast({
          ...payload,
          change: _loc('CALENDAR.DSA.notifications.questStarted'),
        }));
      } else if (statusChanged) {
        toasts.push(this.#toast({
          ...payload,
          change: _loc(choices[Number(patch.status)] || choices[0] || 'DSAQUESTLOG.STATUS.0'),
        }));
      }

      for (const [objectiveKey, objectivePatch] of this.#patches(patch, 'objectives')) {
        const previousObjective = previous?.objectives?.[objectiveKey];
        if (!previousObjective || objectivePatch.status === undefined) continue;
        if (Number(objectivePatch.status) === Number(previousObjective.status)) continue;
        const objective = this.#merged(previousObjective, objectivePatch);
        toasts.push(this.#toast({
          ...payload,
          image: next.image || this.FALLBACK_QUEST_IMG,
          title: objective.text || payload.title,
          change: _loc(choices[Number(objective.status)] || choices[0] || 'DSAQUESTLOG.STATUS.0'),
          kicker: payload.title,
          objectiveVisible: objective.visible !== false,
        }));
      }
    }
    return toasts;
  }

  static enqueueAll(toasts = []) {
    for (const toast of toasts) this.enqueue(toast);
  }

  static enqueue(toast) {
    if (!toast || !this.enabled(toast.kind) || !this.canSee(toast)) return false;
    this.#queue.push(toast);
    this.#pump();
    return true;
  }

  static canSee(toast, user = game.user) {
    if (user?.isGM) return true;
    if (toast?.kind === 'questlog') {
      if (toast.visible === false) return false;
      const audience = Number(toast.audience) || 0;
      if (audience === 2) return false;
      if (audience === 1) return (toast.playerOwners || []).includes(user.id);
      return toast.objectiveVisible !== false;
    }
    return toast?.visible !== false;
  }

  static get pending() {
    return this.#queue.length;
  }

  static get active() {
    return this.#active;
  }

  static clear() {
    this.#showToken += 1;
    if (this.#holdId) window.clearTimeout(this.#holdId);
    this.#holdId = 0;
    this.#queue.length = 0;
    this.#active = null;
    document.getElementById(this.HOST_ID)?.remove();
  }

  static dismiss() {
    const host = document.getElementById(this.HOST_ID);
    const el = host?.querySelector('.dsa-almanac-toast');
    if (!el) {
      this.#active = null;
      this.#pump();
      return;
    }
    this.#fadeOut(el);
  }

  static #pump() {
    if (this.#active || !this.#queue.length) return;
    const toast = this.#queue.shift();
    this.#active = toast;
    void this.#show(toast);
  }

  static async #show(toast) {
    const token = ++this.#showToken;
    const host = this.#host();
    let html = '';
    try {
      html = await renderTemplate(this.TEMPLATE, toast);
    } catch (error) {
      console.warn('Could not render almanac notification', error);
      if (token === this.#showToken && this.#active === toast) {
        this.#active = null;
        this.#pump();
      }
      return;
    }
    if (token !== this.#showToken || this.#active !== toast) return;
    host.innerHTML = html;
    const el = host.querySelector('.dsa-almanac-toast');
    if (!el) {
      this.#active = null;
      this.#pump();
      return;
    }

    this.#bind(el, toast);
    this.#playSound();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) el.classList.add('is-reduced');
    el.classList.add('is-visible');
    this.#holdId = window.setTimeout(() => this.#fadeOut(el), this.HOLD_MS);
  }

  static #bind(el, toast) {
    el.querySelector('[data-action="close"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.#fadeOut(el);
    });
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-action="close"]')) return;
      game.dsa5?.apps?.CalendarWidget?.constructor.openCalendarPicker?.(toast.tab);
    });
  }

  static #fadeOut(el) {
    if (!el || el.classList.contains('is-leaving')) return;
    if (this.#holdId) window.clearTimeout(this.#holdId);
    this.#holdId = 0;
    el.classList.add('is-leaving');
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      el.remove();
      this.#active = null;
      const host = document.getElementById(this.HOST_ID);
      if (host && !host.querySelector('.dsa-almanac-toast')) host.remove();
      this.#pump();
    };
    el.addEventListener('animationend', (ev) => {
      if (ev.target !== el) return;
      done();
    }, { once: true });
    window.setTimeout(done, this.FADE_MS + 120);
  }

  static #playSound() {
    const src = this.options().notifySound;
    if (!src) return;
    try {
      foundry.audio.AudioHelper.play({ src, volume: 0.8, loop: false }, false);
    } catch (exception) {
      console.warn(`Could not play almanac notification sound ${src}`);
    }
  }

  static #host() {
    let host = document.getElementById(this.HOST_ID);
    if (host) return host;
    host = document.createElement('div');
    host.id = this.HOST_ID;
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
    return host;
  }

  static #toast(data) {
    return {
      ...data,
      title: data.title || '',
      change: data.change || '',
      kicker: data.kicker || '',
      image: data.image || '',
      icon: data.icon || 'fas fa-scroll',
      color: data.color || '',
      closeLabel: _loc('CALENDAR.DSA.notifications.close'),
      holdMs: this.HOLD_MS,
    };
  }

  static #patches(changed, collection) {
    const source = changed?.[collection] ?? changed?.system?.[collection] ?? {};
    return Object.entries(source).filter(([key, patch]) => patch && !String(key).startsWith('-='));
  }

  static #merged(previous, patch) {
    if (!patch || typeof patch !== 'object') return previous ?? null;
    if (!previous) return patch;
    return foundry.utils.mergeObject(this.#plain(previous), patch, { inplace: false });
  }

  static #plain(value) {
    if (!value) return {};
    if (typeof value.toObject === 'function') return value.toObject();
    return foundry.utils.deepClone(value);
  }
}
