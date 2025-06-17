export class CalendarCanvas {
    constructor(parentElement, callback, hoverCallback) {
        this.element = parentElement;
        this.callback = callback;
        this.hoverCallback = hoverCallback;

        // Canvas properties
        this.canvas = null;
        this.ctx = null;
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.centerX = 0;
        this.centerY = 0;

        // State
        this.hoveredSection = null;
        this.isDestroyed = false;
        this.needsRedraw = false;
        this.animationFrameId = null;

        // Event handlers (bound once)
        this.throttledMouseMove = this._throttle(this._handleMouseMove.bind(this), 16);
        this._boundMouseLeave = this._handleMouseLeave.bind(this);
        this._boundClick = this._handleClick.bind(this);

        // Constants
        this._initializeConstants();

        // Data containers
        this.calendarData = null;
        this.precalculated = this._initializePrecalculated();
    }

    _initializeConstants() {
        this.RADIUS = Object.freeze({
            OUTER: 300,
            DAYS: 260,
            WEEKDAYS: 140,
            OUTER_FRAME: 315,
            SEASONS: 280
        });

        this.COLORS = Object.freeze({
            BACKGROUND_INNER: "#1a1a1a",
            BACKGROUND_OUTER: "#000000",
            BORDER_OUTER: "#888",
            BORDER_INNER: "#555",
            TEXT_NORMAL: "#e0c080",
            TEXT_HIGHLIGHT: "#ffcc00",
            DOT_NORMAL: "#fff6d0",
            HIGHLIGHT_BG: "rgba(255, 204, 0, 0.3)"
        });

        this.SEASON_GRADIENTS = Object.freeze([
            { start: "#f8e9c0", end: "#e6c366" }, // Summer
            { start: "#e6c8a6", end: "#c4784b" }, // Fall
            { start: "#c9e1f2", end: "#7da9cc" }, // Winter
            { start: "#c6e8c8", end: "#74ba7b" }, // Spring
            { start: "#f8e9c0", end: "#e6c366" }, // Summer (repeated)
            { start: "#393939", end: "#121212" }  // Namenlose Tage
        ]);

        this.FONTS = Object.freeze({
            MONTHS: "16px Garamond",
            WEEKDAYS: "14px Garamond"
        });
    }

    _initializePrecalculated() {
        return {
            monthAngles: [],
            dayAngles: [],
            weekdayAngles: [],
            seasonAngles: [],
            angleOffsets: {
                month: 0,
                day: 0,
                weekday: 0
            },
            backgroundImage: null,
            hitRegions: {
                month: { min: this.RADIUS.OUTER - 10, max: this.RADIUS.OUTER + 10 },
                day: { center: this.RADIUS.DAYS, tolerance: 10 },
                weekday: { center: this.RADIUS.WEEKDAYS, tolerance: 15 }
            }
        };
    }

    _throttle(func, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    async render() {
        try {
            this._setupCanvas();
            await this._prepareData();
            this._precalculateValues();
            await this._loadBackgroundImage();
            this._renderStaticElements();
            this._drawCalendar();
            this._setupEventListeners();
        } catch (error) {
            console.error('Error rendering calendar:', error);
            throw error;
        }
    }

    destroy() {
        this.isDestroyed = true;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this._removeEventListeners();
        this._cleanupCanvases();
    }

    _removeEventListeners() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.throttledMouseMove);
            this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);
            this.canvas.removeEventListener('click', this._boundClick);
        }
    }

    _cleanupCanvases() {
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.canvas = null;
        this.ctx = null;
    }

    _setupCanvas() {
        this.canvas = this.element.querySelector('.circular-calendar');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;

        this._setupOffscreenCanvas();
    }

    _setupOffscreenCanvas() {
        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
    }

    async _prepareData() {
        const calendar = game.time.calendar;
        const components = calendar.timeToComponents(game.time.worldTime);
        const daysPerYear = calendar.days.daysPerYear;

        // Calculate seasons with improved logic
        const seasons = this._calculateSeasons(calendar, daysPerYear);

        this.calendarData = {
            months: this._getLocalizedArray(calendar.months.values, calendar.translationPrefix),
            weekdays: this._getLocalizedArray(calendar.days.values, calendar.translationPrefix),
            currentMonth: components.month,
            currentDay: components.dayOfMonth,
            currentWeekday: components.dayOfWeek,
            daysInMonth: calendar.months.values[components.month].days,
            seasons: this._adjustSeasonsForRotation(seasons, components, calendar, daysPerYear)
        };

        // Rotate arrays to start with current elements
        this.calendarData.months = this._rotateArray(this.calendarData.months, this.calendarData.currentMonth);
        this.calendarData.weekdays = this._rotateArray(this.calendarData.weekdays, this.calendarData.currentWeekday);
    }

    _getLocalizedArray(values, translationPrefix) {
        return values.map(item => game.i18n.localize(`${translationPrefix}.${item.name}`));
    }

    _calculateSeasons(calendar, daysPerYear) {
        const seasons = [];
        let cumulativeAngle = 0;

        for (let i = 0; i < calendar.seasons.values.length; i++) {
            const season = calendar.seasons.values[i];
            const nextSeason = calendar.seasons.values[i + 1];

            const days = this._calculateSeasonDays(season, nextSeason, calendar);
            const angle = days / daysPerYear * 2 * Math.PI;
            const startAngle = cumulativeAngle;

            cumulativeAngle += angle;

            seasons.push({
                angle,
                startAngle,
                endAngle: cumulativeAngle,
                gradient: this.SEASON_GRADIENTS[i]
            });
        }

        return seasons;
    }

    _calculateSeasonDays(season, nextSeason, calendar) {
        if (!nextSeason) {
            return calendar.months.values[season.monthStart].days;
        }

        let days = calendar.months.values[season.monthStart].days - season.dayStart;

        for (let j = season.monthStart + 1; j < nextSeason.monthStart; j++) {
            days += calendar.months.values[j].days;
        }

        return days + nextSeason.dayStart - 1;
    }

    _adjustSeasonsForRotation(seasons, components, calendar, daysPerYear) {
        let currentMonthStartAngle = 0;

        for (let i = 0; i < components.month; i++) {
            currentMonthStartAngle += (calendar.months.values[i].days / daysPerYear) * 2 * Math.PI;
        }

        return seasons.map(season => ({
            ...season,
            startAngle: (season.startAngle - currentMonthStartAngle + 2 * Math.PI) % (2 * Math.PI),
            endAngle: (season.endAngle - currentMonthStartAngle + 2 * Math.PI) % (2 * Math.PI)
        }));
    }

    _rotateArray(array, startIndex) {
        return [...array.slice(startIndex), ...array.slice(0, startIndex)];
    }

    _precalculateValues() {
        const { months, weekdays, daysInMonth } = this.calendarData;

        // Cache angle offsets
        this.precalculated.angleOffsets = {
            month: Math.PI / months.length,
            day: Math.PI / daysInMonth,
            weekday: Math.PI / weekdays.length
        };

        // Precalculate all positions
        this.precalculated.monthAngles = this._calculateMonthAngles(months.length);
        this.precalculated.dayAngles = this._calculateDayAngles(daysInMonth);
        this.precalculated.weekdayAngles = this._calculateWeekdayAngles(weekdays.length);
        this.precalculated.seasonAngles = this._calculateSeasonAngles();
    }

    _calculateMonthAngles(monthCount) {
        const angles = [];
        const angleStep = 2 * Math.PI / monthCount;

        for (let i = 0; i < monthCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const startAngle = angleStep * i;
            const endAngle = angleStep * (i + 1);
            const originalIndex = (this.calendarData.currentMonth + i) % monthCount;

            angles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.OUTER,
                y: this.centerY + Math.sin(angle) * this.RADIUS.OUTER,
                startAngle,
                endAngle,
                originalIndex
            });
        }

        return angles;
    }

    _calculateDayAngles(dayCount) {
        const angles = [];
        const angleStep = 2 * Math.PI / dayCount;

        for (let i = 0; i < dayCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            angles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.DAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.DAYS
            });
        }

        return angles;
    }

    _calculateWeekdayAngles(weekdayCount) {
        const angles = [];
        const angleStep = 2 * Math.PI / weekdayCount;

        for (let i = 0; i < weekdayCount; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const startAngle = angleStep * i;
            const endAngle = angleStep * (i + 1);

            angles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.WEEKDAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.WEEKDAYS,
                startAngle,
                endAngle
            });
        }

        return angles;
    }

    _calculateSeasonAngles() {
        const seasonAngleOffset = 15 / 365 * 2 * Math.PI;

        return this.calendarData.seasons.map(season => ({
            startAngle: season.startAngle - Math.PI / 2 - seasonAngleOffset,
            endAngle: season.endAngle - Math.PI / 2 - seasonAngleOffset,
            gradient: season.gradient
        }));
    }

    async _loadBackgroundImage() {
        if (this.precalculated.backgroundImage) return;

        const backgroundImage = "systems/dsa5/icons/backgrounds/turnMarker.webp";

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.precalculated.backgroundImage = img;
                resolve();
            };
            img.onerror = () => {
                console.warn('Failed to load background image:', backgroundImage);
                resolve(); // Continue without background
            };
            img.src = backgroundImage;
        });
    }

    _renderStaticElements() {
        const ctx = this.offscreenCtx;

        this._drawBackground(ctx);
        this._drawMonthSeasons(ctx);
        this._drawBorders(ctx);
        this._drawNorthMarker(ctx);
        this._drawMonths(ctx, false);
        this._drawWeekdays(ctx, false);
    }

    _drawCalendar() {
        // Clear and draw static background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);

        // Draw dynamic elements
        this._drawHighlightedSection();
        this._drawDays();

        // Redraw highlighted text elements
        this._drawHighlightedText();
    }

    _drawHighlightedText() {
        if (!this.hoveredSection) return;

        const { type } = this.hoveredSection;

        if (type === 'month') {
            this._drawMonths(this.ctx, true);
        } else if (type === 'weekday') {
            this._drawWeekdays(this.ctx, true);
        }
    }

    _drawBackground(ctx = this.ctx) {
        // Create gradient background
        const bgGradient = ctx.createRadialGradient(
            this.centerX, this.centerY, 50,
            this.centerX, this.centerY, this.RADIUS.OUTER_FRAME
        );
        bgGradient.addColorStop(0, this.COLORS.BACKGROUND_INNER);
        bgGradient.addColorStop(1, this.COLORS.BACKGROUND_OUTER);

        // Fill background
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.RADIUS.OUTER_FRAME, 0, 2 * Math.PI);
        ctx.fillStyle = bgGradient;
        ctx.fill();

        this._drawBackgroundImage(ctx);
    }

    _drawBackgroundImage(ctx) {
        if (!this.precalculated.backgroundImage) return;

        const size = this.RADIUS.OUTER * 2;
        const offset = size / 2;

        ctx.save();

        // Create clipping region
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.RADIUS.OUTER_FRAME, 0, 2 * Math.PI);
        ctx.arc(this.centerX, this.centerY, this.RADIUS.WEEKDAYS + 15, 0, 2 * Math.PI, true);
        ctx.arc(this.centerX, this.centerY, this.RADIUS.WEEKDAYS - 15, 0, 2 * Math.PI);
        ctx.clip();

        ctx.drawImage(
            this.precalculated.backgroundImage,
            this.centerX - offset,
            this.centerY - offset,
            size,
            size
        );

        ctx.restore();
    }

    _drawMonthSeasons(ctx = this.ctx) {
        for (const season of this.precalculated.seasonAngles) {
            this._drawArcSegment(
                this.RADIUS.SEASONS - 6,
                this.RADIUS.SEASONS + 6,
                season.startAngle + Math.PI / 2,
                season.endAngle + Math.PI / 2,
                season.gradient,
                false,
                ctx
            );
        }
    }

    _drawBorders(ctx = this.ctx) {
        const borders = [
            { radius: this.RADIUS.OUTER_FRAME, color: this.COLORS.BORDER_OUTER, width: 2 },
            { radius: this.RADIUS.DAYS, color: this.COLORS.BORDER_INNER, width: 1 },
            { radius: this.RADIUS.WEEKDAYS + 15, color: this.COLORS.BORDER_INNER, width: 1 },
            { radius: this.RADIUS.WEEKDAYS - 15, color: this.COLORS.BORDER_INNER, width: 1 }
        ];

        borders.forEach(border => {
            this._drawCircle(border.radius, border.color, border.width, ctx);
        });
    }

    _drawCircle(radius, color, lineWidth = 1, ctx = this.ctx) {
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    _drawNorthMarker(ctx = this.ctx) {
        const markerHeight = 10;
        const markerWidth = 16;
        const topY = this.centerY - this.RADIUS.OUTER_FRAME;

        ctx.beginPath();
        ctx.moveTo(this.centerX, topY - markerHeight);
        ctx.lineTo(this.centerX - markerWidth / 2, topY);
        ctx.lineTo(this.centerX + markerWidth / 2, topY);
        ctx.closePath();
        ctx.fillStyle = this.COLORS.TEXT_HIGHLIGHT;
        ctx.fill();
    }

    _drawMonths(ctx = this.ctx, onlyHighlighted = false) {
        ctx.font = this.FONTS.MONTHS;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        this.calendarData.months.forEach((month, i) => {
            const isHighlighted = this._isElementHighlighted('month', i);

            if (onlyHighlighted && !isHighlighted) return;

            const { x, y, angle } = this.precalculated.monthAngles[i];

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle + Math.PI / 2);
            ctx.fillStyle = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            ctx.fillText(month, 0, 0);
            ctx.restore();
        });
    }

    _drawDays() {
        const { currentDay } = this.calendarData;

        // Draw regular day dots
        this.precalculated.dayAngles.forEach((pos, i) => {
            const { x, y } = pos;
            const isHighlighted = this._isElementHighlighted('day', i);

            if (isHighlighted) {
                this._drawDayHighlight(x, y);
            }

            this._drawDayDot(x, y, isHighlighted);
        });

        // Draw current day highlight
        const { x: xToday, y: yToday } = this.precalculated.dayAngles[currentDay];
        this._drawCurrentDay(xToday, yToday);
    }

    _drawDayHighlight(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.COLORS.HIGHLIGHT_BG;
        this.ctx.fill();
    }

    _drawDayDot(x, y, isHighlighted) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
        this.ctx.fillStyle = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.DOT_NORMAL;
        this.ctx.fill();
    }

    _drawCurrentDay(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.COLORS.TEXT_HIGHLIGHT;
        this.ctx.fill();
    }

    _drawWeekdays(ctx = this.ctx, onlyHighlighted = false) {
        const { weekdays } = this.calendarData;

        ctx.font = this.FONTS.WEEKDAYS;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        weekdays.forEach((day, i) => {
            const isHighlighted = this._isElementHighlighted('weekday', i);

            if (onlyHighlighted && !isHighlighted) return;

            const { x, y, angle } = this.precalculated.weekdayAngles[i];
            const isCurrentWeekday = i === 0;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle + Math.PI / 2);
            ctx.fillStyle = (isCurrentWeekday || isHighlighted) ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            ctx.fillText(day, 0, 0);
            ctx.restore();
        });
    }

    _isElementHighlighted(type, index) {
        return this.hoveredSection?.type === type && this.hoveredSection?.index === index;
    }

    _drawHighlightedSection() {
        if (!this.hoveredSection) return;

        const { type, index } = this.hoveredSection;

        if (type === 'month') {
            this._drawMonthHighlight(index);
        } else if (type === 'weekday') {
            this._drawWeekdayHighlight(index);
        }
    }

    _drawMonthHighlight(index) {
        const { startAngle, endAngle } = this.precalculated.monthAngles[index];
        const { month: offset } = this.precalculated.angleOffsets;

        this._drawArcSegment(
            this.RADIUS.OUTER - 15,
            this.RADIUS.OUTER_FRAME,
            startAngle - offset,
            endAngle - offset,
            null,
            true
        );
    }

    _drawWeekdayHighlight(index) {
        const { startAngle, endAngle } = this.precalculated.weekdayAngles[index];
        const { weekday: offset } = this.precalculated.angleOffsets;

        this._drawArcSegment(
            this.RADIUS.WEEKDAYS - 15,
            this.RADIUS.WEEKDAYS + 15,
            startAngle - offset,
            endAngle - offset,
            null,
            true
        );
    }

    _drawArcSegment(innerRadius, outerRadius, startAngle, endAngle, gradient = null, isHighlight = false, ctx = this.ctx) {
        const startAngleAdjusted = startAngle - Math.PI / 2;
        const endAngleAdjusted = endAngle - Math.PI / 2;

        const startCos = Math.cos(startAngleAdjusted);
        const startSin = Math.sin(startAngleAdjusted);
        const endCos = Math.cos(endAngleAdjusted);
        const endSin = Math.sin(endAngleAdjusted);

        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, outerRadius, startAngleAdjusted, endAngleAdjusted);
        ctx.lineTo(
            this.centerX + innerRadius * endCos,
            this.centerY + innerRadius * endSin
        );
        ctx.arc(this.centerX, this.centerY, innerRadius, endAngleAdjusted, startAngleAdjusted, true);
        ctx.closePath();

        this._applyArcFill(ctx, gradient, isHighlight, innerRadius, outerRadius, startAngleAdjusted, endAngleAdjusted);

        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    _applyArcFill(ctx, gradient, isHighlight, innerRadius, outerRadius, startAngle, endAngle) {
        if (gradient) {
            const arcCenterAngle = (startAngle + endAngle) / 2;
            const midRadius = innerRadius + (outerRadius - innerRadius) / 2;
            const arcCenterX = this.centerX + midRadius * Math.cos(arcCenterAngle);
            const arcCenterY = this.centerY + midRadius * Math.sin(arcCenterAngle);
            const gradientRadius = (outerRadius - innerRadius) * 0.75;

            const gradientFill = ctx.createRadialGradient(
                arcCenterX, arcCenterY, 0,
                arcCenterX, arcCenterY, gradientRadius
            );

            gradientFill.addColorStop(0, gradient.start);
            gradientFill.addColorStop(1, gradient.end);

            ctx.fillStyle = gradientFill;
            ctx.globalAlpha = 0.7;
        } else if (isHighlight) {
            ctx.fillStyle = this.COLORS.HIGHLIGHT_BG;
            ctx.globalAlpha = 0.6;
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.globalAlpha = 0.3;
        }
    }

    _setupEventListeners() {
        this.canvas.addEventListener('mousemove', this.throttledMouseMove);
        this.canvas.addEventListener('mouseleave', this._boundMouseLeave);
        this.canvas.addEventListener('click', this._boundClick);
    }

    _handleMouseMove(event) {
        const { mouseX, mouseY } = this._getMousePosition(event);
        const { distance, angle } = this._calculateMouseMetrics(mouseX, mouseY);

        const previousHovered = this.hoveredSection;
        this.hoveredSection = this._detectHoveredSection(distance, angle);

        this._handleHoverChange(previousHovered);
    }

    _getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            mouseX: event.clientX - rect.left,
            mouseY: event.clientY - rect.top
        };
    }

    _calculateMouseMetrics(mouseX, mouseY) {
        const dx = mouseX - this.centerX;
        const dy = mouseY - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx) + Math.PI / 2;

        if (angle < 0) angle += 2 * Math.PI;

        return { distance, angle };
    }

    _detectHoveredSection(distance, angle) {
        const { hitRegions } = this.precalculated;

        if (distance >= hitRegions.month.min && distance <= hitRegions.month.max) {
            return this._getMonthSection(angle);
        }

        if (Math.abs(distance - hitRegions.day.center) <= hitRegions.day.tolerance) {
            return this._getDaySection(angle);
        }

        if (Math.abs(distance - hitRegions.weekday.center) <= hitRegions.weekday.tolerance) {
            return this._getWeekdaySection(angle);
        }

        return null;
    }

    _getMonthSection(angle) {
        const { month } = this.precalculated.angleOffsets;
        const adjustedAngle = angle + month;
        const monthIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.months.length) % this.calendarData.months.length;
        return { type: 'month', index: monthIndex };
    }

    _getDaySection(angle) {
        const { day } = this.precalculated.angleOffsets;
        const adjustedAngle = angle + day;
        const dayIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.daysInMonth) % this.calendarData.daysInMonth;
        return { type: 'day', index: dayIndex };
    }

    _getWeekdaySection(angle) {
        const { weekday } = this.precalculated.angleOffsets;
        const adjustedAngle = angle + weekday;
        const weekdayIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.weekdays.length) % this.calendarData.weekdays.length;
        return { type: 'weekday', index: weekdayIndex };
    }

    _handleHoverChange(previousHovered) {
        const hasChanged = JSON.stringify(previousHovered) !== JSON.stringify(this.hoveredSection);

        if (hasChanged) {
            this.needsRedraw = true;
            this._scheduleRedraw();

            const data = this.hoveredSection ? this._collectSliceData() : null;
            this.hoverCallback(data);
        }
    }

    _handleMouseLeave() {
        this.hoveredSection = null;
        this.needsRedraw = true;
        this._scheduleRedraw();
        this.hoverCallback(null);
    }

    _scheduleRedraw() {
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => this._animationFrame());
        }
    }

    _animationFrame() {
        this.animationFrameId = null;

        if (this.isDestroyed) return;

        if (this.needsRedraw) {
            this._drawCalendar();
            this.needsRedraw = false;
        }
    }

    _collectSliceData() {
        const { type, index } = this.hoveredSection;
        const clickData = { type, index };

        switch (type) {
            case 'month':
                clickData.name = this.calendarData.months[index];
                clickData.originalIndex = this.precalculated.monthAngles[index].originalIndex;
                break;
            case 'day':
                clickData.day = index + 1;
                clickData.isCurrentDay = index === this.calendarData.currentDay;
                break;
            case 'weekday':
                clickData.name = this.calendarData.weekdays[index];
                clickData.originalIndex = (this.calendarData.currentWeekday + index) % this.calendarData.weekdays.length;
                break;
        }

        return clickData;
    }

    _handleClick() {
        if (this.hoveredSection) {
            this.callback(this._collectSliceData());
        }
    }
}