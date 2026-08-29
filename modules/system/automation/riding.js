import actor from '../../hooks/actor.js';
import CreatureType from './creature-type.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

const { mergeObject, getProperty } = foundry.utils;

export default class Riding {
  static preRenderedUnmountHud =
    '<button type="button" class="control-icon" data-action="ride"><i class="fas fa-horse" style="transform: rotate(180deg)" data-tooltip="RIDING.unmount" width="36" height="36"></i></button>';
  static preRenderedMountHud =
    '<button type="button" class="control-icon" data-action="ride"><i class="fas fa-horse" data-tooltip="RIDING.mount" width="36" height="36"></i></button>';
  static preRenderedSpeedHud =
    '<button type="button" class="control-icon" data-action="rideIncrease" data-tooltip="RIDING.increase"><i class="fas fa-caret-up" width="36" height="36"></i></button><button type="button" class="control-icon" data-tooltip="RIDING.decrease" data-action="rideDecrease"><i class="fas fa-caret-down" width="36" height="36"></i></button>';

  static async createTokenHook(token, options, id) {
    if (!DSA5_Utility.isActiveGM()) return;

    const scene = token.parent;
    if (this.isRiding(token.actor) && scene) {
      const horse = this.getHorse(token.actor);

      if (!horse) return;

      const horseTokenSource = await horse.getTokenDocument({
        x: token.x,
        y: token.y,
        hidden: token.hidden,
      });
      TokenDocument.implementation.applySourceTokenPlacement(token, horseTokenSource);
      const horseToken = (await scene.createEmbeddedDocuments('Token', [horseTokenSource]))[0];
      const tokenUpdate = {
        'flags.dsa5.horseTokenId': horseToken.id,
        elevation: (horseToken.elevation ?? 0) + 1,
      };
      mergeObject(tokenUpdate, this.adaptTokenSize(token, horseToken));
      await token.update(tokenUpdate);

      if (!horseToken.actorLink) {
        await token.actor.update({
          'system.horse.actorLink': false,
          'system.horse.token': { scene: scene.id, token: horseToken.id },
        });
      }
    }
  }

  static isRiding(actor) {
    return (actor.system.horse?.isRiding ?? 0) > 0;
  }

  static isDriving(actor) {
    return (actor.system.horse?.isRiding ?? 0) > 1;
  }

  static probablyDriving(horse) {
    return CreatureType.detectCreatureType(horse).length == 0 ? 2 : 1;
  }

  static updateTokenHook(token, data, options) {
    if (!DSA5_Utility.isActiveGM()) return;

    const horseId = getProperty(token, 'flags.dsa5.horseTokenId');
    if (!horseId) return;

    const scene = token.parent;
    if (!scene || (!data.x && !data.y && data.elevation === undefined)) return;

    const horseToken = scene.tokens.get(horseId);
    if (!horseToken) return;

    const waypoint = {
      x: data.x ?? token.x,
      y: data.y ?? token.y,
      rotation: data.rotation ?? token.rotation,
    };
    // Rider sits one step above the horse; keep horse under the rider when following.
    if (data.elevation !== undefined) waypoint.elevation = data.elevation - 1;
    else if (data.x || data.y) waypoint.elevation = Math.max(0, (token.elevation ?? 0) - 1);

    horseToken.update(waypoint);
  }

  static rollLoyalty(actor, options = {}) {
    const horse = this.getHorse(actor);
    if (!horse) return;

    const skill = this.getLoyaltyFromHorse(horse);
    if (!skill) {
      return ui.notifications.warn(
        'DSAError.notFound', { localize: true, format: {
          category: DSA5_Utility.categoryLocalization('skill'),
          name: _loc('LocalizedIDs.loyalty'),
        }});
    }
    horse.setupSkill(skill, options, horse.token?.id).then((setupData) => {
      horse.basicTest(setupData);
    });
  }

  static updateRiderSpeed(horse, newSpeed) {
    //Might need to speed this up somehow
    if (!canvas?.tokens?.documentCollection) return;

    const horseIds = horse.getActiveTokens().map((x) => x.id);
    for (const token of Array.from(canvas.tokens.documentCollection)) {
      if (horseIds.includes(token.getFlag('dsa5', 'horseTokenId'))) {
        if (newSpeed != token.actor.system.status.speed.max) {
          token.actor.prepareData();
          token.actor.sheet.render();
        }
      }
    }
  }

  static getLoyaltyFromHorse(horse) {
    return horse.items.find((x) => x.type == 'skill' && x.name.startsWith(_loc('LocalizedIDs.loyalty')));
  }

