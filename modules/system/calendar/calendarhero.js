const { renderTemplate } = foundry.applications.handlebars;

export class CalendarHeroHelper {
  static DEFAULT_OPACITY = 0.55;
  static PART = {
    template: 'systems/dsa5/templates/system/calendar/hero.hbs',
  };

  static #provider = null;
  static #configSections = [];

  #parent;

  constructor(parent) {
    this.#parent = parent;
  }

  get element() {
    return this.#parent.element;
  }

  static registerHero(provider) {
    this.#provider = typeof provider === 'function' ? provider : null;
  }

  static registerConfigSection(section) {
    if (!section?.id) return;
    const idx = this.#configSections.findIndex((entry) => entry.id === section.id);
    if (idx >= 0) this.#configSections[idx] = section;
    else this.#configSections.push(section);
  }

  static resolve() {
    const raw = this.#provider?.() ?? null;
    const path = String(raw?.path ?? '').trim();
    const opacity = Math.clamp(Number(raw?.opacity), 0, 1);
    return {
      path,
      opacity: Number.isFinite(opacity) ? opacity : this.DEFAULT_OPACITY,
    };
  }

  prepareContext(data) {
    const hero = this.constructor.resolve();
    data.heroImage = hero.path;
    data.heroOpacity = hero.opacity;
    return data;
  }

  apply(config) {
    const hero = config?.heroImage != null
      ? { path: config.heroImage, opacity: config.heroOpacity }
      : (config?.path != null ? config : this.constructor.resolve());
    const path = String(hero?.path ?? '').trim();
    const opacity = Math.clamp(Number(hero?.opacity), 0, 1);
    const resolvedOpacity = Number.isFinite(opacity) ? opacity : this.constructor.DEFAULT_OPACITY;

    this.element?.classList.toggle('has-hero', Boolean(path));
    let layer = this.#layer();
    if (!path) {
      layer?.replaceChildren();
      return;
    }
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'dsa-app-hero';
      layer.setAttribute('aria-hidden', 'true');
    }
    this.element.prepend(layer);
    if (!layer.querySelector('.dsa-app-hero__bg')) {
      layer.innerHTML = '<img class="dsa-app-hero__bg" alt="" /><div class="dsa-app-hero__scrim"></div>';
    }
    layer.style.setProperty('--dsa-app-hero-opacity', String(resolvedOpacity));
    const img = layer.querySelector('.dsa-app-hero__bg');
    if (img && img.getAttribute('src') !== path) img.setAttribute('src', path);
  }

  applyOpacity(opacity) {
    const value = Math.clamp(Number(opacity), 0, 1);
    this.#layer()
      ?.style.setProperty('--dsa-app-hero-opacity', String(Number.isFinite(value) ? value : this.constructor.DEFAULT_OPACITY));
  }

  async applyConfigSections(context) {
    for (const section of this.constructor.#configSections) {
      const tabId = section.tab || 'calendar_config';
      const tab = this.element.querySelector(`.tab[data-tab="${CSS.escape(tabId)}"]`);
      if (!tab) continue;

      const data = foundry.utils.mergeObject(context, {}, { inplace: false });
      if (section.prepare) {
        const keep = await section.prepare(data, this.#parent);
        if (keep === false) {
          tab.querySelector(`[data-config-section="${section.id}"]`)?.remove();
          continue;
        }
      }

      let host = tab.querySelector(`[data-config-section="${section.id}"]`);
      if (!host) {
        host = document.createElement('div');
        host.dataset.configSection = section.id;
        tab.append(host);
      }
      host.innerHTML = section.template
        ? await renderTemplate(section.template, data)
        : (await section.html?.(data, this.#parent) ?? '');
      section.onRender?.(host, this.#parent, data);
    }
  }

  #layer() {
    return this.element?.querySelector(':scope > [data-application-part="hero"]')
      ?? this.element?.querySelector(':scope > .dsa-app-hero');
  }
}
