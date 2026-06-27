import { DefaultAppv2 } from '../actor/baseapp.js';
import { bindImgToCanvasDragStart } from '../hooks/imgTileDrop.js';
import { increaseFontSize } from '../hooks/journal.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import DSA5 from '../config/config-dsa5.js';
import { slist } from '../system/helpers/view_helper.js';
import { DragMixin } from '../actor/mixins/drag_mixin.js';
import CustomBookDialog from './custom_book_dialog.js';
import { bookLibraryPartTemplates } from '../actor/template-configs.js';
import FlexSearch from '../../libs/flexsearch.bundle.module.min.js';

const { mergeObject, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class BookWizard extends DragMixin(DefaultAppv2) {
  static wizard;
  static RECENT_BOOKS_MAX = 5;

  #bookSearch;
  #bookCoverCache = new Map();
  #bookLibraryHoverCleanup;
  #previewRequest = 0;
  #hoverShowTimer;
  #hoverHideTimer;
  #activePreviewKey;

  constructor(app) {
    super(app);
    this.adventures = [];
    this.books = [];
    this.rshs = [];
    this.manuals = [];
    this.customBooks = [];
    this.fulltextsearch = true;
    this.libraryViewMode = game.settings.get('dsa5', 'journalBrowserViewMode') || 'list';
  }

  static _toggleVisibility(ev, target) {
    const id = target.dataset.itemid;
    const type = target.dataset.type;
    const toggle = $(target).find('i').hasClass('fa-toggle-off');
    this.toggleBookVisibility(id, type, toggle);
  }

  static _showMapNote(ev, target) {
    game.journal.get(target.dataset.entryId).panToNote();
  }

  static _loadBook(ev, target) {
    const entry = target.closest('.book-entry');
    const id = entry?.dataset.bookId || target.textContent?.trim();
    const type = target.dataset.type || entry?.dataset.bookType;
    this.loadBook(id, $(this.element), type);
  }

  static async _selectLibraryView(ev, target) {
    const view = target.dataset.view;
    if (!view || view === this.libraryViewMode) return;
    this.libraryViewMode = view;
    await game.settings.set('dsa5', 'journalBrowserViewMode', view);
    const html = $(this.element);
    this._saveScrollPositions(html);
    await this.loadPage(html);
  }

  static _pinJournal(ev, target) {
    const parent = $(target).closest('h1');
    const id = parent.attr('data-uuid');
    const name = parent.text();
    this.pinJournal(id, name);
  }

  static _showJournal(ev, target) {
    this.popJournal($(target).closest('h1').attr('data-uuid'));
  }

  static _tocCollapser(ev, target) {
    $(target).find('i').toggleClass('fa-chevron-right fa-chevron-left');
    $(this.element).find('.tocCollapsing').toggleClass('expanded');
  }

  static _fulltextsearch(ev, target) {
    this.fulltextsearch = !this.fulltextsearch;
    target.classList.toggle('on', this.fulltextsearch);
    target.classList.toggle('active', this.fulltextsearch);
    target.setAttribute('aria-pressed', this.fulltextsearch ? 'true' : 'false');
    const icon = target.querySelector('i');
    icon?.classList.toggle('fa-toggle-on', this.fulltextsearch);
    icon?.classList.toggle('fa-toggle-off', !this.fulltextsearch);
    this.filterToc(this.element.querySelector('.filterJournals').value);
  }

  static async _openPin(ev, target) {
    const uuid = target.dataset.uuid;

    if (ev.button == 0) this.showJournal(await fromUuid(uuid));
    else if (ev.button == 2) this.unpinJournal(uuid);
  }

  static _getChapter(ev, target) {
    this.#getChapter($(target).closest('.tocList').attr('data-type'), target.dataset.id);
  }

  #getChapter(selectedType, selectedChapter) {
    this.selectedType = selectedType;
    this.selectedChapter = selectedChapter;
    this.content = undefined;
    this.pageTocs = undefined;
    this.selectedSubChapter = undefined;
    this.loadPage($(this.element));
  }

  static async _subChapter(ev, target) {
    const name = target.textContent;
    const jid = target.dataset.jid;
    const html = $(this.element);
    if (jid) {
      if (this.selectedSubChapter == jid) {
        html.find('h1.journalHeader')[0].scrollIntoView({
          behavior: 'smooth',
        });
      } else {
        await this.loadJournalById(jid);
      }
    } else {
      html.find('.subChapter').removeClass('selected');
      html.find(`[data-id="${name}"]`).addClass('selected');
      await this.loadJournal(name);
    }

    this._saveScrollPositions(html);
    html.find('.tocList').html(await this.getToc());
    this._restoreScrollPositions(html);

    if (this.searchString) this.filterToc(this.searchString);
  }

  static async _increaseFontSize(ev, target) {
    await increaseFontSize($(this.element).find('.chapter'), 'journalFontSizeIndex', target);
  }

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'largeDialog', 'noscrollWizard', 'bookWizardsheet'],
    actions: {
      increaseFontSize: this._increaseFontSize,
      library: function () {
        this._showBooks();
      },
      toggleVisibility: this._toggleVisibility,
      showMapNote: this._showMapNote,
      loadBook: this._loadBook,
      importBook: this._importBook,
      activateScene: this._showSzene,
      pinJournal: this._pinJournal,
      showJournal: this._showJournal,
      tocCollapser: this._tocCollapser,
      fulltextsearch: this._fulltextsearch,
      openPin: { handler: this._openPin, buttons: [0, 2] },
      movePage: this._movePage,
      getChapter: this._getChapter,
      subChapter: this._subChapter,
      selectLibraryView: this._selectLibraryView,
      addCustomBook: this._addCustomBook,
      removeCustomBook: this._removeCustomBook,
    },
    window: {
      title: 'Book.Wizard',
      resizable: true,
      controls: [
        {
          action: 'increaseFontSize',
          label: 'SHEET.increaseFontSize',
          icon: 'fas fa-arrows-up-down',
        },
      ],
    },
    majorButtons: [
      {
        action: 'library',
        label: 'Book.home',
        icon: 'fas fa-book',
      },
    ],
    position: {
      width: 980,
      height: 860,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/wizard/adventure/adventure_wizard.hbs',
    },
  };

  static initHook() {
    foundry.applications.handlebars.loadTemplates(bookLibraryPartTemplates);

    BookWizard.wizard = new BookWizard();

    game.dsa5.apps.journalBrowser = BookWizard.wizard;

    Hooks.once('ready', () => BookWizard.wizard.loadCustomBooks());

    Hooks.on('renderJournalDirectory', (app, html) => {
      html = $(html);
      const div = $('<div class="header-actions action-buttons flexrow"></div>');
      const button = $(`<button id="openJournalBrowser"><i class="fa fa-book"></i>${_loc('Book.Wizard')}</button>`);
      button.on('click', () => {
        BookWizard.wizard.render(true);
      });
      div.append(button);
      html.find('.header-actions:first-child').after(div);
    });
  }

  static #customBooksSettingKey = 'journalBrowserCustomBooks';

  readCustomBooksSetting() {
    return game.settings.get('dsa5', BookWizard.#customBooksSettingKey) || [];
  }

  loadCustomBooks() {
    this.customBooks = this.readCustomBooksSetting().map((entry) => ({
      id: entry.id,
      title: entry.title,
      journal: entry.journal,
      splash: entry.splash,
      moduleName: entry.moduleName || entry.title,
    }));
  }

  static async _addCustomBook() {
    if (!game.user.isGM) return;

    const entry = await CustomBookDialog.prompt({
      existingJournals: this.readCustomBooksSetting().map((book) => book.journal),
    });
    if (!entry) return;

    const books = this.readCustomBooksSetting();
    books.push(entry);
    await game.settings.set('dsa5', BookWizard.#customBooksSettingKey, books);
    this.loadCustomBooks();
    ui.notifications.info('Book.customBookAdded', { localize: true });
    await this.loadPage($(this.element));
  }

  static async _removeCustomBook(_ev, target) {
    if (!game.user.isGM) return;

    const id = target.dataset.itemid;
    const book = this.customBooks.find((x) => x.id === id);
    if (!book) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Book.removeCustomBook' },
      content: `<p>${_loc('Book.removeCustomBookConfirm', { title: book.title })}</p>`,
    });
    if (!confirmed) return;

    const books = this.readCustomBooksSetting().filter((entry) => entry.id !== id);
    await game.settings.set('dsa5', BookWizard.#customBooksSettingKey, books);

    const permissions = game.settings.get('dsa5', 'expansionPermissions');
    if (permissions[id] !== undefined) {
      delete permissions[id];
      await game.settings.set('dsa5', 'expansionPermissions', permissions);
    }

    let recent = this.readRecentBooks().filter((entry) => !(entry.type === 'customBooks' && entry.id === id));
    await game.settings.set('dsa5', BookWizard.#recentBooksKey(), JSON.stringify(recent));

    this.loadCustomBooks();
    ui.notifications.info('Book.customBookRemoved', { localize: true });

    if (this.book?.id === id && this.currentType === 'customBooks') this.#resetBook();
    await this.loadPage($(this.element));
  }

  #resetBook() {
    this.book = null;
    this.bookData = null;
    this.selectedChapter = null;
    this.selectedType = null;
    this.journals = null;
    this.actors = null;
    this.scenes = null;
    this.content = undefined;
    this.journalIndex = null;
    this.fulltextsearch = true;
    this.searchString = undefined;
    this.currentType = undefined;
    this.pageTocs = undefined;
    this.selectedSubChapter = undefined;
  }

  _showBooks() {
    this.#resetBook();
    this.loadPage($(this.element));
  }

  async toggleBookVisibility(id, type, toggle) {
    const config = game.settings.get('dsa5', 'expansionPermissions');
    config[id] = toggle;
    await game.settings.set('dsa5', 'expansionPermissions', config);

    const book = this[type].find((x) => x.id == id);

    if (type !== 'customBooks' && book?.path) {
      const json = await (await fetch(book.path)).json();
      const moduleId = json.moduleName;
      const module = game.modules.get(moduleId);
      const documentTypes = ['Actor', 'JournalEntry', 'Scene'];
      const scope = json.options?.scope?.split('-')[1];

      for (const mPack of module?.packs ?? []) {
        if (!documentTypes.includes(mPack.type)) continue;
        if (mPack.flags?.dsalang != game.i18n.lang) continue;
        if (scope && !mPack.id.includes(scope)) continue;

        const pack = game.packs.get(mPack.id);
        if (!pack) continue;
        const visibility = toggle ? 'OBSERVER' : 'NONE';
        const ownership = {
          ownership: {
            PLAYER: visibility,
            TRUSTED: visibility,
            ASSISTANT: 'OWNER',
            GAMEMASTER: 'OWNER',
          },
        };

        await pack.configure(ownership);
      }
    }
    if (book) book.visible = toggle;

    const html = $(this.element);
    this._saveScrollPositions(html);
    await this.loadPage(html);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    html.on('search keyup', '.filterJournals', (ev) => {
      this.filterToc(ev.currentTarget.value);
    });

    html.on('click', '.heading-link', (ev) => this._onClickPageLink(ev));

    html.on('click', '.show-item', async (ev) => {
      //TODO maybe try to open imported character
      const itemId = ev.currentTarget.dataset.uuid;
      const item = await fromUuid(itemId);
      item.sheet.render(true);
    });

    DSA5ChatAutoCompletion.bindRollCommands(html);

    html.on('mousedown', '.chapter img', (ev) => {
      const name = this.book.id;
      if (ev.button == 2)
        game.dsa5.apps.DSA5_Utility.showArtwork({
          name,
          uuid: '',
          img: ev.currentTarget.getAttribute('src'),
        });
    });

    DSA5StatusEffects.bindButtons(html);

    bindImgToCanvasDragStart(html);

    slist(html, '.breadcrumbs', this.resaveBreadCrumbs);

    this.#bindBookLibrarySearch();
    this.#bindBookLibraryHover();
  }

  #bindBookLibrarySearch() {
    this.#bookSearch?.unbind();
    if (!this.element.querySelector('.book-library')) return;

    this.#bookSearch ??= new foundry.applications.ux.SearchFilter({
      inputSelector: '.library-sidebar input[type=search]',
      contentSelector: '.book-library',
      callback: this.#onBookSearchFilter.bind(this),
    });
    this.#bookSearch.bind(this.element);
    this.#restoreBookSearch();
  }

  #restoreBookSearch() {
    if (!this.searchString) return;
    const input = this.element.querySelector('.library-sidebar input[type=search]');
    const library = this.element.querySelector('.book-library');
    if (!input || !library) return;
    input.value = this.searchString;
    const rgx = new RegExp(foundry.applications.ux.SearchFilter.cleanQuery(this.searchString), 'i');
    this.#onBookSearchFilter(null, this.searchString, rgx, library);
  }

  async #getBookSplash(type, id) {
    const cacheKey = `${type}:${id}`;
    if (this.#bookCoverCache.has(cacheKey)) return this.#bookCoverCache.get(cacheKey);

    const book = this[type]?.find((x) => x.id == id);
    if (!book) return null;

    if (type === 'customBooks' && book.splash) {
      this.#bookCoverCache.set(cacheKey, book.splash);
      return book.splash;
    }

    if (!book.path) return null;

    try {
      const json = await (await fetch(book.path)).json();
      const splash = json.splash ?? null;
      this.#bookCoverCache.set(cacheKey, splash);
      return splash;
    } catch {
      this.#bookCoverCache.set(cacheKey, null);
      return null;
    }
  }

  #showLibraryCover(splash, title = '') {
    const preview = this.element.querySelector('.tocList .library-preview');
    if (!preview) return;

    const stack = preview.querySelector('.libraryCoverStack');
    const moduleLayer = preview.querySelector('.libraryCover-module');
    const frame = preview.querySelector('.libraryCover-frame');
    const titleEl = preview.querySelector('.libraryCoverTitle');
    if (!stack || !moduleLayer || !frame || !titleEl) return;

    if (!splash) {
      frame.classList.remove('is-visible');
      stack.classList.remove('has-cover');
      titleEl.classList.remove('is-visible');
      titleEl.textContent = '';
      moduleLayer.style.removeProperty('background-image');
      return;
    }

    const requestId = ++this.#previewRequest;
    const img = new Image();
    img.onload = () => {
      if (requestId !== this.#previewRequest) return;
      moduleLayer.style.backgroundImage = `url("${splash}")`;
      stack.classList.add('has-cover');
      frame.classList.add('is-visible');
      titleEl.textContent = title;
      titleEl.classList.add('is-visible');
    };
    img.src = splash;
  }

  async #previewBookCover(type, id, title) {
    const splash = await this.#getBookSplash(type, id);
    if (`${type}:${id}` !== this.#activePreviewKey) return;
    this.#showLibraryCover(splash, title);
  }

  #resetLibraryCover() {
    this.#previewRequest++;
    this.#activePreviewKey = null;
    this.#updatePreviewedEntry();
    this.#showLibraryCover(null);
  }

  #updatePreviewedEntry(entry = null) {
    for (const el of this.element.querySelectorAll('.book-entry.is-previewed')) {
      el.classList.remove('is-previewed');
      el.querySelector('[data-action="loadBook"]')?.classList.remove('active');
    }
    const link = entry?.querySelector('[data-action="loadBook"]');
    if (link) {
      entry.classList.add('is-previewed');
      link.classList.add('active');
    }
  }

  #clearHoverTimers() {
    clearTimeout(this.#hoverShowTimer);
    clearTimeout(this.#hoverHideTimer);
    this.#hoverShowTimer = undefined;
    this.#hoverHideTimer = undefined;
  }

  #schedulePreview(type, id, entry) {
    if (this.libraryViewMode === 'cards') return;
    this.#clearHoverTimers();

    const key = `${type}:${id}`;
    if (this.#activePreviewKey === key) return;

    const title = entry.querySelector('[data-action="loadBook"]')?.textContent?.trim() || id;
    const show = () => {
      this.#activePreviewKey = key;
      this.#updatePreviewedEntry(entry);
      this.#previewBookCover(type, id, title);
    };

    if (this.#activePreviewKey) show();
    else this.#hoverShowTimer = setTimeout(show, 150);
  }

  #scheduleReset() {
    this.#clearHoverTimers();
    this.#hoverHideTimer = setTimeout(() => this.#resetLibraryCover(), 250);
  }

  #bindBookLibraryHover() {
    this.#bookLibraryHoverCleanup?.();
    this.#bookLibraryHoverCleanup = undefined;
    this.#clearHoverTimers();

    if (!this.element.querySelector('.book-library') && !this.element.querySelector('.library-recent')) return;

    const previewZone = (node) => node?.closest?.('.book-library, .library-recent, .library-preview');

    const onMouseOver = (ev) => {
      const entry = ev.target.closest('.book-entry');
      if (!entry || entry.hidden) {
        if (!previewZone(ev.target)) this.#scheduleReset();
        return;
      }
      const { bookId, bookType } = entry.dataset;
      if (bookId && bookType) {
        this.#schedulePreview(bookType, bookId, entry);
      }
    };

    const onMouseOut = (ev) => {
      if (previewZone(ev.relatedTarget)) return;
      this.#scheduleReset();
    };

    this.element.addEventListener('mouseover', onMouseOver);
    this.element.addEventListener('mouseout', onMouseOut);
    this.#bookLibraryHoverCleanup = () => {
      this.element.removeEventListener('mouseover', onMouseOver);
      this.element.removeEventListener('mouseout', onMouseOut);
      this.#clearHoverTimers();
    };
  }

  #onBookSearchFilter(_event, query, rgx, html) {
    this.searchString = query;
    let visibleCount = 0;
    for (const entry of html.querySelectorAll('.book-entry')) {
      if (!query) {
        entry.hidden = false;
        visibleCount++;
        continue;
      }
      const title =
        entry.querySelector('[data-action="loadBook"]')?.textContent?.trim() ||
        entry.querySelector('h3')?.textContent?.trim() ||
        entry.dataset.bookId ||
        '';
      entry.hidden = !rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(title));
      if (!entry.hidden) visibleCount++;
    }

    for (const section of html.querySelectorAll('.book-section')) {
      const visibleEntries = section.querySelectorAll('.book-entry:not([hidden])');
      section.hidden = !!query && visibleEntries.length === 0;
    }

    const emptyMsg = html.querySelector('.book-search-empty');
    if (emptyMsg) emptyMsg.hidden = !query || visibleCount > 0;
  }

  _tearDown(options) {
    this.#bookSearch?.unbind();
    this.#bookLibraryHoverCleanup?.();
    this.#bookLibraryHoverCleanup = undefined;
    this.#clearHoverTimers();
    return super._tearDown(options);
  }

  async getPagy(chapter, journalId) {
    const journals = this.journals.filter((x) => x.flags.dsa5.parent == chapter).sort((a, b) => (a.flags.dsa5.sort > b.flags.dsa5.sort ? 1 : -1));
    const targetindex = journals.findIndex((x) => x._id == journalId);
    return { journals, targetindex };
  }

  static async _movePage(ev, target) {
    const dir = target.dataset.direction;
    let { journals, targetindex } = await this.getPagy(this.selectedChapter, this.selectedSubChapter);
    const flattenedChapters = [];

    for (const chap of this.bookData.chapters) {
      for (const sub of chap.content) {
        flattenedChapters.push(sub.name);
      }
    }

    const curChapterIndex = flattenedChapters.findIndex((x) => x == this.selectedChapter);
    this.bookData.chapters.findIndex((x) => x.name == this.selectedChapter);

    if (dir == 'next') targetindex++;
    else targetindex--;

    if (targetindex < 0) {
      this.selectedChapter = flattenedChapters[curChapterIndex - 1];
      if (!this.selectedChapter) return;

      journals = (await this.getPagy(this.selectedChapter, undefined)).journals;
      targetindex = 0;
    } else if (targetindex >= journals.length) {
      this.selectedChapter = flattenedChapters[curChapterIndex + 1];
      if (!this.selectedChapter) return;

      journals = (await this.getPagy(this.selectedChapter, undefined)).journals;
      targetindex = 0;
    }

    if (['prep', 'foundryUsage'].includes(this.selectedChapter)) return;

    const journal = journals[targetindex];

    if (journal) {
      await this.loadJournalById(journal.id);
    }

    const toc = await this.getToc();
    const html = $(this.element);
    this._saveScrollPositions(html);
    html.find('.tocList').html(toc);
    this._restoreScrollPositions(html);
  }

  async loadJournal(name) {
    await this.showJournal(this.journals.find((x) => x.name == name && x.flags.dsa5.parent == this.selectedChapter));
  }

  async loadJournalById(id) {
    await this.showJournal(this.journals.find((x) => x.id == id));
  }

  async resaveBreadCrumbs(target) {
    const breadcrumbs = {};
    for (const elem of target.getElementsByTagName('div')) {
      breadcrumbs[elem.dataset.uuid] = elem.innerText;
    }
    await game.settings.set('dsa5', `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs));
  }

  markFindings(html) {
    const container = html.closest('.tocCollapsing');
    container.find('.searchLines').remove();
    const findings = html.find('.searchMatch');

    if (findings.length == 0) return;

    const markers = [];
    const boundingRect = html.find('> div')[0].getBoundingClientRect();
    for (const finding of findings) {
      const bounding = finding.getBoundingClientRect();
      markers.push(`<div class="marker" style="top:${((bounding.top - boundingRect.top) / boundingRect.height) * 100}%"></div>`);
    }
    const lines = $(`<div class="searchLines">${markers.join('')}</div>`);
    container.append(lines);
  }

  async filterToc(val) {
    this.searchString = val;
    const html = $(this.element);
    if (val != undefined) {
      val = val.toLowerCase().trim();

      if (val != '') {
        let result = [];
        if (this.fulltextsearch) {
          if (!this.journalIndex) {
            this.journalIndex = new FlexSearch.Document({
              tokenize: 'full',
              cache: true,
              document: {
                id: 'id',
                store: true,
                index: ['name', 'data'],
              },
            });
            for (const journal of this.journals) {
              await this.journalIndex.add(new JournalSearch(journal).toObject());
            }
          }
          const query = {
            index: ['name', 'data'],
          };
          result = (await this.journalIndex.searchAsync(val, query))
            .map((x) => x.result)
            .flat()
            .map((x) => this.journalIndex.get(x));
        } else {
          result = this.journals.filter((x) => {
            return x.name.toLowerCase().trim().indexOf(val) != -1;
          });
        }
        result = result.map(
          (x) => `<li><button type="button" data-jid="${x.id}" data-action="subChapter" class="subChapter"><i class="fas fa-caret-right"></i>${x.name}</button></li>`,
        );

        html.find('.tocContent').html(`<ul>${result.join('\n')}</ul>`);
      } else {
        const content = await this.getToc();
        html.find('.tocList').html(content).find('.filterJournals').trigger('focus');
      }
    }

    const journal = await this.getChapter();
    const chapter = html.find('.chapter');
    chapter.html(journal);
    this.markFindings(chapter);
  }

  async showSearchResults(pageContent) {
    if (this.searchString) {
      const html = document.createElement('div');
      html.innerHTML = $(pageContent).html();
      await TextEditor._applyCustomEnrichers(
        {
          pattern: new RegExp(this.searchString, 'ig'),
          enricher: (match, options) => {
            return $(`<span class="searchMatch">${match[0]}</span>`)[0];
          },
        },
        BookWizard.#getTextNodes(html),
        {},
      );
      return html.innerHTML;
    } else {
      return $(pageContent).html();
    }
  }

  static #getTextNodes(parent) {
    const text = [];
    const walk = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) text.push(walk.currentNode);
    return text;
  }

  _onClickPageLink(ev) {
    const anchor = ev.currentTarget.closest('[data-anchor]')?.dataset.anchor;
    if (anchor) {
      const element = this.element.querySelector(`.chapter [data-anchor="${anchor}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    const page = this.element.querySelector(`.journalHeader`);
    page?.scrollIntoView({ behavior: 'smooth' });
  }

  async _renderHeadings(toc, shiftFirst = false) {
    let headings = Object.values(toc);

    if (shiftFirst) headings.shift();

    headings.sort((a, b) => a.order - b.order);

    const minLevel = Math.min(...headings.map((node) => node.level));
    headings = headings.reduce((arr, { text, level, slug, element }) => {
      if (element) element.dataset.anchor = slug;
      if (level < minLevel + 2) arr.push({ text, slug, level: level - minLevel + 2 });
      return arr;
    }, []);
    return await foundry.applications.handlebars.renderTemplate('templates/journal/toc.hbs', { headings });
  }

  async renderContent(journal) {
    this.content = journal.id;
    let content = '';
    const pageTocs = [];
    for (const page of journal.pages) {
      const sheet = journal.sheet.getPageSheet(page.id);
      let view;
      let pageContent;
      let shiftFirstTocHeading = false;
      const pageName = page.name.replace(/ Text$/gi, '');
      const equalName = journal.name == pageName;

      if (sheet.isV2) {
        const oldShow = sheet.page?.title?.show;
        if (oldShow != undefined) {
          shiftFirstTocHeading = !equalName;
          sheet.page.title.show = shiftFirstTocHeading;
        }
        await sheet.render(true);
        view = sheet.element;
        pageContent = view;

        if (oldShow != undefined) sheet.page.title.show = oldShow;
      } else {
        const data = await sheet.getData();
        view = (await sheet._renderInner(data)).get();
        pageContent = view[view.length - 1];
      }

      const pageToc = JournalEntryPage.implementation.buildTOC(view);
      pageTocs.push(await this._renderHeadings(pageToc, shiftFirstTocHeading));

      pageContent = await this.showSearchResults(pageContent);

      if (page.type == 'video') pageContent = `<div class="video-container">${pageContent}</div>`;
      if (!sheet.isV2 && !equalName) pageContent = `<h2 data-anchor="${page.name.slugify()}">${pageName}</h2>${pageContent}`;

      content += `<div style="clear: both">${pageContent}</div>`;
    }

    this.pageTocs = pageTocs.join('');

    const pinIcon = this.findSceneNote(journal.getFlag('dsa5', 'initId'));
    const enriched = await TextEditor.enrichHTML(content, {
      secrets: game.user.isGM,
    });

    return `<div><h1 class="journalHeader" data-uuid="${journal.uuid}">${journal.name}<div class="jrnIcons">${pinIcon}<a data-action="pinJournal"><i class="fas fa-thumbtack"></i></a><a data-action="showJournal"><i class="fas fa-eye"></i></a></div></h1>${enriched}`;
  }

  async showJournal(journal) {
    const html = $(this.element);
    const chapter = html.find('.chapter');
    chapter.html(await this.renderContent(journal));

    this.selectedSubChapter = journal.id;

    html.find('.subChapter').removeClass('selected');
    html.find(`[data-jid="${journal.id}"]`).addClass('selected');
    bindImgToCanvasDragStart(chapter);
    this.markFindings(chapter);
    chapter.find('.documentName-link, .content-link').on('click', (ev) => {
      const dataset = ev.currentTarget.dataset;
      if (this.bookData && dataset.pack == this.bookData.journal) {
        //todo make this work for pages
        if (dataset.type != 'JournalEntryPage') {
          ev.stopPropagation();
          this.loadJournalById(dataset.id);
        }
      }
    });
  }

  findSceneNote(entryId) {
    if (entryId) {
      const importedJournalEntry = game.journal.find((x) => x.getFlag('dsa5', 'initId') == entryId);
      if (importedJournalEntry && importedJournalEntry.sceneNote)
        return `<a data-action="showMapNote" data-entry-id="${importedJournalEntry.id}"><i class="fas fa-map-pin"></i></a>`;
    }
    return '';
  }

  static async _importBook(ev, target) {
    if (!game.user.isGM) return;

    const mod = this.bookData.moduleName;
    const options = this.bookData.options;

    new game.dsa5.apps.DSA5Initializer(
      'DSA5 Module Initialization',
      _loc(`${options?.scope || mod}.importContent`, {
        defaultText: _loc('importDefault'),
      }),
      mod,
      game.i18n.lang,
      options,
    ).render(true);
  }

  async loadBook(id, html, type) {
    this.selectedChapter = undefined;
    this.selectedType = undefined;
    this.content = undefined;

    if (!type) type = this.currentType;

    this.currentType = type;
    this.book = this[type].find((x) => x.id == id);
    if (!this.book) return;

    if (type === 'customBooks') {
      this.bookData = {
        moduleName: this.book.moduleName || this.book.title,
        journal: this.book.journal,
        splash: this.book.splash,
      };
      const journal = game.packs.get(this.bookData.journal);
      if (!journal) {
        ui.notifications.error('Book.customBookMissingCompendium', { localize: true });
        return;
      }
      await journal.getIndex();
      this.journals = await journal.getDocuments();
      this.checkChapters(journal);
      await this.recordRecentBook(type, id);
      this.loadPage(html);
      return;
    }

    await fetch(this.book.path)
      .then(async (r) => r.json())
      .then(async (json) => {
        this.bookData = json;
        let journal = game.packs.get(json.journal);
        //Need this to replace links
        await journal.getIndex();
        let entries = await journal.getDocuments();
        this.journals = entries;
        if (json.actors) {
          journal = game.packs.get(json.actors);
          entries = await journal.getIndex();
          this.actors = entries;
        }
        if (json.scenes) {
          journal = game.packs.get(json.scenes);
          entries = await journal.getIndex();
          this.scenes = entries;
        }
        this.checkChapters(journal);
        await this.recordRecentBook(type, id);
        this.loadPage(html);
      });
  }

  checkChapters(journal) {
    if (this.bookData.chapters) return;

    this.bookData.isDynamic = true;
    this.bookData.chapters = BookWizard.#buildChaptersFromCompendium(journal, this.bookData.moduleName);
  }

  static #buildChaptersFromCompendium(journal, sectionTitle) {
    const folders = journal.folders ?? [];
    const rootFolders = folders.filter((f) => !f.folder).sort(BookWizard.#sortFolders);
    const useSections = rootFolders.some((root) => folders.some((f) => f.folder?.id === root.id));

    if (useSections) {
      return rootFolders.map((root) => {
        const childFolders = folders.filter((f) => f.folder?.id === root.id).sort(BookWizard.#sortFolders);
        const content = childFolders.length
          ? childFolders.map((f) => ({ name: f.name, id: f.id }))
          : [{ name: root.name, id: root.id }];

        return { name: root.name, content };
      });
    }

    return [
      {
        name: sectionTitle,
        content: rootFolders.map((f) => ({ name: f.name, id: f.id })),
      },
    ];
  }

  static #sortFolders(a, b) {
    return (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  }

  async prefillActors(chapter) {
    if (!chapter.actors) return [];

    const result = [];
    const head = await game.folders.contents.find((x) => x.name == _loc(`${this.bookData.moduleName}.name`) && x.type == 'Actor' && x.folder == null);
    const folderids = head ? await game.folders.contents.filter((x) => x.type == 'Actor' && x.folder?.id == head.id).map((x) => x.id) : undefined;
    for (const k of chapter.actors) {
      let actor = folderids?.length ? game.actors.contents.find((x) => x.name == k && folderids.includes(x.folder?.id)) : undefined;
      let pack = undefined;
      let id = actor?.id;
      let uuid = actor?.uuid;
      if (!actor) {
        actor = this.actors.find((x) => x.name == k);
        pack = this.bookData.actors;
        id = actor?._id;
        uuid = actor ? `Compendium.${pack}.${id}` : undefined;
      }
      result.push({
        name: k,
        actor,
        pack,
        id,
        uuid,
      });
    }
    return result;
  }

  async popJournal(uuid) {
    const entry = await fromUuid(uuid);
    entry.sheet.render(true);
  }

  static async _showSzene(ev, target) {
    const name = target.dataset.id;
    const mode = target.dataset.mode;
    const scene = game.scenes.contents.find((x) => x.name == name);
    if (!scene)
      return ui.notifications.error('DSAError.sceneNotInitialized', {
        localize: true,
      });

    switch (mode) {
      case 'activate':
        scene.activate();
        break;
      case 'view':
        scene.view();
        break;
      case 'toggle':
        scene.update({ navigation: !scene.navigation });
        break;
    }
  }

  async getChapter() {
    if (this.book) {
      if (this.content) {
        const journal = this.journals.find((x) => x.id == this.content);
        return await this.renderContent(journal);
      }
      if (this.selectedChapter) {
        if (this.selectedChapter == 'prep') {
          const info = {
            initDescr: _loc(`${this.bookData.options?.scope || this.bookData.moduleName}.importContent`, { defaultText: _loc('importDefault') }),
          };

          const modules = this.bookData.modules;
          for (const k of modules) k.enabled = this.moduleEnabled(k.id);

          return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_preparation.hbs', { modules, info });
        } else if (this.selectedChapter == 'foundryUsage') {
          return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_foundry.hbs');
        }

        const section = this.bookData.chapters.find((x) => x.name == this.selectedType);
        const chapter = section?.content?.find((x) => x.id == this.selectedChapter);
        if (!chapter) {
          return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_cover.hbs', { book: this.book, bookData: this.bookData });
        }
        const subChapters = this.getSubChapters();
        if (chapter.scenes || chapter.actors || subChapters.length == 0) {
          return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_chapter.hbs', {
            chapter,
            subChapters: this.getSubChapters(),
            actors: await this.prefillActors(chapter),
          });
        } else {
          this.selectedSubChapter = subChapters[0].id;
          return await this.loadJournalById(subChapters[0].id);
        }
      }
      return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_cover.hbs', { book: this.book, bookData: this.bookData });
    } else {
      const manuals = this.filterBooks(this.manuals);
      const adventures = this.filterBooks(this.adventures);
      const rules = this.filterBooks(this.books);
      const rshs = this.filterBooks(this.rshs);
      const customBooks = this.filterBooks(this.customBooks);
      const showCustomBooksSection = game.user.isGM || customBooks.length > 0;
      const bookSections = this.#buildBookLibrarySections({
        manuals,
        adventures,
        rules,
        rshs,
        customBooks,
        showCustomBooksSection,
      });

      if (this.libraryViewMode === 'cards') {
        await Promise.all(bookSections.map((section) => this.#enrichBooksWithSplash(section.type, section.books)));
      }

      return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_intro.hbs', {
        bookSections,
        isGM: game.user.isGM,
        libraryViewMode: this.libraryViewMode,
      });
    }
  }

  #buildBookLibrarySections({ manuals, adventures, rules, rshs, customBooks, showCustomBooksSection }) {
    const enrich = (books, useTitle) =>
      books.map((book) => ({
        ...book,
        displayName: useTitle ? book.title ?? book.id : book.id,
      }));

    const sections = [
      {
        type: 'manuals',
        labelKey: null,
        books: enrich(manuals, false),
        show: true,
        showEmpty: false,
        allowRemove: false,
        allowAdd: false,
      },
      {
        type: 'adventures',
        labelKey: 'Book.availableModules',
        books: enrich(adventures, false),
        show: adventures.length > 0,
        showEmpty: false,
        allowRemove: false,
        allowAdd: false,
      },
      {
        type: 'books',
        labelKey: 'Book.availableRules',
        books: enrich(rules, false),
        show: true,
        showEmpty: true,
        allowRemove: false,
        allowAdd: false,
      },
      {
        type: 'rshs',
        labelKey: 'Book.availableRSHs',
        books: enrich(rshs, false),
        show: true,
        showEmpty: true,
        allowRemove: false,
        allowAdd: false,
      },
      {
        type: 'customBooks',
        labelKey: 'Book.customBooks',
        books: enrich(customBooks, true),
        show: showCustomBooksSection,
        showEmpty: true,
        allowRemove: true,
        allowAdd: true,
      },
    ];

    for (const section of sections) section.hasBooks = section.books.length > 0;

    return sections;
  }

  filterBooks(books) {
    const bookPermissions = game.settings.get('dsa5', 'expansionPermissions');
    for (const book of books) {
      if (bookPermissions[book.id] != undefined) book.visible = bookPermissions[book.id];
    }
    const filtered = game.user.isGM ? books : books.filter((x) => x.visible == undefined || x.visible);
    return filtered.sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }));
  }

  static #recentBooksKey() {
    return `recentBooks_${game.world.id}`;
  }

  readRecentBooks() {
    try {
      return JSON.parse(game.settings.get('dsa5', BookWizard.#recentBooksKey())) || [];
    } catch {
      return [];
    }
  }

  async recordRecentBook(type, id) {
    let recent = this.readRecentBooks().filter((book) => !(book.type === type && book.id === id));
    recent.unshift({ type, id });
    recent = recent.slice(0, BookWizard.RECENT_BOOKS_MAX);
    await game.settings.set('dsa5', BookWizard.#recentBooksKey(), JSON.stringify(recent));
  }

  getRecentBooks() {
    return this.readRecentBooks()
      .map(({ type, id }) => {
        const book = this[type]?.find((x) => x.id == id);
        if (!book) return null;
        if (!this.filterBooks([book]).length) return null;
        return { id, type, title: book.title ?? book.id };
      })
      .filter(Boolean);
  }

  static #journalFolderId(journal) {
    return journal?.folder?.id ?? journal?._source?.folder ?? null;
  }

  getSubChapters() {
    let jrns;
    if (this.bookData.isDynamic) {
      jrns = this.journals
        .filter((x) => BookWizard.#journalFolderId(x) === this.selectedChapter)
        .sort((a, b) => (a.sort > b.sort ? 1 : -1));
    } else {
      jrns = this.journals.filter((x) => x.flags.dsa5.parent == this.selectedChapter).sort((a, b) => (a.flags.dsa5.sort > b.flags.dsa5.sort ? 1 : -1));
    }

    return jrns.map((x) => {
      const selected = this.selectedSubChapter == x.id;
      return {
        name: x.name,
        id: x.id,
        selected,
        cssClass: selected ? 'selected' : '',
      };
    });
  }

  async getToc() {
    const chapters = [];
    if (this.book) {
      chapters.push(...duplicate(this.bookData.chapters));
      if (this.selectedChapter) {
        let chapter;
        for (const k of chapters) {
          chapter = k.content.find((x) => x.id == this.selectedChapter);
          if (chapter) break;
        }
        if (chapter) {
          chapter.cssClass = 'selected';
          chapter.selected = true;
          chapter.subChapters = this.getSubChapters();
        }
      }
      return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_toc.hbs', {
        chapters,
        searchString: this.searchString,
        book: this.book,
        pageTocs: this.pageTocs,
        fulltextsearch: this.fulltextsearch ? 'on' : '',
      });
    } else {
      return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_library_sidebar.hbs', {
        recentBooks: this.getRecentBooks(),
        libraryViewMode: this.libraryViewMode,
        searchString: this.searchString ?? '',
      });
    }
  }

  async #enrichBooksWithSplash(type, books) {
    await Promise.all(
      books.map(async (book) => {
        if (type !== 'customBooks') book.splash = await this.#getBookSplash(type, book.id);
      }),
    );
    return books;
  }

  //TODO this is gone in v2
  _saveScrollPositions(html) {
    const selectors = ['.scrollable'];
    this._scrollPositions = selectors.reduce((pos, sel) => {
      const el = html.find(sel);
      pos[sel] = Array.from(el).map((el) => el.scrollTop);
      return pos;
    }, {});
  }

  //TODO this is gone in v2
  _restoreScrollPositions(html) {
    const selectors = ['.scrollable'];
    const positions = this._scrollPositions || {};
    for (const sel of selectors) {
      const el = html.find(sel);
      el.each((i, el) => (el.scrollTop = positions[sel]?.[i] || 0));
    }
  }

  async loadPage(html) {
    const template = await this.getChapter();
    const toc = await this.getToc();

    this._saveScrollPositions(html);
    html.find('.tocList').html(toc);
    const chapter = html.find('.chapter');
    chapter.html(template);
    this.markFindings(chapter);
    this._restoreScrollPositions(html);
    this.#bindBookLibrarySearch();
    this.#bindBookLibraryHover();
    this.#updatePageNav(html);
    if (this.libraryViewMode === 'cards') this.#resetLibraryCover();
  }

  #updatePageNav(html = $(this.element)) {
    const footer = html.find('.tocPageNav')[0];
    if (footer) footer.hidden = !this.book;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const currentChapter = await this.getChapter();
    const toc = await this.getToc();
    const index = game.settings.get('dsa5', 'journalFontSizeIndex');
    const fontSize = DSA5.journalFontSizes[index - 1] || 14;
    mergeObject(data, {
      adventure: this.bookData,
      currentChapter,
      breadcrumbs: this.renderBreadcrumbs(),
      toc,
      fontSize,
      showPageNav: !!this.book,
    });
    return data;
  }

  async pinJournal(uuid, name = undefined) {
    const breadcrumbs = this.readBreadCrumbs();
    if (!name) name = (await fromUuid(uuid))?.name || '';
    breadcrumbs[uuid] = name;
    game.settings.set('dsa5', `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs));
    this.render(true);
  }

  unpinJournal(uuid) {
    const breadcrumbs = this.readBreadCrumbs();
    delete breadcrumbs[uuid];
    game.settings.set('dsa5', `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs));
    this.render(true);
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      return false;
    }
    if (data.type == 'JournalEntry') {
      this.pinJournal(data.uuid);
    }
  }

  readBreadCrumbs() {
    let breadcrumbs = {};
    try {
      breadcrumbs = JSON.parse(game.settings.get('dsa5', `breadcrumbs_${game.world.id}`));
    } catch (e) {
      console.log('No Journalbrowser notes found');
    }
    return breadcrumbs;
  }

  renderBreadcrumbs() {
    const breadcrumbs = this.readBreadCrumbs();
    const btns = Object.entries(breadcrumbs).map((x) => `<div data-tooltip="${x[1]}" data-uuid="${x[0]}" data-action="openPin" class="item">${x[1]}</div>`);

    if (btns.length > 0) return `<div id="breadcrumbs" class="breadcrumbs wrap row-section">${btns.join('')}</div>`;

    return '';
  }

  moduleEnabled(id) {
    if (game.modules.get(id)) {
      return game.modules.get(id).active ? 'fa-check' : 'fa-dash';
    }
    return 'fa-times';
  }

  async loadBookAndPage(book, chapter, bookType, chapterCategory) {
    //todo figure out booktype, chapterCategory automatically
    this.#resetBook();
    await this.loadBook(book, $(this.element), bookType);
    this.#getChapter(chapterCategory, chapter);
    await this.render(true);
  }
}

class JournalSearch {
  constructor(item) {
    const data = item.pages.find((x) => true).text.content;
    this.document = {
      name: item.name,
      data: $('<div>').html(data).text(),
      id: item.id,
    };
  }

  toObject() {
    return {
      name: this.name,
      data: this.data,
      id: this.id,
    };
  }

  get name() {
    return this.document.name;
  }
  get data() {
    return this.document.data;
  }
  get id() {
    return this.document.id;
  }
}
