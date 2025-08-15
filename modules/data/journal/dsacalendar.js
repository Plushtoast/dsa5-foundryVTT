export class DSACalendarEntry extends foundry.abstract.TypeDataModel {
    static CATEGORY_CHOICES = {
        0: "dsacalendar.CATEGORIES.general",
        1: "dsacalendar.CATEGORIES.holidays",
        2: "dsacalendar.CATEGORIES.event",
        3: "dsacalendar.CATEGORIES.historical",
        4: "dsacalendar.CATEGORIES.milestones"
    }

    static CATEGORY_COLORS = {
        0: "#0b93bdff",
        1: "#920b0bff",
        2: "#c4c708ff",
        3: "#149b1bff",
        4: "#bd5b00ff"
    };

    static CATEGORY_ICONS = {
        0: "fas fa-calendar",
        1: "fas fa-holly-berry",
        2: "fas fa-birthday-cake",
        3: "fas fa-history",
        4: "fas fa-star"
    }

    static defineSchema() {
        const { TypedObjectField, SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;
        return {
            calendarentries: new TypedObjectField(new SchemaField({
                title: new StringField({ required: true, label: "dsacalendar.FIELDS.calendarentries.title.label" }),
                content: new StringField({ label: "dsacalendar.FIELDS.calendarentries.content.label" }),
                location: new StringField({ label: "dsacalendar.FIELDS.calendarentries.location.label" }),
                from: new SchemaField({
                    dayOfMonth: new NumberField({ required: true, initial: 1, min: 1, step: 1 }),
                    month: new NumberField({ required: true, initial: 0, min: 0, step: 1 }),
                    year: new NumberField({ required: true, initial: 1040, step: 1 }),
                    day: new NumberField({ required: false, initial: 0, min: 0, step: 1 }),
                }, { required: true, label: "dsacalendar.FIELDS.calendarentries.from.label" }),
                to: new SchemaField({
                    dayOfMonth: new NumberField({ required: false, min: 1, step: 1 }),
                }),
                category: new NumberField({ required: true, initial: 0, choices: DSACalendarEntry.CATEGORY_CHOICES, label: "dsacalendar.FIELDS.calendarentries.category.label" }),
                visible: new BooleanField({ initial: true, label: "dsacalendar.FIELDS.calendarentries.visible.label" }),
                recurring: new BooleanField({ initial: true, label: "dsacalendar.FIELDS.calendarentries.recurring.label" }),
            })),
        };
    }

    async _preUpdate(changed, options, user) {
        for (let key of Object.keys(changed.system.calendarentries || {})) {
            this.#recalculateDay(changed.system.calendarentries[key]);
        }
        game.dsa5.apps.CalendarPicker.constructor.invalidateCache(this.parent.parent.uuid)
        await super._preUpdate(changed, options, user);
    }

    static prepareCalendarEntry(entry) {
        const calendar = game.time.calendar;
        const month = calendar.months.values[entry.from.month];
        const converted = calendar.componentsToTime({
            day: entry.from.day,
            year: entry.from.year,
        });
        const convertedComponents = calendar.timeToComponents(converted);
        const dayOfWeek = calendar.days.values[convertedComponents.dayOfWeek]
        entry.monthShort = calendar.translate(month.abbreviation);
        entry.weekdayShort = calendar.translate(dayOfWeek.abbreviation);
        entry.from.monthLong = calendar.translate(month.name);
        entry.categoryName = game.i18n.localize(DSACalendarEntry.CATEGORY_CHOICES[entry.category]);
        entry.color = DSACalendarEntry.CATEGORY_COLORS[entry.category];
    }

    #recalculateDay(date) {
        if (!date || !date.from?.dayOfMonth) return;

        const monthChange = date.from.month;
        date.from.dayOfMonth = Math.clamp(date.from.dayOfMonth, 1, game.time.calendar.months.values[monthChange].days + 1);
        const dayOfMonth = date.from.dayOfMonth - 1;
        let dayOffset = 0;

        for (let m = 0; m < monthChange; m++) {
            dayOffset += game.time.calendar.months.values[m].days;
        }

        date.from.day = dayOffset + dayOfMonth;
        
        if (date.to?.dayOfMonth) 
            date.to.dayOfMonth = Math.clamp(date.to.dayOfMonth, date.from.dayOfMonth, game.time.calendar.months.values[date.from.month].days + 1);
    }
}