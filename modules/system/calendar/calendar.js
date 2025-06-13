import { DSAKalender } from './default.js';

export class DSAWorldCalendar extends foundry.data.CalendarData {
  static months = ['Praios', 'Rondra', 'Efferd', 'Travia', 'Boron', 'Hesinde', 'Namenloser', 'Firun', 'Tsa', 'Phex', 'Peraine', 'Ingerimm', 'Rahja'];
  static availableCalendars = [
    { key: 'none', name: '-' },
    { key: 'default', name: 'CALENDAR.DSA.defaultName', config: DSAKalender },
  ];

  static prepare() {
    Hooks.call('registerCalendars', DSAWorldCalendar.availableCalendars);
  }

  static init() {
    const selectedCalendar = DSAWorldCalendar.selectedCalendar();
    if (selectedCalendar) {
      CONFIG.time.worldCalendarConfig = selectedCalendar.config;
      CONFIG.time.worldCalendarClass = DSAWorldCalendar;
    }
    CONFIG.time.roundTime = 5;
    CONFIG.time.turnTime = 0;
  }

  static collectCalendars() {
    const transformed = {};
    console.warn(transformed, DSAWorldCalendar.availableCalendars);
    for (const calendar of DSAWorldCalendar.availableCalendars) {
      transformed[calendar.key] = game.i18n.localize(calendar.name);
    }

    console.warn(transformed, DSAWorldCalendar.availableCalendars);
    return transformed;
  }

  static selectedCalendar() {
    const calendar = game.settings.get('dsa5', 'calendar');
    if (calendar === 'none') return;

    const selected = this.availableCalendars.find(x => x.key == calendar) || this.availableCalendars.default;
    return selected;
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    return Object.assign(super.defineSchema(), {
      translationPrefix: new fields.StringField({ required: true, initial: '' }),
      moon: new fields.SchemaField(
        {
          cycle: new fields.NumberField({ required: true, initial: 28 }),
          anchor: new fields.SchemaField({
            year: new fields.NumberField({ required: true, initial: 1040 }),
            month: new fields.NumberField({ required: true, initial: 3 }),
            dayOfMonth: new fields.NumberField({ required: true, initial: 1 }),
          }),
          values: new fields.ArrayField(
            new fields.SchemaField({
              name: new fields.StringField({ required: true, blank: false }),
              dayStart: new fields.NumberField({ required: true, initial: 0 }),
            }),
          ),
        },
        { required: true, nullable: true, initial: null },
      ),
    });
  }

  // game.time.calendar.formatPraiosGefaellig(game.time.worldTime, "formatTimestamp")
  static formatPraiosGefaellig(calendar, components, _options) {
    const translationPrefix = calendar.translationPrefix;
    const yyyy = components.year + ' ' + game.i18n.localize(`${translationPrefix}.${CONFIG.time.worldCalendarConfig.years.yearSuffix}`);
    const month = calendar.months.values[components.month];
    const mm = game.i18n.localize(`${translationPrefix}.${month.name}`);
    const dd = components.dayOfMonth + 1;
    let h = components.hour;
    
    if (h > 11) h -= 12;

    const hourIndex = h > 5 ? h + 1 : h;
    const hourPart = components.hour > 11 ? "2." : "1. ";
    const hourName = game.i18n.localize(`${translationPrefix}.${CONFIG.time.worldCalendarConfig.months.values[hourIndex].name}`);
    const hourSuffix = game.i18n.localize('CALENDAR.DSA.hourSuffix');

    return `${hourPart}${hourName}${hourSuffix}, ${dd}. ${mm} ${yyyy}`;
  }

