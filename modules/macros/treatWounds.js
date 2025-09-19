const dict = {
  de: {
    powerFullHealer: 'Machtvoller Heiler',
    treatWounds: 'Wunden versorgen',
    treatPain: 'Schmerzen lindern',
    tooltip: (bonus) => `Zusätzlich +${bonus} LeP-Regeneration durch Machtvoller Heiler.`,
    description: (bonusString) => `<b>Wunden versorgen</b>: Alle Ziele erhalten einen Bonus von <b>${qs}${bonusString ?? ''}</b> auf die nächste Regeneration.</br><b>Schmerzen lindern</b>: Pro QS kann eine Stufe Schmerz bei allen Zielen gelindert werden.`,
    woundsTreated: (names, qs, bonusString) => `<b>${names}</b> wurde/wurden versorgt und erhalten <b>${qs}${bonusString ?? ''}</b> LeP-Regeneration.`,
    painTreated: (names, qs) => `<b>${names}</b> wurde/wurden versorgt und erhält/erhalten <b>${qs}</b> Stufe(n) Schmerzlinderung.`,
  },
  en: {
    powerFullHealer: 'Powerful Healer',
    treatWounds: 'Treat Wounds',
    treatPain: 'Treat Pain',
    tooltip: (bonus) => `Gains an additional +${bonus} health regeneration from Powerful Healer.`,
    description: (bonusString) => `<b>Treat Wounds</b>: All targets receive a bonus of <b>${qs}${bonusString ?? ''}</b> on the next regeneration.</br><b>Treat Pain</b>: For each QS, one level of pain can be treated on the targets.`,
    woundsTreated: (names, qs, bonusString) => `<b>${names}</b> has/have been treated and receive <b>${qs}${bonusString ?? ''}</b> health regeneration.`,
    painTreated: (names, qs) => `<b>${names}</b> has/have been treated and receive <b>${qs}</b> level(s) of pain treatment.`,
  },
}[game.i18n.lang == 'de' ? 'de' : 'en'];

class TreatWounds extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, source, qs) {
    super();
    this.macroData = {
      actor,
      source,
      qs,
      item,
      hasPowerfulHealer: actor.items.some(i => i.type == 'specialability' && i.name === dict.powerFullHealer),
    };
  }

  static DEFAULT_OPTIONS = {
    window: {
      title: item.name,
      resizable: true,
    },
    position: {
      width: 500,
    },
    classes: ['treat-wounds'],
    actions: {
      contentLink: this.openUuid,
      treatWounds: this._onTreatWounds,
      treatPain: this._onTreatPain
    }
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/macros/treatWounds.hbs',
    },
  };

  static async openUuid(ev, target) {
    const uuid = ev.currentTarget.dataset.uuid;
    const item = game.items.get(uuid);
    if (item) {
      item.sheet.render(true);
    }
  }

  updateTargets(html) {
    const targets = Array.from(game.user.targets);
    this.targets = targets.map((x) => x.actor);
    html.find('.targets').html(this.buildAnchors(targets));
  }

  static async _onTreatPain(event, target) {
    const names = [];
    for (let actor of this.targets) {
      if (!actor) continue;

      names.push(actor.name);
      const ef = {
        name: `${dict.treatPain} (${this.macroData.qs})`,
        img: 'icons/svg/aura.svg',
        changes: [
          {
            key: 'system.resistances.effects',
            value: `inpain ${this.macroData.qs}`,
            mode: 0,
          },
        ],
        duration: {},
        flags: {
          dsa5: {
            description: `${dict.treatPain} (${this.macroData.qs})`,
          },
        },
      };
      await actor.addCondition(ef);
    }
    const msg = dict.painTreated(names.join(', '), this.macroData.qs);
    const chatData = game.dsa5.apps.DSA5_Utility.chatDataSetup(msg);
    await ChatMessage.create(chatData);
    this.close();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('.content-link').on('click', (ev) => this.openUuid(ev));
  }

  static async _onTreatWounds(event, target) {
    let bonus = 0;

    if (this.macroData.hasPowerfulHealer) {
      const bonusRoll = await new Roll("1d3").roll();
      bonus += bonusRoll.total;
    }

    const names = [];

    for (let actor of this.targets) {
      if (!actor) continue;

      const currentTemp = actor.system.status.regeneration.LePTemp || 0;
      const newValue = currentTemp + this.macroData.qs + bonus;
      names.push(actor.name);
      await actor.update({ 'system.status.regeneration.LePTemp': newValue, });
    }
    const bonusString = bonus > 0 ? ` + <span data-tooltip="${dict.tooltip(bonus)}">${bonus}</span>` : "";
    const msg = dict.woundsTreated(names.join(', '), this.macroData.qs, bonusString);
    const chatData = game.dsa5.apps.DSA5_Utility.chatDataSetup(msg);
    await ChatMessage.create(chatData);
    this.close();
  }

  buildAnchors(targets) {
    const res = [];
    for (const target of targets) {
      res.push(target.toAnchor().outerHTML);
    }
    return res.join(', ');
  }

  async _prepareContext(options) {
    const data = await super._prepareContext(options);
    this.targets = [actor];
    data.macroData = this.macroData;
    data.source = this.buildAnchors([args.sourceActor]);
    data.lang = dict;
    data.description = dict.description(this.macroData.hasPowerfulHealer ? ` + <span data-tooltip="${dict.tooltip("1d3")}">1d3</span>` : "");
    data.targets = this.buildAnchors(this.targets);
    return data;
  }
}

new TreatWounds(actor, item, qs).render(true);