  static onRender(html, actor) {
    html.find('.combat-horse select').select2({
      escapeMarkup: function (m) {
        return m;
      },
    });
    html.find('.riding-toggle select').on('change', (ev) => {
      ev.preventDefault();
      this.toggleIsRiding(actor, ev.currentTarget.value);
    });
    html.find('.showHorse').on('click', () => this.getHorse(actor).sheet.render(true));
    html.find('.horse-delete').on('click', () => this.clearMount(actor));
    html.find('.horse-loyalty').on('click', () => this.rollLoyalty(actor));
    html.find('[name="horseSpeedSelector"]').on('change', async (ev) => {
      ev.preventDefault();
      const horse = Riding.getHorse(actor);
      Riding.setSpeed(horse, ev.currentTarget.value);
    });
  }

  /**
   * Rider elevation is derived from the mount, not from the previous riding mode.
   * Mounted or driving: horse + 1. Dismounted: same as the horse.
   * @param {TokenDocument|undefined} horseToken
   * @param {boolean} mounted
   * @param {TokenDocument} [riderToken] fallback when the horse is not on the scene
   * @param {boolean} [alreadyMounted]
   * @returns {number}
   */
  static elevationForRidingState(horseToken, mounted, riderToken, alreadyMounted = false) {
    if (horseToken) {
      const horseElevation = horseToken.elevation ?? 0;
      return mounted ? horseElevation + 1 : horseElevation;
    }
    const current = riderToken?.elevation ?? 0;
    if (mounted && alreadyMounted) return current;
    return mounted ? Math.max(0, current + 1) : Math.max(0, current - 1);
  }

  static async toggleIsRiding(actor, value) {
    value = Number(value);
    const wasMounted = this.isRiding(actor);
    await actor.update({
      'system.horse.isRiding': value,
    });

    const nowMounted = value > 0;
    const horse = this.getHorse(actor);
    const horseTokens = horse?.getActiveTokens?.(false, true) ?? [];
    const horseToken = horseTokens[0];
    const tokenUpdates = [];

    if (!nowMounted) {
      for (const token of actor.getActiveTokens(false, true)) {
        tokenUpdates.push({
          _id: token.id,
          'flags.dsa5.horseTokenId': _del,
          elevation: this.elevationForRidingState(horseToken, false, token, wasMounted),
        });
      }
      await this.removeRidingCondition(actor);
    } else {
      let horseTokenId;
      for (const ht of horseTokens) {
        tokenUpdates.push({
          _id: ht.id,
          'flags.dsa5.horseTokenId': _del,
        });
        horseTokenId = ht.id;
      }
      for (const token of actor.getActiveTokens(false, true)) {
        tokenUpdates.push({
          _id: token.id,
          elevation: this.elevationForRidingState(horseToken, true, token, wasMounted),
          'flags.dsa5.horseTokenId': horseTokenId,
        });
      }

      //TODO might need to create or search token?
      await this.addRidingCondition(actor, horse);
    }
    if (tokenUpdates.length && canvas.scene) {
      await canvas.scene.updateEmbeddedDocuments('Token', tokenUpdates);
    }
  }

  static getRidingCondition(actor) {
    const ridingLabel = _loc('RIDING.riding');
    return actor.effects.find((x) => x.name == ridingLabel);
  }

  static async addRidingCondition(actor, horse) {
    if (!this.getRidingCondition(actor)) await actor.addCondition(this.ridingCondition(horse));
  }

  static async removeRidingCondition(actor) {
    const ef = this.getRidingCondition(actor);
    if (ef) await actor.deleteEmbeddedDocuments('ActiveEffect', [ef.id]);
  }

  static deleteTokenHook() {
    console.warn('delete riding token hook not implemented');
  }

  static getHorse(actor, returnEmptyHorse = false) {
    let horse;
    const horseData = actor.system.horse;
    if (!horseData) return undefined;

    const hasTokenData = !foundry.utils.isEmpty(horseData.token || {});

    if (hasTokenData && !horseData.actorLink) horse = DSA5_Utility.getSpeaker(horseData.token);
    else if (horseData.actorId) horse = game.actors.get(horseData.actorId);

    if (!horse && returnEmptyHorse && horseData.isRiding) horse = { name: _loc('unknown') };

    return horse;
  }

  static async unmountHorse(actor, token) {
    const horse = this.getHorse(actor);
    const horseToken = horse?.getActiveTokens?.(false, true)?.[0]
      ?? canvas.scene?.tokens.get(token?.getFlag?.('dsa5', 'horseTokenId'));
    await this.clearMount(actor);
    if (!token) return;

    // HUD may pass a token document that is not currently an active placeable.
    if (token.getFlag?.('dsa5', 'horseTokenId') || token.getFlag?.('dsa5', 'horseResized')) {
      const tokenUpdate = {
        'flags.dsa5.horseTokenId': _del,
        elevation: this.elevationForRidingState(horseToken, false, token),
      };
      const tokenResized = token.getFlag('dsa5', 'horseResized');
      if (tokenResized) {
        // Do not mergeObject _del — mergeObject ignores ForcedDeletion unless applyOperators is set.
        tokenUpdate.width = tokenResized.width;
        tokenUpdate.height = tokenResized.height;
        tokenUpdate['flags.dsa5.horseResized'] = _del;
      }
      await token.update(tokenUpdate);
    }
  }

