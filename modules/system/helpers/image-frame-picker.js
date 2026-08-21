/**
 * Shared image framing (pan/zoom) for hotbar portrait and shop Ladenschild.
 *
 * Portrait (hotbar): object-position + scale in px (fixed circle).
 * Banner (Ladenschild): percentage offsets + unitless zoom on a shared
 * `.dsa-media-frame` layer so Ausschnitt preview and player header WYSIWYG.
 */
export default class ImageFramePicker {
  static DEFAULT = Object.freeze({ offsetX: 0, offsetY: 0, zoom: 100, flipX: false });

  /** Legacy v1 banner offsets were px relative to this preview size. */
  static BANNER_REF = Object.freeze({ width: 480, height: 110 });

  static FRAME_VERSION = 2;

  static PRESETS = Object.freeze({
    portrait: Object.freeze({
      offsetXMin: -100,
      offsetXMax: 100,
      offsetYMin: -100,
      offsetYMax: 100,
      zoomMin: 50,
      zoomMax: 300,
      zoomStep: 5,
      offsetStep: 1,
      model: 'object',
      frameClass: 'dsa-image-frame--portrait',
    }),
    banner: Object.freeze({
      /** Percent of window width/height from center. */
      offsetXMin: -50,
      offsetXMax: 50,
      offsetYMin: -50,
      offsetYMax: 50,
      zoomMin: 50,
      zoomMax: 300,
      zoomStep: 5,
      offsetStep: 0.5,
      model: 'layer',
      frameClass: 'dsa-image-frame--banner',
    }),
  });

  static resolvePreset(preset = 'portrait') {
    if (preset && typeof preset === 'object') return { ...ImageFramePicker.PRESETS.portrait, ...preset };
    return ImageFramePicker.PRESETS[preset] || ImageFramePicker.PRESETS.portrait;
  }

  static normalize(raw = {}, defaults = ImageFramePicker.DEFAULT) {
    return {
      offsetX: Math.round(Number(raw?.offsetX) || defaults.offsetX),
      offsetY: Math.round(Number(raw?.offsetY) || defaults.offsetY),
      zoom: Math.round(Number(raw?.zoom) || defaults.zoom),
    };
  }

  /**
   * Banner frame: percentages of the crop window (+ zoom + optional mirror).
   * Migrates v1 px data.
   * @param {object} [raw]
   * @returns {{ offsetX: number, offsetY: number, zoom: number, flipX: boolean, v: number }}
   */
  static normalizeBanner(raw = {}) {
    const zoom = Math.round(Number(raw?.zoom) || ImageFramePicker.DEFAULT.zoom);
    let offsetX = Number(raw?.offsetX) || 0;
    let offsetY = Number(raw?.offsetY) || 0;
    if (Number(raw?.v) !== ImageFramePicker.FRAME_VERSION) {
      offsetX = (offsetX / ImageFramePicker.BANNER_REF.width) * 100;
      offsetY = (offsetY / ImageFramePicker.BANNER_REF.height) * 100;
    }
    return ImageFramePicker.clampBanner({
      offsetX,
      offsetY,
      zoom,
      flipX: !!raw?.flipX,
    });
  }

  static clampBanner(frame) {
    const limits = ImageFramePicker.PRESETS.banner;
    const round1 = (n) => Math.round(Number(n) * 10) / 10;
    return {
      offsetX: Math.max(limits.offsetXMin, Math.min(limits.offsetXMax, round1(frame.offsetX))),
      offsetY: Math.max(limits.offsetYMin, Math.min(limits.offsetYMax, round1(frame.offsetY))),
      zoom: Math.max(limits.zoomMin, Math.min(limits.zoomMax, Math.round(Number(frame.zoom) || 100))),
      flipX: !!frame.flipX,
      v: ImageFramePicker.FRAME_VERSION,
    };
  }

  static clamp(frame, preset = 'portrait') {
    const limits = this.resolvePreset(preset);
    if (limits.model === 'layer') return this.clampBanner(this.normalizeBanner(frame));
    const normalized = this.normalize(frame);
    return {
      offsetX: Math.max(limits.offsetXMin, Math.min(limits.offsetXMax, normalized.offsetX)),
      offsetY: Math.max(limits.offsetYMin, Math.min(limits.offsetYMax, normalized.offsetY)),
      zoom: Math.max(limits.zoomMin, Math.min(limits.zoomMax, normalized.zoom)),
    };
  }

