import Riding from '../system/automation/riding.js';
import { TokenHoverHud } from './actor.js';
const { getProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

function addThirdBarToHUD(html, actor, app) {
  if (actor.system.isPriest && actor.system.isMage) {
    const currentKaP = actor.system.status.karmaenergy.value;
    const attrBar = `<div class="attribute bar3"><input type="text" name="system.status.karmaenergy.value" value="${currentKaP}"></div>`;
    html.find('.col.middle').prepend(attrBar);
    html.find('.bar3 input').on('change', async (ev) => {
      const input = ev.currentTarget;
      let strVal = input.value.trim();
      const isDelta = strVal.startsWith('+') || strVal.startsWith('-');
      if (strVal.startsWith('=')) strVal = strVal.slice(1);
      const value = Number(strVal);
      const current = input.name.split('.').reduce((o, i) => o[i], actor);
      await actor.update({
        [input.name]: isDelta ? current + value : value,
      });
      app.clear();
    });
  }
}

function swarmButtons(app, html, data) {
  if (!game.user.isGM) return;

  const actor = app.object.actor;
  if (!actor.isToken) return;

  if (canvas.tokens.controlled.length >= 2) {
    const actorId = actor._id;
    if (!canvas.tokens.controlled.every((x) => x.actor?._id == actorId)) return;

    html.find('.col.left').prepend(swarmHud('swarm.combine'));
    const btn = html.find('.control-icon[data-action="swarm"]');
    btn.on('click', () => {
      combineSwarm(actor, app.object.document);
      btn.remove();
    });
  } else if (actor.isSwarm()) {
    html.find('.col.left').prepend(swarmHud('swarm.split'));
    const btn = html.find('.control-icon[data-action="swarm"]');
    btn.on('click', () => {
      splitSwarm(actor, app.object.document);
      btn.remove();
    });
  }
}

class SwarmDialog extends foundry.applications.api.DialogV2 {
  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('input[type="range"]').on('change', (ev) => {
      $(ev.currentTarget).closest('.row-section').find('.range-value').html($(ev.currentTarget).val());
    });
  }
}

function swarmHud(tooltip) {
  return `<button type="button" class="control-icon" data-action="swarm" data-tooltip="${tooltip}"><i class="fas fa-locust" width="36" height="36"></button>`;
}

async function splitSwarm(actor, token) {
  const maxSplitsize = Number(actor.system.swarm.count) - 1;
  const content = await renderTemplate('systems/dsa5/templates/dialog/swarm-split-dialog.hbs', { actor, maxSplitsize });

  new SwarmDialog({
    window: {
      title: 'swarm.split',
    },
    content,
    buttons: [
      {
        action: 'yes',
        icon: 'fa fa-check',
        label: 'ok',
        default: true,
        callback: async (event, button, dialog) => {
          const split = button.form.elements.newswarmsplit.value;
          const newtokenData = token.toObject();
          delete newtokenData._id;

          const newHp = Math.floor((actor.system.status.wounds.value / actor.system.swarm.count) * split);
          const oldHp = actor.system.status.wounds.value - newHp;

          await actor.update(
            {
              'system.swarm.count': actor.system.swarm.count - split,
              'system.status.wounds.value': oldHp,
            },
            { skipSwarmUpdate: true },
          );
          const newtoken = (await canvas.scene.createEmbeddedDocuments('Token', [newtokenData]))[0];
          await newtoken.actor.update(
            {
              'system.swarm.count': split,
              'system.status.wounds.value': newHp,
            },
            { skipSwarmUpdate: true },
          );
          const axis = ['x', 'y'][Math.floor(Math.random() * 2)];
          const dir = Math.random() > 0.5 ? 1 : -1;
          await canvas.scene.updateEmbeddedDocuments('Token', [
            {
              _id: newtoken.id,
              [axis]: token[axis] + canvas.scene.grid.size * dir,
            },
          ]);
        },
      },
      {
        action: 'delete',
        icon: 'fas fa-trash',
        label: 'cancel',
      },
    ],
  }).render(true);
}

async function combineSwarm(actor, token) {
  let swarmSum = 0;
  let lepSum = 0;
  for (const token of canvas.tokens.controlled) {
    swarmSum += Number(token.actor.system.swarm?.count) || 1;
    lepSum += Number(token.actor.system.status.wounds.value);
  }
  await token.actor.update({ 'system.swarm.count': swarmSum, 'system.status.wounds.value': lepSum }, { skipSwarmUpdate: true });
  const tokensToRemove = canvas.tokens.controlled.map((x) => x.id).filter((x) => x != token.id);
  await canvas.scene.updateEmbeddedDocuments(
    'Token',
    tokensToRemove.map((x) => {
      return { _id: x, x: token.x, y: token.y };
    }),
  );
  await canvas.scene.deleteEmbeddedDocuments('Token', tokensToRemove);
}

function setTokenSpeedIndicator(actor, html, data) {
  const speed = actor.speedByMovementType(data.movementAction);
  const movementButton = html.find('button[data-palette="movementActions"][data-action="togglePalette"]')
  const indicator = $(`
    <div class="position-relative">
    ${movementButton.html()}
    <div class="speedIndicator">${speed}</div>
    </div>
  `)  
  movementButton.html(indicator);
}

export default function () {
  Hooks.on('renderTokenHUD', (app, jhtml, data) => {
    const html = $(jhtml);
    TokenHoverHud.hide(app.object);

    const actor = app.object.actor;
    if (actor) {
      addThirdBarToHUD(html, actor, app);
      swarmButtons(app, html, data);

      game.dsa5.apps.LightDialog?.lightHud(html, actor, data);
    }
    html.find('.control-icon[data-action="target"]').on('mousedown', (ev) => {
      if (ev.button == 2) {
        if (game.canvas.ready) game.user._onUpdateTokenTargets([]);
        $(ev.currentTarget).trigger('click');
        ev.preventDefault();
      }
    });
    // Prevent double calling of modifytokenattribute
    html.find('.attribute input').off('change');

    Riding.renderTokenHUD(app, html, data);
    setTokenSpeedIndicator(actor, html, data);
  });

  Hooks.on('renderPrototypeTokenConfig', (app, jhtml) => {
    const html = $(jhtml);

    const addCheckbox = ({ configPath, labelKey, hintKey, anchorSelector }) => {
      const value = getProperty(app.actor.system, configPath);
      const anchor = html.find(anchorSelector).closest('.form-group');
      const elem = $(`
        <div class="form-group">
          <label>${_loc(labelKey)}</label>
          <input type="checkbox" class="config-checkbox" ${value ? 'checked' : ''}>
          <p class="hint">${_loc(hintKey)}</p>
        </div>
      `);
      anchor.after(elem);
      elem.find('.config-checkbox').on('change', (ev) => {
        app.actor.update({ [`system.${configPath}`]: ev.currentTarget.checked });
      });
    };

    addCheckbox({
      configPath: 'config.autoBar',
      labelKey: 'ActorConfig.autoBar',
      hintKey: 'ActorConfig.AutoBarHint',
      anchorSelector: '[name="bar2.attribute"]',
    });

    addCheckbox({
      configPath: 'config.autoSize',
      labelKey: 'ActorConfig.autoSize',
      hintKey: 'ActorConfig.AutoSizeHint',
      anchorSelector: 'input[name="height"]',
    });

    addCheckbox({
      configPath: 'config.lockRotation',
      labelKey: 'ActorConfig.lockRotation',
      hintKey: 'ActorConfig.lockRotationHint',
      anchorSelector: 'input[name="lockRotation"]',
    });
  });
}
