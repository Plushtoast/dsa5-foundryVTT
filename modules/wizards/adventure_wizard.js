import { DefaultAppv2 } from '../actor/baseapp.js';
import { bindImgToCanvasDragStart } from '../hooks/imgTileDrop.js';
import { increaseFontSize } from '../hooks/journal.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DSA5ChatAutoCompletion from '../system/chat_autocompletion.js';
import DSA5 from '../system/config-dsa5.js';
import { slist } from '../system/view_helper.js';
import { DragMixin } from '../actor/drag_mixin.js';
import FlexSearch from "../../libs/flexsearch.bundle.module.min.js"
const { mergeObject, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class BookWizard extends DragMixin(DefaultAppv2) {
  static wizard;

  constructor(app) {
    super(app);
    this.adventures = [];
    this.books = [];
    this.rshs = [];
    this.manuals = [];
    this.fulltextsearch = true;
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
    this.loadBook(target.textContent, $(this.element), target.dataset.type);
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
    target.classList.toggle('on');
    this.filterToc(this.element.querySelector('.filterJournals').value);
  }

  static async _openPin(ev, target) {
    const uuid = target.dataset.uuid;

    if (ev.button == 0) this.showJournal(await fromUuid(uuid));
    else if (ev.button == 2) this.unpinJournal(uuid);
  }

  static _getChapter(ev, target) {
    this.selectedType = $(target).closest('.tocList').attr('data-type');
    this.selectedChapter = target.dataset.id;
    this.content = undefined;
    this.pageTocs = undefined;
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

  static _increaseFontSize(ev, target) {
    increaseFontSize($(this.element).find('.chapter'));
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
      width: 960,
      height: 860,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/wizard/adventure/adventure_wizard.hbs',
    },
  };

  static initHook() {
    BookWizard.wizard = new BookWizard();

    game.dsa5.apps.journalBrowser = BookWizard.wizard;

    Hooks.on('renderJournalDirectory', (app, html) => {
      html = $(html);
      const div = $('<div class="header-actions action-buttons flexrow"></div>');
      const button = $(`<button id="openJournalBrowser"><i class="fa fa-book"></i>${game.i18n.localize('Book.Wizard')}</button>`);
      button.on('click', () => {
        BookWizard.wizard.render(true);
      });
      div.append(button);
      html.find('.header-actions:first-child').after(div);
    });
  }

  _showBooks() {
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
    this.loadPage($(this.element));
  }

  async toggleBookVisibility(id, type, toggle) {
    const config = game.settings.get('dsa5', 'expansionPermissions');
    config[id] = toggle;
    await game.settings.set('dsa5', 'expansionPermissions', config);

    const book = this[type].find((x) => x.id == id);
    const json = await (await fetch(book.path)).json();
    const moduleId = json.moduleName;
    const module = game.modules.get(moduleId);
    const documentTypes = ['Actor', 'JournalEntry', 'Scene'];
    const scope = json.options?.scope?.split('-')[1];

    for (const mPack of module?.packs | []) {
      if (!documentTypes.includes(mPack.type)) continue;
      if (mPack.flags?.dsalang != game.i18n.lang) continue;
      if (scope && !mPack.id.includes(scope)) continue;

      const pack = game.packs.get(mPack.id);
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
    this.render();
  }

  async _onRender(context, options) {
    await super._onRender((context, options));
    const html = $(this.element);

    html.on('search keyup', '.filterJournals', (ev) => {
      this.filterToc(ev.currentTarget.value);
    });

    html.on('click', '.heading-link', (ev) => this._onClickPageLink(ev));
    

    html.on('click', '.show-item', async (ev) => {
      //TODO maybe try to open imported character
      let itemId = ev.currentTarget.dataset.uuid;
      const item = await fromUuid(itemId);
      item.sheet.render(true);
    });

    DSA5ChatAutoCompletion.bindRollCommands(html);

    html.on('mousedown', '.chapter img', (ev) => {
      let name = this.book.id;
      if (ev.button == 2)
        game.dsa5.apps.DSA5_Utility.showArtwork({
          name: name,
          uuid: '',
          img: $(ev.currentTarget).attr('src'),
        });
    });

    DSA5StatusEffects.bindButtons(html);

    bindImgToCanvasDragStart(html);

    slist(html, '.breadcrumbs', this.resaveBreadCrumbs);

    //todo we could remove this if every .item is replaced with .draggable (parent has draggable attachment listener)    
  }  

  async getPagy(chapter, journalId) {
    const journals = this.journals.filter((x) => x.flags.dsa5.parent == chapter).sort((a, b) => (a.flags.dsa5.sort > b.flags.dsa5.sort ? 1 : -1));
    const targetindex = journals.findIndex((x) => x._id == journalId);
    return { journals, targetindex };
  }

  static async _movePage(ev, target) {
    const dir = target.dataset.direction;
    let { journals, targetindex } = await this.getPagy(this.selectedChapter, this.selectedSubChapter);
    let flattenedChapters = [];

    for (let chap of this.bookData.chapters) {
      for (let sub of chap.content) {
        flattenedChapters.push(sub.name);
      }
    }

    let curChapterIndex = flattenedChapters.findIndex((x) => x == this.selectedChapter);
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

    let journal = journals[targetindex];

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
    for (let elem of target.getElementsByTagName('div')) {
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
    for (let finding of findings) {
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
                tokenize: "full",
                cache: true,
                document: {
                    id: "id",
                    store: true,
                    index: ['name', 'data']
                }
            })
            for(const journal of this.journals) {
              await this.journalIndex.add(new JournalSearch(journal).toObject());
            }
          }
          const query = {
            index: ['name', 'data']
          }
          result = (await this.journalIndex.searchAsync(val, query)).map(x => x.result).flat().map(x => this.journalIndex.get(x))
        } else {
          result = this.journals.filter((x) => {
            return x.name.toLowerCase().trim().indexOf(val) != -1;
          });
        }
        result = result.map((x) => `<li><button type="button" data-jid="${x.id}" data-action="subChapter" class="subChapter"><i class="fas fa-caret-right"></i>${x.name}</button></li>`);

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
      const html = document.createElement("div");
      html.innerHTML = $(pageContent).html();
      await TextEditor._applyCustomEnrichers({
        pattern: new RegExp(this.searchString, 'ig'),
        enricher: (match, options) => {
          return $(`<span class="searchMatch">${match[0]}</span>`)[0];
        }
      }, BookWizard.#getTextNodes(html), {});
      return html.innerHTML;
    } else {
      return $(pageContent).html();
    }
  }

  static #getTextNodes(parent) {
    const text = [];
    const walk = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
    while ( walk.nextNode() ) text.push(walk.currentNode);
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

    const minLevel = Math.min(...headings.map(node => node.level));
    headings = headings.reduce((arr, { text, level, slug, element }) => {
      if ( element ) element.dataset.anchor = slug;
      if ( level < minLevel + 2 ) arr.push({ text, slug, level: level - minLevel + 2 });
      return arr;
    }, []);
    return await foundry.applications.handlebars.renderTemplate("templates/journal/toc.hbs", { headings });
  }

  async renderContent(journal) {
    this.content = journal.id;
    let content = '';
    const pageTocs = [];
    for (let page of journal.pages) {
      const sheet = journal.sheet.getPageSheet(page.id);
      let view
      let pageContent
      if (sheet.isV2) {
        const oldShow = sheet.page?.title?.show;
        if(oldShow != undefined) sheet.page.title.show = true;
        await sheet.render(true);        
        view = sheet.element
        pageContent = view
        if(oldShow != undefined) sheet.page.title.show = oldShow;
      } else {
        const data = await sheet.getData();
        view = (await sheet._renderInner(data)).get();
        pageContent = view[view.length - 1];
      }
      
      const pageName = page.name.replace(/ Text$/gi, '');
      const equalName = journal.name == pageName;

      const pageToc = JournalEntryPage.implementation.buildTOC(view);
      pageTocs.push(await this._renderHeadings(pageToc, equalName));

      pageContent = await this.showSearchResults(pageContent);

      if (page.type == 'video') pageContent = `<div class="video-container">${pageContent}</div>`;
      if (!sheet.isV2 && !equalName) pageContent = `<h2 data-anchor="${page.name.slugify()}">${pageName}</h2>${pageContent}`;

      content += pageContent;
    }

    this.pageTocs = pageTocs.join('');

    const pinIcon = this.findSceneNote(journal.getFlag('dsa5', 'initId'));
    const enriched = await TextEditor.enrichHTML(content, {
      secrets: game.user.isGM,
      async: true,
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
      game.i18n.format(`${options?.scope || mod}.importContent`, {
        defaultText: game.i18n.localize('importDefault'),
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
        this.loadPage(html);
      });
  }

  checkChapters(journal) {
    if (this.bookData.chapters) return;

    this.bookData.isDynamic = true;
    this.bookData.chapters = [
      {
        name: game.i18n.localize(`${this.bookData.moduleName}.name`),
        content: journal.folders.map((x) => {
          return {
            name: x.name,
            id: x.id,
          };
        }),
      },
    ];
  }

  async prefillActors(chapter) {
    if (!chapter.actors) return [];

    let result = [];
    const head = await game.folders.contents.find((x) => x.name == game.i18n.localize(`${this.bookData.moduleName}.name`) && x.type == 'Actor' && x.folder == null);
    const folderids = head ? await game.folders.contents.filter((x) => x.type == 'Actor' && x.folder?.id == head.id).map((x) => x.id) : undefined;
    for (let k of chapter.actors) {
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
    let scene = game.scenes.contents.find((x) => x.name == name);
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
          let info = {
            initDescr: game.i18n.format(`${this.bookData.options?.scope || this.bookData.moduleName}.importContent`, { defaultText: game.i18n.localize('importDefault') }),
          };

          let modules = this.bookData.modules;
          for (let k of modules) k.enabled = this.moduleEnabled(k.id);

          return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_preparation.hbs', { modules, info });
        } else if (this.selectedChapter == 'foundryUsage') {
          return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_foundry.hbs');
        }

        let chapter = this.bookData.chapters.find((x) => x.name == this.selectedType).content.find((x) => x.id == this.selectedChapter);
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
      return await renderTemplate('systems/dsa5/templates/wizard/adventure/adventure_intro.hbs', {
        rshs: this.filterBooks(this.rshs),
        rules: this.filterBooks(this.books),
        adventures: this.filterBooks(this.adventures),
        manuals: this.filterBooks(this.manuals),
        isGM: game.user.isGM,
      });
    }
  }

  filterBooks(books) {
    const bookPermissions = game.settings.get('dsa5', 'expansionPermissions');
    for (const book of books) {
      if (bookPermissions[book.id] != undefined) book.visible = bookPermissions[book.id];
    }
    return game.user.isGM
      ? books
      : books
          .filter((x) => x.visible == undefined || x.visible)
          .sort((a, b) => {
            return a.id.localeCompare(b.id);
          });
  }

  getSubChapters() {
    let jrns;
    if (this.bookData.isDynamic) {
      jrns = this.journals.filter((x) => x.folder.id == this.selectedChapter).sort((a, b) => (a.sort > b.sort ? 1 : -1));
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
    let chapters = [];
    if (this.book) {
      chapters.push(...duplicate(this.bookData.chapters));
      if (this.selectedChapter) {
        let chapter;
        for (let k of chapters) {
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
      return '<div class="libraryImg"></div>';
    }
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
    });
    return data;
  }

  async pinJournal(uuid, name = undefined) {
    let breadcrumbs = this.readBreadCrumbs();
    if (!name) name = (await fromUuid(uuid))?.name || '';
    breadcrumbs[uuid] = name;
    game.settings.set('dsa5', `breadcrumbs_${game.world.id}`, JSON.stringify(breadcrumbs));
    this.render(true);
  }

  unpinJournal(uuid) {
    let breadcrumbs = this.readBreadCrumbs();
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
