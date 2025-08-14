import { DSAWorldCalendar } from './calendar.js';
import { CalendarCanvas } from './calendarcanvas.js';
import { tabSlider } from '../../system/helpers/view_helper.js';
import { DSACalendarEntry } from '../../data/journal/dsacalendar.js';
const { renderTemplate } = foundry.applications.handlebars;

export class DSACalendarPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'dsa-calendar-picker',
    tag: 'form',
    window: {
      frame: false,
      positioned: false,
    },
    classes: ['dsaCalendarPicker', 'fullScreenApp'],
    actions: {
      removeJournal: { handler: this._removeJournal, buttons: [0, 2] },
      addJournal: this._addJournal,
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
      scrollable: ['']
    },
    events: {
      template: 'systems/dsa5/templates/system/calendar/holidays.hbs',
      templates: ['systems/dsa5/templates/journal/calendarcard.hbs']
    },
    calendar: {
      template: 'systems/dsa5/templates/system/calendar/calendar.hbs',
      templates: ['systems/dsa5/templates/system/calendar/picker.hbs']
    },
  };

  get title() {
    return game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'calendar', label: 'CALENDAR.DSA.calendar' },
        { id: 'events', label: 'CALENDAR.DSA.holidays' },
        { id: 'config', label: 'CALENDAR.DSA.config' },
      ],
      initial: 'calendar',
    }
  }

  // invalidate on year and calendar change
  static async fromCache(components) {
    if (this.cached) {
      return this.cached;
    }
    const journals = await Promise.all(game.settings.get('dsa5', 'calendarJournals').activated.map(j => fromUuid(j.uuid)));
    const entries = journals.flatMap(j => j.pages.filter(p => p.type === 'dsacalendar' && game.user.isGM || p.system.visible)).flatMap(p => {
      return Object.values(p.system.calendarentries).map(entry => {
        DSACalendarEntry.prepareCalendarEntry(entry);
        return entry;
      });
    });

    this.cached = CONFIG.time.worldCalendarConfig.holidays.values
      .map(h => {
        let dayOffset = 0;
        for (let m = 0; m < h.month; m++) {
          dayOffset += game.time.calendar.months.values[m].days;
        }

        const day = dayOffset + h.dayStart;
        const year = components.year;

        const entry = {
          title: game.time.calendar.translate(`holiday.${h.name}`),
          //content: undefined,
          location: h.location,
          from: {
            dayOfMonth: h.dayStart + 1,
            month: h.month,
            year,
            day,
          },
          to: {
            dayOfMonth: h.dayEnd ? h.dayEnd + 1 : undefined,
          },
          category: 1,
          visible: true,
        }

        DSACalendarEntry.prepareCalendarEntry(entry);
        return entry;
      }).concat(entries);
    return this.cached;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!game.user.isGM) delete parts.config;
    return parts;
  }

  static async _addJournal(ev, target) {
    const container = this.element.querySelector('.journalPickerContainer');
    if (container.children.length == 0) {
      const activated = new Set(game.settings.get('dsa5', 'calendarJournals').activated.map(x => x.uuid));
      const possibleJournals = game.journal.filter(j => {
        return !activated.has(j.uuid) && j.pages.some(p => p.type === 'dsacalendar');
      }).reduce((acc, j) => {
        acc[j.uuid] = j.name;
        return acc;
      }, {});
      const content = await renderTemplate('systems/dsa5/templates/journal/calendarjournalpicker.hbs', { possibleJournals });
      container.innerHTML = content;
    } else {
      const settings = game.settings.get('dsa5', 'calendarJournals');
      const selected = this.element.querySelector('select[name="journal"]');
      settings.activated.push({ uuid: selected.value, name: selected.options[selected.selectedIndex].text });
      await game.settings.set('dsa5', 'calendarJournals', settings);
      this.render(true);
    }
  }

  static async _removeJournal(ev, target) {
    const uuid = target.dataset.uuid;

    if (ev.button == 2) {
      const settings = game.settings.get('dsa5', 'calendarJournals');
      settings.activated = settings.activated.filter(el => el.uuid !== uuid);
      game.settings.set('dsa5', 'calendarJournals', settings);
      this.render(true);
    } else {
      const journal = await fromUuid(uuid);
      if (!journal) return;

      this.close();
      journal.sheet.render(true);
    }
  }

  static invalidateCache(uuid) {
    if (uuid) {
      const activated = game.settings.get('dsa5', 'calendarJournals').activated;
      if (!activated.some(el => el.uuid === uuid)) return
    }
    this.cached == null;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const calendar = game.time.calendar;
    data.isGM = game.user.isGM;
    data.calendar = calendar;
    data.worldCalendarConfig = CONFIG.time.worldCalendarConfig;
    data.components = calendar.timeToComponents(game.time.worldTime);
    data.appTitle = game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
    data.currentMonth = calendar.translate(calendar.months.values[data.components.month].name);
    data.currentDay = data.components.dayOfMonth + 1;
    data.calendarSize = Math.min(window.innerWidth, window.innerHeight) * 0.75;
    data.yearSuffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);

    const currentDateValue = data.components.month * 100 + data.components.dayOfMonth;
    function getSortableDate(h) {
      const sortValue = h.from.month * 100 + h.from.dayOfMonth;
      return sortValue >= currentDateValue ? sortValue : sortValue + 1300;
    }

    data.sortedEntries = (await DSACalendarPicker.fromCache(data.components)).sort((a, b) => getSortableDate(a) - getSortableDate(b));
    data.calendarSetting = game.settings.settings.get('dsa5.calendar');
    data.selectedCalendar = game.settings.get('dsa5', 'calendar');
    data.maxHoursPerDay = calendar.days.hoursPerDay;
    data.calendarConfig = game.settings.get('dsa5', 'calendarSettings');
    data.calendarJournals = game.settings.get('dsa5', 'calendarJournals');
    return data;
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
    const html = $(this.element);

    tabSlider(html);
    this.#dateFormListeners();

    html.find('.settingChange').on('change', async (ev) => this._onSettingChange(ev));
    html.find('[name="dsa5.calendar"').on('change', async (ev) => this._onChangeCalendar(ev));
    this._drawCalendar();
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
      const components = game.time.calendar.timeToComponents(game.time.worldTime);
      const refreshedTimePart = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/picker.hbs', {
        components,
        calendar: game.time.calendar,
        currentMonth: game.time.calendar.translate(game.time.calendar.months.values[components.month].name),
        worldCalendarConfig: CONFIG.time.worldCalendarConfig,
        currentDay: components.dayOfMonth + 1,
      });
      const div = document.createElement('div');
      div.innerHTML = refreshedTimePart;
      this.element.querySelector('.calendarDateChange').innerHTML = div.querySelector('.calendarDateChange').innerHTML;
      this.#dateFormListeners();
      this._drawCalendar();
    }
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
        tooltipContent = this._buildDayTooltip(hoverBait, components);
        break;
      case "weekday":
        tooltipContent = this._buildWeekdayTooltip(hoverBait, components);
        break;
      case "month":
        const result = this._buildMonthTooltip(hoverBait);
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

  _buildDayTooltip(hoverBait, components) {
    const calendar = game.time.calendar;
    const modifiedComponents = foundry.utils.deepClone(components);
    modifiedComponents.day += hoverBait.index - components.dayOfMonth;

    const converted = calendar.componentsToTime(modifiedComponents);
    const convertedComponents = calendar.timeToComponents(converted);

    const moon = calendar.translate(convertedComponents.moon.phase.name);
    const month = calendar.translate(calendar.months.values[components.month].name);
    const weekday = calendar.translate(calendar.days.values[convertedComponents.dayOfWeek].name);
    const holidays = this._getHolidaysFormatted(convertedComponents);

    return `<div>
      <b>${hoverBait.day}. ${month}</b><br/>
      <b>${calendar.translate('weekday', true)}</b>: ${weekday}<br/>
      <b>${calendar.translate("moonphase", true)}</b>: ${moon}
      ${holidays ? `<br/><b>${calendar.translate('holidays', true)}</b>: ${holidays}` : ''}
    </div>`;
  }

  _buildWeekdayTooltip(hoverBait, components) {
    const calendar = game.time.calendar;
    const modifiedComponents = foundry.utils.deepClone(components);
    modifiedComponents.day += hoverBait.originalIndex - components.dayOfWeek;

    const converted = calendar.componentsToTime(modifiedComponents);
    const convertedComponents = calendar.timeToComponents(converted);

    const moon = calendar.translate(convertedComponents.moon.phase.name);
    const dayOfMonth = convertedComponents.dayOfMonth + 1;
    const monthName = calendar.translate(calendar.months.values[convertedComponents.month].name);
    const weekdayName = calendar.translate(calendar.days.values[hoverBait.originalIndex].name);
    const holidays = this._getHolidaysFormatted(convertedComponents);

    return `<div>
      <b>${dayOfMonth}. ${monthName}</b><br/>
      <b>${calendar.translate('weekday', true)}</b>: ${weekdayName}<br/>
      <b>${calendar.translate("moonphase", true)}</b>: ${moon}
      ${holidays ? `<br/><b>${calendar.translate('holidays', true)}</b>: ${holidays}` : ''}
    </div>`;
  }

  _buildMonthTooltip(hoverBait) {
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

  _getHolidaysFormatted(components) {
    const holidays = game.time.calendar.findHolidays(components) || [];
    return holidays.map(h => game.time.calendar.translate(`holiday.${h.name}`)).join('<br/>');
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