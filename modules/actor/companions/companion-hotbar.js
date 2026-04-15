const ICON_CONTROL = 'fa-arrows-to-eye';
const ICON_SUMMON = 'fa-bell';
const POSITION_STYLE = 'left:calc(50% + 40px);top:1px;';

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
        style: POSITION_STYLE,
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
        style: POSITION_STYLE,
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

  static async summonCompanion({ petUuid, ownerTokenId, sceneId }) {
    const scene = game.scenes.get(sceneId) ?? canvas.scene;
    if (!scene) return null;

    const petActor = await fromUuid(petUuid);
    if (!petActor) return null;

    const existingToken = scene.tokens.find((tokenDoc) => tokenDoc.actorId === petActor.id);
    if (existingToken) return existingToken;

    const ownerToken = scene.tokens.get(ownerTokenId);
    if (!ownerToken) return null;

    const spawnX = ownerToken.x + (scene.grid.size || canvas.grid?.size || 50);
    const spawnY = ownerToken.y;
    const tokenData = await petActor.getTokenDocument({ x: spawnX, y: spawnY }, { parent: scene });
    const [createdToken] = await scene.createEmbeddedDocuments('Token', [tokenData]);

    return createdToken ?? null;
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
      const ownerToken = ownerTokens[0];
      const payload = {
        petUuid: petActor.uuid,
        ownerTokenId: ownerToken.id,
        sceneId: ownerToken.parent?.id ?? canvas.scene?.id,
      };

      if (TokenDocument.implementation.canUserCreate(game.user)) {
        const createdToken = await CompanionHotbar.summonCompanion(payload);
        if (createdToken) {
          await CompanionHotbar.#focusToken(createdToken);
          ui.notifications.info(_loc('COMPANIONS.Notification.ActorSummoned', { name: petActor.name }));
        }
        return;
      }

      if (!game.users.activeGM) {
        ui.notifications.warn('DSAError.requiresGM', { localize: true });
        return;
      }

      game.socket.emit('system.dsa5', {
        type: 'summonCompanion',
        payload,
      });
      ui.notifications.info('CONJURATION.requestSend', { localize: true });
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



