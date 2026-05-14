import DSA5 from '../config/config-dsa5.js';
import WizardDSA5 from './dsa5_wizard.js';
import APTracker from '../system/orwell/ap-tracker.js';
const { mergeObject } = foundry.utils;

export default class SpeciesWizard extends WizardDSA5 {
  generatedSpeciesDetails = {};
  selectedGeneratorEntries = {};

  get title() {
    return _loc('WIZARD.addItem', { item: `${_loc('TYPES.Item.species')} ${this.species.name}`, })
  }

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/wizard/add-species-wizard.hbs',
      templates: ['systems/dsa5/templates/system/dsatabs.hbs']
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'generalToChose', label: 'WIZARD.generalTab' },
        { id: 'vantagesToChose', label: 'vantages' }
      ],
      initial: 'description',
    }
  }

  wizardListeners(html) {
    super.wizardListeners(html);
    html.find('.optional').on('change', (ev) => {
      const parent = this._getAPCostContainer(ev.currentTarget);
      const costOf = this._apCostFrom.bind(this);
      let apCost = this._apCostFrom(parent);

      parent.find('.optional:checked').each(function () {
        apCost += costOf(this);
      });
      this._updateAPCost(parent, apCost);
    });

    html.find('.species-generator-choice').on('change', (ev) => {
      this._setSelectedGeneratorEntry(ev.currentTarget.dataset.field, ev.currentTarget.value);
    });

    html.find('.species-generator-roll').on('click', async (ev) => {
      const button = $(ev.currentTarget);
      const { field, entry } = ev.currentTarget.dataset;
      if (!field || !entry || button.prop('disabled')) return;

      button.prop('disabled', true);
      try {
        const results = await this._rollGeneratorEntry(field, entry);
        this._applyGeneratorResults(html, results);

        const result = results[results.length - 1];
        const label = this._generatorLabel(field);
        const formula = result.formula ? this._formatGeneratorFormula(field, result) : '';
        const suffix = result.total != null && formula ? ` (${formula} = ${result.total})` : '';
        ui.notifications.info(`${label} - ${result.display}${suffix}`);
      } catch (error) {
        ui.notifications.warn(error.message);
      } finally {
        button.prop('disabled', false);
      }
    });
  }

  _generatorConfigs() {
    return [
      {
        field: 'furSkinColor',
        label: _loc('Hair_color'),
      },
      {
        field: 'eyeColor',
        label: _loc('Eye_color'),
      },
      {
        field: 'bodyHeight',
        label: _loc('Height'),
        unit: this._generatorUnit('bodyHeight'),
      },
      {
        field: 'weight',
        label: _loc('Weight'),
        unit: this._generatorUnit('weight'),
      },
    ];
  }

  _generatorUnit(field) {
    return this.species?.system?.constructor?.getGeneratorUnit(field) || '';
  }

  _initializeGeneratorState() {
    const previousResults = this.generatedSpeciesDetails || {};
    this.generatedSpeciesDetails = {};
    this.selectedGeneratorEntries ||= {};

    for (const config of this._generatorConfigs()) {
      const entries = this.species?.system?.getGeneratorEntries(config.field) || [];
      this.generatedSpeciesDetails[config.field] = previousResults[config.field] || {};

      if (this.selectedGeneratorEntries[config.field] && !entries.some((entry) => entry.id === this.selectedGeneratorEntries[config.field])) {
        delete this.selectedGeneratorEntries[config.field];
      }

      if (!this.selectedGeneratorEntries[config.field] && entries.length === 1) {
        this._setSelectedGeneratorEntry(config.field, entries[0].id);
      }
    }
  }

  _setSelectedGeneratorEntry(field, entryId = '') {
    if (!field) return;

    if (entryId) {
      this.selectedGeneratorEntries[field] = entryId;
    } else {
      delete this.selectedGeneratorEntries[field];
    }

    for (const [resultId, result] of Object.entries(this.generatedSpeciesDetails[field] || {})) {
      result.selected = resultId === entryId;
    }
  }

  _formatGeneratorPreview(result) {
    if (!result) return '';
    return result.unit ? `${result.value} ${result.unit}` : `${result.value ?? ''}`;
  }

  _formatGeneratorFormula(field, formulaOrState) {
    return this.species.system.constructor.formatGeneratorFormula(field, formulaOrState);
  }

  _storeGeneratedResult(result) {
    if (!result?.field || !result?.entryId) return;

    this.generatedSpeciesDetails[result.field] ||= {};
    this.generatedSpeciesDetails[result.field][result.entryId] = {
      name: result.name,
      value: result.value,
      unit: result.unit || '',
      preview: this._formatGeneratorPreview(result),
      display: result.display,
      selected: this.selectedGeneratorEntries[result.field] === result.entryId,
    };
  }

  _applyGeneratorResults(html, results) {
    for (const result of results) {
      this._storeGeneratedResult(result);
      html.find(`.species-generator-result[data-field="${result.field}"][data-entry="${result.entryId}"]`).val(this._formatGeneratorPreview(result));
    }
  }

  _prepareGeneratorFields() {
    this._initializeGeneratorState();

    return this._generatorConfigs()
      .map((config) => {
        const entries = this.species.system.getGeneratorEntries(config.field);
        return {
          ...config,
          hasMultipleEntries: entries.length > 1,
          entries: entries.map((entry) => ({
            ...entry,
            outcomeDisplay: entry.rollable ? this.species.system.getGeneratorEntryOutcomeDisplay(config.field, entry.id) : '',
            selected: this.selectedGeneratorEntries[config.field] === entry.id,
            resultDisplay: this.generatedSpeciesDetails[config.field]?.[entry.id]?.preview || '',
          })),
        };
      })
      .filter((config) => config.entries.length > 0);
  }

  async _rollGeneratorEntry(field, entryId) {
    if (field !== 'weight') {
      return [await this.species.system.rollNamedGeneratorEntry(field, entryId)];
    }

    const matchingEntry = this.species.system.getWeightBodyHeightEntry(entryId, { rollableOnly: true });
    const storedBodyHeight = matchingEntry ? this.generatedSpeciesDetails.bodyHeight?.[matchingEntry.id] : undefined;
    const { results } = await this.species.system.rollWeightEntryWithDependencies(entryId, {
      ...(storedBodyHeight?.value != null ? { bodyheight: storedBodyHeight.value } : {}),
    });
    return results;
  }

  _generatorLabel(field) {
    switch (field) {
      case 'furSkinColor':
        return _loc('Hair_color');
      case 'eyeColor':
        return _loc('Eye_color');
      case 'bodyHeight':
        return _loc('Height');
      case 'weight':
        return _loc('Weight');
      default:
        return field;
    }
  }

  _resolveAcceptedGeneratorResult(field) {
    const entries = this.species.system.getGeneratorEntries(field);
    if (!entries.length) return null;

    const selectedEntryId = this.selectedGeneratorEntries[field]
      ?? (entries.length === 1 ? entries[0].id : undefined);

    if (!selectedEntryId) {
      return null;
    }

    return this.generatedSpeciesDetails[field]?.[selectedEntryId] || null;
  }

  _applyAcceptedGeneratorResults(update) {
    const furSkinColor = this._resolveAcceptedGeneratorResult('furSkinColor');
    const eyeColor = this._resolveAcceptedGeneratorResult('eyeColor');
    const bodyHeight = this._resolveAcceptedGeneratorResult('bodyHeight');
    const weight = this._resolveAcceptedGeneratorResult('weight');

    if (furSkinColor?.value) {
      update['system.details.haircolor.value'] = furSkinColor.value;
    }
    if (eyeColor?.value) {
      update['system.details.eyecolor.value'] = eyeColor.value;
    }
    if (bodyHeight?.value != null) {
      update['system.details.height.value'] = bodyHeight.preview || `${bodyHeight.value} ${this._generatorUnit('bodyHeight')}`;
    }
    if (weight?.value != null) {
      update['system.details.weight.value'] = weight.preview || `${weight.value} ${this._generatorUnit('weight')}`;
    }
  }

  async _toGroups(input, categories, previous) {
    const groups = await Promise.all(
      input.split('\n').map(async (x) => {
        const vals = x.split(':');
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

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const requirements = await this.parseToItem(this.species.system.requirements.value, ['disadvantage', 'advantage']);
    const missingVantages = requirements.filter((x) => ['advantage', 'disadvantage'].includes(x.type) && !x.disabled);
    const advantagegroups = await this._toGroups(this.species.system.recommendedAdvantages.value, ['advantage'], requirements);
    const disadvantagegroups = await this._toGroups(this.species.system.recommendedDisadvantages.value, ['disadvantage'], requirements);
    const attributeRequirements = this.enrichAttributeRequirements(this._parseAttributes(this.species.system.attributeChange.value));
    const generatorFields = this._prepareGeneratorFields();
    const baseCost = Number(this.species.system.APValue.value);
    const reqCost = requirements.reduce(function (_this, val) {
      return _this + (val.disabled ? 0 : Number(val.system.APValue.value) || 0);
    }, 0);
    mergeObject(data, {
      species: this.species,
      description: _loc('WIZARD.speciesdescr', {
        species: this.species.name,
        cost: baseCost + reqCost,
      }),
      advantagegroups,
      baseCost,
      disadvantagegroups,
      missingVantages,
      attributeRequirements,
      generatorFields,
      hasLocalization: game.i18n.has(`Racedescr.${this.species.name}`),
      anyAttributeRequirements: attributeRequirements.length > 0,
      advantagesToChose: advantagegroups.length > 0,
      missingVantagesToChose: missingVantages.length > 0,
      disadvantagesToChose: disadvantagegroups.length > 0,
      vantagesToChose: advantagegroups.length > 0 || disadvantagegroups.length > 0 || missingVantages.length > 0,
      generatorsToChose: generatorFields.length > 0,
      generalToChose: attributeRequirements.length > 0 || generatorFields.length > 0,
    });
    this.filterTabs(data);
    return data;
  }

  async addSpecies(actor, item) {
    this.actor = actor;
    this.species = item;
    if (typeof this.species?.system?.getGeneratorEntries !== 'function') {
      throw new Error(`Expected a species document for ${item?.name || item?._id || 'unknown species'}.`);
    }
    this.generatedSpeciesDetails = {};
    this.selectedGeneratorEntries = {};
    this._initializeGeneratorState();
  }

  _validateInput(parent, app = this) {
    return super._validateInput(parent, app);
  }

  async updateCharacter(parent, app = this) {
    parent.find('button.ok i').toggleClass('fa-check fa-spinner fa-spin');

    const apCost = Number(parent.find('.apCost').text());
    if (!this._validateInput(parent, app) || !(await this.actor.checkEnoughXP(apCost)) || (await this.alreadyAdded(this.actor.system.details.species.value, 'species'))) {
      parent.find('button.ok i').toggleClass('fa-check fa-spinner fa-spin');
      return false;
    }

    const update = {
      'system.details.species.value': this.species.name,
      'system.status.speed.initial': this.species.system.baseValues.speed.value,
      'system.status.soulpower.initial': this.species.system.baseValues.soulpower.value,
      'system.status.toughness.initial': this.species.system.baseValues.toughness.value,
      'system.status.wounds.initial': this.species.system.baseValues.wounds.value,
      'system.status.wounds.value': this.species.system.baseValues.wounds.value + this.actor.system.characteristics['ko'].value * 2,
    };

    const attributeChoices = [];
    for (const k of parent.find('.exclusive:checked')) {
      attributeChoices.push($(k).val());
    }

    Object.keys(DSA5.characteristics).forEach((k) => {
      update[`system.characteristics.${k}.species`] = 0;
    });

    for (const attr of this.species.system.attributeChange.value.split(',').concat(attributeChoices)) {
      if (attr.includes(_loc('combatskillcountdivider') + ':') || attr == '') continue;

      const attrs = attr.trim().split(' ');
      const dataAttr = game.dsa5.config.knownShortcuts[attrs[0].toLowerCase().trim()].slice(0);
      dataAttr[dataAttr.length - 1] = 'species';
      update[`system.${dataAttr.join('.')}`] = Number(attrs[1]);
    }

    this._applyAcceptedGeneratorResults(update);

    await this.actor._updateAPs(apCost, {}, { render: false });
    await this.addSelections(parent.find('.optional:checked'), false);
    await this.actor.update(update);

    await this.actor.removeCondition('incapacitated');

    await APTracker.track(this.actor, { type: 'item', item: this.species, state: 1 }, apCost);

    this.finalizeUpdate();
    return true;
  }

  enrichAttributeRequirements(attributeRequirements) {
    return attributeRequirements.map((ar) => {
      if (ar.choices) {
        ar.choices = ar.choices.map((c) => {
          const split = c.split(' ');
          const shortcutArr = game.dsa5.config.knownShortcuts[split[0]?.toLowerCase().trim()];
          const localizedAttr = Array.isArray(shortcutArr) && shortcutArr.length > 1 ? shortcutArr.slice(0)[1] : undefined;

          return {
            name: c,
            label: localizedAttr ? _loc(`CHAR.${localizedAttr.toUpperCase()}`) + ' ' + split[1] : c,
          };
        });
      }
      return ar;
    });
  }
}