  static async clearMount(actor) {
    const horse = this.getHorse(actor);
    const horseToken = horse?.getActiveTokens?.(false, true)?.[0];
    const tokenUpdates = [];
    for (const doc of actor.getActiveTokens(false, true)) {
      const update = {
        _id: doc.id,
        'flags.dsa5.horseTokenId': _del,
        elevation: this.elevationForRidingState(horseToken, false, doc),
      };
      const tokenResized = doc.getFlag('dsa5', 'horseResized');
      if (tokenResized) {
        // Do not mergeObject _del — mergeObject ignores ForcedDeletion unless applyOperators is set.
        update.width = tokenResized.width;
        update.height = tokenResized.height;
        update['flags.dsa5.horseResized'] = _del;
      }
      tokenUpdates.push(update);
    }
    if (tokenUpdates.length && canvas.scene) {
      await canvas.scene.updateEmbeddedDocuments('Token', tokenUpdates);
    }

    // ObjectField merges: token: {} does not clear scene/token keys — must delete them.
    await actor.update({
      'system.horse.isRiding': 0,
      'system.horse.actorLink': false,
      'system.horse.actorId': '',
      'system.horse.token': { scene: _del, token: _del },
    });
    await this.removeRidingCondition(actor);
  }

  static ridingCondition(horse) {
    const changes = [{ key: 'system.status.dodge.gearmodifier', type: 'add', value: -2 }];

    if (horse) {
      const trainings = horse.items.filter(i => i.type === 'trait' && i.system?.traitType?.value === 'training');
      const hasRiderTraining = trainings.some(t => t.name.includes(_loc('LocalizedIDs.riderTraining')));

      let effectValue = 0;
      if (!hasRiderTraining) effectValue = -1;
      else if (trainings.length >= 2) effectValue = 1;

      if (effectValue !== 0) {
        changes.push({ key: 'system.skillModifiers.step', mode: 0, value: `${_loc('LocalizedIDs.riding')} ${effectValue}` });
      }
    }

    return {
      name: _loc('RIDING.riding'),
      img: 'systems/dsa5/icons/thirdparty/horse-head.svg',
      system: {
        description: _loc('RIDING.ridingDescription'),
        changes,
      },
    };
  }

