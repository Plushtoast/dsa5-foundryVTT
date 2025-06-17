import { tabSlider } from '../view_helper.js';
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

  static async autoDayLight() {
    const selectedCalendar = DSAWorldCalendar.selectedCalendar();
    if (!selectedCalendar) return;

    const settings = game.settings.get('dsa5', 'calendarSettings');
    if (!settings.lightByDayTime) return;

    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const currentGradient = CalendarWidget.dayTimeBackground(components);

    let lightLevel = settings.dayDarknessAdjust[currentGradient.key] || 0;

    if (settings.moonAddsLight && currentGradient.key == 'night') {
      lightLevel -= settings.moon.darknessAdjust * components.moon.phase.lightAdjust;
    }

    if (canvas.scene) canvas.scene.update({ 'environment.darknessLevel': Math.clamp(lightLevel, 0, 1) }, { animateDarkness: 1000 });
  }

  static collectCalendars() {
    const transformed = {};
    for (const calendar of DSAWorldCalendar.availableCalendars) {
      transformed[calendar.key] = game.i18n.localize(calendar.name);
    }
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
              lightAdjust: new fields.NumberField({ required: true, initial: 0.1 }),
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
    { from: 'dayStart', to: 'dawn', gradient: 'linear-gradient(to top, #0d1b2a, #1b263b)', textColor: '#e0e6ed', key: 'night' }, // Night - light text
    { from: 'dawn', to: 'morning', gradient: 'linear-gradient(to top, #2c3e50, #f39c12)', textColor: '#fffbe6', key: 'dawn' }, // Dawn - light text
    { from: 'morning', to: 'noon', gradient: 'linear-gradient(to top, #87ceeb, #f1f2b5)', textColor: '#1a1a1a', key: 'morning' }, // Morning - dark text
    { from: 'noon', to: 'afternoon', gradient: 'linear-gradient(to top, #87cefa, #ffffff)', textColor: '#111111', key: 'noon' }, // Midday - dark text
    { from: 'afternoon', to: 'sunset', gradient: 'linear-gradient(to top, #f1f2b5, #ff9966)', textColor: '#222', key: 'afternoon' }, // Afternoon - dark text
    { from: 'sunset', to: 'night', gradient: 'linear-gradient(to top, #654ea3, #eaafc8)', textColor: '#fefefe', key: 'sunset' }, // Sunset - light text
    { from: 'night', to: 'dayEnd', gradient: 'linear-gradient(to top, #0f2027, #2c5364)', textColor: '#f0f8ff', key: 'night' }  // Night again - light text
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
      smallBackward: { handler: this.smallBackward, buttons: [0, 2] },
      smallForward: { handler: this.smallForward, buttons: [0, 2] },
    },
  };

  static PARTS = {
    main: {
      root: true,
      template: 'systems/dsa5/templates/system/calendar/widget.hbs',
    },
  };

  static dayTimeBackground(components) {
    const maxHoursPerDay = game.time.calendar.days.hoursPerDay;
    const calendarConfig = game.settings.get('dsa5', 'calendarSettings');
    const timeGradientsConfig = foundry.utils.mergeObject({
      'dayStart': 0,
      'dayEnd': maxHoursPerDay,
    }, calendarConfig)

    return CalendarWidget.timeGradients.find(g => {
      const from = timeGradientsConfig[g.from] || 0;
      const to = timeGradientsConfig[g.to] || maxHoursPerDay;
      return components.hour >= from && components.hour < to
    }) || CalendarWidget.timeGradients[0];
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    data.components = components;
    data.dateString = game.time.calendar.format(game.time.worldTime, 'formatPraiosGefaellig');
    data.dateTooltip = game.time.calendar.format(game.time.worldTime, 'formatSeason');
    data.isGM = game.user.isGM;
    data.dayTimeBackground = this.constructor.dayTimeBackground(components);
    data.dayProgress = Math.round((components.hour * 3600 + components.minute * 60 + components.second) / (24 * 3600) * 100);
    return data;
  }

  static editCalendar(ev, target) {
    if (this.wasDragging) {
      this.wasDragging = false;
      return;
    }

    new DSACalendarPicker().render(true);
  }

  static smallBackward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? -1800 : -60;
    game.time.advance(seconds + components.second);
  }

  static smallForward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? 1800 : 60;;
    game.time.advance(seconds - components.second);
  }

  static backward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? -3600 : -6 * 3600;
    game.time.advance(seconds + components.second);
  }

  static forward(ev, target) {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const seconds = ev.button != 2 ? 3600 : 6 * 3600;;
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

  async _onRender(context, options) {
    await super._onRender(context, options);

    if (!game.user.isGM) return;

    const indicator = this.element.querySelector('.slideIndicator');
    const container = this.element.querySelector('.dayProgress');

    indicator.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.wasDragging = false;
      this.offsetX = e.clientX - indicator.offsetLeft;
      e.preventDefault();
      e.stopPropagation();
    });

    this.element.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      this.wasDragging = true;
      let newLeft = e.clientX - this.offsetX;
      const containerRect = container.getBoundingClientRect();
      const maxLeft = containerRect.width - indicator.offsetWidth;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      const percentage = newLeft / maxLeft * 100.0;
      indicator.style.setProperty('--p', `${percentage}%`);
      this.currentPercentage = percentage;

      const secondsInDay = 24 * 3600 * this.currentPercentage / 100.0;
      const hour = Math.floor(secondsInDay / 3600) || 0;
      const minute = Math.floor((secondsInDay % 3600) / 60) || 0;
      const second = Math.floor(secondsInDay % 60) || 0;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
      const dayTimeBackground = this.constructor.dayTimeBackground({ hour, minute, second });
      container.style.width = containerRect.width + 'px';
      container.style.background = dayTimeBackground.gradient;
      container.style.color = dayTimeBackground.textColor;
      container.querySelector('.timeIndicator').textContent = timeString;
    });

    this.element.addEventListener('mouseup', (ev) => {
      if (!this.isDragging) return;

      this.isDragging = false;

      ev.preventDefault();
      ev.stopPropagation();

      const components = game.time.calendar.timeToComponents(game.time.worldTime);
      const secondsInDay = 24 * 3600 * this.currentPercentage / 100.0;
      const passedTime = Math.floor(secondsInDay - (components.hour * 3600 + components.minute * 60 + components.second));
      game.time.advance(passedTime);
    });
  }
}

class DSACalendarPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
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
    data.components = data.calendar.timeToComponents(game.time.worldTime);
    data.appTitle = game.i18n.localize(DSAWorldCalendar.selectedCalendar().name);
    const translationPrefix = data.calendar.translationPrefix;
    data.monthOptions = data.calendar.months.values.map((month, index) => {
      return {
        name: `${translationPrefix}.${month.name}`,
        value: index,
        selected: index === data.components.month,
      };
    });
    const currentMonth = data.calendar.months.values[data.components.month];
    data.dayOptions = Array.from({ length: currentMonth.days }, (_, i) => {
      return {
        name: (i + 1).toString(),
        value: i,
        selected: i === data.components.dayOfMonth - 1,
      };
    });

    function getSortableDate(h) {
      return h.month * 100 + h.dayStart;
    }

    const currentDateValue = data.components.month * 100 + data.components.dayOfMonth;
    data.holidays = CONFIG.time.worldCalendarConfig.holidays.values
      .map((h) => ({
        ...h,
        sortValue: getSortableDate(h) >= currentDateValue ? getSortableDate(h) : getSortableDate(h) + 1300, // offset past-year holidays to wrap around
      })).sort((a, b) => a.sortValue - b.sortValue)
      .map(({ sortValue, ...h }) => {
        const start = h.dayStart + 1;
        const end = h.dayEnd;
        const day = start + '.' + (end ? `-${end + 1}` : '');

        return {
          month: game.i18n.localize(`${translationPrefix}.${data.calendar.months.values[h.month].name}`),
          day,
          name: game.i18n.localize(`${translationPrefix}.holiday.${h.name}`),
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

      components.day = Math.min(components.day, game.time.calendar.months.values[components.month].days - 1);
      for (let m = 0; m < components.month; m++) {
        components.day += game.time.calendar.months.values[m].days;
      }
      const newTime = game.time.calendar.componentsToTime(components);
      await game.time.set(newTime);
      this.render(true);
    });

    html.find('.settingChange').on('change', async (ev) => this._onSettingChange(ev));
    html.find('[name="dsa5.calendar"').on('change', async (ev) => this._onChangeCalendar(ev));
    this._drawCalendar();
  }

  async _drawCalendar() {
    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const canvas = document.querySelector('.circular-calendar');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const radiusOuter = 300;   // Month ring
    const radiusDays = 270;    // Day dots
    const radiusWeekdays = 140; // Weekday labels
    const outerFrame = radiusOuter + 15;

    let months = game.time.calendar.months.values.map((m) => game.i18n.localize(`${game.time.calendar.translationPrefix}.${m.name}`))
    let weekdays = game.time.calendar.days.values.map((d) => game.i18n.localize(`${game.time.calendar.translationPrefix}.${d.name}`));

    const currentMonth = components.month;
    const currentDay = components.dayOfMonth;
    const currentWeekday = components.dayOfWeek;
    const daysInMonth = game.time.calendar.months.values[currentMonth].days

    // circle the months until the first month is the current month
    months = months.slice(currentMonth).concat(months.slice(0, currentMonth));
    weekdays = weekdays.slice(currentWeekday).concat(weekdays.slice(0, currentWeekday));

    const backgroundImage = "systems/dsa5/icons/backgrounds/turnMarker.webp";

    const loadImage = () => {
      return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = radiusOuter * 2;
        const offset = size / 2;
        ctx.drawImage(img, centerX - offset, centerY - offset, size, size);
        resolve();
      };
      img.src = backgroundImage;
      });
    };

    const bgGradient = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, outerFrame);
    bgGradient.addColorStop(0, "#1a1a1a");
    bgGradient.addColorStop(1, "#000000");
    
    // Fill the full circle area
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerFrame, 0, 2 * Math.PI, false);
    ctx.fillStyle = bgGradient;
    ctx.fill();
      
    await loadImage();

    function drawBorder(radius, color = "#444", width = 1) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    drawBorder(outerFrame, "#888", 2);
    drawBorder(radiusOuter - 15, "#555", 1);
    drawBorder(radiusDays, "#555", 1);
    drawBorder(radiusWeekdays + 15, "#555", 1);    
    drawBorder(radiusWeekdays - 15, "#555", 1);

    ctx.font = "16px Garamond";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw months along the full circle
    months.forEach((month, i) => {
      const angle = (2 * Math.PI * i) / months.length;
      const x = centerX + Math.cos(angle - Math.PI/2) * radiusOuter;
      const y = centerY + Math.sin(angle - Math.PI/2) * radiusOuter;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "#e0c080";
      ctx.fillText(month, 0, 0);
      ctx.restore();
    });

    // Draw days in full circle
    for (let d = 0; d < daysInMonth; d++) {
      const angle = (2 * Math.PI * d) / daysInMonth;
      const x = centerX + Math.cos(angle - Math.PI/2) * radiusDays;
      const y = centerY + Math.sin(angle - Math.PI/2) * radiusDays;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff6d0";
      ctx.fill();
    }

    // Highlight current day
    const angleToday = (2 * Math.PI * currentDay) / daysInMonth;
    const xToday = centerX + Math.cos(angleToday - Math.PI/2) * radiusDays;
    const yToday = centerY + Math.sin(angleToday - Math.PI/2) * radiusDays;

    ctx.beginPath();
    ctx.arc(xToday, yToday, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffcc00";
    ctx.fill();

    ctx.font = "12px Garamond";
    
    // Draw weekdays in full circle
    weekdays.forEach((day, i) => {
      const angle = (2 * Math.PI * i) / weekdays.length;
      const x = centerX + Math.cos(angle - Math.PI/2) * radiusWeekdays;
      const y = centerY + Math.sin(angle - Math.PI/2) * radiusWeekdays;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = (i === currentWeekday) ? "#ffcc00" : "#e0c080";
      ctx.fillText(day, 0, 0);
      ctx.restore();
    });
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

Hooks.on('updateWorldTime', (worldTime, delta, options, userId) => {
  game.dsa5.apps.CalendarWidget.render(true);
  DSAWorldCalendar.autoDayLight();
});