  static formatSeason(calendar, components, _options) {
    const translationPrefix = calendar.translationPrefix;
    const season = calendar.seasons.values[components.season];
    const seasonName = game.i18n.localize(`${translationPrefix}.${season.name}`);
    const h = components.hour.paddedString(2);
    const m = components.minute.paddedString(2);
    const s = components.second.paddedString(2);
    const moon = game.i18n.localize(`${translationPrefix}.${components.moon.phase.name}`);
    const dayOfWeek = game.i18n.localize(`${translationPrefix}.${calendar.days.values[components.dayOfWeek].name}`);
    const holiday = CONFIG.time.worldCalendarConfig.holidays.values.find((h) => {
      const start = h.dayStart;
      const end = h.dayEnd || h.dayStart + 1;
      return h.month === components.month && start <= components.dayOfMonth && components.dayOfMonth < end;
    });
    let res = `${seasonName}, ${moon}<br/>${dayOfWeek} - ${h}:${m}:${s}`;
    if (holiday) {
      res += `<br/>${game.i18n.localize(`${translationPrefix}.holiday.${holiday.name}`)}`;
    }
    return `<div class="center">${res}</div>`;
  }

  timeToComponents(time = 0) {
    const { day, dayOfMonth, dayOfWeek, hour, leapYear, minute, month, season, second, year } = super.timeToComponents(time);

    // Calculate moon phase
    let moon = null;
    if (this.moon) {
      // Calculate total days since anchor date
      const anchorDate = this.moon.anchor;
      const yearDiff = year - anchorDate.year;

      let totalDays = yearDiff * this.days.daysPerYear;

      for (let m = 0; m < month; m++) {
        totalDays += this.months.values[m].days;
      }

      totalDays += dayOfMonth - (anchorDate.dayOfMonth - 1);

      if (yearDiff === 0 && month >= anchorDate.month) {
        for (let m = 0; m < anchorDate.month; m++) {
          totalDays -= this.months.values[m].days;
        }
      }

      const dayInCycle = Math.abs(Math.floor(totalDays % this.moon.cycle));

      let currentPhase = this.moon.values[0];
      let phaseIndex = 0;
      for (const phase of this.moon.values) {
        if (dayInCycle >= phase.dayStart) {
          currentPhase = phase;
        } else {
          break;
        }
        phaseIndex++;
      }

      moon = {
        phase: currentPhase,
        previousMoon: phaseIndex - 1 < 0 ? this.moon.values.length - 1 : phaseIndex - 1,
        nextMoon: phaseIndex + 1 >= this.moon.values.length ? 0 : phaseIndex + 1,
        dayInCycle: dayInCycle,
        cycle: this.moon.cycle,
        phaseIndex,
      };
    }
    return { day, dayOfMonth, dayOfWeek, hour, leapYear, minute, month, season, second, year, moon };
  }
}

export class CalendarWidget extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static timeGradients = [
    { from: 0, to: 4, gradient: 'linear-gradient(to top, #0d1b2a, #1b263b)', textColor: '#e0e6ed' }, // Night - light text
    { from: 5, to: 6, gradient: 'linear-gradient(to top, #2c3e50, #f39c12)', textColor: '#fffbe6' }, // Dawn - light text
    { from: 7, to: 10, gradient: 'linear-gradient(to top, #87ceeb, #f1f2b5)', textColor: '#1a1a1a' }, // Morning - dark text
    { from: 11, to: 15, gradient: 'linear-gradient(to top, #87cefa, #ffffff)', textColor: '#111111' }, // Midday - dark text
    { from: 16, to: 18, gradient: 'linear-gradient(to top, #f1f2b5, #ff9966)', textColor: '#222' }, // Afternoon - dark text
    { from: 19, to: 20, gradient: 'linear-gradient(to top, #654ea3, #eaafc8)', textColor: '#fefefe' }, // Sunset - light text
    { from: 21, to: 23, gradient: 'linear-gradient(to top, #0f2027, #2c5364)', textColor: '#f0f8ff' }  // Night again - light text
  ];

  static DEFAULT_OPTIONS = {
    id: 'dsa-calendar-widget',
    window: {
      frame: false,
      positioned: false,
    },
    classes: ['dsaCalendarWidget', 'faded-ui'],
    actions: {
      edit: this.editCalendar,
      backward: { handler: this.backward, buttons: [0, 2] },
      forward: { handler: this.forward, buttons: [0, 2] },
      fastBackward: { handler: this.fastBackward, buttons: [0, 2] },
      fastForward: { handler: this.fastForward, buttons: [0, 2] },
    },
  };

  static PARTS = {
    main: {
      root: true,
      template: 'systems/dsa5/templates/system/calendar/widget.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    data.components = components;
    data.dateString = game.time.calendar.format(game.time.worldTime, 'formatPraiosGefaellig');
    data.dateTooltip = game.time.calendar.format(game.time.worldTime, 'formatSeason');
    data.isGM = game.user.isGM;
    data.dayTimeBackground = CalendarWidget.timeGradients.find(g => components.hour >= g.from && components.hour <= g.to);
    data.dayProgress = Math.round((components.hour * 3600 + components.minute * 60 + components.second) / (24 * 3600) * 100);
    return data;
  }

  static editCalendar(ev, target) {
    new DSACalendarPicker().render(true);
  }

  static backward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? -3600 : -60;
    game.time.advance(seconds + components.second);
  }

  static forward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? 3600 : 60;
    game.time.advance(seconds - components.second);
  }

  static fastBackward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? -3600 * 24 : -3600 * 24 * 7;
    game.time.advance(seconds + components.second + components.minute * 60);
  }

  static fastForward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? 3600 * 24 : 3600 * 24 * 7;
    game.time.advance(seconds - components.second - components.minute * 60);
  }
}

class DSACalendarPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'dsa-calendar-picker',
    window: {
      resizable: true,
    },
    classes: ['dsaCalendarPicker'],
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/calendar/picker.hbs',
    },
  };

  get title() {
    return game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.isGM = game.user.isGM;
    data.components = game.time.calendar.timeToComponents(game.time.worldTime);
    const translationPrefix = game.time.calendar.translationPrefix;
    data.monthOptions = game.time.calendar.months.values.map((month, index) => {
      return {
        name: `${translationPrefix}.${month.name}`,
        value: index,
        selected: index === data.components.month,
      };
    });
    const currentMonth = game.time.calendar.months.values[data.components.month];
    data.dayOptions = Array.from({ length: currentMonth.days }, (_, i) => {
      return {
        name: (i + 1).toString(),
        value: i,
        selected: i === data.components.dayOfMonth - 1,
      };
    });
    //sort holidays by next occurrence
    function getSortableDate(h) {
      return h.month * 100 + h.dayStart;
    }

    const currentDateValue = data.components.month * 100 + data.components.day;
    data.holidays = CONFIG.time.worldCalendarConfig.holidays.values
      .map((h) => ({
        ...h,
        sortValue: getSortableDate(h) >= currentDateValue ? getSortableDate(h) : getSortableDate(h) + 1300, // offset past-year holidays to wrap around
      }))
      .sort((a, b) => a.sortValue - b.sortValue)
      .map(({ sortValue, ...h }) => h)
      .map((h) => {
        const start = h.dayStart + 1;
        const end = h.dayEnd;
        const day = start + '.' + (end ? `-${end + 1}` : '');

        return {
          month: game.i18n.localize(`${translationPrefix}.${game.time.calendar.months.values[h.month].name}`),
          day,
          name: game.i18n.localize(`${translationPrefix}.holiday.${h.name}`),
        };
      });
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    html.find('.dateChange').on('change', async (ev) => {
      const form = ev.target.form;
      const components = new foundry.applications.ux.FormDataExtended(form).object;

      components.day = Math.min(components.day, game.time.calendar.months.values[components.month].days - 1);
      for (let m = 0; m < components.month; m++) {
        components.day += game.time.calendar.months.values[m].days;
      }
      const newTime = game.time.calendar.componentsToTime(components);
      await game.time.set(newTime);
      this.render(true);
    });
  }
}

Hooks.on('updateWorldTime', (worldTime, delta, options, userId) => {
  game.dsa5.apps.CalendarWidget.render(true);
});
