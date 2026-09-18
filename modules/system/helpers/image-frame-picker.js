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

  /** Safety clamp for stored % offsets; live picker limits are tighter (see panLimits). */
  static OFFSET_HARD_MAX = 2000;

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
      /** Percent of window width/height from center. Hard ceiling; picker uses panLimits. */
      offsetXMin: -2000,
      offsetXMax: 2000,
      offsetYMin: -2000,
      offsetYMax: 2000,
      zoomMin: 10,
      zoomMax: 300,
      zoomStep: 5,
      offsetStep: 0.5,
      model: 'layer',
      frameClass: 'dsa-image-frame--banner',
      frameAspect: ImageFramePicker.BANNER_REF.width / ImageFramePicker.BANNER_REF.height,
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

  /**
   * Pan range so any part of the source can enter the crop window.
   * Cover size × zoom vs frame: when the layer is larger, reach the edges;
   * when smaller (zoom-out), keep the whole layer inside the viewport.
   * @param {number} [zoom=100]
   * @param {number} [imgAr=1] naturalWidth / naturalHeight
   * @param {number} [frameAspect]
   * @returns {{ offsetXMin: number, offsetXMax: number, offsetYMin: number, offsetYMax: number }}
   */
  static panLimits(zoom = 100, imgAr = 1, frameAspect = ImageFramePicker.BANNER_REF.width / ImageFramePicker.BANNER_REF.height) {
    const z = Math.max(0.01, (Number(zoom) || 100) / 100);
    const ar = Number(imgAr) > 0 ? Number(imgAr) : 1;
    const far = Number(frameAspect) > 0 ? Number(frameAspect) : (ImageFramePicker.BANNER_REF.width / ImageFramePicker.BANNER_REF.height);
    const widthRatio = z * Math.max(1, ar / far);
    const heightRatio = z * Math.max(1, far / ar);
    const extent = (ratio) => {
      const max = Math.round(Math.abs(ratio - 1) * 50 * 10) / 10;
      return Math.min(ImageFramePicker.OFFSET_HARD_MAX, max);
    };
    const maxX = extent(widthRatio);
    const maxY = extent(heightRatio);
    return {
      offsetXMin: -maxX,
      offsetXMax: maxX,
      offsetYMin: -maxY,
      offsetYMax: maxY,
    };
  }

  static clampBanner(frame, panLimits = null) {
    const zoomLimits = ImageFramePicker.PRESETS.banner;
    const limits = panLimits ?? zoomLimits;
    const round1 = (n) => Math.round(Number(n) * 10) / 10;
    return {
      offsetX: Math.max(limits.offsetXMin, Math.min(limits.offsetXMax, round1(frame.offsetX))),
      offsetY: Math.max(limits.offsetYMin, Math.min(limits.offsetYMax, round1(frame.offsetY))),
      zoom: Math.max(zoomLimits.zoomMin, Math.min(zoomLimits.zoomMax, Math.round(Number(frame.zoom) || 100))),
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
   * @param {{ onReady?: () => void }} [options]
   */
  static hydrateMediaFrame(windowEl, { onReady } = {}) {
    if (!windowEl) return;
    const img = windowEl.querySelector('.dsa-media-frame__img');
    if (!img) return;

    const applyAr = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      windowEl.style.setProperty('--img-ar', String(img.naturalWidth / img.naturalHeight));
      onReady?.();
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
  #pointerUp = null;
  #bound = false;
  #syncing = false;
  /** Slider `data-prop` currently being dragged, if any. */
  #draggingProp = null;

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
    let next = ImageFramePicker.clamp(frame, this.limits);
    if (this.isLayerModel) next = ImageFramePicker.clampBanner(next, this.#livePanLimits(next));
    this.frame = next;
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
      slider.addEventListener('pointerdown', (ev) => {
        if (!this.isInteractive()) return;
        this.#draggingProp = ev.currentTarget.dataset.prop || null;
      });
      slider.addEventListener('input', (ev) => {
        if (this.#syncing || !this.isInteractive()) return;
        const prop = ev.currentTarget.dataset.prop;
        if (!prop) return;
        // Chromium remaps the pointer onto sibling ranges when their min/max
        // change mid-drag; ignore those spurious input events.
        if (this.#draggingProp && prop !== this.#draggingProp) return;
        this.setFrame({ ...this.frame, [prop]: Number(ev.currentTarget.value) });
      });
    }

    this.#pointerUp = () => {
      const was = this.#draggingProp;
      if (was === 'zoom' && this.isLayerModel) this.#syncSliders({ bounds: true });
      this.#draggingProp = null;
    };
    window.addEventListener('pointerup', this.#pointerUp);
    window.addEventListener('pointercancel', this.#pointerUp);

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
    ImageFramePicker.hydrateMediaFrame(root.querySelector('.dsa-media-frame'), {
      onReady: () => this.#onMediaReady(),
    });
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
    if (this.#pointerUp) {
      window.removeEventListener('pointerup', this.#pointerUp);
      window.removeEventListener('pointercancel', this.#pointerUp);
      this.#pointerUp = null;
    }
    this.#draggingProp = null;
    this.#syncing = false;
    this.#root = null;
    this.#bound = false;
  }

  #imgAr() {
    const windowEl = this.#root?.querySelector('.dsa-media-frame');
    const fromVar = Number(windowEl?.style.getPropertyValue('--img-ar'));
    if (fromVar > 0) return fromVar;
    const img = windowEl?.querySelector('.dsa-media-frame__img');
    if (img?.naturalWidth && img.naturalHeight) return img.naturalWidth / img.naturalHeight;
    return null;
  }

  #livePanLimits(frame = this.frame) {
    const imgAr = this.#imgAr();
    if (!(imgAr > 0)) {
      return {
        offsetXMin: -ImageFramePicker.OFFSET_HARD_MAX,
        offsetXMax: ImageFramePicker.OFFSET_HARD_MAX,
        offsetYMin: -ImageFramePicker.OFFSET_HARD_MAX,
        offsetYMax: ImageFramePicker.OFFSET_HARD_MAX,
      };
    }
    return ImageFramePicker.panLimits(
      frame.zoom,
      imgAr,
      this.limits.frameAspect ?? (ImageFramePicker.BANNER_REF.width / ImageFramePicker.BANNER_REF.height),
    );
  }

  #onMediaReady() {
    if (!this.#bound || !this.isLayerModel) return;
    this.frame = ImageFramePicker.clampBanner(this.frame, this.#livePanLimits());
    const windowEl = this.#root?.querySelector('.dsa-media-frame');
    ImageFramePicker.applyVarsToWindow(windowEl, this.frame);
    this.#syncSliders();
  }

  #paint() {
    if (this.isLayerModel) {
      const windowEl = this.#root?.querySelector('.dsa-media-frame');
      ImageFramePicker.applyVarsToWindow(windowEl, this.frame);
      return;
    }
    const img = this.#root?.querySelector('.dsa-image-frame__img');
    ImageFramePicker.applyToElement(img, this.frame);
  }

  #syncSliders({ bounds } = {}) {
    if (!this.#root) return;
    const pan = this.isLayerModel ? this.#livePanLimits() : this.limits;
    // Live zoom must not rewrite X/Y min/max: browsers fire input on those
    // ranges (often from the zoom pointer's X) and the thumbs wiggle.
    const updateBounds = bounds ?? this.#draggingProp !== 'zoom';
    this.#syncing = true;
    try {
      for (const prop of ['offsetX', 'offsetY', 'zoom']) {
        const slider = this.#root.querySelector(`.dsa-image-frame__slider[data-prop="${prop}"]`);
        if (!slider) continue;
        if (updateBounds && (prop === 'offsetX' || prop === 'offsetY')) {
          this.#writeOffsetBounds(slider, pan[`${prop}Min`], pan[`${prop}Max`]);
        }
        slider.value = String(this.frame[prop]);
      }
      const flipBtn = this.#root.querySelector('[data-frame-flip]');
      if (flipBtn) flipBtn.classList.toggle('active', !!this.frame.flipX);
    } finally {
      this.#syncing = false;
    }
  }

  /**
   * Update a pan slider's min/max without a min>max transient or a degenerate
   * min===max range (both make the thumb jump).
   * @param {HTMLInputElement} slider
   * @param {number} min
   * @param {number} max
   */
  #writeOffsetBounds(slider, min, max) {
    const step = Number(this.limits.offsetStep) || Number(slider.step) || 0.5;
    let lo = Math.min(Number(min), Number(max));
    let hi = Math.max(Number(min), Number(max));
    if (!(hi > lo)) {
      lo -= step;
      hi += step;
    }
    const currentMax = Number(slider.max);
    if (Number.isFinite(currentMax) && hi > currentMax) slider.max = String(hi);
    slider.min = String(lo);
    slider.max = String(hi);
  }
}
