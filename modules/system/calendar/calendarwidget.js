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

        game.dsa5.apps.CalendarPicker.render(true);
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