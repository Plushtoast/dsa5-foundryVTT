const ICON_CONTROL = 'fa-arrows-to-eye';
const ICON_SUMMON = 'fa-bell';

export default class CompanionHotbar {

  /**
   * Resolve the companion relationship for the current hotbar actor.
   * @param {Actor} actor - The hotbar's active actor
   * @returns {Promise<{petActor: Actor, ownerActor: Actor, isControllingPet: boolean}|null>}
   */
  static async resolveCompanion(actor) {
    if (!actor) return null;

    const petUuid = actor.getFlag('dsa5', 'hotbarCompanion');
    if (petUuid) {
      const petActor = await fromUuid(petUuid);
      return petActor ? { petActor, ownerActor: actor, isControllingPet: false } : null;
    }

    const ownerChar = game.user.character ?? await CompanionHotbar.#resolveOwner(actor);
    if (!ownerChar) return null;

    const ownerPetUuid = ownerChar.getFlag('dsa5', 'hotbarCompanion');
    if (ownerPetUuid === actor.uuid) {
      return { petActor: actor, ownerActor: ownerChar, isControllingPet: true };
    }

    return null;
  }

  /**
   * Prepare companion context data for the hotbar template.
   * @param {object} context - The hotbar render context to extend
   * @param {Actor} actor - The hotbar's active actor
   */
  static async prepareContext(context, actor) {
    const result = await CompanionHotbar.resolveCompanion(actor);
    if (!result) return;

    const { petActor, ownerActor, isControllingPet } = result;
    const petOnScene = petActor.getActiveTokens().length > 0;

    if (isControllingPet) {
      context.companion = {
        uuid: petActor.uuid,
        ownerUuid: ownerActor.uuid,
        isControllingPet: true,
        img: ownerActor.img,
        tooltip: _loc('SHEET.ControlActor', { name: ownerActor.name }),
        statusIcon: ICON_CONTROL,
      };
    } else {
      context.companion = {
        uuid: petActor.uuid,
        ownerUuid: ownerActor.uuid,
        isControllingPet: false,
        img: petActor.img,
        tooltip: petOnScene
          ? _loc('SHEET.ControlActor', { name: petActor.name })
          : _loc('SHEET.SummonActor', { name: petActor.name }),
        statusIcon: petOnScene ? ICON_CONTROL : ICON_SUMMON,
      };
    }
  }

  /**
   * Bind event listeners on the companion hotbar icon.
   * @param {HTMLElement} element - The hotbar root element
   */
  static attachListeners(element) {
    const icon = element.querySelector('.companion-hotbar-icon');
    if (!icon) return;

    const statusOverlay = icon.querySelector('.status-icon');
    icon.addEventListener('mouseenter', () => { if (statusOverlay) statusOverlay.style.opacity = '1'; });
    icon.addEventListener('mouseleave', () => { if (statusOverlay) statusOverlay.style.opacity = '0'; });
    icon.addEventListener('click', (ev) => CompanionHotbar.#onClick(ev, icon));
  }

  /**
   * Update the companion icon status without a full re-render.
   * Called on token create/delete/canvasReady.
   */
  static refreshStatus() {
    const icon = ui.hotbar?.element?.querySelector('.companion-hotbar-icon');
    if (!icon || icon.dataset.isControllingPet === 'true') return;

    const petActor = fromUuidSync(icon.dataset.uuid);
    if (!petActor) return;

    const petOnScene = petActor.getActiveTokens().length > 0;
    const statusEl = icon.querySelector('.status-icon i');
    if (statusEl) {
      statusEl.className = `fa-solid ${petOnScene ? ICON_CONTROL : ICON_SUMMON}`;
    }

    icon.setAttribute('data-tooltip', petOnScene
      ? _loc('SHEET.ControlActor', { name: petActor.name })
      : _loc('SHEET.SummonActor', { name: petActor.name }),
    );
  }

  /**
   * Register token/canvas hooks for lightweight status updates.
   */
  static registerHooks() {
    const onTokenChange = (tokenDoc) => {
      const icon = ui.hotbar?.element?.querySelector('.companion-hotbar-icon');
      if (icon && tokenDoc.actor && icon.dataset.uuid === tokenDoc.actor.uuid) {
        CompanionHotbar.refreshStatus();
      }
    };
    Hooks.on('createToken', onTokenChange);
    Hooks.on('deleteToken', onTokenChange);
    Hooks.on('canvasReady', () => CompanionHotbar.refreshStatus());
  }

  // ---- Private ----

  static async #resolveOwner(actor) {
    const owners = actor.getFlag('dsa5', 'owners') || [];
    return owners.length > 0 ? fromUuid(owners[0]) : null;
  }

  static async #onClick(ev, icon) {
    ev.preventDefault();
    if (icon.dataset.isSpawning === 'true') return;

    const isControllingPet = icon.dataset.isControllingPet === 'true';
    if (isControllingPet) {
      await CompanionHotbar.#switchToOwner(icon.dataset.ownerUuid);
    } else {
      await CompanionHotbar.#switchToPetOrSummon(icon);
    }
  }

  static async #switchToOwner(ownerUuid) {
    const ownerActor = await fromUuid(ownerUuid);
    if (!ownerActor) return;

    const tokens = ownerActor.getActiveTokens();
    if (tokens.length > 0) {
      tokens[0].control({ releaseOthers: true });
      canvas.animatePan({ x: tokens[0].x, y: tokens[0].y });
    } else {
      ownerActor.sheet.render(true, { focus: true });
    }
  }

  static async #switchToPetOrSummon(icon) {
    const petActor = await fromUuid(icon.dataset.uuid);
    if (!petActor) return;

    const petTokens = petActor.getActiveTokens();
    if (petTokens.length > 0) {
      petTokens[0].control({ releaseOthers: true });
      canvas.animatePan({ x: petTokens[0].x, y: petTokens[0].y });
      return;
    }

    const ownerActor = await fromUuid(icon.dataset.ownerUuid);
    const ownerTokens = ownerActor?.getActiveTokens() || [];
    if (ownerTokens.length === 0) return;

    icon.dataset.isSpawning = 'true';
    try {
      const spawnX = ownerTokens[0].x + (canvas.grid?.size || 50);
      const spawnY = ownerTokens[0].y;
      const tokenData = await petActor.getTokenDocument({ x: spawnX, y: spawnY });
      await canvas.scene.createEmbeddedDocuments('Token', [tokenData]);
      ui.notifications.info(_loc('SHEET.ActorSummoned', { name: petActor.name }));
    } finally {
      icon.dataset.isSpawning = 'false';
    }
  }
}



