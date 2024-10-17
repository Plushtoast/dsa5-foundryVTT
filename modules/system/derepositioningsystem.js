import AdvantageRulesDSA5 from './advantage-rules-dsa5.js';
const { getProperty } = foundry.utils;

export default class DPS {
  RECT_SPREAD = [
    { x: 0.25, y: 0.25 },
    { x: 0.5, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.25, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.25, y: 0.75 },
    { x: 0.5, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ];

  static rangeFinder(tokenSource, tokenTarget) {
    const gridSize = canvas.scene.grid.size;
    const ray = new Ray(tokenSource, tokenTarget);
    const tileDistance = ray.distance / gridSize;
    const distance = tileDistance * canvas.scene.grid.distance;
    const elevation = Math.abs(
      (getProperty(tokenSource, 'document.elevation') || 0) -
        (getProperty(tokenTarget, 'document.elevation') || 0),
    );
    const distanceSum = Math.hypot(distance, elevation);
    return {
      elevation,
      distance,
      distanceSum,
      tileDistance,
      unit: canvas.scene.grid.units,
    };
  }

  static inDistance(toToken) {
    for (let token of canvas.scene.tokens) {
      if (
        token.isOwner &&
        DPS.rangeFinder(toToken, token.object).tileDistance <= 2
      )
        return true;
    }
    return false;
  }

  static inLight(token) {
    let bright = false;
    let dim = false;

    if (game.settings.get('dsa5', 'lightSightCompensationEnabled')) {
      for (const light of canvas.effects.lightSources) {
        if (!light.active || !light.object || !light.object.document) continue;

        if (light.object == token) {
          (bright = bright || light.data.bright > 0),
            (dim = dim || light.data.dim > 0);

          if (bright) break;
          else continue;
        }

        const distance = DPS.rangeFinder(token, light.object).distanceSum;
        const lightConfig =
          light.object.document.config || light.object.document.light;
        const inBright = lightConfig.bright >= distance;
        const inDim = lightConfig.dim >= distance;

        if (!inBright && !inDim) continue;

        if (
          light.data.walls === false ||
          light.shape.contains(token.center.x, token.center.y)
        ) {
          bright = inBright || bright;
          dim = inDim || dim;
        }

        if (bright) break;
      }
    }
    return { bright, dim };
  }

  static get isEnabled() {
    const sceneFlag = canvas?.scene?.getFlag('dsa5', 'enableDPS');
    return sceneFlag
      ? sceneFlag == '2'
      : game.settings.get('dsa5', 'enableDPS');
  }

  static lightLevel(actor, html) {
    if (canvas.scene && game.settings.get('dsa5', 'sightAutomationEnabled')) {
      let level = 0;
      const threholds = game.settings
        .get('dsa5', 'sightOptions')
        .split('|')
        .map((x) => Number(x));

      if (actor) {
        const darkSightLevel = AdvantageRulesDSA5.vantageStep(
          actor,
          game.i18n.localize('LocalizedIDs.darksight'),
        );
        const sightModifier =
          Number(getProperty(actor, 'system.sightModifier.value')) || 0;
        const modifyableLevel =
          Number(getProperty(actor, 'system.sightModifier.maxLevel')) || 3;

        let token = Array.from(game.user.targets);
        if (token.length) {
          token = token[0];
          const darkness =
            canvas?.effects.getDarknessLevel(
              token.center,
              token.document.elevation,
            ) || 0;

          while (threholds[level] <= darkness) level += 1;

          const light = DPS.inLight(token);
          let mod = 0;
          if (light.bright) mod = -2;
          else if (light.dim) mod = -1;

          level = Math.max(level + mod, 0);
        }

        if (level <= modifyableLevel && level > 0) {
          if (darkSightLevel > 1) {
            level = 0;
          } else {
            level = Math.clamp(level + sightModifier - darkSightLevel, 0, 4);
          }
        }
      }

      const elem = html.find(`[name="vision"] option:nth-child(${level + 1})`);
      if (elem.length) elem[0].selected = true;
    }
  }

  static distanceModifier(tokenSource, rangeweapon, currentAmmo) {
    if (!DPS.isEnabled || !tokenSource) return 1;

    let maxDist = {};
    for (let target of game.user.targets) {
      const dist = DPS.rangeFinder(tokenSource, target);
      if ((maxDist.distanceSum || 0) < dist.distanceSum) maxDist = dist;
    }

    if (maxDist.unit == game.i18n.localize('gridUnits')) {
      const rangeMultiplier =
        Number(getProperty(currentAmmo, 'system.rangeMultiplier')) || 1;
      const rangeBands = rangeweapon.system.reach.value
        .split('/')
        .map((x) => Number(x) * rangeMultiplier);
      let index = 0;
      while (index < 2 && rangeBands[index] < maxDist.distanceSum) {
        index++;
      }

      return index;
    } else {
      return 1;
    }
  }

  static initDoorMinDistance() {
    const originalDoorControl = DoorControl.prototype._onMouseDown;
    DoorControl.prototype._onMouseDown = function (event) {
      if (!game.user.isGM && DPS.isEnabled) {
        if (!DPS.inDistance(this))
          return ui.notifications.warn('DSAError.notInRangeToLoot', {
            localize: true,
          });
      }
      return originalDoorControl.apply(this, arguments);
    };
  }
}

Hooks.on('renderSceneConfig', (app, html, msg) => {
  const sceneFlag = getProperty(app.object, 'flags.dsa5.enableDPS');
  const dpsSelector = `<div class="form-group dpsSelector">
        <label data-tooltip="DSASETTINGS.enableDPSHint">${game.i18n.localize('DSASETTINGS.enableDPS')}</label>
        <select name="flags.dsa5.enableDPS">
            <option value="" ${sceneFlag == '' ? 'selected' : ''}>${game.i18n.localize('globalConfig')}</option>
            <option value="2" ${sceneFlag == '2' ? 'selected' : ''}>${game.i18n.localize('yes')}</option>
            <option value="1" ${sceneFlag == '1' ? 'selected' : ''}>${game.i18n.localize('no')}</option>
        </select>
    </div>`;
  html.find('.dpsSelector').remove();
  html.find('.tab[data-tab="grid"]').append(dpsSelector);
});
