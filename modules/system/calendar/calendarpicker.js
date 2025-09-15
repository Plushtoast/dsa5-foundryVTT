import { DSAWorldCalendar } from './calendar.js';
import { CalendarCanvas } from './calendarcanvas.js';
import { tabSlider } from '../../system/helpers/view_helper.js';
import { DSACalendarEntry } from '../../data/journal/dsacalendar.js';
import { PersonaeDramatis } from './personaedramatis.js';
const { renderTemplate } = foundry.applications.handlebars;

export class DSACalendarPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static #cached;

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
      openMoreSearch: this.#toggleMoreSearch,
      ...PersonaeDramatis.actions,
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
      scrollable: [''],
      templates: ['systems/dsa5/templates/system/dsatabs.hbs'],
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
    }
  };

  #search;
  #personaeDramatis = new PersonaeDramatis(this);

  get title() {
    return game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'calendar', label: 'CALENDAR.DSA.calendar', icon: 'fas fa-calendar' },
        { id: 'events', label: 'CALENDAR.DSA.holidays', icon: 'fas fa-person-praying' },
        { id: 'personae', label: 'PERSONAE.title', icon: 'fas fa-user' },
        { id: 'config', label: 'CALENDAR.DSA.config', icon: 'fas fa-cog' },
      ],
      initial: 'calendar',
    },
    config: {
      tabs: [
        { id: 'calendar_config', label: 'CALENDAR.DSA.calendar', icon: 'fas fa-cog' },
        { id: 'personae_config', label: 'PERSONAE.ImportantPersons', icon: 'fas fa-cog' },
      ],
      initial: 'calendar_config',
    }
  };

  // invalidate on year and calendar change
  static async fromCache(components) {
    if (this.#cached) return this.#cached;

    const journalSettings = game.settings.get('dsa5', 'calendarJournals');
    const activated = journalSettings.activated || [];

    const loaded = await Promise.allSettled(activated.map(j => fromUuid(j.uuid)));
    const validJournals = loaded
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    const year = components.year;

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
        await DSACalendarEntry.prepareCalendarEntry(entry);
        entry.isOwner = page.isOwner;
        entry.uuid = page.uuid;
        entry.juuid = page.parent?.uuid;
        entry.calendarKey = key;
        return entry;
      }));
      preparedEntries.push(...processed);
    }

    const months = game.time.calendar.months.values;
    const monthPrefix = new Array(months.length + 1);
    monthPrefix[0] = 0;
    for (let m = 0; m < months.length; m++) monthPrefix[m + 1] = monthPrefix[m] + months[m].days;

    const holidayDefs = CONFIG.time.worldCalendarConfig.holidays.values || [];
    const holidayEntries = [];
    for (const holiday of holidayDefs) {
      const dayOffset = monthPrefix[holiday.month] ?? 0;
      const entry = {
        title: game.time.calendar.translate(`holiday.${holiday.name}`),
        location: holiday.location,
        from: {
          dayOfMonth: holiday.dayStart + 1,
          month: holiday.month,
          year,
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
      await DSACalendarEntry.prepareCalendarEntry(entry);
      holidayEntries.push(entry);
    }

    this.#cached = [...holidayEntries, ...preparedEntries];
    return this.#cached;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!game.user.isGM) delete parts.config;
    return parts;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!game.user.isGM) delete tabs.config;
    return tabs;
  }

  static async #addJournal(ev, target) {
    const fieldset = target.closest('fieldset');
    const container = fieldset.querySelector('.journalPickerContainer');
    const setting = target.dataset.setting;
    if (container.children.length == 0) {
      const activated = new Set(game.settings.get('dsa5', setting).activated.map(x => x.uuid));
      const category = {
        'calendarJournals': 'dsacalendar',
        'calendarActors': 'dsapersonaedramatis',
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

    const entry = journal.system.calendarentries[key];
    if (!entry) return;

    this.close();
    journal.sheet.render({ force: true, search: entry.title });
  }

  static #toggleMoreSearch(ev, target) {
    const moreOptions = target.closest('.flexcol').querySelector('.moreSearchOptions').classList.toggle('dsahidden');
    target.classList.toggle('fa-caret-up', !moreOptions);
    target.classList.toggle('fa-caret-down', moreOptions);
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

  static invalidateCache(uuid) {
    if (uuid) {
      const activated = game.settings.get('dsa5', 'calendarJournals').activated;
      if (!activated.some(el => el.uuid === uuid)) return
    }
    game.socket.emit('system.dsa5', {
      type: 'invalidateCache',
    });
    this.#cached = null;
  }

  #getSortableDate(h, currentDateValue) {
    const sortValue = h.from.month * 100 + h.from.dayOfMonth;
    return sortValue >= currentDateValue ? sortValue : sortValue + 1300;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const calendar = game.time.calendar;
    data.tabs = this._prepareTabs('sheet');
    data.isGM = game.user.isGM;
    data.calendar = calendar;
    data.appTitle = game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
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
    }
    return context;
  }

  async _prepareConfigContext(context, options) {
    const calendar = game.time.calendar;
    if (!context.calendarJournals) context.calendarJournals = game.settings.get('dsa5', 'calendarJournals');
    
    context.calendarActors = game.settings.get('dsa5', 'calendarActors');
    context.calendarSetting = game.settings.settings.get('dsa5.calendar');
    context.selectedCalendar = game.settings.get('dsa5', 'calendar');
    context.maxHoursPerDay = calendar.days.hoursPerDay;
    context.calendarConfig = game.settings.get('dsa5', 'calendarSettings');
    context.configTabs = this._prepareTabs('config');
  }

  async _prepareCalendarContext(context, options) {
    const calendar = game.time.calendar;
    if (!context.components) context.components = calendar.timeToComponents(game.time.worldTime);

    context.worldCalendarConfig = CONFIG.time.worldCalendarConfig;
    context.currentMonth = calendar.translate(calendar.months.values[context.components.month].name);
    context.currentDay = context.components.dayOfMonth + 1;
    context.calendarSize = Math.min(window.innerWidth, window.innerHeight) * 0.75;
  }

  async _prepareEventsContext(context, options) {
    const calendar = game.time.calendar;
    if (!context.components) context.components = calendar.timeToComponents(game.time.worldTime);
    if (!context.calendarJournals) context.calendarJournals = game.settings.get('dsa5', 'calendarJournals');

    const currentDateValue = context.components.month * 100 + context.components.dayOfMonth;
    context.sortedEntries = (await DSACalendarPicker.fromCache(context.components))
      .sort((a, b) => this.#getSortableDate(a, currentDateValue) - this.#getSortableDate(b, currentDateValue));

    context.dayCategories = Object.entries(DSACalendarEntry.CATEGORY_CHOICES).reduce((acc, [key, val]) => {
      acc[key] = { key, name: val, color: DSACalendarEntry.CATEGORY_COLORS[key], icon: DSACalendarEntry.CATEGORY_ICONS[key] };
      return acc;
    }, {});
  }

  async #onDateChange(ev) {
    if (ev.currentTarget.name == 'year') game.dsa5.apps.CalendarPicker.constructor.invalidateCache();

    const form = ev.target.form;
    const components = new foundry.applications.ux.FormDataExtended(form).object;
    const currentComponents = game.time.calendar.timeToComponents(game.time.worldTime);
    components.month = currentComponents.month;
    components.day = Math.min(currentComponents.day, game.time.calendar.months.values[components.month].days - 1);
    for (let m = 0; m < components.month; m++) {
      components.day += game.time.calendar.months.values[m].days;
    }
    const newTime = game.time.calendar.componentsToTime(components);
    await game.time.set(newTime);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    tabSlider($(this.element));
    this.#dateFormListeners();
    this.element.querySelectorAll('.settingChange').forEach(element => {
      element.addEventListener('change', this._onSettingChange.bind(this));
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
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#search?.unbind();
    this.#personaeDramatis._tearDown(options);
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

  async refreshCalendar() {
    if (this.rendered) {
      const context = { calendar: game.time.calendar, };
      await this._prepareCalendarContext(context, {});
      const refreshedTimePart = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/picker.hbs', context);
      const div = document.createElement('div');
      div.innerHTML = refreshedTimePart;
      this.element.querySelector('.calendarDateChange').innerHTML = div.querySelector('.calendarDateChange').innerHTML;
      this.#dateFormListeners();
      this._drawCalendar();

      this.render({ force: true, parts: ['events'] });
    }
  }

  async close(options = {}) {
    options.animate = false;
    super.close(options);
  }

  _onClose(options) {
    this.calendarRenderer?.destroy();
    this.calendarRenderer = null;
  }

  _drawCalendar() {
    const appContainer = this.element.querySelector('.circular-calendar');
    //const appContainer = this.element;
    if (this.calendarRenderer) {
      this.calendarRenderer.element = appContainer;
    }
    else {
      this.calendarRenderer = new CalendarCanvas(appContainer, this._onCalendarCanvasCallback.bind(this), this._onCalendarCanvasHover.bind(this));
    }
    this.calendarRenderer.render();
  }

  async _onCalendarCanvasHover(hoverBait) {
    if (!hoverBait) {
      this._clearTooltips();
      return;
    }

    const components = game.time.calendar.timeToComponents(game.time.worldTime);
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
    const weekday = calendar.translate(calendar.days.values[convertedComponents.dayOfWeek].name);
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

    // Calculate day offset for this month
    let dayOffset = 0;
    for (let m = 0; m < monthIndex; m++) {
      dayOffset += calendar.months.values[m].days;
    }
    const modifiedComponents = {
      ...calendar.timeToComponents(game.time.worldTime),
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
      const name = game.i18n.has(key) ? game.i18n.localize(key) : h.title;
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
    if (!game.user.isGM) return;

    let { year, month, day, hour, minute, second, dayOfWeek, dayOfMonth } = game.time.calendar.timeToComponents(game.time.worldTime);

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
    const time = game.time.calendar.componentsToTime({ year, month, day, hour, minute, second });
    await game.time.set(time);
  }

  async _onChangeCalendar(ev) {
    game.settings.set('dsa5', 'calendar', ev.target.value);
    foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true })
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
  }
}