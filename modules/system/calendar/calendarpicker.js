import { DSAWorldCalendar } from './calendar.js';
import { CalendarCanvas } from './calendarcanvas.js';
import { DSACalendarEntry } from '../../data/journal/dsacalendar.js';
import { tabSlider } from '../../system/helpers/view_helper.js';
import { PersonaeDramatis } from './personaedramatis.js';
import { DSAPersonaEntry } from '../../data/journal/dsapersonaedramatis.js';
import { DSAQuestLogEntry } from '../../data/journal/dsaquestlog.js';
import { QuestLogFeature } from './questlog.js';

import DSA5_Utility from '../helpers/utility-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

export class DSACalendarPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static #yearCache = new Map();
  static #holidayDefsCache = null;

  static DEFAULT_OPTIONS = {
    id: 'dsa-calendar-picker',
    tag: 'form',
    window: {
      frame: false,
      positioned: false,
    },
    classes: ['dsaCalendarPicker', 'fullScreenApp'],
    actions: {
      removeJournal: { handler: this.#removeJournal, buttons: [0, 2] },
      addJournal: this.#addJournal,
      filterCategory: this.#filterCategory,
      editEvent: this.#onEditEvent,
      createEvent: this.#onCreateEvent,
      resetAutomation: this.#onResetAutomation,
      resetDayTimes: this.#onResetDayTimes,
      openMoreSearch: this.#toggleMoreSearch,
      ...PersonaeDramatis.actions,
      ...QuestLogFeature.actions,
      scrollToToday: this.#scrollToToday,
      scrollMonthPrev: this.#scrollBackward,
      scrollMonthNext: this.#scrollForward,
      confirmDateChange: this.#confirmDateChange,
      cancelDateChange: this.#cancelDateChange,
    }
  };

  static PARTS = {
    fullscreen: {
      template: 'systems/dsa5/templates/system/fullscreenHeader.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    config: {
      template: 'systems/dsa5/templates/system/calendar/config.hbs',
      templates: [
        'systems/dsa5/templates/system/dsatabs.hbs',
        'systems/dsa5/templates/system/calendar/journal-setting-fieldset.hbs',
      ],
      scrollable: ['', '.innerscroll'],
    },
    events: {
      template: 'systems/dsa5/templates/system/calendar/holidays.hbs',
      templates: ['systems/dsa5/templates/journal/calendarcard.hbs']
    },
    calendar: {
      template: 'systems/dsa5/templates/system/calendar/calendar.hbs',
      templates: ['systems/dsa5/templates/system/calendar/picker.hbs']
    },
    personae: {
      template: 'systems/dsa5/templates/system/calendar/personaedramatis.hbs',
      scrollable: ['.personae-list', '.persona-details-container']
    },
    questlog: {
      template: 'systems/dsa5/templates/system/calendar/questlog.hbs',
      scrollable: ['.questlog-list', '.persona-details-container']
    }
  };

  #search;
  #personaeDramatis = new PersonaeDramatis(this);
  #questLog = new QuestLogFeature(this);
  #temporaryTime = null;
  #pendingScrollToToday = false;
  #eventsTabObserver = null;

  get title() {
    return _loc(DSAWorldCalendar.selectedCalendar().name);
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'calendar', label: 'CALENDAR.DSA.calendar', icon: 'fas fa-calendar' },
        { id: 'events', label: 'CALENDAR.DSA.holidays', icon: 'fas fa-person-praying' },
        { id: 'questlog', label: 'DSAQUESTLOG.title', icon: 'fas fa-scroll' },
        { id: 'personae', label: 'PERSONAE.title', icon: 'fas fa-user' },
        { id: 'config', label: 'CALENDAR.DSA.config', icon: 'fas fa-cog' },
      ],
      initial: 'calendar',
    },
    config: {
      tabs: [
        { id: 'general_config', label: 'CALENDAR.DSA.config', icon: 'fas fa-cog' },
        { id: 'calendar_config', label: 'CALENDAR.DSA.calendar', icon: 'fas fa-calendar' },
      ],
      initial: 'general_config',
    },
    ...PersonaeDramatis.TABS,
  };

  static async fromCache(components) {
    return this.fromYearCache(components?.year ?? game.time.calendar.timeToComponents(game.time.worldTime).year);
  }

  static #getHolidayDefinitions() {
    if (this.#holidayDefsCache === null) {
      const months = game.time.calendar.months.values;
      const monthPrefix = new Array(months.length + 1);
      monthPrefix[0] = 0;
      for (let m = 0; m < months.length; m++) monthPrefix[m + 1] = monthPrefix[m] + months[m].days;

      const holidayDefs = CONFIG.time.worldCalendarConfig.holidays.values || [];

      const preparedHolidayTemplates = [];
      for (const holiday of holidayDefs) {
        const dayOffset = monthPrefix[holiday.month] ?? 0;
        const template = {
          title: game.time.calendar.translate(`holiday.${holiday.name}`),
          location: holiday.location,
          from: {
            dayOfMonth: holiday.dayStart + 1,
            month: holiday.month,
            day: dayOffset + holiday.dayStart,
          },
          to: {
            dayOfMonth: holiday.dayEnd ? holiday.dayEnd + 1 : undefined,
          },
          content: game.time.calendar.translate(`holidayDesc.${holiday.name}`, false, true),
          category: 1,
          juuid: 'dC',
          visible: true,
          recurring: true,
          gods: holiday.gods?.join(', ')
        };
        preparedHolidayTemplates.push(template);
      }

      this.#holidayDefsCache = preparedHolidayTemplates;
    }
    return this.#holidayDefsCache;
  }

  static async fromYearCache(year) {
    if (this.#yearCache.has(year)) return this.#yearCache.get(year);

    const journalSettings = game.settings.get('dsa5', DSACalendarEntry.SETTING_NAME);
    const activated = journalSettings.activated || [];

    const loaded = await Promise.allSettled(activated.map(j => fromUuid(j.uuid)));
    const validJournals = loaded
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    const candidates = [];
    for (const journal of validJournals) {
      for (const page of (journal.pages || [])) {
        if (page.type !== 'dsacalendar') continue;
        const entriesObj = page.system?.calendarentries || {};
        for (const [key, entry] of Object.entries(entriesObj)) {
          if (!game.user.isGM && !entry.visible) continue;
          if (entry.recurring ? entry.from.year <= year : entry.from.year === year) {
            candidates.push({ entry, page, key });
          }
        }
      }
    }

    const preparedEntries = [];
    const BATCH = 50;
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const processed = await Promise.all(batch.map(async ({ entry, page, key }) => {
        const e = foundry.utils.deepClone(entry);
        await DSACalendarEntry.prepareCalendarEntry(e);
        e.isOwner = page.isOwner;
        e.uuid = page.uuid;
        e.juuid = page.parent?.uuid;
        e.calendarKey = key;
        return e;
      }));
      preparedEntries.push(...processed);
    }

    const preparedHolidayTemplates = this.#getHolidayDefinitions();
    const holidayEntries = [];
    for (const template of preparedHolidayTemplates) {
      const e = foundry.utils.deepClone(template);
      e.from.year = year;
      await DSACalendarEntry.prepareCalendarEntry(e);
      holidayEntries.push(e);
    }

    const result = [...holidayEntries, ...preparedEntries];
    this.#yearCache.set(year, result);
    return result;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!game.user.isGM) {
      delete parts.config;
      const visibility = game.settings.get('dsa5', 'calendarFeatureVisibility');
      for (const key of ['calendar', 'events', 'personae', 'questlog']) {
        if (!visibility[key]) delete parts[key];
      }
    }
    return parts;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!game.user.isGM && group === 'sheet') {
      delete tabs.config;
      const visibility = game.settings.get('dsa5', 'calendarFeatureVisibility');
      for (const key of ['calendar', 'events', 'personae', 'questlog']) {
        if (!visibility[key]) delete tabs[key];
      }
    }
    return tabs;
  }

  static async #addJournal(ev, target) {
    const fieldset = target.closest('fieldset');
    const container = fieldset.querySelector('.journalPickerContainer');
    const setting = target.dataset.setting;
    if (container.children.length == 0) {
      const activated = new Set(game.settings.get('dsa5', setting).activated.map(x => x.uuid));
      const category = {
        [DSACalendarEntry.SETTING_NAME]: 'dsacalendar',
        [DSAPersonaEntry.SETTING_NAME]: 'dsapersonaedramatis',
        [DSAQuestLogEntry.SETTING_NAME]: 'dsaquestlog',
      }[setting]
      const possibleJournals = game.journal.filter(j => {
        return !activated.has(j.uuid) && (j.pages || []).some(p => p.type === category);
      }).reduce((acc, j) => {
        acc[j.uuid] = j.name;
        return acc;
      }, {});
      const content = await renderTemplate('systems/dsa5/templates/journal/calendarjournalpicker.hbs', { possibleJournals, setting, hasJournals: Object.keys(possibleJournals).length > 0 });
      container.innerHTML = content;
    } else {
      const selected = fieldset.querySelector(`select[name="journal_${setting}"]`);
      if (!selected) return;

      const settings = game.settings.get('dsa5', setting);
      settings.activated.push({ uuid: selected.value, name: selected.options[selected.selectedIndex].text });
      await game.settings.set('dsa5', setting, settings);
      game.dsa5.apps.CalendarPicker.constructor.invalidateCache(selected.value);
      this.render(true);
    }
  }

  static async #onEditEvent(ev, target) {
    const uuid = target.dataset.uuid;
    const key = target.dataset.key;

    if (!uuid || !key) return;

    const journal = await fromUuid(uuid);

    if (!journal) return;

    this.close();
    journal.sheet.render({ force: true, currentKey: key });
  }

  static async #onCreateEvent(ev, target) {
    await DSACalendarEntry.startCreation(this, this?.actualTimeComponents?.() ?? game.time.calendar.timeToComponents(game.time.worldTime));
  }

  static #toggleMoreSearch(ev, target) {
    const moreOptions = target.closest('.flexcol').querySelector('.moreSearchOptions').classList.toggle('dsahidden');
    target.classList.toggle('fa-caret-up', !moreOptions);
    target.classList.toggle('fa-caret-down', moreOptions);
  }

  async _resetKeys(setting, keys) {
    const settings = game.settings.get('dsa5', setting);
    const defaultSettings = game.settings.settings.get(`dsa5.${setting}`).default;
    for (const key of keys) {
      foundry.utils.setProperty(settings, key, foundry.utils.getProperty(defaultSettings, key));
    }
    await game.settings.set('dsa5', setting, settings);
  }

  static async #onResetAutomation(ev, target) {
    const defaultKeys = ['lightByDayTime', 'moonAddsLight', 'moon', 'dayDarknessAdjust'];
    await this._resetKeys('calendarSettings', defaultKeys);
    this.render({ force: true, parts: ['config'] });
  }

  static async #onResetDayTimes(ev, target) {
    const defaultKeys = ['dawn', 'morning', 'noon', 'afternoon', 'sunset', 'night'];
    await this._resetKeys('calendarSettings', defaultKeys);
    this.render({ force: true, parts: ['config'] });
  }

  static async #removeJournal(ev, target) {
    const uuid = target.dataset.uuid;

    if (ev.button == 2) {
      const setting = target.dataset.setting;
      const settings = game.settings.get('dsa5', setting);
      settings.activated = settings.activated.filter(el => el.uuid !== uuid);
      game.settings.set('dsa5', setting, settings);
      this.render(true);
    } else {
      const journal = await fromUuid(uuid);
      if (!journal) return;

      this.close();
      journal.sheet.render(true);
    }
  }

  static async #filterCategory(ev, target) {
    const isOn = !target.classList.contains('toggleOn');
    target.classList.toggle('toggleOn', isOn);
    const searchOptions = {
      category: new Set(),
      uuid: new Set(),
    }
    for (const elm of Array.from(target.closest('.searchOptions').querySelectorAll('.toggleOn'))) {
      const type = elm.dataset.filterType;
      if (type) searchOptions[type].add(elm.dataset.filter);
    }
    const container = this.element.querySelector('.eventscontainer');
    container.querySelectorAll('.event-card').forEach(card => {
      let isVisible = true;
      for (const [type, values] of Object.entries(searchOptions)) {
        if (!values.size) { isVisible = false; break; };
        const attr = card.dataset[type];
        if (!attr) { isVisible = false; break; }
        if (!values.has(attr)) { isVisible = false; break; }
      }
      card.classList.toggle('dsahidden', !isVisible);
    });
  }

  static clearCache() {
    this.#yearCache.clear();
  }

  static invalidateCache(uuid) {
    //console.warn(`Invalidate calendar cache called from ${uuid}`);
    if (uuid) {
      const activated = game.settings.get('dsa5', DSACalendarEntry.SETTING_NAME).activated;
      if (!activated.some(el => el.uuid === uuid)) return
    }

    game.socket.emit('system.dsa5', {
      type: 'invalidateCache',
    });

    this.clearCache();
  }

  #getChronologicalSortKey(entry) {
    const day = entry?.from?.day;
    if (typeof day === 'number') return day;

    const month = entry?.from?.month;
    const dayOfMonth = entry?.from?.dayOfMonth;
    return month * 100 + dayOfMonth;
  }

  #tryScrollToToday() {
    const eventsTab = this.element?.querySelector('.tab[data-tab="events"]');
    if (!eventsTab?.classList.contains('active')) return false;

    const todayMarker = this.element?.querySelector('.calendar-today-marker');
    if (!todayMarker) return false;

    requestAnimationFrame(() => this._scrollToCard(todayMarker, { behavior: 'auto' }));
    this.#pendingScrollToToday = false;
    return true;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const calendar = game.time.calendar;
    data.tabs = this._prepareTabs('sheet');
    data.isGM = game.user.isGM;
    data.calendar = calendar;
    data.appTitle = _loc(DSAWorldCalendar.selectedCalendar().name);
    data.yearSuffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);

    return data;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch (partId) {
      case "config": await this._prepareConfigContext(context, options); break;
      case "events": await this._prepareEventsContext(context, options); break;
      case "calendar": await this._prepareCalendarContext(context, options); break;
      case 'personae': await this.#personaeDramatis._preparePartContext(context, options); break;
      case 'questlog': await this.#questLog._preparePartContext(context, options); break;
    }
    return context;
  }

  async _prepareConfigContext(context, options) {
    const calendar = game.time.calendar;
    if (!context.calendarJournals) context.calendarJournals = game.settings.get('dsa5', DSACalendarEntry.SETTING_NAME);

    context.calendarActors = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME);
    context.questlogJournals = game.settings.get('dsa5', DSAQuestLogEntry.SETTING_NAME);
    context.calendarSetting = game.settings.settings.get('dsa5.calendar');
    context.selectedCalendar = game.settings.get('dsa5', 'calendar');
    context.maxHoursPerDay = calendar.days.hoursPerDay;
    context.calendarConfig = game.settings.get('dsa5', 'calendarSettings');
    context.configTabs = this._prepareTabs('config');

    context.featureVisibility = game.settings.get('dsa5', 'calendarFeatureVisibility');
    context.playerDateVisibility = game.settings.get('dsa5', 'calendarPlayerDateVisibility');

    context.atlasEnabled = DSA5_Utility.moduleEnabled('dsa5-atlas');

    const autoTimes = context.calendarConfig.autoDayTimes && context.atlasEnabled;
    const dayTimes = game.dsa5.apps.CalendarWidget.constructor.dayTimes;
    const step = autoTimes ? 0.01 : 1;
    const disabled = autoTimes;
    context.dayTimes = ['dawn', 'morning', 'noon', 'afternoon', 'sunset', 'night'].map(key => {
      return {
        key,
        value: dayTimes[key],
        step,
        disabled,
      }
    });
  }

  async _prepareCalendarContext(context, options) {
    const calendar = game.time.calendar;

    if (!context.components) context.components = this.actualTimeComponents();

    context.isGM = game.user.isGM;
    context.hasDateChanges = this.#temporaryTime !== null && this.#temporaryTime !== game.time.worldTime;
    context.worldCalendarConfig = CONFIG.time.worldCalendarConfig;
    context.currentMonth = calendar.translate(calendar.months.values[context.components.month].name);
    context.currentDay = context.components.dayOfMonth + 1;
    context.calendarSize = Math.min(window.innerWidth, window.innerHeight) * 0.75;
  }

  async _prepareEventsContext(context, options) {
    if (!context.components) context.components = this.actualTimeComponents();
    if (!context.calendarJournals) context.calendarJournals = game.settings.get('dsa5', DSACalendarEntry.SETTING_NAME);

    context.initialYear = context.components.year;
    context.dayCategories = Object.entries(DSACalendarEntry.CATEGORY_CHOICES).reduce((acc, [key, val]) => {
      acc[key] = { key, name: val, color: DSACalendarEntry.CATEGORY_COLORS[key], icon: DSACalendarEntry.CATEGORY_ICONS[key] };
      return acc;
    }, {});
  }

  async #onDateChange(ev) {
    if (ev.currentTarget.name == 'year') game.dsa5.apps.CalendarPicker.constructor.invalidateCache();

    const form = ev.target.form;
    if (!form) return;

    const components = new foundry.applications.ux.FormDataExtended(form).object;
    const currentComponents = this.actualTimeComponents();
    components.month = currentComponents.month;
    components.day = Math.min(currentComponents.day, game.time.calendar.months.values[components.month].days - 1);
    for (let m = 0; m < components.month; m++) {
      components.day += game.time.calendar.months.values[m].days;
    }

    this.#temporaryTime = game.time.calendar.componentsToTime(components);
    this.refreshCalendar();
  }

  async refreshParts(parts = []) {
    if (this.rendered) {
      await this.render({ force: true, parts });
    }
  }

  async refreshCalendar() {
    if (!this.rendered) return;

    const context = { calendar: game.time.calendar };
    await this._prepareCalendarContext(context, {});
    const refreshedTimePart = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/picker.hbs', context);
    const div = document.createElement('div');
    div.innerHTML = refreshedTimePart;
    this.element.querySelector('.calendarDateChange').innerHTML = div.querySelector('.calendarDateChange').innerHTML;
    this.#dateFormListeners();
    this._drawCalendar();

    const parts = game.user.isGM ? ['events', 'config'] : ['events'];
    await this.refreshParts(parts);
  }

  async refreshPersonae() {
    await this.refreshParts(['personae']);
  }

  async refreshQuestlog() {
    await this.refreshParts(['questlog']);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    tabSlider($(this.element));

    this.#eventsTabObserver?.disconnect();
    const eventsTab = this.element.querySelector('.tab[data-tab="events"]');
    if (eventsTab) {
      this.#eventsTabObserver = new MutationObserver(() => {
        if (this.#pendingScrollToToday) this.#tryScrollToToday();
        if (!this.#pendingScrollToToday) {
          this.#eventsTabObserver?.disconnect();
          this.#eventsTabObserver = null;
        }
      });
      this.#eventsTabObserver.observe(eventsTab, { attributes: true, attributeFilter: ['class'] });
    }
    this.#dateFormListeners();
    this.element.querySelectorAll('.settingChange').forEach(element => {
      element.addEventListener('change', this._onSettingChange.bind(this));
    });
    this.element.querySelectorAll('.directSettingChange').forEach(element => {
      element.addEventListener('change', this._onDirectSettingChange.bind(this));
    });
    this.element.querySelector('[name="dsa5.calendar"]')?.addEventListener('change', this._onChangeCalendar.bind(this));

    this._drawCalendar();

    this.#search ??= new foundry.applications.ux.SearchFilter({
      inputSelector: "input.calendarSearch[type=search]",
      contentSelector: ".eventscontainer",
      callback: this.#onSearchFilter.bind(this)
    });
    this.#search.bind(this.element);

    const scrollContainer = this.element.querySelector('[data-tab="events"].tab');
    const sticky = this.element.querySelector('.position-fake-sticky');
    scrollContainer.addEventListener('scroll', (ev) => {
      const scrollTop = scrollContainer.scrollTop != 0 ? scrollContainer.scrollTop - 20 : scrollContainer.scrollTop;
      sticky.style.transform = `translateY(${scrollTop}px)`;
    });

    this.#personaeDramatis.onRenderListeners();
    this.#questLog.onRenderListeners();

    this._setupInfiniteScroll();
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#search?.unbind();
    this.#personaeDramatis._tearDown(options);
    this.#questLog._tearDown(options);
    this.#eventsTabObserver?.disconnect();
    this.#eventsTabObserver = null;
    if (this._evtState?.topObserver) this._evtState.topObserver.disconnect();
    if (this._evtState?.bottomObserver) this._evtState.bottomObserver.disconnect();
    this._evtState = null;
  }

  #onSearchFilter(_event, query, rgx, html) {
    for (const entry of html.querySelectorAll(".event-card")) {
      if (!query) {
        entry.hidden = false;
        continue;
      }

      const title = entry.querySelector('.event-card__title').textContent || '';
      const location = entry.querySelector('.eventlocation')?.textContent || '';
      const description = entry.querySelector('.event-card__desc')?.textContent || '';
      const isMatch = [title, location, description].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
      entry.hidden = !isMatch;
    }
  }

  #dateFormListeners() {
    const dateChange = this.element.querySelectorAll('.dateChange');
    dateChange.forEach(element => {
      element.addEventListener('change', this.#onDateChange.bind(this));
      element.addEventListener('blur', this.#onDateChange.bind(this));
    });
  }

  async openDocumentSheet(documentOrUuid, { currentKey = null, close = true } = {}) {
    const document = typeof documentOrUuid === 'string' ? await fromUuid(documentOrUuid) : documentOrUuid;
    if (!document?.sheet?.render) return null;

    if (close) await this.close();

    if (currentKey) {
      document.sheet.render({ force: true, currentKey });
    } else {
      document.sheet.render(true);
    }

    return document;
  }

  async close(options = {}) {
    options.animate = false;
    super.close(options);
  }

  _onClose(options) {
    this.calendarRenderer?.destroy();
    this.calendarRenderer = null;
    this.#temporaryTime = null;
  }

  _drawCalendar() {
    const appContainer = this.element.querySelector('.circular-calendar');
    //const appContainer = this.element;
    if (this.calendarRenderer) {
      this.calendarRenderer.element = appContainer;
    }
    else {
      this.calendarRenderer = new CalendarCanvas(this, appContainer, this._onCalendarCanvasCallback.bind(this), this._onCalendarCanvasHover.bind(this));
    }
    this.calendarRenderer.render();
  }

  async _onCalendarCanvasHover(hoverBait) {
    if (!hoverBait) {
      this._clearTooltips();
      return;
    }

    const components = this.actualTimeComponents();
    const calendar = game.time.calendar;
    let tooltipContent = '';
    let detailsContent = '';
    let img = '';

    switch (hoverBait.type) {
      case "day":
        tooltipContent = await this._buildDayTooltip(hoverBait, components);
        break;
      case "weekday":
        tooltipContent = await this._buildWeekdayTooltip(hoverBait, components);
        break;
      case "month":
        const result = await this._buildMonthTooltip(hoverBait);
        tooltipContent = result.tooltipContent;
        detailsContent = result.detailsContent;
        img = result.img;
        break;
      case "moon":
        tooltipContent = `<div><b>${calendar.translate('moonphase', true)}</b>: ${hoverBait.name}</div>`;
        break;
    }

    this._updateTooltips(tooltipContent, detailsContent, img);
  }

  async _buildDayTooltip(hoverBait, components) {
    const calendar = game.time.calendar;
    const modifiedComponents = foundry.utils.deepClone(components);
    modifiedComponents.day += hoverBait.index - components.dayOfMonth;

    const converted = calendar.componentsToTime(modifiedComponents);
    const convertedComponents = calendar.timeToComponents(converted);

    const moon = calendar.translate(convertedComponents.moon.phase.name);
    const month = calendar.translate(calendar.months.values[components.month].name);
    const daysCount = calendar.days.values.length;
    const dayOfWeekIndex = ((convertedComponents.dayOfWeek % daysCount) + daysCount) % daysCount;
    const weekday = calendar.translate(calendar.days.values[dayOfWeekIndex].name);
    const holidays = await this._getHolidaysFormatted(convertedComponents);

    return `<div>
      <b>${hoverBait.day}. ${month}</b><br/>
      <b>${calendar.translate('weekday', true)}</b>: ${weekday}<br/>
      <b>${calendar.translate("moonphase", true)}</b>: ${moon}
      ${holidays ? `<br/><b>${calendar.translate('holidays', true)}</b>: ${holidays}` : ''}
    </div>`;
  }

  async _buildWeekdayTooltip(hoverBait, components) {
    const calendar = game.time.calendar;
    const modifiedComponents = foundry.utils.deepClone(components);
    modifiedComponents.day += hoverBait.originalIndex - components.dayOfWeek;

    const converted = calendar.componentsToTime(modifiedComponents);
    const convertedComponents = calendar.timeToComponents(converted);

    const moon = calendar.translate(convertedComponents.moon.phase.name);
    const dayOfMonth = convertedComponents.dayOfMonth + 1;
    const monthName = calendar.translate(calendar.months.values[convertedComponents.month].name);
    const weekdayName = calendar.translate(calendar.days.values[hoverBait.originalIndex].name);
    const holidays = await this._getHolidaysFormatted(convertedComponents);

    return `<div>
      <b>${dayOfMonth}. ${monthName}</b><br/>
      <b>${calendar.translate('weekday', true)}</b>: ${weekdayName}<br/>
      <b>${calendar.translate("moonphase", true)}</b>: ${moon}
      ${holidays ? `<br/><b>${calendar.translate('holidays', true)}</b>: ${holidays}` : ''}
    </div>`;
  }

  async _buildMonthTooltip(hoverBait) {
    const calendar = game.time.calendar;
    const monthIndex = hoverBait.originalIndex;
    const monthImage = DSAWorldCalendar.monthImage(monthIndex);
    let img;

    let dayOffset = 0;
    for (let m = 0; m < monthIndex; m++) {
      dayOffset += calendar.months.values[m].days;
    }
    const modifiedComponents = {
      ...this.actualTimeComponents(),
      day: dayOffset
    };
    const converted = calendar.componentsToTime(modifiedComponents);
    const convertedComponents = calendar.timeToComponents(converted);
    const monthData = calendar.months.values[monthIndex];
    const season = calendar.seasons.values[convertedComponents.season];
    const monthName = calendar.translate(monthData.name);
    const tooltipContent = `<div>
      <img src="${monthImage}" style="width: 100px; height: 100px; object-fit: cover; object-position: center;" />    
    </div>
    <div>
      <b>${calendar.translate('month', true)}</b>: ${monthName}<br/>
      <b>${calendar.translate('season', true)}</b>: ${calendar.translate(season.name)}
    </div>`;

    const detailsContent = calendar.translate(`monthDetails.${monthData.name}`);

    if (game.modules.get('dsa5-godsofaventuria')) {
      const baseMonthName = calendar.translate(monthData.name, true);
      const mappedName = {
        "Namenlose Tage": "Namenlos",
        "Nameless Days": "Namenlos"
      }[baseMonthName] || baseMonthName;

      img = mappedName;
    }

    return { tooltipContent, detailsContent, img };
  }

  async _getHolidaysFormatted(components) {
    const holidays = await this.constructor.findHolidays(components);
    if (!holidays.length) return '';
    const translationPrefix = game.time.calendar.translationPrefix;
    return '<div style="margin-left: 12px;">' + holidays.map(h => {
      const key = `${translationPrefix}.holiday.${h.title}`;
      const name = game.i18n.has(key) ? _loc(key) : h.title;
      return `<div><i style="color: ${DSACalendarEntry.CATEGORY_COLORS[h.category]}" class="${DSACalendarEntry.CATEGORY_ICONS[h.category]}"></i> ${name}</div>`;
    }).join('') + '</div>';
  }

  static async findHolidays(components) {
    const entries = await DSACalendarPicker.fromCache(components);
    return entries.filter(entry => entry.from.month === components.month
      && (entry.recurring || entry.from.year === components.year)
      && (entry.from.dayOfMonth - 1) <= components.dayOfMonth && components.dayOfMonth <= ((entry.to?.dayOfMonth || entry.from.dayOfMonth) - 1)
    );
  }

  _updateTooltips(tooltipContent, detailsContent, img) {
    const tooltip = this.element.querySelector('.tooltipBox');
    const calendarDetails = this.element.querySelector('.calendar-details');
    const calendarImage = this.element.querySelector('.calendar-img');

    tooltip.innerHTML = tooltipContent;
    tooltip.classList.toggle('dsahidden', !tooltipContent);
    tooltip.classList.toggle('offsetTooltip', detailsContent);

    calendarDetails.innerHTML = detailsContent || '';
    calendarDetails.classList.toggle('showThis', detailsContent);

    calendarImage.dataset.img = img || '';
    calendarImage.classList.toggle('showThis', img);
  }

  _clearTooltips() {
    this._updateTooltips('', '', '');
  }

  async _onCalendarCanvasCallback(clickBait) {
    let { year, month, day, hour, minute, second, dayOfWeek, dayOfMonth } = this.actualTimeComponents();

    switch (clickBait.type) {
      case "month":
        if (month === clickBait.originalIndex) return;

        day = Math.min(day, game.time.calendar.months.values[clickBait.originalIndex].days - 1);
        for (let m = 0; m < clickBait.originalIndex; m++) {
          day += game.time.calendar.months.values[m].days;
        }
        break;
      case "day":
        if (clickBait.isCurrentDay) return;

        day = clickBait.index;
        for (let m = 0; m < month; m++) {
          day += game.time.calendar.months.values[m].days;
        }
        break;
      case "weekday":
        if (dayOfWeek === clickBait.originalIndex) return;

        const dayDelta = clickBait.originalIndex - dayOfWeek;
        day += dayDelta;

        break;

    }

    this.#temporaryTime = game.time.calendar.componentsToTime({ year, month, day, hour, minute, second });
    this.refreshCalendar();
  }

  async _onChangeCalendar(ev) {
    game.settings.set('dsa5', 'calendar', ev.target.value);
    foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true })
  }

  actualTimeComponents() {
    return this.#temporaryTime !== null ?
      game.time.calendar.timeToComponents(this.#temporaryTime) :
      game.time.calendar.timeToComponents(game.time.worldTime);
  }

  async _confirmDateChange() {
    if (this.#temporaryTime === null) return;

    await game.time.set(this.#temporaryTime);

    this.#temporaryTime = null;

    this.refreshCalendar();
  }

  async _cancelDateChange() {
    this.#temporaryTime = null;
    this.refreshCalendar();
  }

  static async #confirmDateChange(ev, target) {
    return this._confirmDateChange(ev, target);
  }

  static async #cancelDateChange(ev, target) {
    return this._cancelDateChange(ev, target);
  }

  async _onSettingChange(ev) {
    const isCheckbox = ev.target.type === 'checkbox';
    const value = isCheckbox ? ev.target.checked : ev.target.value;
    const setting = ev.target.name;
    const settingName = ev.target.dataset.settingName || 'calendarSettings';
    const settings = game.settings.get('dsa5', settingName);
    foundry.utils.setProperty(settings, setting, value);
    await game.settings.set('dsa5', settingName, settings);
    game.dsa5.apps.CalendarWidget.render(true);

    if ((ev.target.dataset.refresh)) this.render({ force: true, parts: ['config'] });
  }

  async _onDirectSettingChange(ev) {
    const settingName = ev.target.dataset.settingName;
    await game.settings.set('dsa5', settingName, ev.target.value);
    game.dsa5.apps.CalendarWidget.render(true);
  }

  /* =====================
   * Events Virtual Scroller
   * ===================== */

  _setupInfiniteScroll() {
    const container = this.element.querySelector('.eventscontainer');
    const root = this.element.querySelector('[data-tab="events"].tab');
    if (!container || !root) return;

    if (container.dataset.vscrollInit === '1' && this._evtState?.container === container) return;

    if (this._evtState?.topObserver) this._evtState.topObserver.disconnect();
    if (this._evtState?.bottomObserver) this._evtState.bottomObserver.disconnect();
    this._evtState = null;

    if (container.dataset.vscrollInit === '1') return;

    const topSentinel = document.createElement('div');
    topSentinel.className = 'events-sentinel top';
    const bottomSentinel = document.createElement('div');
    bottomSentinel.className = 'events-sentinel bottom';
    container.prepend(topSentinel);
    container.append(bottomSentinel);

    const components = this.actualTimeComponents();
    this._evtState = {
      root,
      container,
      topSentinel,
      bottomSentinel,
      earliestYear: components.year,
      latestYear: components.year,
      loadedYears: new Set(),
      isLoadingTop: false,
      isLoadingBottom: false,
      keepYears: 5,
    };

    const opts = { root, rootMargin: '200px', threshold: 0 };
    const topObserver = new IntersectionObserver(async (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !this._evtState.isLoadingTop) {
          this._evtState.isLoadingTop = true;
          try { await this._prependPrevYear(); } finally { this._evtState.isLoadingTop = false; }
        }
      }
    }, opts);
    const bottomObserver = new IntersectionObserver(async (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !this._evtState.isLoadingBottom) {
          this._evtState.isLoadingBottom = true;
          try { await this._appendNextYear(); } finally { this._evtState.isLoadingBottom = false; }
        }
      }
    }, opts);
    topObserver.observe(topSentinel);
    bottomObserver.observe(bottomSentinel);
    this._evtState.topObserver = topObserver;
    this._evtState.bottomObserver = bottomObserver;

    container.dataset.vscrollInit = '1';

    this._renderInitialYearChunk(components.year, components);
  }

  async _renderInitialYearChunk(year, components) {
    const entries = await this.constructor.fromYearCache(year);
    const sorted = entries.slice().sort((a, b) => this.#getChronologicalSortKey(a) - this.#getChronologicalSortKey(b));
    await this._insertYearChunk(year, sorted, 'after', true);
    this.#pendingScrollToToday = true;
    this.#tryScrollToToday();
  }

  async _appendNextYear() {
    const nextYear = this._evtState.latestYear + 1;
    if (this._evtState.loadedYears.has(nextYear)) return;
    const entries = await this.constructor.fromYearCache(nextYear);
    const sorted = entries.slice().sort((a, b) => this.#getChronologicalSortKey(a) - this.#getChronologicalSortKey(b));
    await this._insertYearChunk(nextYear, sorted, 'after');
    this._evtState.latestYear = nextYear;
    this._pruneYearsIfNeeded();
  }

  async _prependPrevYear() {
    const prevYear = this._evtState.earliestYear - 1;
    if (this._evtState.loadedYears.has(prevYear)) return;
    const entries = await this.constructor.fromYearCache(prevYear);
    const sorted = entries.slice().sort((a, b) => this.#getChronologicalSortKey(a) - this.#getChronologicalSortKey(b));
    const prevHeight = this._evtState.root.scrollHeight;
    await this._insertYearChunk(prevYear, sorted, 'before');
    const newHeight = this._evtState.root.scrollHeight;
    const delta = newHeight - prevHeight;
    this._evtState.root.scrollTop += delta;
    this._evtState.earliestYear = prevYear;
    this._pruneYearsIfNeeded();
  }

  async _insertYearChunk(year, entries, position, initialChunk = false) {
    const { container, topSentinel, bottomSentinel, loadedYears } = this._evtState;
    if (loadedYears.has(year)) return;
    if (container.querySelector(`.year-chunk[data-year="${year}"]`)) {
      loadedYears.add(year);
      return;
    }

    const frag = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.className = 'year-chunk';
    wrapper.dataset.year = String(year);
    frag.append(wrapper);

    const tpl = 'systems/dsa5/templates/journal/calendarcard.hbs';
    const yearSuffix = game.time.calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);

    const components = this.actualTimeComponents();
    const currentYear = components.year;
    //const currentDateValue = components.month * 100 + components.dayOfMonth;

    const shouldAddTodayMarker = year === currentYear && initialChunk;
    await this._renderEntriesWithMonthDividers(entries, wrapper, tpl, yearSuffix, year, initialChunk, shouldAddTodayMarker ? components : null);

    if (position === 'before') container.insertBefore(frag, topSentinel.nextSibling);
    else container.insertBefore(frag, bottomSentinel);

    loadedYears.add(year);

    this._applyActiveFiltersToNewContent(wrapper);
    this._applyActiveSearchToNewContent(wrapper);
  }

  async _renderEntriesWithMonthDividers(entries, wrapper, template, yearSuffix, year, initialChunk, currentComponents = null) {
    if (!entries.length) return;

    let currentMonth = -1;
    const shouldPlaceTodayMarker = !!currentComponents;
    const todayMonth = shouldPlaceTodayMarker ? currentComponents.month : null;
    const todayDay = shouldPlaceTodayMarker ? (currentComponents.dayOfMonth + 1) : null;
    let todayMarkerInserted = false;

    const appendTodayMarker = () => {
      if (!shouldPlaceTodayMarker || todayMarkerInserted) return;
      const todayMarker = document.createElement('div');
      todayMarker.className = 'calendar-today-marker';
      const todayMonthName = game.time.calendar.translate(game.time.calendar.months.values[currentComponents.month].name);
      const todayYearSuffix = game.time.calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
      const todayLabel = _loc('dsacalendar.today');
      todayMarker.innerHTML = `<hr><span class="today-label">${todayLabel} - ${todayDay}. ${todayMonthName} ${currentComponents.year} ${todayYearSuffix}</span>`;
      wrapper.appendChild(todayMarker);
      todayMarkerInserted = true;
    };

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];

      if (entry.from.month !== currentMonth) {
        if (shouldPlaceTodayMarker && !todayMarkerInserted && currentMonth === todayMonth) {
          appendTodayMarker();
        }

        currentMonth = entry.from.month;

        const monthName = game.time.calendar.translate(game.time.calendar.months.values[currentMonth].name);
        const monthDivider = document.createElement('div');
        monthDivider.className = 'calendar-month-marker';
        monthDivider.innerHTML = `<hr><span class="month-label">${monthName} ${year} ${yearSuffix}</span>`;
        wrapper.appendChild(monthDivider);
      }

      if (shouldPlaceTodayMarker && !todayMarkerInserted && entry.from.month === todayMonth) {
        const entryStart = Number(entry?.from?.dayOfMonth);
        const entryEnd = Number(entry?.to?.dayOfMonth ?? entryStart);
        if (Number.isFinite(entryStart) && Number.isFinite(entryEnd)) {
          if (todayDay <= entryStart || (entryStart <= todayDay && todayDay <= entryEnd)) {
            appendTodayMarker();
          }
        }
      }

      const displayYear = entry.recurring ? year : entry.from.year;
      const html = await renderTemplate(template, { ...entry, yearSuffix, displayYear, initialChunk });
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = html;
      while (tempContainer.firstElementChild) wrapper.appendChild(tempContainer.firstElementChild);

    }

    if (shouldPlaceTodayMarker && !todayMarkerInserted && currentMonth === todayMonth) {
      appendTodayMarker();
    }
  }

  _applyActiveFiltersToNewContent(scopeElement) {
    const toggles = Array.from(this.element.querySelectorAll('.searchOptions .toggleOn'));
    if (!toggles.length) return;
    const searchOptions = { category: new Set(), uuid: new Set() };
    for (const elm of toggles) {
      const type = elm.dataset.filterType;
      if (type) searchOptions[type].add(elm.dataset.filter);
    }
    for (const card of scopeElement.querySelectorAll('.event-card')) {
      let isVisible = true;
      for (const [type, values] of Object.entries(searchOptions)) {
        if (!values.size) { isVisible = false; break; }
        const attr = card.dataset[type];
        if (!attr || !values.has(attr)) { isVisible = false; break; }
      }
      card.classList.toggle('dsahidden', !isVisible);
    }
  }

  //todo not sure if it is needed
  _applyActiveSearchToNewContent(scopeElement) {
    const input = this.element.querySelector('input.calendarSearch[type=search]');
    const query = input?.value?.trim() || '';
    if (!query) return;
    this.#search.search = query;
  }

  _pruneYearsIfNeeded() {
    const { loadedYears, container, topSentinel, bottomSentinel, keepYears } = this._evtState;
    if (loadedYears.size <= keepYears) return;
    const years = Array.from(loadedYears).sort((a, b) => a - b);
    while (years.length > keepYears) {
      const removeFromTop = (this._evtState.latestYear - years[0]) > (years.at(-1) - this._evtState.earliestYear);
      const yearToRemove = removeFromTop ? years.shift() : years.pop();
      const chunk = container.querySelector(`.year-chunk[data-year="${yearToRemove}"]`);
      if (chunk) chunk.remove();
      loadedYears.delete(yearToRemove);
    }
  }

  /* =====================
   * Scrolling helpers (Today / Month +/-)
   * ===================== */
  async _ensureYearLoaded(year) {
    if (!this._evtState.loadedYears.has(year)) {
      if (year < this._evtState.earliestYear) {
        const entries = await this.constructor.fromYearCache(year);
        const sorted = entries.slice().sort((a, b) => this.#getChronologicalSortKey(a) - this.#getChronologicalSortKey(b));
        const prevHeight = this._evtState.root.scrollHeight;
        await this._insertYearChunk(year, sorted, 'before');
        const newHeight = this._evtState.root.scrollHeight;
        this._evtState.root.scrollTop += (newHeight - prevHeight);
        this._evtState.earliestYear = Math.min(this._evtState.earliestYear, year);
      } else {
        const entries = await this.constructor.fromYearCache(year);
        const sorted = entries.slice().sort((a, b) => this.#getChronologicalSortKey(a) - this.#getChronologicalSortKey(b));
        await this._insertYearChunk(year, sorted, 'after');
        this._evtState.latestYear = Math.max(this._evtState.latestYear, year);
      }
      this._pruneYearsIfNeeded();
    }
    return this.element.querySelector(`.year-chunk[data-year="${year}"]`);
  }

  _scrollToCard(el, { behavior = 'smooth' } = {}) {
    if (!el) return;
    const scrollRoot = this.element.querySelector('[data-tab="events"].tab');
    const rect = el.getBoundingClientRect();
    const rootRect = scrollRoot.getBoundingClientRect();
    const offset = rect.top - rootRect.top + scrollRoot.scrollTop - 60;
    scrollRoot.scrollTo({ top: offset, behavior });
  }

  static async #scrollToToday() {
    const todayMarker = this.element.querySelector('.calendar-today-marker');
    if (todayMarker) {
      this._scrollToCard(todayMarker);
      return;
    }
  }

  static #scrollForward(event, target) {
    this._scrollToAdjacentMonth(1);
  }

  static #scrollBackward(event, target) {
    this._scrollToAdjacentMonth(-1);
  }

  async _scrollToAdjacentMonth(direction) {
    if (!direction || !this.element) return;

    const root = this.element.querySelector('[data-tab="events"].tab');
    const container = this.element.querySelector('.eventscontainer');
    if (!root || !container) return;

    const getVisibleCards = () => Array.from(container.querySelectorAll('.event-card'))
      .filter(el => el.offsetParent !== null && !el.classList.contains('dsahidden'));

    const getVisibleDividers = () => Array.from(container.querySelectorAll('.calendar-month-marker'))
      .filter(el => el.offsetParent !== null && !el.classList.contains('dsahidden'));

    const findTopVisibleCard = (cards) => {
      const rootRect = root.getBoundingClientRect();
      return cards.find(card => {
        const r = card.getBoundingClientRect();
        return r.top >= rootRect.top && r.top < rootRect.bottom;
      });
    };

    const findTargetCard = (dividers, topCard, direction) => {
      if (direction > 0) {
        const topCardRect = topCard.getBoundingClientRect();
        for (const div of dividers) {
          const r = div.getBoundingClientRect();
          if (r.top > topCardRect.top) {
            return div;
          }
        }
      } else {
        const topCardRect = topCard.getBoundingClientRect();
        for (let i = dividers.length - 1; i >= 0; i -= 1) {
          const div = dividers[i];
          const r = div.getBoundingClientRect();
          if (r.top < topCardRect.top) {
            return dividers[i - 1] || div;
          }
        }
      }
      return null;
    };

    let cards = getVisibleCards();
    if (!cards.length) return;

    const topCard = findTopVisibleCard(cards);
    if (!topCard) return;

    let dividers = getVisibleDividers();
    if (!dividers.length) return;

    let targetCard = findTargetCard(dividers, topCard, direction);

    if (!targetCard) {
      if (direction > 0) {
        await this._appendNextYear();
      } else {
        await this._prependPrevYear();
      }

      cards = getVisibleCards();
      dividers = getVisibleDividers();
      targetCard = findTargetCard(dividers, topCard, direction);

      if (!targetCard && cards.length) {
        targetCard = direction > 0 ? cards[cards.length - 1] : cards[0];
      }
    }

    if (targetCard) {
      this._scrollToCard(targetCard);
    }
  }
}