/**
 * Reusable DOM fly animation: clone an image at a source rect and animate it to a target.
 * Enlarges in place first for visibility, then flies into the target.
 */
export default class DomFlyAnimation {
  static DEFAULT_DURATION = 1400;
  static DEFAULT_SCALE_END = 0.3;
  static DEFAULT_SCALE_PEAK = 2.2;

  /**
   * @param {object} config
   * @param {Element|DOMRect} config.source
   * @param {Element|DOMRect} config.target
   * @param {string} config.img
   * @param {number} [config.duration]
   * @param {number} [config.scaleEnd]
   * @param {number} [config.scalePeak]
   * @returns {Promise<void>}
   */
  static async fly({
    source,
    target,
    img,
    duration = this.DEFAULT_DURATION,
    scaleEnd = this.DEFAULT_SCALE_END,
    scalePeak = this.DEFAULT_SCALE_PEAK,
  } = {}) {
    if (!img) return;

    const sourceRect = this.#resolveRect(source);
    const targetRect = this.#resolveRect(target);
    if (!sourceRect || !targetRect) return;

    const size = Math.max(32, Math.min(sourceRect.width || 48, sourceRect.height || 48, 80));
    const startX = sourceRect.left + (sourceRect.width || size) / 2 - size / 2;
    const startY = sourceRect.top + (sourceRect.height || size) / 2 - size / 2;
    const endX = targetRect.left + (targetRect.width || size) / 2 - size / 2;
    const endY = targetRect.top + (targetRect.height || size) / 2 - size / 2;
    const dx = endX - startX;
    const dy = endY - startY;

    const el = document.createElement('div');
    el.className = 'dsa-dom-fly';
    el.style.cssText = [
      `width:${size}px`,
      `height:${size}px`,
      `left:${startX}px`,
      `top:${startY}px`,
      `background-image:url("${img.replace(/"/g, '\\"')}")`,
    ].join(';');
    document.body.appendChild(el);

    // Force layout so the transition starts from the initial state.
    el.getBoundingClientRect();

    try {
      if (typeof el.animate === 'function') {
        await el.animate(
          [
            // Appear at source
            { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
            // Enlarge in place so the item is clearly visible
            { transform: `translate(0, 0) scale(${scalePeak})`, opacity: 1, offset: 0.28 },
            // Brief hold at peak size
            { transform: `translate(0, 0) scale(${scalePeak})`, opacity: 1, offset: 0.38 },
            // Fly toward target while still large
            { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(${scalePeak * 0.75})`, opacity: 1, offset: 0.7 },
            // Drop into avatar
            { transform: `translate(${dx}px, ${dy}px) scale(${scaleEnd})`, opacity: 0, offset: 1 },
          ],
          { duration, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' },
        ).finished;
      } else {
        const enlargeMs = Math.round(duration * 0.35);
        const flyMs = duration - enlargeMs;
        el.style.transition = `transform ${enlargeMs}ms cubic-bezier(0.33, 1, 0.68, 1)`;
        el.style.transform = `scale(${scalePeak})`;
        await this.#wait(enlargeMs);
        el.style.transition = `transform ${flyMs}ms cubic-bezier(0.33, 1, 0.68, 1), opacity ${flyMs}ms ease-out`;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleEnd})`;
        el.style.opacity = '0';
        await this.#wait(flyMs + 50);
      }
    } catch (_) {
      /* animation interrupted */
    } finally {
      el.remove();
    }
  }

  static #wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static #resolveRect(value) {
    if (!value) return null;
    if (typeof value.getBoundingClientRect === 'function') {
      const rect = value.getBoundingClientRect();
      if (!rect.width && !rect.height) return null;
      return rect;
    }
    if (typeof value.left === 'number' && typeof value.top === 'number') return value;
    return null;
  }
}
