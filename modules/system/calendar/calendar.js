import { DSAKalender } from './default.js';
import { CalendarWidget } from './calendarwidget.js';

export class DSAWorldCalendar extends foundry.data.CalendarData {
  static months = ['Praios', 'Rondra', 'Efferd', 'Travia', 'Boron', 'Hesinde', 'Firun', 'Tsa', 'Phex', 'Peraine', 'Ingerimm', 'Rahja', 'Namenloser'];

  static availableCalendars = [
    { key: 'none', name: '-' },
    { key: 'default', name: 'CALENDAR.DSA.defaultName', config: DSAKalender },
  ];

  static prepare() {
    Hooks.call('registerCalendars', this.availableCalendars);
  }

  static monthImage(index) {
    return `systems/dsa5/icons/months/${this.months[index]}.webp`;
  }

  static init() {
    const selectedCalendar = this.selectedCalendar();
    if (selectedCalendar) {
      CONFIG.time.worldCalendarConfig = selectedCalendar.config;
      CONFIG.time.worldCalendarClass = this;
    }
    CONFIG.time.roundTime = 5;
    CONFIG.time.turnTime = 0;
  }

  translate(key, basicKey = false) {
    const translationPrefix = basicKey ? 'CALENDAR.DSA' : this.translationPrefix;
    return game.i18n.localize(`${translationPrefix}.${key}`);
  }

  static async autoDayLight() {
    const selectedCalendar = this.selectedCalendar();
    if (!selectedCalendar) return;

    const settings = game.settings.get('dsa5', 'calendarSettings');
    if (!settings.lightByDayTime) return;

    const components = game.time.calendar.timeToComponents(game.time.worldTime);
    const currentGradient = CalendarWidget.dayTimeBackground(components);

    let lightLevel = settings.dayDarknessAdjust[currentGradient.key] || 0;

    if (settings.moonAddsLight && currentGradient.key === 'night' && components.moon) {
      lightLevel -= settings.moon.darknessAdjust * components.moon.phase.lightAdjust;
    }

    if (canvas.scene) {
      canvas.scene.update(
        { 'environment.darknessLevel': Math.clamp(lightLevel, 0, 1) },
        { animateDarkness: 1000 }
      );
    }
  }

  static collectCalendars() {
    return Object.fromEntries(
      this.availableCalendars.map(calendar => [
        calendar.key,
        game.i18n.localize(calendar.name)
      ])
    );
  }

  static selectedCalendar() {
    const calendar = game.settings.get('dsa5', 'calendar');
    if (calendar === 'none') return null;

    return this.availableCalendars.find(x => x.key === calendar) || this.availableCalendars[1]; // Default to second entry
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      translationPrefix: new fields.StringField({ required: true, initial: '' }),
      moon: new fields.SchemaField({
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
          })
        ),
      }, { required: true, nullable: true, initial: null }),
    };
  }

  // Format time as "formatPraiosGefaellig"
  static formatPraiosGefaellig(calendar, components, _options) {
    const yyyy = `${components.year} ${calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix)}`;
    const month = calendar.months.values[components.month];
    const mm = calendar.translate(month.name);
    const dd = components.dayOfMonth + 1;

    let h = components.hour;
    if (h > 11) h -= 12;

    const hourIndex = h;
    const hourPart = components.hour > 11 ? "2." : "1.";
    const hourName = calendar.translate(CONFIG.time.worldCalendarConfig.months.values[hourIndex].name);
    const hourSuffix = game.i18n.localize('CALENDAR.DSA.hourSuffix');

    return `${hourPart} ${hourName}${hourSuffix}, ${dd}. ${mm} ${yyyy}`;
  }

  findHolidays(components) {
    return CONFIG.time.worldCalendarConfig.holidays.values.filter(h =>
      h.month === components.month &&
      h.dayStart <= components.dayOfMonth &&
      components.dayOfMonth < (h.dayEnd || h.dayStart + 1)
    );
  }

  static seasonParts(calendar, components, _options) {
    const season = calendar.seasons.values[components.season];
    
    return {
      seasonName: calendar.translate(season.name),
      moon: calendar.translate(components.moon?.phase.name || ''),
      dayOfWeek: calendar.translate(calendar.days.values[components.dayOfWeek].name),
      h: components.hour.toString().padStart(2, '0'),
      m: components.minute.toString().padStart(2, '0'),
      s: components.second.toString().padStart(2, '0'),
      holiday: calendar.findHolidays(components) || null,
    };
  }

  static formatSeason(calendar, components, options) {
    const { seasonName, moon, dayOfWeek, h, m, s, holiday } = calendar.constructor.seasonParts(calendar, components, options);

    let result = `${seasonName}, ${moon}<br/>${dayOfWeek} - ${h}:${m}:${s}`;

    if (holiday) {
      result += holiday.map(h => `<br/>${calendar.translate(`holiday.${h.name}`)}`);
    }

    return `<div class="center">${result}</div>`;
  }

  timeToComponents(time = 0) {
    const components = super.timeToComponents(time);

    // Calculate moon phase
    components.moon = null;

    if (this.moon) {
      const { year, month, dayOfMonth } = components;
      const { anchor, cycle, values } = this.moon;

      // Calculate total days since anchor date
      const yearDiff = year - anchor.year;
      let totalDays = yearDiff * this.days.daysPerYear;

      // Add days from current year's elapsed months
      for (let m = 0; m < month; m++) {
        totalDays += this.months.values[m].days;
      }

      // Add days in current month
      totalDays += dayOfMonth - (anchor.dayOfMonth - 1);

      // Adjust if within same year
      if (yearDiff === 0 && month >= anchor.month) {
        for (let m = 0; m < anchor.month; m++) {
          totalDays -= this.months.values[m].days;
        }
      }

      const dayInCycle = Math.abs(Math.floor(totalDays % cycle));

      // Find current moon phase
      let phaseIndex = 0;
      let currentPhase = values[0];

      for (let i = 0; i < values.length; i++) {
        if (dayInCycle >= values[i].dayStart) {
          currentPhase = values[i];
          phaseIndex = i;
        } else {
          break;
        }
      }

      components.moon = {
        phase: currentPhase,
        previousMoon: phaseIndex > 0 ? phaseIndex - 1 : values.length - 1,
        nextMoon: phaseIndex < values.length - 1 ? phaseIndex + 1 : 0,
        dayInCycle,
        cycle,
        phaseIndex,
      };
    }

    return components;
  }
}

// Set up hook to update calendar displays when world time changes
Hooks.on('updateWorldTime', () => {
  game.dsa5.apps.CalendarWidget.render(true);
  if (game.dsa5.apps.CalendarPicker) game.dsa5.apps.CalendarPicker.refreshCalendar();
  DSAWorldCalendar.autoDayLight();
});
