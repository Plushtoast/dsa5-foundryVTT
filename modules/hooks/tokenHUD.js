import Riding from '../system/riding.js';
import { TokenHoverHud } from './actor.js';
const { getProperty } = foundry.utils;

function addThirdBarToHUD(html, actor, app) {
  if (actor.system.isPriest && actor.system.isMage) {
    let currentKaP = actor.system.status.karmaenergy.value;
    let attrBar = `<div class="attribute bar3"><input type="text" name="system.status.karmaenergy.value" value="${currentKaP}"></div>`;
    html.find('.col.middle').prepend(attrBar);
    html.find('.bar3 input').change(async (ev) => {
      const input = ev.currentTarget;
      let strVal = input.value.trim();
      let isDelta = strVal.startsWith('+') || strVal.startsWith('-');
      if (strVal.startsWith('=')) strVal = strVal.slice(1);
      let value = Number(strVal);
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
    btn.click(() => {
      combineSwarm(actor, app.object.document);
      btn.remove();
    });
  } else if (actor.isSwarm()) {
    html.find('.col.left').prepend(swarmHud('swarm.split'));
    const btn = html.find('.control-icon[data-action="swarm"]');
    btn.click(() => {
      splitSwarm(actor, app.object.document);
      btn.remove();
    });
  }
}

class SwarmDialog extends foundry.applications.api.DialogV2 {
  _onRender(context, options) {
    super._onRender((context, options));

    const html = $(this.element);
    html.find('input[type="range"]').on('change', (ev) => {
      $(ev.currentTarget)
        .closest('.row-section')
        .find('.range-value')
        .html($(ev.currentTarget).val());
    });
  }
}

function swarmHud(tooltip) {
  return `<div class="control-icon" data-action="swarm"><i class="fas fa-locust" data-tooltip="${tooltip}" width="36" height="36"></div>`;
}

async function splitSwarm(actor, token) {
  const maxSplitsize = Number(actor.system.swarm.count) - 1;
  const content = await renderTemplate(
    'systems/dsa5/templates/dialog/swarm-split-dialog.html',
    { actor, maxSplitsize },
  );

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
          const split = button.form.elements.newswarmsplit.valueAsNumber;
          const newtokenData = token.toObject();
          delete newtokenData._id;

          const newHp = Math.floor(
            (actor.system.status.wounds.value / actor.system.swarm.count) *
              split,
          );
          const oldHp = actor.system.status.wounds.value - newHp;

          await actor.update(
            {
              'system.swarm.count': actor.system.swarm.count - split,
              'system.status.wounds.value': oldHp,
            },
            { skipSwarmUpdate: true },
          );
          const newtoken = (
            await canvas.scene.createEmbeddedDocuments('Token', [newtokenData])
          )[0];
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
  for (let token of canvas.tokens.controlled) {
    swarmSum += Number(token.actor.system.swarm?.count) || 1;
    lepSum += Number(token.actor.system.status.wounds.value);
  }
  await token.actor.update(
    { 'system.swarm.count': swarmSum, 'system.status.wounds.value': lepSum },
    { skipSwarmUpdate: true },
  );
  const tokensToRemove = canvas.tokens.controlled
    .map((x) => x.id)
    .filter((x) => x != token.id);
  await canvas.scene.updateEmbeddedDocuments(
    'Token',
    tokensToRemove.map((x) => {
      return { _id: x, x: token.x, y: token.y };
    }),
  );
  await canvas.scene.deleteEmbeddedDocuments('Token', tokensToRemove);
}

export default function () {
  Hooks.on('renderTokenHUD', (app, html, data) => {
    TokenHoverHud.hide(app.object);

    const actor = app.object.actor;
    if (actor) {
      addThirdBarToHUD(html, actor, app);
      swarmButtons(app, html, data);

      game.dsa5.apps.LightDialog?.lightHud(html, actor, data);
    }
    html.find('.control-icon[data-action="target"]').mousedown((ev) => {
      if (ev.button == 2) {
        game.user.updateTokenTargets([]);
        $(ev.currentTarget).trigger('click');
        ev.preventDefault();
      }
    });
    // Prevent double calling of modifytokenattribute
    html.find('.attribute input').off('change');

    Riding.renderTokenHUD(app, html, data);
  });

  Hooks.on('renderTokenConfig', (app, html, data) => {
    if (data.isPrototype) {
      const autoBar = getProperty(app.actor, 'system.config.autoBar');

      let hint = html.find('.bar2-max').closest('.form-group');
      let elem = $(`<div class="form-group">
                <label>${game.i18n.localize('ActorConfig.autoBar')}</label>
                <input type="checkbox" class="autoBar" ${autoBar ? 'checked=""' : ''}>
                <p class="hint">${game.i18n.localize('ActorConfig.AutoBarHint')}</p>
            </div>`);
      hint.after(elem);
      elem.find('.autoBar').on('change', (ev) => {
        app.actor.update({ 'system.config.autoBar': ev.currentTarget.checked });
      });

      const autoSize = getProperty(app.actor, 'system.config.autoSize');
      hint = html.find('input[name="height"]').closest('.form-group');
      elem = $(`<div class="form-group">
                <label>${game.i18n.localize('ActorConfig.autoSize')}</label>
                <input type="checkbox" class="autoSize" ${autoSize ? 'checked=""' : ''}>
                <p class="hint">${game.i18n.localize('ActorConfig.AutoSizeHint')}</p>
            </div>`);
      hint.after(elem);
      elem.find('.autoSize').on('change', (ev) => {
        app.actor.update({
          'system.config.autoSize': ev.currentTarget.checked,
        });
      });
    }
  });
}
