import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import APValueTemplate from './templates/apvalue.js';
import RequirementsTemplate from './templates/requirements.js';
import DSAStringField from '../fields/dsa_string_field.js';
import SpeciesRollFormulaField from '../fields/species_roll_formula_field.js';
import SpeciesRollTableField from '../fields/species_roll_table_field.js';

const { SchemaField, StringField, NumberField, TypedObjectField } = foundry.data.fields;

function speciesRollTableEntryField() {
  return new SchemaField({
    name: new StringField({ initial: '', label: 'name' }),
    value: new SpeciesRollTableField({ initial: '', label: 'value' }),
  });
}

function speciesRollFormulaEntryField() {
  return new SchemaField({
    name: new StringField({ initial: '', label: 'name' }),
    value: new SpeciesRollFormulaField({ initial: '', label: 'value' }),
  });
}

export default class SpeciesData extends ItemDataModel.mixin(DescriptionTemplate, APValueTemplate, RequirementsTemplate) {
  static GENERATOR_FIELDS = Object.freeze({
    furSkinColor: 'table',
    eyeColor: 'table',
    bodyHeight: 'formula',
    weight: 'formula',
  });

  static getGeneratorLabel(field) {
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

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      recommendedAdvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedAdvantages' }),
      }),
      recommendedDisadvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedDisadvantages' }),
      }),
      notsuitableAdvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableAdvantages' }),
      }),
      notsuitableDisadvantages: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'notsuitableDisadvantages' }),
      }),
      recommendedCultures: new SchemaField({
        value: new DSAStringField({ initial: '', label: 'recommendedCultures' }),
      }),
      attributeChange: new SchemaField({
        value: new StringField({ initial: '', label: 'attributeChange' }),
      }),
      baseValues: new SchemaField({
        wounds: new SchemaField({
          value: new NumberField({ initial: 0, label: 'wounds' }),
        }),
        soulpower: new SchemaField({
          value: new NumberField({ initial: 0, label: 'soulpower' }),
        }),
        toughness: new SchemaField({
          value: new NumberField({ initial: 0, label: 'toughness' }),
        }),
        speed: new SchemaField({
          value: new NumberField({ initial: 0, label: 'speed' }),
        }),
      }),

      // Generator entry value format:
      // - Formula entries store one roll formula, for example: `168 + 2d20`
      // - Table entries store one formula on the first line and `range=result` rows below it
      // - Entry names are optional; blank names resolve to the parent species name
      generators: new SchemaField({
        furSkinColor: new TypedObjectField(speciesRollTableEntryField()),
        eyeColor: new TypedObjectField(speciesRollTableEntryField()),
        bodyHeight: new TypedObjectField(speciesRollFormulaEntryField()),
        weight: new TypedObjectField(speciesRollFormulaEntryField()),
      }),
    });
  }

  static #compactGeneratorDefinition(field, entry) {
    const state = field ? this.prototype.getGeneratorEntryParseState.call({
      constructor: this,
      generators: { [field]: { [entry.id]: entry.entry } },
      parent: { name: entry.name },
    }, field, entry.id, entry.name, entry.entry) : null;

    if (!state?.valid) {
      return `${entry.name}: ${state?.error || entry.value || '-'}`;
    }

    const formula = this.formatGeneratorFormula(field, state);

    if (this.GENERATOR_FIELDS[field] === 'table') {
      return `${entry.name}: ${formula} + ${state.rows.length} rows`;
    }

    return `${entry.name}: ${formula}`;
  }

  static chatData(data, name) {
    const generatorLines = [];
    const context = {
      constructor: this,
      generators: data.generators,
      parent: { name },
      getGeneratorEntries: this.prototype.getGeneratorEntries,
      getGeneratorEntryParseState: this.prototype.getGeneratorEntryParseState,
    };

    for (const [field] of Object.entries(this.GENERATOR_FIELDS)) {
      const entries = this.prototype.getGeneratorEntries.call(context, field, name);
      if (!entries.length) continue;

      generatorLines.push({
        key: field === 'furSkinColor' ? 'Hair_color' : field === 'eyeColor' ? 'Eye_color' : field === 'bodyHeight' ? 'Height' : 'Weight',
        val: entries.map((entry) => this.#compactGeneratorDefinition(field, entry)).join('; '),
      });
    }

    return generatorLines;
  }

  static normalizeGeneratorEntryName(entryName = '', parentName = '') {
    const normalizedName = String(entryName ?? '').trim();
    return normalizedName || String(parentName ?? '').trim();
  }

  static parseRollFormulaDefinition(rawValue) {
    const formula = String(rawValue ?? '').trim();

    if (!formula) {
      return {
        valid: false,
        reason: 'empty',
        error: _loc('SPECIES_GENERATOR.emptyEntry'),
      };
    }

    if (!Roll.validate(formula)) {
      return {
        valid: false,
        reason: 'invalidFormula',
        error: _loc('SPECIES_GENERATOR.invalidFormula'),
        formula,
      };
    }

    return {
      valid: true,
      formula,
    };
  }

  static parseRollTableDefinition(rawValue) {
    const lines = String(rawValue ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return {
        valid: false,
        reason: 'empty',
        error: _loc('SPECIES_GENERATOR.emptyEntry'),
      };
    }

    const [formula, ...rowLines] = lines;
    if (!Roll.validate(formula)) {
      return {
        valid: false,
        reason: 'invalidFormula',
        error: _loc('SPECIES_GENERATOR.invalidTableFormula'),
        formula,
      };
    }

    if (!rowLines.length) {
      return {
        valid: false,
        reason: 'missingRows',
        error: _loc('SPECIES_GENERATOR.missingRows'),
        formula,
      };
    }

    const rows = [];
    for (const line of rowLines) {
      const match = line.match(/^(\d+)(?:\s*-\s*(\d+))?\s*=\s*(.+)$/);
      if (!match) {
        return {
          valid: false,
          reason: 'invalidRow',
          error: _loc('SPECIES_GENERATOR.invalidRow', { line }),
          formula,
        };
      }

      const min = Number(match[1]);
      const max = match[2] ? Number(match[2]) : min;
      const result = match[3].trim();

      if (!result) {
        return {
          valid: false,
          reason: 'emptyResult',
          error: _loc('SPECIES_GENERATOR.missingResult', { line }),
          formula,
        };
      }

      if (Number.isNaN(min) || Number.isNaN(max) || max < min) {
        return {
          valid: false,
          reason: 'invalidRange',
          error: _loc('SPECIES_GENERATOR.invalidRange', { line }),
          formula,
        };
      }

      rows.push({
        min,
        max,
        result,
      });
    }

    return {
      valid: true,
      formula,
      rows,
    };
  }

  static getGeneratorUnit(field) {
    switch (field) {
      case 'bodyHeight':
        return _loc('Halbfinger');
      case 'weight':
        return _loc('stone');
      default:
        return '';
    }
  }

  static formatGeneratorFormula(field, formulaOrState) {
    const state = typeof formulaOrState === 'string' ? { formula: formulaOrState } : formulaOrState;
    if (!state?.formula) {
      return '';
    }

    const bodyHeightLabel = this.getGeneratorLabel('bodyHeight');
    const bodyHeightUnit = this.getGeneratorUnit('bodyHeight');
    const bodyHeightDisplay = bodyHeightUnit ? `${bodyHeightLabel} (${bodyHeightUnit})` : bodyHeightLabel;

    let formula = String(state.formula)
      .replaceAll('@bodyheight', bodyHeightDisplay);

    const unit = this.getGeneratorUnit(field);
    if (unit) {
      formula = `${formula} (${unit})`;
    }

    return formula;
  }

  static formatGeneratorOutcomeRange(min, max, unit = '') {
    if (min == null || max == null) {
      return '';
    }

    const suffix = unit ? ` ${unit}` : '';
    if (min === max) {
      return `${min}${suffix}`;
    }

    return `${min} - ${max}${suffix}`;
  }

  static getGeneratorTableOutcomes(rows = []) {
    return [...new Set(rows.map((row) => row.result).filter(Boolean))].join(', ');
  }

  static getFormulaOutcomeBounds(formula, contexts = [{}]) {
    const bounds = contexts
      .filter((context) => context)
      .map((context) => {
        const minRoll = new Roll(formula, context).evaluateSync({ minimize: true });
        const maxRoll = new Roll(formula, context).evaluateSync({ maximize: true });
        return {
          min: minRoll.total,
          max: maxRoll.total,
        };
      })
      .filter(({ min, max }) => Number.isFinite(min) && Number.isFinite(max));

    if (!bounds.length) {
      return null;
    }

    return {
      min: Math.min(...bounds.map((entry) => entry.min)),
      max: Math.max(...bounds.map((entry) => entry.max)),
    };
  }

  async addGeneratorEntry(field, { name = '', value = '' } = {}) {
    if (!this.constructor.GENERATOR_FIELDS[field]) {
      throw new Error(`Unknown generator field: ${field}`);
    }

    const id = foundry.utils.randomID();
    await this.parent.update({
      [`system.generators.${field}.${id}`]: {
        name,
        value,
      },
    });
    return id;
  }

  async removeGeneratorEntry(field, id) {
    if (!this.constructor.GENERATOR_FIELDS[field] || !id) {
      return;
    }

    await this.parent.update({ [`system.generators.${field}.${id}`]: _del });
  }

  getGeneratorEntries(collectionOrField, parentName = this.parent?.name ?? '') {
    const field = typeof collectionOrField === 'string' ? collectionOrField : undefined;
    const collection = field ? this.generators?.[field] : collectionOrField;

    return Object.entries(collection || {}).map(([id, entry]) => ({
      id,
      key: id,
      field,
      name: this.constructor.normalizeGeneratorEntryName(entry?.name, parentName),
      value: String(entry?.value ?? ''),
      rawName: String(entry?.name ?? ''),
      entry,
      ...(field ? this.getGeneratorEntryParseState(field, id, parentName, entry) : {}),
    }));
  }

  getGeneratorEntryParseState(field, entryId, parentName = this.parent?.name ?? '', providedEntry = undefined) {
    const generatorType = this.constructor.GENERATOR_FIELDS[field];
    if (!generatorType) {
      return {
        valid: false,
        rollable: false,
        reason: 'unknownField',
        error: `Unknown generator field: ${field}`,
      };
    }

    const entry = providedEntry ?? this.generators?.[field]?.[entryId];
    if (!entry) {
      return {
        valid: false,
        rollable: false,
        reason: 'missingEntry',
        error: `Unknown generator entry: ${entryId}`,
      };
    }

    const name = this.constructor.normalizeGeneratorEntryName(entry.name, parentName);
    const rawValue = String(entry.value ?? '').trim();
    if (!rawValue) {
      return {
        valid: false,
        rollable: false,
        reason: 'empty',
        error: _loc('SPECIES_GENERATOR.emptyEntry'),
        name,
      };
    }

    const parsed = generatorType === 'table'
      ? this.constructor.parseRollTableDefinition(rawValue)
      : this.constructor.parseRollFormulaDefinition(rawValue);

    return {
      ...parsed,
      rollable: !!parsed.valid,
      name,
    };
  }

  getGeneratorEntryOutcomeBounds(field, entryId, parentName = this.parent?.name ?? '', providedEntry = undefined) {
    const state = this.getGeneratorEntryParseState(field, entryId, parentName, providedEntry);
    if (!state.valid || this.constructor.GENERATOR_FIELDS[field] !== 'formula') {
      return null;
    }

    if (field === 'weight' && state.formula?.includes('@bodyheight')) {
      const bodyHeightEntry = this.getMatchingGeneratorEntry('bodyHeight', state.name, { rollableOnly: true });
      const bodyHeightBounds = bodyHeightEntry ? this.getGeneratorEntryOutcomeBounds('bodyHeight', bodyHeightEntry.id) : null;
      if (!bodyHeightBounds) {
        return null;
      }

      return this.constructor.getFormulaOutcomeBounds(state.formula, [
        { bodyheight: bodyHeightBounds.min },
        { bodyheight: bodyHeightBounds.max },
      ]);
    }

    return this.constructor.getFormulaOutcomeBounds(state.formula);
  }

  getGeneratorEntryOutcomeDisplay(field, entryId, parentName = this.parent?.name ?? '', providedEntry = undefined) {
    const state = this.getGeneratorEntryParseState(field, entryId, parentName, providedEntry);
    if (!state.valid) {
      return '';
    }

    if (this.constructor.GENERATOR_FIELDS[field] === 'table') {
      return this.constructor.getGeneratorTableOutcomes(state.rows);
    }

    const bounds = this.getGeneratorEntryOutcomeBounds(field, entryId, parentName, providedEntry);
    if (!bounds) {
      return '';
    }

    return this.constructor.formatGeneratorOutcomeRange(bounds.min, bounds.max, this.constructor.getGeneratorUnit(field));
  }

  async rollRollTableDefinition(rawValue, rollData = {}) {
    const parsed = this.constructor.parseRollTableDefinition(rawValue);
    if (!parsed.valid) {
      throw new Error(parsed.error);
    }

    const roll = await new Roll(parsed.formula, rollData).evaluate();
    const row = parsed.rows.find((entry) => roll.total >= entry.min && roll.total <= entry.max);

    if (!row) {
      throw new Error(_loc('SPECIES_GENERATOR.rollNoResult'));
    }

    return {
      formula: parsed.formula,
      total: roll.total,
      result: row.result,
      row,
      roll,
    };
  }

  async rollNamedGeneratorEntry(field, entryId, context = {}) {
    const state = this.getGeneratorEntryParseState(field, entryId);
    if (!state.rollable) {
      throw new Error(state.error);
    }

    if (this.constructor.GENERATOR_FIELDS[field] === 'table') {
      const rolled = await this.rollRollTableDefinition(this.generators[field][entryId].value, context);
      return {
        field,
        entryId,
        name: state.name,
        value: rolled.result,
        display: `${state.name}: ${rolled.result}`,
        total: rolled.total,
        formula: rolled.formula,
        roll: rolled.roll,
        row: rolled.row,
      };
    }

    const roll = await new Roll(state.formula, context).evaluate();
    const unit = this.constructor.getGeneratorUnit(field);
    return {
      field,
      entryId,
      name: state.name,
      value: roll.total,
      unit,
      display: `${state.name}: ${roll.total}${unit ? ` ${unit}` : ''}`,
      total: roll.total,
      formula: state.formula,
      roll,
    };
  }

  getMatchingGeneratorEntry(field, entryName, { rollableOnly = false } = {}) {
    const entries = this.getGeneratorEntries(field).filter((entry) => !rollableOnly || entry.rollable);
    return entries.find((entry) => entry.name === entryName)
      ?? (entries.length === 1 ? entries[0] : undefined);
  }

  getWeightBodyHeightEntry(entryId, { rollableOnly = true } = {}) {
    const weightState = this.getGeneratorEntryParseState('weight', entryId);
    if (!weightState.rollable) {
      throw new Error(weightState.error);
    }

    return this.getMatchingGeneratorEntry('bodyHeight', weightState.name, { rollableOnly });
  }

  async rollWeightEntryWithDependencies(entryId, context = {}) {
    const weightState = this.getGeneratorEntryParseState('weight', entryId);
    if (!weightState.rollable) {
      throw new Error(weightState.error);
    }

    const needsBodyHeight = weightState.formula?.includes('@bodyheight');
    if (!needsBodyHeight || context.bodyheight != null) {
      const result = await this.rollNamedGeneratorEntry('weight', entryId, context);
      return {
        result,
        results: [result],
      };
    }

    const matchingEntry = this.getWeightBodyHeightEntry(entryId, { rollableOnly: true });
    if (!matchingEntry) {
      throw new Error(_loc('SPECIES_GENERATOR.missingBodyHeight', { name: weightState.name || _loc('Height') }));
    }

    const bodyHeightResult = await this.rollNamedGeneratorEntry('bodyHeight', matchingEntry.id, context);
    const result = await this.rollNamedGeneratorEntry('weight', entryId, {
      ...context,
      bodyheight: bodyHeightResult.value,
    });

    return {
      result,
      bodyHeightResult,
      results: [bodyHeightResult, result],
    };
  }

  async rollBodyHeight(entryId, context = {}) {
    return await this.rollGenerator('bodyHeight', { entryId, ...context });
  }

  async rollWeight(entryId, bodyHeight, context = {}) {
    const rollData = { ...context };
    if (bodyHeight != null && rollData.bodyheight == null) {
      rollData.bodyheight = bodyHeight;
    }
    const { result } = await this.rollWeightEntryWithDependencies(entryId, rollData);
    return result;
  }

  async rollGenerator(field, context = {}) {
    const entries = this.getGeneratorEntries(field);
    if (!entries.length) {
      throw new Error(`No generator entries configured for ${field}.`);
    }

    const { entryId, entryName, bodyheight, ...rollData } = context;
    const resolvedEntryId = entryId
      ?? entries.find((entry) => entry.name === entryName)?.id
      ?? (entries.length === 1 ? entries[0].id : undefined);

    if (!resolvedEntryId) {
      throw new Error(`Multiple generator entries configured for ${field}. Provide entryId or entryName.`);
    }

    if (field === 'weight') {
      return await this.rollWeight(resolvedEntryId, bodyheight, rollData);
    }

    return await this.rollNamedGeneratorEntry(field, resolvedEntryId, rollData);
  }

  async getSheetData(data) {
    data.hasLocalization = game.i18n.has(`Racedescr.${data.document.name}`);
  }
}