  static isDefault(frame, defaults = ImageFramePicker.DEFAULT) {
    const isBanner = Number(frame?.v) === ImageFramePicker.FRAME_VERSION;
    const normalized = isBanner
      ? {
        offsetX: Number(frame.offsetX) || 0,
        offsetY: Number(frame.offsetY) || 0,
        zoom: Number(frame.zoom) || 100,
        flipX: !!frame.flipX,
      }
      : { ...this.normalize(frame, defaults), flipX: !!frame?.flipX };
    return (
      normalized.offsetX === defaults.offsetX
      && normalized.offsetY === defaults.offsetY
      && normalized.zoom === defaults.zoom
      && !normalized.flipX
    );
  }

  /**
   * Hotbar / portrait picker: object-position + scale.
   * @param {{ offsetX?: number, offsetY?: number, zoom?: number }|null|undefined} frame
   * @returns {string}
   */
  static buildStyle(frame) {
    const { offsetX, offsetY, zoom } = this.normalize(frame);
    const parts = ['object-fit: cover', 'transform-origin: center center'];
    parts.push(
      offsetX || offsetY
        ? `object-position: calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`
        : 'object-position: center center',
    );
    if (zoom !== 100) parts.push(`transform: scale(${zoom / 100})`);
    return parts.join('; ');
  }

  /**
   * CSS custom properties for `.dsa-media-frame` (picker window + player header).
   * @param {object} [frame]
   * @returns {string}
   */
  static buildBannerVars(frame) {
    const { offsetX, offsetY, zoom, flipX } = this.normalizeBanner(frame);
    return [
      `--frame-x: ${offsetX}%`,
      `--frame-y: ${offsetY}%`,
      `--frame-zoom: ${zoom / 100}`,
      `--frame-flip: ${flipX ? -1 : 1}`,
    ].join('; ');
  }

  static applyVarsToWindow(el, frame) {
    if (!el) return;
    const { offsetX, offsetY, zoom, flipX } = this.normalizeBanner(frame);
    el.style.setProperty('--frame-x', `${offsetX}%`);
    el.style.setProperty('--frame-y', `${offsetY}%`);
    el.style.setProperty('--frame-zoom', String(zoom / 100));
    el.style.setProperty('--frame-flip', flipX ? '-1' : '1');
  }

  /**
   * Set --img-ar from the source image so cover sizing is real (zoom-out reveals more).
   * `object-fit: cover` alone crops before scale and makes zoom-out useless.
   * @param {HTMLElement|null|undefined} windowEl `.dsa-media-frame`
   */
  static hydrateMediaFrame(windowEl) {
    if (!windowEl) return;
    const img = windowEl.querySelector('.dsa-media-frame__img');
    if (!img) return;

    const applyAr = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      windowEl.style.setProperty('--img-ar', String(img.naturalWidth / img.naturalHeight));
    };

