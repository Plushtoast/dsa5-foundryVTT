import { DSAWorldCalendar } from './calendar.js';
import { CalendarCanvas } from './calendarcanvas.js';
import { tabSlider } from '../../system/view_helper.js';

export class DSACalendarPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'dsa-calendar-picker',
    tag: 'form',
    window: {
      frame: false,
      positioned: false,
    },
    classes: ['dsaCalendarPicker', 'fullScreenApp'],
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

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!game.user.isGM) delete parts.config;
    return parts;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.isGM = game.user.isGM;
    data.calendar = game.time.calendar;
    data.worldCalendarConfig = CONFIG.time.worldCalendarConfig;
    data.components = data.calendar.timeToComponents(game.time.worldTime);
    data.appTitle = game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
    data.currentMonth = data.calendar.translate(data.calendar.months.values[data.components.month].name);

    function getSortableDate(h) {
      return h.month * 100 + h.dayStart;
    }

    const currentDateValue = data.components.month * 100 + data.components.dayOfMonth;
    data.holidays = data.worldCalendarConfig.holidays.values
      .map((h) => ({
        ...h,
        sortValue: getSortableDate(h) >= currentDateValue ? getSortableDate(h) : getSortableDate(h) + 1300, // offset past-year holidays to wrap around
      })).sort((a, b) => a.sortValue - b.sortValue)
      .map(({ sortValue, ...h }) => {
        const start = h.dayStart + 1;
        const end = h.dayEnd;
        const day = start + '.' + (end ? `-${end + 1}` : '');

        return {
          month: data.calendar.translate(data.calendar.months.values[h.month].name),
          day,
          name: data.calendar.translate(`holiday.${h.name}`),
        };
      });

    data.calenderSetting = game.settings.settings.get('dsa5.calendar');
    data.selectedCalendar = game.settings.get('dsa5', 'calendar');
    data.maxHoursPerDay = data.calendar.days.hoursPerDay;
    data.calendarConfig = game.settings.get('dsa5', 'calendarSettings');
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    tabSlider(html);
    html.find('.dateChange').on('change', async (ev) => {
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
    });

    html.find('.settingChange').on('change', async (ev) => this._onSettingChange(ev));
    html.find('[name="dsa5.calendar"').on('change', async (ev) => this._onChangeCalendar(ev));
    this._drawCalendar();
  }

  _drawCalendar() {
    if (!this.calendarRenderer) this.calendarRenderer = new CalendarCanvas(this.element, this._onCalendarCanvasCallback.bind(this), this._onCalendarCanvasHover.bind(this));
    this.calendarRenderer.render();
  }

  async _onCalendarCanvasHover(hoverBait) {
    console.log("Calendar hover bait", hoverBait);
    let content = '';
    if (hoverBait) {
      const components = game.time.calendar.timeToComponents(game.time.worldTime);
      switch (hoverBait.type) {
        case "day": 
          const month = game.time.calendar.translate(game.time.calendar.months.values[components.month].name);
          content = `<b>${hoverBait.day}. ${month}</b>`
          break;
        case "weekday":
          content = `<div><b>${game.time.calendar.translate('weekday', true)}</b>: ${game.time.calendar.translate(game.time.calendar.days.values[hoverBait.originalIndex].name)}</div>`;
          break;
        case "month":
          const monthImage = DSAWorldCalendar.monthImage(hoverBait.originalIndex);
          content = `<div>
                <img src="${monthImage}" style="width: 100px; height: 100px; object-fit: cover; object-position: center;" />    
            </div>
            <div>
                <b>${game.time.calendar.translate('month', true)}</b>: ${game.time.calendar.translate(game.time.calendar.months.values[hoverBait.originalIndex].name)}
            
            </div>
            `;
          break;
      }
    }

    const tooltip = this.element.querySelector('.tooltipBox')

    tooltip.innerHTML = content;
    tooltip.classList.toggle('dsahidden', !content);
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
    const value = ev.target.value;
    const setting = ev.target.name;

    const settings = game.settings.get('dsa5', 'calendarSettings');
    foundry.utils.setProperty(settings, setting, value);
    await game.settings.set('dsa5', 'calendarSettings', settings);
    game.dsa5.apps.CalendarWidget.render(true);
  }
}