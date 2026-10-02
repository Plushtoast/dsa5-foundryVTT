import AdvantageRulesDSA5 from '../rules/advantage-rules-dsa5.js';

const { escapeHTML } = foundry.utils;

export default class RandomVictim {
  static SPIN_MS = 2100;
  static HOLD_MS = 1400;
  static FADE_MS = 550;

  static async pick(actors, { withMisfortune = false } = {}) {
    const pool = [...(actors ?? [])].filter(Boolean);
    if (!pool.length) {
      ui.notifications.warn('DIALOG.noTarget', { localize: true });
      return null;
    }

    const weighted = [];
    for (const actor of pool) {
      weighted.push(actor);
      if (withMisfortune && AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.misfortune')) weighted.push(actor);
      if (withMisfortune && actor.hasCondition('badluck')) weighted.push(actor);
    }

    const roll = (await new Roll(`1d${weighted.length}`).evaluate()).total;
    return weighted[roll - 1] ?? null;
  }

  static show(actor, { actors = [] } = {}) {
    if (!actor) return null;

    const reel = this.#reelFaces(actors, actor);
    const name = escapeHTML(actor.name ?? '');
    const faces = reel
      .map((entry) => `<img class="dsa-random-victim-face" src="${escapeHTML(entry.img ?? '')}" alt="">`)
      .join('');
    const html = `<span class="dsa-random-victim-toast"><span class="dsa-random-victim-window"><span class="dsa-random-victim-reel">${faces}</span></span><span class="dsa-random-victim-name">${name}</span></span>`;
    const notification = ui.notifications.info(html, { clean: false, console: false, permanent: true });
    const start = () => {
      const el = notification.element;
      if (!el) return;
      el.classList.add('dsa-random-victim', 'dsa-hud-surface');
      this.#runSpin(el, notification, reel.length);
    };
    start();
    if (!notification.element) queueMicrotask(start);
    return notification;
  }

  static async pickAndShow(actors, options = {}) {
    const pool = [...(actors ?? [])].filter(Boolean);
    const actor = await this.pick(pool, options);
    if (!actor) return null;
    this.show(actor, { actors: pool });
    return actor;
  }

  static #uniqueActors(actors, winner) {
    const faces = [];
    const seen = new Set();
    for (const actor of [...actors, winner]) {
      if (!actor || seen.has(actor.id)) continue;
      seen.add(actor.id);
      faces.push(actor);
    }
    return faces;
  }

  static #shuffle(list) {
    const order = list.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  static #reelFaces(actors, winner) {
    const faces = this.#uniqueActors(actors, winner);
    if (faces.length <= 1) return [winner];

    const reel = [];
    while (reel.length < 12) reel.push(...this.#shuffle(faces));
    while (reel.length && reel.at(-1).id === winner.id) reel.pop();
    reel.push(winner);
    return reel;
  }

  static #runSpin(el, notification, count) {
    if (el.dataset.spinStarted) return;
    el.dataset.spinStarted = '1';

    const reelEl = el.querySelector('.dsa-random-victim-reel');
    const nameEl = el.querySelector('.dsa-random-victim-name');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#bindDismiss(el, notification);

    const land = () => {
      if (el.dataset.landed || el.classList.contains('is-fading')) return;
      el.dataset.landed = '1';
      this.#commitReel(reelEl);
      nameEl?.classList.add('is-revealed');
      el.classList.remove('is-spinning');
      const hold = window.setTimeout(() => this.#fadeOut(notification), this.HOLD_MS);
      el.dataset.holdId = String(hold);
    };

    if (reduced || count <= 1 || !reelEl) {
      land();
      return;
    }

    const size = parseFloat(getComputedStyle(el).getPropertyValue('--dsa-random-victim-size')) || 180;
    el.classList.add('is-spinning');
    const animation = reelEl.animate(
      [{ transform: 'translateY(0px)' }, { transform: `translateY(-${(count - 1) * size}px)` }],
      { duration: this.SPIN_MS, easing: 'cubic-bezier(0.08, 0.86, 0.12, 1)', fill: 'forwards' },
    );
    animation.finished.then(land).catch(() => {});
  }

  static #commitReel(reelEl) {
    if (!reelEl) return;
    for (const animation of reelEl.getAnimations()) {
      try {
        animation.commitStyles();
      } catch (err) {
        /* element may already be detached */
      }
      animation.cancel();
    }
  }

  static #bindDismiss(el, notification) {
    el.addEventListener(
      'click',
      (ev) => {
        ev.stopImmediatePropagation();
        this.#fadeOut(notification);
      },
      { capture: true },
    );
  }

  static #fadeOut(notification) {
    const el = notification.element;
    if (!el) {
      notification.remove();
      return;
    }
    if (el.dataset.holdId) window.clearTimeout(Number(el.dataset.holdId));
    delete el.dataset.holdId;
    if (el.classList.contains('is-fading')) return;

    el.classList.add('is-fading');
    this.#commitReel(el.querySelector('.dsa-random-victim-reel'));
    const done = () => notification.remove();
    el.addEventListener(
      'transitionend',
      (ev) => {
        if (ev.propertyName !== 'opacity') return;
        done();
      },
      { once: true },
    );
    window.setTimeout(done, this.FADE_MS + 150);
  }
}
