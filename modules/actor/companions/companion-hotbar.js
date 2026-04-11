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

    const petUuid = Object.values(actor.system.companions || {}).find(c => c.hotbar)?.uuid;
    if (petUuid) {
      const petActor = await fromUuid(petUuid);
      return petActor ? { petActor, ownerActor: actor, isControllingPet: false } : null;
    }

    const ownerChar = game.user.character ?? await CompanionHotbar.#resolveOwner(actor);
    if (!ownerChar) return null;

    const ownerPetUuid = Object.values(ownerChar.system.companions || {}).find(c => c.hotbar)?.uuid;
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
        tooltip: _loc('COMPANIONS.Hotbar.ControlActor', { name: ownerActor.name }),
        statusIcon: ICON_CONTROL,
      };
    } else {
      context.companion = {
        uuid: petActor.uuid,
        ownerUuid: ownerActor.uuid,
        isControllingPet: false,
        img: petActor.img,
        tooltip: petOnScene
          ? _loc('COMPANIONS.Hotbar.ControlActor', { name: petActor.name })
          : _loc('COMPANIONS.Hotbar.SummonActor', { name: petActor.name }),
        statusIcon: petOnScene ? ICON_CONTROL : ICON_SUMMON,
      };
    }
  }

  /**
   * Handle click on the companion hotbar icon.
   * @param {PointerEvent} ev
   * @param {HTMLElement} target - The icon element with data-action
   */
  static async onClick(ev, target) {
    if (target.dataset.isSpawning === 'true') return;

    const isControllingPet = target.dataset.isControllingPet === 'true';
    if (isControllingPet) {
      await CompanionHotbar.#switchToOwner(target.dataset.ownerUuid);
    } else {
      await CompanionHotbar.#switchToPetOrSummon(target);
    }
  }

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
      ? _loc('COMPANIONS.Hotbar.ControlActor', { name: petActor.name })
      : _loc('COMPANIONS.Hotbar.SummonActor', { name: petActor.name }),
    );
  }

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

  static async #resolveOwner(actor) {
    const owners = actor.system.companionData?.owners || [];
    return owners.length > 0 ? fromUuid(owners[0]) : null;
  }

  static async #switchToOwner(ownerUuid) {
    const ownerActor = await fromUuid(ownerUuid);
    if (!ownerActor) return;

    const tokens = ownerActor.getActiveTokens();
    if (tokens.length > 0) {
      await CompanionHotbar.#focusToken(tokens[0]);
    } else {
      ui.notifications.warn(_loc('COMPANIONS.Notification.NoActorOnMap', { name: ownerActor.name }));
      ownerActor.sheet.render(true, { focus: true });
    }
  }

  static async #switchToPetOrSummon(icon) {
    const petActor = await fromUuid(icon.dataset.uuid);
    if (!petActor) return;

    const petTokens = petActor.getActiveTokens();
    if (petTokens.length > 0) {
      await CompanionHotbar.#focusToken(petTokens[0]);
      return;
    }

    const ownerActor = await fromUuid(icon.dataset.ownerUuid);
    const ownerTokens = ownerActor?.getActiveTokens() || [];
    if (ownerTokens.length === 0) {
      ui.notifications.warn(_loc('COMPANIONS.Notification.NoOwnerOrPetOnMap', {
        owner: ownerActor?.name ?? '',
        pet: petActor.name,
      }));
      return;
    }

    icon.dataset.isSpawning = 'true';
    try {
      const spawnX = ownerTokens[0].x + (canvas.grid?.size || 50);
      const spawnY = ownerTokens[0].y;
      const tokenData = await petActor.getTokenDocument({ x: spawnX, y: spawnY });
      const [createdToken] = await canvas.scene.createEmbeddedDocuments('Token', [tokenData]);
      if (createdToken) {
        await CompanionHotbar.#focusToken(createdToken);
      }
      ui.notifications.info(_loc('COMPANIONS.Notification.ActorSummoned', { name: petActor.name }));
    } finally {
      icon.dataset.isSpawning = 'false';
    }
  }

  static async #focusToken(tokenLike) {
    const tokenObject = tokenLike?.object ?? tokenLike;
    tokenObject?.control?.({ releaseOthers: true });
    await canvas.animatePan({ x: tokenLike.x, y: tokenLike.y });
  }
}