    if (img.complete && img.naturalWidth) applyAr();
    else img.addEventListener('load', applyAr, { once: true });
  }

  /**
   * @param {ParentNode|null|undefined} root
   */
  static hydrateMediaFrames(root) {
    if (!root?.querySelectorAll) return;
    for (const el of root.querySelectorAll('.dsa-media-frame')) {
      this.hydrateMediaFrame(el);
    }
  }

  static applyToElement(img, frame) {
    if (!img) return;
    const { offsetX, offsetY, zoom } = this.normalize(frame);
    img.style.objectFit = 'cover';
    img.style.transformOrigin = 'center center';
    img.style.objectPosition = offsetX || offsetY
      ? `calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`
      : 'center center';
    img.style.transform = zoom !== 100 ? `scale(${zoom / 100})` : '';
  }

  #root = null;
  #mouseMove = null;
  #mouseUp = null;
  #bound = false;

  /**
   * @param {object} options
   * @param {string} [options.preset='portrait']
   * @param {{ offsetX?: number, offsetY?: number, zoom?: number }} [options.frame]
   * @param {() => boolean} [options.isInteractive]
   * @param {(frame: object) => void} [options.onChange]
   */
  constructor({ preset = 'portrait', frame = {}, isInteractive = () => true, onChange = null } = {}) {
    this.presetKey = typeof preset === 'string' ? preset : 'custom';
    this.limits = ImageFramePicker.resolvePreset(preset);
    this.frame = ImageFramePicker.clamp(frame, this.limits);
    this.isInteractive = isInteractive;
    this.onChange = onChange;
  }

  get isLayerModel() {
    return this.limits.model === 'layer';
  }

  get templateContext() {
    const limits = this.limits;
    const layer = this.isLayerModel;
    return {
      frame: this.frame,
      interactive: this.isInteractive(),
      frameClass: limits.frameClass,
      layerModel: layer,
      imgStyle: layer ? '' : ImageFramePicker.buildStyle(this.frame),
      frameVars: layer ? ImageFramePicker.buildBannerVars(this.frame) : '',
      flipX: !!this.frame.flipX,
      offsetXMin: limits.offsetXMin,
      offsetXMax: limits.offsetXMax,
      offsetYMin: limits.offsetYMin,
      offsetYMax: limits.offsetYMax,
      offsetStep: limits.offsetStep ?? 1,
      zoomMin: limits.zoomMin,
      zoomMax: limits.zoomMax,
    };
  }

  setFrame(frame, { silent = false } = {}) {
    this.frame = ImageFramePicker.clamp(frame, this.limits);
    this.#paint();
    this.#syncSliders();
    if (!silent) this.onChange?.(this.frame);
  }

  reset(defaults = ImageFramePicker.DEFAULT) {
    this.setFrame(defaults);
  }

  /**
   * Bind drag/wheel/sliders inside `root` (expects shared image-frame partial markup).
   * @param {HTMLElement} root
   */
  bind(root) {
    this.unbind();
    this.#root = root;
    if (!root) return;

    const preview = root.querySelector('.dsa-image-frame__preview');
    if (preview) {
      let dragging = false;
      let startX;
      let startY;
      let startOffsetX;
      let startOffsetY;

      preview.addEventListener('mousedown', (ev) => {
        if (!this.isInteractive()) return;
        ev.preventDefault();
        dragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        startOffsetX = this.frame.offsetX;
        startOffsetY = this.frame.offsetY;
        preview.style.cursor = 'grabbing';
      });

      this.#mouseMove = (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (this.isLayerModel) {
          const rect = preview.getBoundingClientRect();
          const w = rect.width || 1;
          const h = rect.height || 1;
          this.setFrame({
            ...this.frame,
            offsetX: startOffsetX + (dx / w) * 100,
            offsetY: startOffsetY + (dy / h) * 100,
          });
          return;
        }
        this.setFrame({
          ...this.frame,
          offsetX: startOffsetX + dx,
          offsetY: startOffsetY + dy,
        });
      };
      window.addEventListener('mousemove', this.#mouseMove);

      this.#mouseUp = () => {
        if (!dragging) return;
        dragging = false;
        preview.style.cursor = '';
      };
      window.addEventListener('mouseup', this.#mouseUp);

      preview.addEventListener('wheel', (ev) => {
        if (!this.isInteractive()) return;
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? -this.limits.zoomStep : this.limits.zoomStep;
        this.setFrame({ ...this.frame, zoom: this.frame.zoom + delta });
      }, { passive: false });
    }

    for (const slider of root.querySelectorAll('.dsa-image-frame__slider')) {
      slider.addEventListener('input', (ev) => {
        if (!this.isInteractive()) return;
        const prop = ev.target.dataset.prop;
        if (!prop) return;
        this.setFrame({ ...this.frame, [prop]: Number(ev.target.value) });
      });
    }

    const flipBtn = root.querySelector('[data-frame-flip]');
    flipBtn?.addEventListener('click', (ev) => {
      if (!this.isInteractive()) return;
      ev.preventDefault();
      this.setFrame({
        ...this.frame,
        flipX: !this.frame.flipX,
        offsetX: -this.frame.offsetX,
      });
    });

    this.#bound = true;
    this.#paint();
    this.#syncSliders();
  }

  unbind() {
    if (this.#mouseMove) {
      window.removeEventListener('mousemove', this.#mouseMove);
      this.#mouseMove = null;
    }
    if (this.#mouseUp) {
      window.removeEventListener('mouseup', this.#mouseUp);
      this.#mouseUp = null;
    }
    this.#root = null;
    this.#bound = false;
  }

  #paint() {
    if (this.isLayerModel) {
      const windowEl = this.#root?.querySelector('.dsa-media-frame');
      ImageFramePicker.applyVarsToWindow(windowEl, this.frame);
      ImageFramePicker.hydrateMediaFrame(windowEl);
      return;
    }
    const img = this.#root?.querySelector('.dsa-image-frame__img');
    ImageFramePicker.applyToElement(img, this.frame);
  }

  #syncSliders() {
    if (!this.#root) return;
    for (const prop of ['offsetX', 'offsetY', 'zoom']) {
      const slider = this.#root.querySelector(`.dsa-image-frame__slider[data-prop="${prop}"]`);
      if (slider) slider.value = String(this.frame[prop]);
    }
    const flipBtn = this.#root.querySelector('[data-frame-flip]');
    if (flipBtn) flipBtn.classList.toggle('active', !!this.frame.flipX);
  }
}
