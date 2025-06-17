export class CalendarCanvas {
    constructor(parentElement) {
        this.element = parentElement;
        this.canvas = null;
        this.ctx = null;
        this.centerX = 0;
        this.centerY = 0;
        this.hoveredSection = null;

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
            TEXT_HIGHLIGHT: "#ffcc00",
            DOT_NORMAL: "#fff6d0",
            HIGHLIGHT_BG: "rgba(255, 204, 0, 0.3)"
        };
    }

    async render() {
        this._setupCanvas();
        this._drawCalendar();
        this._setupEventListeners();
    }

    _setupCanvas() {
        this.canvas = this.element.querySelector('.circular-calendar');
        this.ctx = this.canvas.getContext('2d');
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    async _drawCalendar() {
        const calendar = game.time.calendar;
        const components = calendar.timeToComponents(game.time.worldTime);

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get calendar data
        this.calendarData = {
            months: calendar.months.values.map(m => game.i18n.localize(`${calendar.translationPrefix}.${m.name}`)),
            weekdays: calendar.days.values.map(d => game.i18n.localize(`${calendar.translationPrefix}.${d.name}`)),
            currentMonth: components.month,
            currentDay: components.dayOfMonth,
            currentWeekday: components.dayOfWeek,
            daysInMonth: calendar.months.values[components.month].days
        };

        // Rotate arrays to start with current
        this.calendarData.months = this._rotateArray(this.calendarData.months, this.calendarData.currentMonth);
        this.calendarData.weekdays = this._rotateArray(this.calendarData.weekdays, this.calendarData.currentWeekday);

        // Draw elements
        await this._drawBackground();
        this._drawBorders();
        this._drawNorthMarker();
        this._drawMonths();
        this._drawDays();
        this._drawWeekdays();
    }

    _rotateArray(array, startIndex) {
        return array.slice(startIndex).concat(array.slice(0, startIndex));
    }

    async _drawBackground() {
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

        // Load and draw background image
        await this._loadBackgroundImage();
    }

    async _loadBackgroundImage() {
        const backgroundImage = "systems/dsa5/icons/backgrounds/turnMarker.webp";

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const size = this.RADIUS.OUTER * 2;
                const offset = size / 2;
                this.ctx.drawImage(
                    img,
                    this.centerX - offset,
                    this.centerY - offset,
                    size,
                    size
                );
                resolve();
            };
            img.src = backgroundImage;
        });
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
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.RADIUS.OUTER_FRAME - 2);
        this.ctx.lineTo(this.centerX - 8, this.centerY - this.RADIUS.OUTER_FRAME + 6);
        this.ctx.lineTo(this.centerX + 8, this.centerY - this.RADIUS.OUTER_FRAME + 6);
        this.ctx.closePath();
        this.ctx.fillStyle = this.COLORS.TEXT_HIGHLIGHT;
        this.ctx.fill();
    }

    _drawMonths() {
        this.ctx.font = "16px Garamond";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        this.calendarData.months.forEach((month, i) => {
            const angle = (2 * Math.PI * i) / this.calendarData.months.length;
            const x = this.centerX + Math.cos(angle - Math.PI / 2) * this.RADIUS.OUTER;
            const y = this.centerY + Math.sin(angle - Math.PI / 2) * this.RADIUS.OUTER;

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle);

            const isHighlighted = this.hoveredSection &&
                this.hoveredSection.type === 'month' &&
                this.hoveredSection.index === i;

            this.ctx.fillStyle = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            this.ctx.fillText(month, 0, 0);
            this.ctx.restore();
        });
    }

    _drawDays() {
        const { daysInMonth, currentDay } = this.calendarData;

        // Draw day dots
        for (let d = 0; d < daysInMonth; d++) {
            const angle = (2 * Math.PI * d) / daysInMonth;
            const x = this.centerX + Math.cos(angle - Math.PI / 2) * this.RADIUS.DAYS;
            const y = this.centerY + Math.sin(angle - Math.PI / 2) * this.RADIUS.DAYS;

            const isHighlighted = this.hoveredSection &&
                this.hoveredSection.type === 'day' &&
                this.hoveredSection.index === d;

            // Add shadow effect for hovered days
            if (isHighlighted) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
                this.ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
                this.ctx.fill();
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
            this.ctx.fillStyle = isHighlighted ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.DOT_NORMAL;
            this.ctx.fill();
        }

        // Highlight current day
        const angleToday = (2 * Math.PI * currentDay) / daysInMonth;
        const xToday = this.centerX + Math.cos(angleToday - Math.PI / 2) * this.RADIUS.DAYS;
        const yToday = this.centerY + Math.sin(angleToday - Math.PI / 2) * this.RADIUS.DAYS;

        this.ctx.beginPath();
        this.ctx.arc(xToday, yToday, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.COLORS.TEXT_HIGHLIGHT;
        this.ctx.fill();
    }

    _drawWeekdays() {
        const { weekdays } = this.calendarData;

        this.ctx.font = "12px Garamond";

        weekdays.forEach((day, i) => {
            const angle = (2 * Math.PI * i) / weekdays.length;
            const x = this.centerX + Math.cos(angle - Math.PI / 2) * this.RADIUS.WEEKDAYS;
            const y = this.centerY + Math.sin(angle - Math.PI / 2) * this.RADIUS.WEEKDAYS;

            const isHighlighted = this.hoveredSection &&
                this.hoveredSection.type === 'weekday' &&
                this.hoveredSection.index === i;

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle);
            this.ctx.fillStyle = (i === 0 || isHighlighted) ? this.COLORS.TEXT_HIGHLIGHT : this.COLORS.TEXT_NORMAL;
            this.ctx.fillText(day, 0, 0);
            this.ctx.restore();
        });
    }

    _drawHighlightedSection() {
        if (!this.hoveredSection) return;

        const { type, index } = this.hoveredSection;
        let angleStart, angleEnd, radius;

        if (type === 'month') {
            angleStart = (2 * Math.PI * index) / this.calendarData.months.length;
            angleEnd = (2 * Math.PI * (index + 1)) / this.calendarData.months.length;
            radius = this.RADIUS.OUTER;
            this._drawSector(radius + 10, angleStart, angleEnd);
            this._drawSector(radius - 10, angleEnd, angleStart, true);
        } else if (type === 'weekday') {
            angleStart = (2 * Math.PI * index) / this.calendarData.weekdays.length;
            angleEnd = (2 * Math.PI * (index + 1)) / this.calendarData.weekdays.length;
            radius = this.RADIUS.WEEKDAYS;
            this._drawSector(radius + 10, angleStart, angleEnd);
            this._drawSector(radius - 10, angleEnd, angleStart, true);
        }
        // Day highlighting is now handled in _drawDays
    }

    _drawSector(radius, startAngle, endAngle, counterClockwise = false) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(
            this.centerX, this.centerY, radius,
            startAngle - Math.PI / 2, endAngle - Math.PI / 2,
            counterClockwise
        );
        this.ctx.lineTo(this.centerX, this.centerY);
        this.ctx.fillStyle = this.COLORS.HIGHLIGHT_BG;
        this.ctx.fill();
    }

    _setupEventListeners() {
        this.canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseleave', this._handleMouseLeave.bind(this));
        this.canvas.addEventListener('click', this._handleClick.bind(this));
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
            const monthIndex = Math.floor((angle / (2 * Math.PI)) * this.calendarData.months.length) % this.calendarData.months.length;
            this.hoveredSection = { type: 'month', index: monthIndex };
        }
        // Check if mouse is in days ring
        else if (Math.abs(distance - this.RADIUS.DAYS) <= 10) {
            const dayIndex = Math.floor((angle / (2 * Math.PI)) * this.calendarData.daysInMonth) % this.calendarData.daysInMonth;
            this.hoveredSection = { type: 'day', index: dayIndex };
        }
        // Check if mouse is in weekdays ring
        else if (Math.abs(distance - this.RADIUS.WEEKDAYS) <= 15) {
            const weekdayIndex = Math.floor((angle / (2 * Math.PI)) * this.calendarData.weekdays.length) % this.calendarData.weekdays.length;
            this.hoveredSection = { type: 'weekday', index: weekdayIndex };
        }

        // Redraw if needed
        if (JSON.stringify(previousHovered) !== JSON.stringify(this.hoveredSection)) {
            this._redraw();
        }
    }

    _handleMouseLeave() {
        this.hoveredSection = null;
        this._redraw();
    }

    _handleClick(event) {
        // You can implement click behavior here if needed
        // For example, selecting a month or day
    }

    async _redraw() {
        // Clear and redraw the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        await this._drawBackground();
        this._drawHighlightedSection();
        this._drawBorders();
        this._drawNorthMarker();
        this._drawMonths();
        this._drawDays();
        this._drawWeekdays();
    }
}
