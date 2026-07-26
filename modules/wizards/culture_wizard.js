import WizardDSA5 from './dsa5_wizard.js';
import APTracker from '../system/orwell/ap-tracker.js';
const { mergeObject, duplicate } = foundry.utils;
const { TextEditor } = foundry.applications.ux;

export default class CultureWizard extends WizardDSA5 {
  get title() {
    return _loc('WIZARD.addItem', { item: `${_loc('TYPES.Item.culture')} ${this.culture.name}`, })
  }

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/wizard/add-culture-wizard.hbs',
      templates: ['systems/dsa5/templates/system/dsatabs.hbs']
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description'},
        { id: 'generalToChose', label: 'WIZARD.generalTab'},
        { id: 'vantagesToChose', label: 'vantages'},
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
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const advantages = await this.parseToItem(this.culture.system.recommendedAdvantages.value, ['advantage']);
    const disadvantages = await this.parseToItem(this.culture.system.recommendedDisadvantages.value, ['disadvantage']);
    const writings =
      this.culture.system.writing.value == ''
        ? []
        : await this.parseToItem(
            this.culture.system.writing.value
              .split(',')
              .map((x) => `${_loc('LocalizedIDs.literacy')} (${x.trim()})`)
              .join(', '),
            ['specialability'],
          );
    const languages =
      this.culture.system.language.value == ''
        ? []
        : await this.parseToItem(
            this.culture.system.language.value
              .split(',')
              .map((x) => `${_loc('LocalizedIDs.language')} (${x.trim()}) 3`)
              .join(', '),
            ['specialability'],
          );

    const baseCost = Number(this.culture.system.APValue.value);
    mergeObject(data, {
      culture: this.culture,
      description: _loc('WIZARD.culturedescr', {
        culture: this.culture.name,
        cost: baseCost,
      }),
      advantages,
      disadvantages,
      writings,
      languages,
      advantagesToChose: advantages.length > 0,
      disadvantagesToChose: disadvantages.length > 0,
      writingsToChose: writings.length > 0,
      languagesToChose: languages.length > 0,
      languagesToSelect: languages.length > 1,
      vantagesToChose: advantages.length > 0 || disadvantages.length > 0,
      generalToChose: writings.length > 0 || languages.length > 0,
      enrichedClothing: await TextEditor.enrichHTML(this.culture.system.clothing.value, { secrets: false }),
      enrichedDescription: await TextEditor.enrichHTML(this.culture.system.description.value, { secrets: false }),
    });
    this.filterTabs(data);
    return data;
  }

  async addCulture(actor, item) {
    this.actor = actor;
    this.culture = item;
  }

  _validateInput(parent, app = this) {
    const choice = parent.find('.localKnowledge');
    if (choice.val() == '') {
      this._showInputValidation(choice, parent, app);
      return false;
    }
    const selectOnlyOne = parent.find('.selectOnlyOne');
    if (selectOnlyOne.length) {
      const options = selectOnlyOne.find('.optional:checked');
      if (options.length != 1) {
        this._showInputValidation(selectOnlyOne, parent, app);
        return false;
      }
    }
    return super._validateInput(parent, app);
  }

  async updateCharacter(parent, app = this) {
    parent.find('button.ok i').toggleClass('fa-check fa-spinner fa-spin');

    const apCost = Number(parent.find('.apCost').text());
    if (!this._validateInput(parent, app) || !(await this.actor.checkEnoughXP(apCost)) || (await this.alreadyAdded(this.actor.system.details.culture.value, 'culture'))) {
      parent.find('button.ok i').toggleClass('fa-check fa-spinner fa-spin');
      return false;
    }

    const update = { 'system.details.culture.value': this.culture.name };

    let localKnowledge = await this.findCompendiumItem(`${_loc('LocalizedIDs.localKnowledge')} ()`, ['specialability']);
    if (localKnowledge) {
      localKnowledge = duplicate(localKnowledge);
      localKnowledge.name = `${_loc('LocalizedIDs.localKnowledge')} (${parent.find('.localKnowledge').val()})`;
      localKnowledge.system.APValue.value = 0;
      await this.actor.createEmbeddedDocuments('Item', [localKnowledge], {
        render: false,
      });
    }

    await this.addSelections(parent.find('.optional:checked'), false);
    await this.actor._updateAPs(apCost, {}, { render: false });
    await this.updateSkill(this.culture.system.skills.value.split(','), 'skill');
    await this.actor.update(update);

    await APTracker.track(this.actor, { type: 'item', item: this.culture, state: 1 }, apCost);

    this.finalizeUpdate();
    return true;
  }
}
