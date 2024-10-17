import DSA5 from '../system/config-dsa5.js';
import WizardDSA5 from './dsa5_wizard.js';
import APTracker from '../system/ap-tracker.js';
const { mergeObject } = foundry.utils;

export default class SpeciesWizard extends WizardDSA5 {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.title = game.i18n.format('WIZARD.addItem', {
      item: `${game.i18n.localize('TYPES.Item.species')}`,
    });
    options.template = 'systems/dsa5/templates/wizard/add-species-wizard.html';
    return options;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.optional').change((ev) => {
      let parent = $(ev.currentTarget).closest('.content');
      let apCost = Number(parent.attr('data-cost'));
      parent.find('.optional:checked').each(function () {
        apCost += Number($(this).attr('data-cost'));
      });
      let elem = parent.find('.apCost');
      elem.text(apCost);
      WizardDSA5.flashElem(elem, 'emphasize2');
    });
  }

  async _toGroups(input, categories, previous) {
    const groups = await Promise.all(
      input.split('\n').map(async (x) => {
        let vals = x.split(':');
        let elem;
        if (vals.length > 1) {
          elem = {
            name: vals[0].trim(),
            res: await this.parseToItem(vals[1].trim(), categories),
          };
        } else {
          elem = {
            name: '',
            res: await this.parseToItem(x, categories),
          };
        }
        this.fixPreviousCosts(previous, elem.res);
        return elem;
      }),
    );
    return groups;
  }

  async getData(options) {
    const data = await super.getData(options);
    const requirements = await this.parseToItem(
      this.species.system.requirements.value,
      ['disadvantage', 'advantage'],
    );
    const missingVantages = requirements.filter(
      (x) => ['advantage', 'disadvantage'].includes(x.type) && !x.disabled,
    );
    const advantagegroups = await this._toGroups(
      this.species.system.recommendedAdvantages.value,
      ['advantage'],
      requirements,
    );
    const disadvantagegroups = await this._toGroups(
      this.species.system.recommendedDisadvantages.value,
      ['disadvantage'],
      requirements,
    );
    const attributeRequirements = this._parseAttributes(
      this.species.system.attributeChange.value,
    );
    const baseCost = Number(this.species.system.APValue.value);
    const reqCost = requirements.reduce(function (_this, val) {
      return _this + (val.disabled ? 0 : Number(val.system.APValue.value) || 0);
    }, 0);
    mergeObject(data, {
      title: game.i18n.format('WIZARD.addItem', {
        item: `${game.i18n.localize('TYPES.Item.species')} ${this.species.name}`,
      }),
      species: this.species,
      description: game.i18n.format('WIZARD.speciesdescr', {
        species: this.species.name,
        cost: baseCost + reqCost,
      }),
      advantagegroups,
      baseCost,
      disadvantagegroups,
      missingVantages,
      attributeRequirements,
      hasLocalization: game.i18n.has(`Racedescr.${this.species.name}`),
      anyAttributeRequirements: attributeRequirements.length > 0,
      advantagesToChose: advantagegroups.length > 0,
      missingVantagesToChose: missingVantages.length > 0,
      disadvantagesToChose: disadvantagegroups.length > 0,
      vantagesToChose:
        advantagegroups.length > 0 ||
        disadvantagegroups.length > 0 ||
        missingVantages.length > 0,
      generalToChose: attributeRequirements.length > 0,
    });
    return data;
  }

  async addSpecies(actor, item) {
    this.actor = actor;
    this.species = item;
  }

  async updateCharacter(parent, app = this) {
    parent.find('button.ok i').toggleClass('fa-check fa-spinner fa-spin');

    let apCost = Number(parent.find('.apCost').text());
    if (
      !this._validateInput(parent, app) ||
      !(await this.actor.checkEnoughXP(apCost)) ||
      (await this.alreadyAdded(
        this.actor.system.details.species.value,
        'species',
      ))
    ) {
      parent.find('button.ok i').toggleClass('fa-check fa-spinner fa-spin');
      return;
    }

    let update = {
      'system.details.species.value': this.species.name,
      'system.status.speed.initial': this.species.system.baseValues.speed.value,
      'system.status.soulpower.initial':
        this.species.system.baseValues.soulpower.value,
      'system.status.toughness.initial':
        this.species.system.baseValues.toughness.value,
      'system.status.wounds.initial':
        this.species.system.baseValues.wounds.value,
      'system.status.wounds.value':
        this.species.system.baseValues.wounds.value +
        this.actor.system.characteristics['ko'].value * 2,
    };

    let attributeChoices = [];
    for (let k of parent.find('.exclusive:checked')) {
      attributeChoices.push($(k).val());
    }

    Object.keys(DSA5.characteristics).forEach((k) => {
      update[`system.characteristics.${k}.species`] = 0;
    });

    for (let attr of this.species.system.attributeChange.value
      .split(',')
      .concat(attributeChoices)) {
      if (
        attr.includes(game.i18n.localize('combatskillcountdivider') + ':') ||
        attr == ''
      )
        continue;

      let attrs = attr.trim().split(' ');
      let dataAttr =
        game.dsa5.config.knownShortcuts[attrs[0].toLowerCase().trim()].slice(0);
      dataAttr[dataAttr.length - 1] = 'species';
      update[`system.${dataAttr.join('.')}`] = Number(attrs[1]);
    }

    await this.actor._updateAPs(apCost, {}, { render: false });
    await this.addSelections(parent.find('.optional:checked'), false);
    await this.actor.update(update);

    await this.actor.removeCondition('incapacitated');

    await APTracker.track(
      this.actor,
      { type: 'item', item: this.species, state: 1 },
      apCost,
    );

    this.finalizeUpdate();
  }
}
