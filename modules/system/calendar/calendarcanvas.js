export class CalendarCanvas {
    constructor(parentElement, callback, hoverCallback) {
        this.element = parentElement;
        this.canvas = null;
        this.ctx = null;
        this.centerX = 0;
        this.centerY = 0;
        this.hoveredSection = null;
        this.callback = callback;
        this.hoverCallback = hoverCallback;
        this.animationFrameId = null;
        this.needsRedraw = false;
        this.isDestroyed = false;

        // Seasonal gradients
        this.seasonGradients = [
            { start: "#f8e9c0", end: "#e6c366" }, // Summer
            { start: "#e6c8a6", end: "#c4784b" }, // Fall
            { start: "#c9e1f2", end: "#7da9cc" }, // Winter
            { start: "#c6e8c8", end: "#74ba7b" },  // Spring
            { start: "#f8e9c0", end: "#e6c366" }, // Summer (repeated for easier indexing)
            { start: "#393939", end: "#121212" }, // Namenlose Tage (dark/mysterious)
        ]

        // Constants
        this.RADIUS = {
            OUTER: 300,      // Month ring
            DAYS: 270,       // Day dots
            WEEKDAYS: 140,   // Weekday labels
            OUTER_FRAME: 315 // Outer frame (OUTER + 15)
        };

        this.COLORS = {
            BACKGROUND_INNER: "#1a1a1a",
            BACKGROUND_OUTER: "#000000",
            BORDER_OUTER: "#888",
            BORDER_INNER: "#555",
            TEXT_NORMAL: "#e0c080",
            TEXT_MONTH: "#000000",
            TEXT_HIGHLIGHT: "#ffcc00",
            DOT_NORMAL: "#fff6d0",
            HIGHLIGHT_BG: "rgba(255, 204, 0, 0.3)"
        };

        // Pre-calculated values
        this.precalculated = {
            monthAngles: [],
            dayAngles: [],
            weekdayAngles: [],
            monthAngleOffset: 0,
            dayAngleOffset: 0,
            weekdayAngleOffset: 0,
            backgroundImage: null
        };
    }

    async render() {
        this._setupCanvas();
        await this._prepareData();
        this._precalculateValues();
        await this._loadBackgroundImage();
        this._drawCalendar();
        this._setupEventListeners();
    }

    destroy() {
        this.isDestroyed = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas.removeEventListener('mousemove', this._boundMouseMove);
        this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);
        this.canvas.removeEventListener('click', this._boundClick);
    }

    _setupCanvas() {
        this.canvas = this.element.querySelector('.circular-calendar');
        this.ctx = this.canvas.getContext('2d');
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    async _prepareData() {
        const calendar = game.time.calendar;

        const daysPerYear = calendar.days.daysPerYear;
        const seasons = []
        for (let i = 0; i < calendar.seasons.values.length; i++) {
            const season = calendar.seasons.values[i];
            const nextSeason = calendar.seasons.values[i + 1]
            let days = 0;
            if (nextSeason) {
                days = calendar.months.values[season.monthStart].days - season.dayStart;
                for (let j = season.monthStart + 1; j < nextSeason.monthStart; j++) {
                    days += calendar.months.values[j].days;
                }
                days += nextSeason.dayStart - 1 
            } else {
                days = calendar.months.values[season.monthStart].days;
            }
            seasons.push({
                angle: days / daysPerYear * 2 * Math.PI,
                gradient: this.seasonGradients[i],
            });
        }

        const components = calendar.timeToComponents(game.time.worldTime);

        // Get calendar data
        this.calendarData = {
            months: calendar.months.values.map(m => game.i18n.localize(`${calendar.translationPrefix}.${m.name}`)),
            weekdays: calendar.days.values.map(d => game.i18n.localize(`${calendar.translationPrefix}.${d.name}`)),
            currentMonth: components.month,
            currentDay: components.dayOfMonth,
            currentWeekday: components.dayOfWeek,
            daysInMonth: calendar.months.values[components.month].days,
            seasons
        };

        // Rotate arrays to start with current
        this.calendarData.months = this._rotateArray(this.calendarData.months, this.calendarData.currentMonth);
        this.calendarData.weekdays = this._rotateArray(this.calendarData.weekdays, this.calendarData.currentWeekday);
    }

    _rotateArray(array, startIndex) {
        return array.slice(startIndex).concat(array.slice(0, startIndex));
    }

    _precalculateValues() {
        // Precalculate angle values
        const monthCount = this.calendarData.months.length;
        const dayCount = this.calendarData.daysInMonth;
        const weekdayCount = this.calendarData.weekdays.length;

        this.precalculated.monthAngleOffset = Math.PI / monthCount;
        this.precalculated.dayAngleOffset = Math.PI / dayCount;
        this.precalculated.weekdayAngleOffset = Math.PI / weekdayCount;

        // Precalculate positions for months
        this.precalculated.monthAngles = [];
        for (let i = 0; i < monthCount; i++) {
            const angle = (2 * Math.PI * i) / monthCount - Math.PI / 2;

            // Calculate original month index (accounting for rotation)
            const originalMonthIndex = (this.calendarData.currentMonth + i) % monthCount;

            this.precalculated.monthAngles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.OUTER,
                y: this.centerY + Math.sin(angle) * this.RADIUS.OUTER,
                startAngle: (2 * Math.PI * i) / monthCount,
                endAngle: (2 * Math.PI * (i + 1)) / monthCount,
                originalIndex: originalMonthIndex
            });
        }

        // Precalculate positions for days
        this.precalculated.dayAngles = [];
        for (let i = 0; i < dayCount; i++) {
            const angle = (2 * Math.PI * i) / dayCount - Math.PI / 2;
            this.precalculated.dayAngles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.DAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.DAYS
            });
        }

        // Precalculate positions for weekdays
        this.precalculated.weekdayAngles = [];
        for (let i = 0; i < weekdayCount; i++) {
            const angle = (2 * Math.PI * i) / weekdayCount - Math.PI / 2;
            this.precalculated.weekdayAngles.push({
                angle,
                x: this.centerX + Math.cos(angle) * this.RADIUS.WEEKDAYS,
                y: this.centerY + Math.sin(angle) * this.RADIUS.WEEKDAYS,
                startAngle: (2 * Math.PI * i) / weekdayCount,
                endAngle: (2 * Math.PI * (i + 1)) / weekdayCount
            });
        }
    }

    async _loadBackgroundImage() {
        const backgroundImage = "systems/dsa5/icons/backgrounds/turnMarker.webp";

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.precalculated.backgroundImage = img;
                resolve();
            };
            img.src = backgroundImage;
        });
    }

    _drawCalendar() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw elements in correct order
        this._drawBackground();
        this._drawMonthSeasons(); // New method to draw seasonal backgrounds
        this._drawHighlightedSection();
        this._drawBorders();
        this._drawNorthMarker();
        this._drawMonths();
        this._drawDays();
        this._drawWeekdays();
    }

    _drawBackground() {
        // Create gradient background
        const bgGradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 50,
            this.centerX, this.centerY, this.RADIUS.OUTER_FRAME
        );
        bgGradient.addColorStop(0, this.COLORS.BACKGROUND_INNER);
        bgGradient.addColorStop(1, this.COLORS.BACKGROUND_OUTER);

        // Fill background
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.RADIUS.OUTER_FRAME, 0, 2 * Math.PI);
        this.ctx.fillStyle = bgGradient;
        this.ctx.fill();

        // Draw background image with mask
        if (this.precalculated.backgroundImage) {
            const size = this.RADIUS.OUTER * 2;
            const offset = size / 2;

            // Save the current canvas state
            this.ctx.save();

            // Create clipping region (everything except the weekday ring)
            this.ctx.beginPath();
            // Outer circle
            this.ctx.arc(this.centerX, this.centerY, this.RADIUS.OUTER_FRAME, 0, 2 * Math.PI);
            // Cut out the weekday ring
            this.ctx.arc(this.centerX, this.centerY, this.RADIUS.WEEKDAYS + 15, 0, 2 * Math.PI, true);
            this.ctx.arc(this.centerX, this.centerY, this.RADIUS.WEEKDAYS - 15, 0, 2 * Math.PI);
            this.ctx.clip();

            // Draw background image inside the clipped region
            this.ctx.drawImage(
                this.precalculated.backgroundImage,
                this.centerX - offset,
                this.centerY - offset,
                size,
                size
            );

            // Restore canvas state
            this.ctx.restore();
        }
    }

    _drawMonthSeasons() {
        const seasons = this.calendarData.seasons;

        // For each season, draw a gradient-filled arc in the month ring
        for (let i = 0; i < seasons.length; i++) {
            const season = seasons[i];
            const startAngle = i === 0 ? 0 : seasons.slice(0, i).reduce((sum, s) => sum + s.angle, 0);
            const endAngle = startAngle + season.angle;
            
            // Convert angles from percentage of year to radians (adjusted for canvas)
            const startAngleRad = startAngle;
            const endAngleRad = endAngle;
            
            // Draw the seasonal arc segment with its gradient
            this._drawArcSegment(
                this.RADIUS.OUTER - 15,  // Inner radius of month ring
                this.RADIUS.OUTER_FRAME,       // Outer radius of month ring
                startAngleRad,
                endAngleRad,
                season.gradient
            );
        }
    }

    _drawBorders() {
        this._drawCircle(this.RADIUS.OUTER_FRAME, this.COLORS.BORDER_OUTER, 2);
        this._drawCircle(this.RADIUS.OUTER - 15, this.COLORS.BORDER_INNER);
        this._drawCircle(this.RADIUS.DAYS, this.COLORS.BORDER_INNER);
        this._drawCircle(this.RADIUS.WEEKDAYS + 15, this.COLORS.BORDER_INNER);
        this._drawCircle(this.RADIUS.WEEKDAYS - 15, this.COLORS.BORDER_INNER);
    }

    _drawCircle(radius, color, lineWidth = 1) {
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    _drawNorthMarker() {
        const markerHeight = 10;
        const markerWidth = 16;

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.RADIUS.OUTER_FRAME - markerHeight);
        this.ctx.lineTo(this.centerX - markerWidth / 2, this.centerY - this.RADIUS.OUTER_FRAME);
        this.ctx.lineTo(this.centerX + markerWidth / 2, this.centerY - this.RADIUS.OUTER_FRAME);
        this.ctx.closePath();
        this.ctx.fillStyle = this.COLORS.TEXT_HIGHLIGHT;
        this.ctx.fill();
    }

    _drawMonths() {
        this.ctx.font = "16px Garamond";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        this.calendarData.months.forEach((month, i) => {
            const { x, y, angle } = this.precalculated.monthAngles[i];

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle + Math.PI / 2);

            const isHighlighted = this.hoveredSection &&
                this.hoveredSection.type === 'month' &&
                this.hoveredSection.index === i;

            this.ctx.fillStyle = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_MONTH;
            this.ctx.fillText(month, 0, 0);
            this.ctx.restore();
        });
    }

    _drawDays() {
        const { currentDay } = this.calendarData;

        // Draw day dots
        this.precalculated.dayAngles.forEach((pos, i) => {
            const { x, y } = pos;

            const isHighlighted = this.hoveredSection &&
                this.hoveredSection.type === 'day' &&
                this.hoveredSection.index === i;

            // Add shadow effect for hovered days
            if (isHighlighted) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
                this.ctx.fillStyle = this.COLORS.HIGHLIGHT_BG;
                this.ctx.fill();
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
            this.ctx.fillStyle = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.DOT_NORMAL;
            this.ctx.fill();
        });

        // Highlight current day
        const { x: xToday, y: yToday } = this.precalculated.dayAngles[currentDay];
        this.ctx.beginPath();
        this.ctx.arc(xToday, yToday, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.COLORS.TEXT_HIGHLIGHT;
        this.ctx.fill();
    }

    _drawWeekdays() {
        const { weekdays } = this.calendarData;

        this.ctx.font = "14px Garamond";

        weekdays.forEach((day, i) => {
            const { x, y, angle } = this.precalculated.weekdayAngles[i];

            const isHighlighted = this.hoveredSection &&
                this.hoveredSection.type === 'weekday' &&
                this.hoveredSection.index === i;

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle + Math.PI / 2);
            this.ctx.fillStyle = (i === 0 || isHighlighted) ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            this.ctx.fillText(day, 0, 0);
            this.ctx.restore();
        });
    }

    _drawHighlightedSection() {
        if (!this.hoveredSection) return;

        const { type, index } = this.hoveredSection;

        if (type === 'month') {
            const { startAngle, endAngle } = this.precalculated.monthAngles[index];

            // Draw highlighted arc with increased opacity
            this._drawArcSegment(
                this.RADIUS.OUTER - 15,
                this.RADIUS.OUTER_FRAME,
                startAngle - this.precalculated.monthAngleOffset,
                endAngle - this.precalculated.monthAngleOffset,
                null,
                true
            );
        } else if (type === 'weekday') {
            const { startAngle, endAngle } = this.precalculated.weekdayAngles[index];

            // Draw arc between the inner and outer radius of the weekday section
            this._drawArcSegment(
                this.RADIUS.WEEKDAYS - 15,
                this.RADIUS.WEEKDAYS + 15,
                startAngle - this.precalculated.weekdayAngleOffset,
                endAngle - this.precalculated.weekdayAngleOffset,
                null,
                true
            );
        }
    }

    _drawArcSegment(innerRadius, outerRadius, startAngle, endAngle, gradient = null, isHighlight = false) {
        // Adjust angles to canvas coordinate system
        const startAngleAdjusted = startAngle - Math.PI / 2;
        const endAngleAdjusted = endAngle - Math.PI / 2;

        this.ctx.beginPath();
        // Draw outer arc
        this.ctx.arc(this.centerX, this.centerY, outerRadius, startAngleAdjusted, endAngleAdjusted);
        // Draw line to inner radius
        this.ctx.lineTo(
            this.centerX + innerRadius * Math.cos(endAngleAdjusted),
            this.centerY + innerRadius * Math.sin(endAngleAdjusted)
        );
        // Draw inner arc (counter-clockwise)
        this.ctx.arc(this.centerX, this.centerY, innerRadius, endAngleAdjusted, startAngleAdjusted, true);
        // Close the path
        this.ctx.closePath();

        if (gradient) {
            // Create and apply the radial gradient for the seasonal color
            const arcCenterAngle = (startAngleAdjusted + endAngleAdjusted) / 2;
            const arcCenterX = this.centerX + (innerRadius + (outerRadius - innerRadius) / 2) * Math.cos(arcCenterAngle);
            const arcCenterY = this.centerY + (innerRadius + (outerRadius - innerRadius) / 2) * Math.sin(arcCenterAngle);

            const gradientRadius = (outerRadius - innerRadius) * 0.75;

            const gradientFill = this.ctx.createRadialGradient(
                arcCenterX, arcCenterY, 0,
                arcCenterX, arcCenterY, gradientRadius
            );

            gradientFill.addColorStop(0, gradient.start);
            gradientFill.addColorStop(1, gradient.end);

            this.ctx.fillStyle = gradientFill;
            this.ctx.globalAlpha = 0.7; // Semi-transparent
        } else if (isHighlight) {
            this.ctx.fillStyle = this.COLORS.HIGHLIGHT_BG;
            this.ctx.globalAlpha = 0.6; // Higher opacity for highlight
        } else {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // Default fill
            this.ctx.globalAlpha = 0.3;
        }

        this.ctx.fill();
        this.ctx.globalAlpha = 1.0; // Reset opacity
    }

    _setupEventListeners() {
        // Store bound methods for easier removal
        this._boundMouseMove = this._handleMouseMove.bind(this);
        this._boundMouseLeave = this._handleMouseLeave.bind(this);
        this._boundClick = this._handleClick.bind(this);

        this.canvas.addEventListener('mousemove', this._boundMouseMove);
        this.canvas.addEventListener('mouseleave', this._boundMouseLeave);
        this.canvas.addEventListener('click', this._boundClick);
    }

    _handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Calculate distance from center and angle
        const dx = mouseX - this.centerX;
        const dy = mouseY - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) angle += 2 * Math.PI;

        const previousHovered = this.hoveredSection;
        this.hoveredSection = null;

        // Check if mouse is in month ring
        if (distance >= this.RADIUS.OUTER - 10 && distance <= this.RADIUS.OUTER + 10) {
            const adjustedAngle = angle + this.precalculated.monthAngleOffset;
            const monthIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.months.length) % this.calendarData.months.length;
            this.hoveredSection = { type: 'month', index: monthIndex };
        }
        // Check if mouse is in days ring
        else if (Math.abs(distance - this.RADIUS.DAYS) <= 10) {
            const adjustedAngle = angle + this.precalculated.dayAngleOffset;
            const dayIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.daysInMonth) % this.calendarData.daysInMonth;
            this.hoveredSection = { type: 'day', index: dayIndex };
        }
        // Check if mouse is in weekdays ring
        else if (Math.abs(distance - this.RADIUS.WEEKDAYS) <= 15) {
            const adjustedAngle = angle + this.precalculated.weekdayAngleOffset;
            const weekdayIndex = Math.floor((adjustedAngle / (2 * Math.PI)) * this.calendarData.weekdays.length) % this.calendarData.weekdays.length;
            this.hoveredSection = { type: 'weekday', index: weekdayIndex };
        }

        // Redraw if needed
        if (JSON.stringify(previousHovered) !== JSON.stringify(this.hoveredSection)) {
            this.needsRedraw = true;
            this._scheduleRedraw();

            if (this.hoveredSection) {
                this.hoverCallback(this._collectSliceData());
            } else {
                this.hoverCallback(null);
            }
        }
    }

    _handleMouseLeave() {
        this.hoveredSection = null;
        this.needsRedraw = true;
        this._scheduleRedraw();
        this.hoverCallback(null);
    }

    _scheduleRedraw() {
        // Only schedule a new frame if one isn't already pending
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
        let clickData = {
            type,
            index
        };

        if (type === 'month') {
            clickData.name = this.calendarData.months[index];
            const originalIndex = this.precalculated.monthAngles[index].originalIndex;
            clickData.originalIndex = originalIndex;
        } else if (type === 'day') {
            clickData.day = index + 1; // 1-based day
            clickData.isCurrentDay = index === this.calendarData.currentDay;
        } else if (type === 'weekday') {
            clickData.name = this.calendarData.weekdays[index];
            const originalIndex = (this.calendarData.currentWeekday + index) % this.calendarData.weekdays.length;
            clickData.originalIndex = originalIndex;
        }
        return clickData;
    }

    _handleClick(event) {
        if (!this.hoveredSection) return;

        this.callback(this._collectSliceData());
    }
}