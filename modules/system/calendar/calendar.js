import { DSAKalender } from './default.js';
import { CalendarWidget } from './calendarwidget.js';

export class DSAWorldCalendar extends foundry.data.CalendarData {
  static months = ['Praios', 'Rondra', 'Efferd', 'Travia', 'Boron', 'Hesinde', 'Namenloser', 'Firun', 'Tsa', 'Phex', 'Peraine', 'Ingerimm', 'Rahja'];
  static availableCalendars = [
    { key: 'none', name: '-' },
    { key: 'default', name: 'CALENDAR.DSA.defaultName', config: DSAKalender },
  ];

  static prepare() {
    Hooks.call('registerCalendars', DSAWorldCalendar.availableCalendars);
  }

  static monthImage(index) {
    return `systems/dsa5/icons/months/${DSAWorldCalendar.months[index]}.webp`;
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

  translate(key, basicKey = false) {
    const translationPrefix = basicKey ? 'CALENDAR.DSA' : this.translationPrefix;
    return game.i18n.localize(translationPrefix + '.' + key);
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
    const yyyy = components.year + ' ' + calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
    const month = calendar.months.values[components.month];
    const mm = calendar.translate(month.name);
    const dd = components.dayOfMonth + 1;
    let h = components.hour;

    if (h > 11) h -= 12;

    const hourIndex = h > 5 ? h + 1 : h;
    const hourPart = components.hour > 11 ? "2." : "1. ";
    const hourName = calendar.translate(CONFIG.time.worldCalendarConfig.months.values[hourIndex].name);
    const hourSuffix = game.i18n.localize('CALENDAR.DSA.hourSuffix');

    return `${hourPart}${hourName}${hourSuffix}, ${dd}. ${mm} ${yyyy}`;
  }

  static seasonParts(calendar, components, _options) {
    const season = calendar.seasons.values[components.season];
    const seasonName = calendar.translate(season.name);
    const h = components.hour.paddedString(2);
    const m = components.minute.paddedString(2);
    const s = components.second.paddedString(2);
    const moon = calendar.translate(components.moon.phase.name);
    const dayOfWeek = calendar.translate(calendar.days.values[components.dayOfWeek].name);
    const holiday = CONFIG.time.worldCalendarConfig.holidays.values.find((h) => {
      const start = h.dayStart;
      const end = h.dayEnd || h.dayStart + 1;
      return h.month === components.month && start <= components.dayOfMonth && components.dayOfMonth < end;
    });
    
    return {
      seasonName,
      moon,
      dayOfWeek,
      h,
      m,
      s,
      holiday
    }
  }

  static formatSeason(calendar, components, _options) {
    const { seasonName, moon, dayOfWeek, h, m, s, holiday } = DSAWorldCalendar.seasonParts(calendar, components, _options);
    let res = `${seasonName}, ${moon}<br/>${dayOfWeek} - ${h}:${m}:${s}`;
    if (holiday) {
      res += `<br/>${calendar.translate(`holiday.${holiday.name}`)}`;
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

Hooks.on('updateWorldTime', (worldTime, delta, options, userId) => {
  game.dsa5.apps.CalendarWidget.render(true);
  game.dsa5.apps.CalendarPicker?.render();
  DSAWorldCalendar.autoDayLight();
});
