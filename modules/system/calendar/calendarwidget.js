export class CalendarWidget extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static SECONDS_PER_HOUR = 3600;
    static SECONDS_PER_DAY = 24 * this.SECONDS_PER_HOUR;
    
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
        }, calendarConfig);

        return CalendarWidget.timeGradients.find(g => {
            const from = timeGradientsConfig[g.from] || 0;
            const to = timeGradientsConfig[g.to] || maxHoursPerDay;
            return components.hour >= from && components.hour < to;
        }) || CalendarWidget.timeGradients[0];
    }

    async _prepareContext(_options) {
        const data = await super._prepareContext(_options);
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const secondsInDay = this.constructor.calculateSecondsInDay(components);
        
        data.components = components;
        data.dateString = game.time.calendar.format(game.time.worldTime, 'formatPraiosGefaellig');
        data.dateTooltip = game.time.calendar.format(game.time.worldTime, 'formatSeason');
        data.isGM = game.user.isGM;
        data.dayTimeBackground = this.constructor.dayTimeBackground(components);
        data.dayProgress = Math.round(secondsInDay / this.constructor.SECONDS_PER_DAY * 100);
        
        return data;
    }
    
    // Helper method to calculate seconds passed in the current day
    static calculateSecondsInDay(components) {
        return components.hour * this.SECONDS_PER_HOUR + 
               components.minute * 60 + 
               components.second;
    }

    static editCalendar(ev, target) {
        if (this.wasDragging) {
            this.wasDragging = false;
            return;
        }

        game.dsa5.apps.CalendarPicker.render(true);
    }

    static timeAdvance(seconds, adjustRemainder = false) {
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const adjustment = adjustRemainder ? components.second + (components.minute * 60) : components.second;
        game.time.advance(seconds + (adjustRemainder ? adjustment : -adjustment));
    }

    static smallBackward(ev, target) {
        const seconds = ev.button != 2 ? -1800 : -60;
        this.timeAdvance(seconds);
    }

    static smallForward(ev, target) {
        const seconds = ev.button != 2 ? 1800 : 60;
        this.timeAdvance(seconds);
    }

    static backward(ev, target) {
        const seconds = ev.button != 2 ? -this.SECONDS_PER_HOUR : -6 * this.SECONDS_PER_HOUR;
        this.timeAdvance(seconds);
    }

    static forward(ev, target) {
        const seconds = ev.button != 2 ? this.SECONDS_PER_HOUR : 6 * this.SECONDS_PER_HOUR;
        this.timeAdvance(seconds);
    }

    static fastBackward(ev, target) {
        const seconds = ev.button != 2 ? -this.SECONDS_PER_DAY : -this.SECONDS_PER_DAY * 7;
        this.timeAdvance(seconds, true);
    }

    static fastForward(ev, target) {
        const seconds = ev.button != 2 ? this.SECONDS_PER_DAY : this.SECONDS_PER_DAY * 7;
        this.timeAdvance(seconds, true);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        if (!game.user.isGM) return;

        this._setupDragHandlers();
    }
    
    _setupDragHandlers() {
        const indicator = this.element.querySelector('.slideIndicator');
        const container = this.element.querySelector('.dayProgress');
        
        indicator.addEventListener('mousedown', this._handleMouseDown.bind(this));
        this.element.addEventListener('mousemove', this._handleMouseMove.bind(this, container, indicator));
        this.element.addEventListener('mouseup', this._handleMouseUp.bind(this));
    }
    
    _handleMouseDown(e) {
        this.isDragging = true;
        this.wasDragging = false;
        this.offsetX = e.clientX - e.target.offsetLeft;
        e.preventDefault();
        e.stopPropagation();
    }
    
    _handleMouseMove(container, indicator, e) {
        if (!this.isDragging) return;

        this.wasDragging = true;
        
        const containerRect = container.getBoundingClientRect();
        const maxLeft = containerRect.width - indicator.offsetWidth;
        const newLeft = Math.max(0, Math.min(e.clientX - this.offsetX, maxLeft));
        const percentage = newLeft / maxLeft * 100.0;
        
        indicator.style.setProperty('--p', `${percentage}%`);
        this.currentPercentage = percentage;

        this._updateTimeIndicator(container, containerRect, percentage);
    }
    
    _updateTimeIndicator(container, containerRect, percentage) {
        const secondsInDay = this.constructor.SECONDS_PER_DAY * percentage / 100.0;
        const hour = Math.floor(secondsInDay / this.constructor.SECONDS_PER_HOUR) || 0;
        const minute = Math.floor((secondsInDay % this.constructor.SECONDS_PER_HOUR) / 60) || 0;
        const second = Math.floor(secondsInDay % 60) || 0;
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
        const dayTimeBackground = this.constructor.dayTimeBackground({ hour, minute, second });
        
        container.style.width = containerRect.width + 'px';
        container.style.background = dayTimeBackground.gradient;
        container.style.color = dayTimeBackground.textColor;
        container.querySelector('.timeIndicator').textContent = timeString;
    }
    
    _handleMouseUp(ev) {
        if (!this.isDragging) return;

        this.isDragging = false;
        ev.preventDefault();
        ev.stopPropagation();

        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const currentSeconds = this.constructor.calculateSecondsInDay(components);
        const newSeconds = this.constructor.SECONDS_PER_DAY * this.currentPercentage / 100.0;
        
        game.time.advance(Math.floor(newSeconds - currentSeconds));
    }
}