const { NumberField, SchemaField } = foundry.data.fields;

/** Optional day/month/year part: empty stays `null`, never `Number(null) === 0`. */
class OptionalDatePartField extends NumberField {
  /** @override */
  _cast(value) {
    if (value === null || value === undefined || value === '') return null;
    return super._cast(value);
  }
}

/**
 * Quest-style calendar date: each of day, month, and year may be omitted.
 * Assigning `{ month: 0 }` must persist as Praios with `year: null`, not year 0.
 */
export default class PartialCalendarDateField extends SchemaField {
  static emptyValue() {
    return { dayOfMonth: null, month: null, year: null };
  }

  constructor(options = {}, context = {}) {
    const part = (extra = {}) => new OptionalDatePartField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
      ...extra,
    });

    super({
      dayOfMonth: part({ min: 1, step: 1 }),
      month: part({ min: 0, step: 1 }),
      year: part({ step: 1 }),
    }, { initial: PartialCalendarDateField.emptyValue, ...options }, context);
  }

  /** @override */
  _cast(value) {
    return this.#withOmittedPartsNull(super._cast(value));
  }

  /** @override */
  _cleanType(data, options, _state) {
    return this.#withOmittedPartsNull(super._cleanType(data, options, _state));
  }

  /** @override */
  initialize(value, model, options = {}) {
    if (!value) return super.initialize(value, model, options);
    return super.initialize(this.#withOmittedPartsNull(value), model, options);
  }

  #withOmittedPartsNull(data) {
    if (!data || typeof data !== 'object') return data;
    const next = { ...data };
    for (const key of ['dayOfMonth', 'month', 'year']) {
      if (!(key in next) || next[key] === undefined) next[key] = null;
    }
    return next;
  }
}
