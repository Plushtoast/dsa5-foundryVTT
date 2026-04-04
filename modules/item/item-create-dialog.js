import { DefaultAppv2 } from '../actor/baseapp.js';
import { ITEM_CONSTANTS } from '../config/item-constants.js';

const { deepClone, getProperty, mergeObject, setProperty } = foundry.utils;

export class ItemCreateDialog extends DefaultAppv2 {
  #resolve;
  #search;
  #completed = false;
  #docParent;
  #docPack;

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'item-create-dialog'],
    position: {
      width: 400,
      height: 640,
    },
    window: {
      title: 'DOCUMENT.Create',
      resizable: true,
    },
  };

  static PARTS = {
    content: {
      template: 'systems/dsa5/templates/items/document-create.hbs',
    },
  };

  static async wait(documentClass, data = {}, createOptions = {}, dialogOptions = {}, renderOptions = {}) {
    const { createOptions: normalizedCreateOptions, dialogOptions: normalizedDialogOptions } = this.#normalizeOptions(createOptions, dialogOptions);

    return await new Promise((resolve) => {
      new this(documentClass, data, normalizedCreateOptions, normalizedDialogOptions, resolve, renderOptions).render(true);
    });
  }

  static #normalizeOptions(createOptions = {}, dialogOptions = {}) {
    const normalizedCreateOptions = deepClone(createOptions);
    const normalizedDialogOptions = deepClone(dialogOptions);
    const applicationOptions = {
      top: 'position', left: 'position', width: 'position', height: 'position', scale: 'position', zIndex: 'position',
      title: 'window', id: '', classes: '', jQuery: '',
    };

    for (const [key, value] of Object.entries(normalizedCreateOptions)) {
      if (!(key in applicationOptions)) continue;

      foundry.utils.logCompatibilityWarning('The ClientDocument.createDialog signature has changed. '
        + 'It now accepts database operation options in its second parameter, '
        + 'and options for DialogV2.prompt in its third parameter.', { since: 13, until: 15, once: true });

      const dialogPath = applicationOptions[key];
      if (dialogPath) setProperty(normalizedDialogOptions, `${dialogPath}.${key}`, value);
      else normalizedDialogOptions[key] = value;
      delete normalizedCreateOptions[key];
    }

    if (typeof normalizedDialogOptions.classes === 'string') {
      normalizedDialogOptions.classes = normalizedDialogOptions.classes.split(/\s+/).filter(Boolean);
    }

    return {
      createOptions: normalizedCreateOptions,
      dialogOptions: normalizedDialogOptions,
    };
  }

  constructor(documentClass, data, createOptions, dialogOptions, resolve, renderOptions = {}) {
    super(dialogOptions);

    this.documentClass = documentClass;
    this.cls = documentClass.implementation;
    this.data = deepClone(data ?? {});
    this.createOptions = createOptions ?? {};
    this.renderOptions = renderOptions;
    this.dialogContext = dialogOptions?.context ?? {};
    this.constructor.PARTS.content.template = dialogOptions?.template ?? 'systems/dsa5/templates/items/document-create.hbs';
    this.template = dialogOptions?.template ?? 'systems/dsa5/templates/items/document-create.hbs';
    this.#resolve = resolve;

    const { parent, pack } = this.createOptions;
    this.#docParent = parent;
    this.#docPack = pack;

    this.documentTypes = this.#buildDocumentTypes(dialogOptions?.types);
    this.hasTypes = this.documentTypes.length > 0;
    this.defaultType = this.#resolveDefaultType();
    this.selectedType = this.#resolveSelectedType();
    this.folders = this.#resolveFolders(dialogOptions?.folders);
    this.hasFolders = this.folders.length >= 1;
    this.label = _loc(this.documentClass.metadata.label);    

    this.options.window.title = this.title;
    if (dialogOptions?.position) {
      mergeObject(this.options.position, dialogOptions.position);
    }
  }

  get title() {
    return _loc('DOCUMENT.Create', { type: this.label });
  }

  #buildDocumentTypes(restrictedTypes) {
    const documentTypes = [];
    if (this.documentClass.TYPES.length <= 1) return documentTypes;
    if (restrictedTypes?.length === 0) throw new Error('The array of sub-types to restrict to must not be empty');

    for (const type of this.documentClass.TYPES) {
      if (type === CONST.BASE_DOCUMENT_TYPE) continue;
      if (restrictedTypes && !restrictedTypes.includes(type)) continue;

      const labelKey = CONFIG[this.documentClass.documentName]?.typeLabels?.[type];
      const label = labelKey && game.i18n.has(labelKey) ? _loc(labelKey) : type;
      const englishLabel = labelKey ? getProperty(game.i18n?._fallback, labelKey) : null;
      documentTypes.push({
        value: type,
        label,
        img: ITEM_CONSTANTS.DEFAULT_IMAGES[type],
        searchText: [label, englishLabel, type].filter(Boolean).join(' '),
      });
    }

    if (!documentTypes.length) throw new Error('No document types were permitted to be created');
    documentTypes.sort((left, right) => left.label.localeCompare(right.label, game.i18n.lang));
    return documentTypes;
  }

  #resolveDefaultType() {
    const configuredDefault = CONFIG[this.documentClass.documentName]?.defaultType;
    if (this.documentTypes.some((entry) => entry.value === configuredDefault)) {
      return configuredDefault;
    }

    return this.documentTypes[0]?.value;
  }

  #resolveSelectedType() {
    const selectedType = this.data.type || this.defaultType;
    if (!this.hasTypes) return selectedType;
    if (this.documentTypes.some((entry) => entry.value === selectedType)) return selectedType;
    return this.defaultType;
  }

  #resolveFolders(folders) {
    if (folders) return folders;
    if (this.#docParent) return [];

    const collection = this.#docPack
      ? game.packs.get(this.#docPack)
      : game.collections.get(this.documentClass.documentName);

    return collection?._formatFolderSelectOptions() ?? [];
  }

  #defaultName(type = this.selectedType) {
    return this.cls.defaultName({ type, parent: this.#docParent, pack: this.#docPack });
  }

  async _prepareContext(options) {
    const data = await super._prepareContext(options);

    return mergeObject(data, {
      title: this.title,
      hasTypes: this.hasTypes,
      hasFolders: this.hasFolders,
      folders: this.folders,
      folder: this.data.folder,
      name: this.data.name || '',
      defaultName: this.#defaultName(),
      type: this.selectedType,
      types: this.documentTypes.map((entry) => ({
        ...entry,
        selected: entry.value === this.selectedType,
      })),
      searchPlaceholder: _loc('Book.search'),
      ...this.dialogContext,
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const form = this.element.querySelector('#document-create');
    form?.addEventListener('submit', (event) => this.#onSubmit(event));
    this.element.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.close());

    if (!this.hasTypes) return;

    this.#search ??= new foundry.applications.ux.SearchFilter({
      inputSelector: 'input[type=search]',
      contentSelector: '.item-create-dialog__type-list',
      callback: this.#onSearchFilter.bind(this),
    });
    this.#search.bind(this.element);

    for (const input of this.element.querySelectorAll('[name="type"]')) {
      input.addEventListener('change', (event) => this.#onTypeChange(event));
    }

    this.#syncSelectedState();
    this.#updateNamePlaceholder();
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#search?.unbind();
  }

  _onClose(options) {
    super._onClose(options);
    if (this.#completed) return;
    this.#completed = true;
    this.#resolve?.(null);
  }

  #onSearchFilter(_event, query, rgx, html) {
    let visible = 0;
    for (const row of html.querySelectorAll('.item-create-dialog__type')) {
      if (!query) {
        row.hidden = false;
        visible += 1;
        continue;
      }

      const searchText = row.dataset.search || '';
      const isMatch = rgx?.test(foundry.applications.ux.SearchFilter.cleanQuery(searchText));
      row.hidden = !isMatch;
      if (isMatch) visible += 1;
    }

    this.element.querySelector('.item-create-dialog__empty')?.toggleAttribute('hidden', visible > 0);
  }

  #onTypeChange(event) {
    this.selectedType = event.currentTarget.value;
    this.#syncSelectedState();
    this.#updateNamePlaceholder();
  }

  #syncSelectedState() {
    for (const row of this.element.querySelectorAll('.item-create-dialog__type')) {
      const input = row.querySelector('input[type="radio"]');
      row.classList.toggle('selected', !!input?.checked);
    }
  }

  #updateNamePlaceholder() {
    const nameInput = this.element.querySelector('[name="name"]');
    if (nameInput) nameInput.placeholder = this.#defaultName();
  }

  async #onSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new foundry.applications.ux.FormDataExtended(form).object;
    const data = mergeObject(deepClone(this.data), formData);
    if (!data.folder) delete data.folder;
    if (!data.name?.trim()) data.name = this.#defaultName(data.type);

    const created = await this.cls.create(data, { renderSheet: false, ...this.createOptions });
    created.sheet.render(true, this.renderOptions);
    this.#completed = true;
    this.#resolve?.(created);
    await this.close();
  }
}