  static async setHorse(rider, horse, riderToken) {
    if (horse.inCompendium) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: {
          title: 'DSAError.horseMustBeImported',
        },
        content: `<p>${_loc('DSAError.horseMustBeImportedText')}</p>`,
        rejectClose: false,
      });
      if (!confirmed) return;

      const folder = await DSA5_Utility.getFolderForType('Actor', null, _loc('RIDING.horse'));
      const importedHorse = horse.toObject();
      importedHorse.folder = folder.id;
      horse = await Actor.implementation.create(importedHorse);
    }

    if (riderToken && !horse.token) {
      const horseTokenData = await horse.getTokenDocument({ x: riderToken.x, y: riderToken.y });
      TokenDocument.implementation.applySourceTokenPlacement(riderToken, horseTokenData);
      horse = (await canvas.scene.createEmbeddedDocuments('Token', [horseTokenData]))[0].actor;
    }

    const actorUpdate = {
      system: {
        horse: {
          isRiding: this.probablyDriving(horse),
          actorLink: horse.prototypeToken.actorLink,
          actorId: horse.id,
        },
      },
    };
    if (!horse.prototypeToken.actorLink && horse.token) {
      mergeObject(actorUpdate, {
        system: {
          horse: {
            token: { scene: canvas.scene.id, token: horse.token.id },
          },
        },
      });
    }
    await rider.update(actorUpdate);
    if (horse.isToken && horse.token) {
      const horseElevation = horse.token.elevation ?? 0;
      const tokenUpdates = rider
        .getActiveTokens(false, true)
        .map((doc) => {
          const sizeSource = riderToken ?? doc;
          return mergeObject(
            {
              _id: doc.id,
              'flags.dsa5.horseTokenId': horse.token.id,
              x: horse.token.x,
              y: horse.token.y,
              elevation: horseElevation + 1,
            },
            this.adaptTokenSize(sizeSource, horse.token),
          );
        })
        .concat({ _id: horse.token.id, 'flags.dsa5.horseTokenId': _del });
      await canvas.scene.updateEmbeddedDocuments('Token', tokenUpdates);
    }
    await this.addRidingCondition(rider, horse);
  }

  static adaptTokenSize(riderTokenDocument, horseTokenDocument) {
    if (!riderTokenDocument || !horseTokenDocument) return {};
    if (riderTokenDocument.width >= horseTokenDocument.width) {
      return {
        width: 0.7 * horseTokenDocument.width,
        height: 0.7 * horseTokenDocument.height,
        'flags.dsa5.horseResized': {
          width: riderTokenDocument.width,
          height: riderTokenDocument.height,
        },
      };
    }
    return {};
  }

  static async mountHorse(rider) {
    const horse = canvas.tokens.controlled.find((x) => x.document.id != rider.id);
    const scene = rider.parent;

    const actorUpdate = {
      system: {
        horse: {
          isRiding: this.probablyDriving(horse.actor),
          actorLink: horse.actorLink,
          actorId: horse.actor.id,
        },
      },
    };
    if (!horse.actorLink) {
      mergeObject(actorUpdate, {
        system: {
          horse: {
            token: { scene: scene.id, token: horse.id },
          },
        },
      });
    }

    const riderTokenUpdate = {
      _id: rider.id,
      'flags.dsa5.horseTokenId': horse.id,
      x: horse.x,
      y: horse.y,
      elevation: (horse.document.elevation ?? 0) + 1,
    };
    mergeObject(riderTokenUpdate, this.adaptTokenSize(rider.document, horse.document));
    await rider.actor.update(actorUpdate);
    await canvas.scene.updateEmbeddedDocuments('Token', [riderTokenUpdate, { _id: horse.id, 'flags.dsa5.horseTokenId': _del }]);
    await this.addRidingCondition(rider.actor, horse.actor);
  }

  static speedKeys = {
    0: { key: 'system.status.speed.multiplier', type: 'override', value: 0 },
    '-4': { key: 'system.status.speed.initial', type: 'override', value: 4 },
    '-5000': { key: 'system.status.speed.multiplier', type: 'override', value: 0.66 },
    '-8': { key: 'system.status.speed.multiplier', type: 'override', value: 1 },
  };

  static getHorseSpeed(horse) {
    return horse.effects.find((x) => Number.isFinite(x.system?.horseSpeed))?.system.horseSpeed || 0;
  }

  static horseSpeedModifier(horse) {
    const speed = this.getHorseSpeed(horse);
    return Object.keys(this.speedKeys)
      .map((x) => Number(x))
      .indexOf(Number(speed));
  }

  static increaseSpeed(horse) {
    const speed = this.getHorseSpeed(horse);
    const newIndex = Math.min(
      3,
      Object.keys(this.speedKeys)
        .map((x) => Number(x))
        .indexOf(speed) + 1,
    );
    this.setSpeed(horse, Object.keys(this.speedKeys).map((x) => Number(x))[newIndex]);
  }

  static decreaseSpeed(horse) {
    const speed = this.getHorseSpeed(horse);
    const newIndex = Math.max(
      0,
      Object.keys(this.speedKeys)
        .map((x) => Number(x))
        .indexOf(speed) - 1,
    );
    this.setSpeed(horse, Object.keys(this.speedKeys).map((x) => Number(x))[newIndex]);
  }

  static async setSpeed(horse, speed) {
    await horse.deleteEmbeddedDocuments(
      'ActiveEffect',
      horse.effects.filter((x) => Number.isFinite(x.system?.horseSpeed)).map((x) => x.id),
    );
    await horse.addCondition({
      name: _loc('speed') + ': ' + _loc(`RIDING.speeds.${speed}`),
      icon: 'systems/dsa5/icons/thirdparty/horse-head.svg',
      changes: [this.speedKeys[speed]],
      system: {
        horseSpeed: Number(speed),
        description: _loc(`RIDING.speed.${speed}`),
        changes: [this.speedKeys[speed]],
      },
    });
  }

  static renderTokenHUD(app, html, data) {
    const actor = app.object.actor;

    if (canvas.tokens.controlled.length == 2) {
      html.find('.col.left').prepend(this.preRenderedMountHud);
      const btn = html.find('.control-icon[data-action="ride"]');
      btn.on('click', () => this.mountHorse(app.object));
    } else if (this.isRiding(actor)) {
      html.find('.col.left').prepend(this.preRenderedUnmountHud);
      const btn = html.find('.control-icon[data-action="ride"]');
      btn.on('click', () => {
        this.unmountHorse(actor, app.object.document);
        btn.remove();
      });
      const horse = this.getHorse(actor);
      html.find('.col.right').prepend(this.preRenderedSpeedHud);
      const btn2 = html.find('.control-icon[data-action="rideIncrease"]');
      btn2.on('click', () => this.increaseSpeed(horse));
      const btn3 = html.find('.control-icon[data-action="rideDecrease"]');
      btn3.on('click', () => this.decreaseSpeed(horse));
    }
  }
}
