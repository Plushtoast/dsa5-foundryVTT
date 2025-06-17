export class CalendarCanvas {
    constructor(parentElement) {
        this.element = parentElement;
    }

    async render() {
        this._drawCalendar();
    }

    async _drawCalendar() {
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const canvas = this.element.querySelector('.circular-calendar');
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

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - outerFrame - 2);
        ctx.lineTo(centerX - 8, centerY - outerFrame + 6);
        ctx.lineTo(centerX + 8, centerY - outerFrame + 6);
        ctx.closePath();
        ctx.fillStyle = "#ffcc00";
        ctx.fill();

        ctx.font = "16px Garamond";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Draw months along the full circle
        months.forEach((month, i) => {
            const angle = (2 * Math.PI * i) / months.length;
            const x = centerX + Math.cos(angle - Math.PI / 2) * radiusOuter;
            const y = centerY + Math.sin(angle - Math.PI / 2) * radiusOuter;

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
            const x = centerX + Math.cos(angle - Math.PI / 2) * radiusDays;
            const y = centerY + Math.sin(angle - Math.PI / 2) * radiusDays;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff6d0";
            ctx.fill();
        }

        // Highlight current day
        const angleToday = (2 * Math.PI * currentDay) / daysInMonth;
        const xToday = centerX + Math.cos(angleToday - Math.PI / 2) * radiusDays;
        const yToday = centerY + Math.sin(angleToday - Math.PI / 2) * radiusDays;

        ctx.beginPath();
        ctx.arc(xToday, yToday, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffcc00";
        ctx.fill();

        ctx.font = "12px Garamond";

        // Draw weekdays in full circle
        weekdays.forEach((day, i) => {
            const angle = (2 * Math.PI * i) / weekdays.length;
            const x = centerX + Math.cos(angle - Math.PI / 2) * radiusWeekdays;
            const y = centerY + Math.sin(angle - Math.PI / 2) * radiusWeekdays;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillStyle = (i === currentWeekday) ? "#ffcc00" : "#e0c080";
            ctx.fillText(day, 0, 0);
            ctx.restore();
        });

        // Add hover effect
        let hoveredSection = null;

        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Calculate distance from center and angle
            const dx = mouseX - centerX;
            const dy = mouseY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            let angle = Math.atan2(dy, dx) + Math.PI / 2;
            if (angle < 0) angle += 2 * Math.PI;

            const previousHovered = hoveredSection;
            hoveredSection = null;

            // Check if mouse is in month ring
            if (distance >= radiusOuter - 10 && distance <= radiusOuter + 10) {
                const monthIndex = Math.floor((angle / (2 * Math.PI)) * months.length) % months.length;
                hoveredSection = { type: 'month', index: monthIndex };
            }
            // Check if mouse is in days ring
            else if (distance >= radiusDays - 10 && distance <= radiusDays + 10) {
                const dayIndex = Math.floor((angle / (2 * Math.PI)) * daysInMonth) % daysInMonth;
                hoveredSection = { type: 'day', index: dayIndex };
            }

            // Redraw if needed
            if (JSON.stringify(previousHovered) !== JSON.stringify(hoveredSection)) {
                redrawWithHighlight();
            }
        });

        canvas.addEventListener('mouseleave', () => {
            hoveredSection = null;
            redrawWithHighlight();
        });

        function redrawWithHighlight() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Redraw background
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerFrame, 0, 2 * Math.PI, false);
            ctx.fillStyle = bgGradient;
            ctx.fill();

            // Redraw background image
            const img = new Image();
            img.onload = () => {
                const size = radiusOuter * 2;
                const offset = size / 2;
                ctx.drawImage(img, centerX - offset, centerY - offset, size, size);

                // Redraw borders
                drawBorder(outerFrame, "#888", 2);
                drawBorder(radiusOuter - 15, "#555", 1);
                drawBorder(radiusDays, "#555", 1);
                drawBorder(radiusWeekdays + 15, "#555", 1);
                drawBorder(radiusWeekdays - 15, "#555", 1);

                ctx.beginPath();
                ctx.moveTo(centerX, centerY - outerFrame - 2);
                ctx.lineTo(centerX - 8, centerY - outerFrame + 6);
                ctx.lineTo(centerX + 8, centerY - outerFrame + 6);
                ctx.closePath();
                ctx.fillStyle = "#ffcc00";
                ctx.fill();

                // Draw highlighted section if any
                if (hoveredSection) {
                    if (hoveredSection.type === 'month') {
                        const i = hoveredSection.index;
                        const angleStart = (2 * Math.PI * i) / months.length;
                        const angleEnd = (2 * Math.PI * (i + 1)) / months.length;

                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radiusOuter + 10, angleStart - Math.PI / 2, angleEnd - Math.PI / 2);
                        ctx.lineTo(centerX, centerY);
                        ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
                        ctx.fill();

                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radiusOuter - 10, angleEnd - Math.PI / 2, angleStart - Math.PI / 2, true);
                        ctx.lineTo(centerX, centerY);
                        ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
                        ctx.fill();
                    } else if (hoveredSection.type === 'day') {
                        const i = hoveredSection.index;
                        const angleStart = (2 * Math.PI * i) / daysInMonth;
                        const angleEnd = (2 * Math.PI * (i + 1)) / daysInMonth;

                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radiusDays + 10, angleStart - Math.PI / 2, angleEnd - Math.PI / 2);
                        ctx.lineTo(centerX, centerY);
                        ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
                        ctx.fill();

                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radiusDays - 10, angleEnd - Math.PI / 2, angleStart - Math.PI / 2, true);
                        ctx.lineTo(centerX, centerY);
                        ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
                        ctx.fill();
                    }
                }

                // Redraw months
                ctx.font = "16px Garamond";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                months.forEach((month, i) => {
                    const angle = (2 * Math.PI * i) / months.length;
                    const x = centerX + Math.cos(angle - Math.PI / 2) * radiusOuter;
                    const y = centerY + Math.sin(angle - Math.PI / 2) * radiusOuter;

                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(angle);
                    ctx.fillStyle = (hoveredSection && hoveredSection.type === 'month' && hoveredSection.index === i)
                        ? "#ffcc00" : "#e0c080";
                    ctx.fillText(month, 0, 0);
                    ctx.restore();
                });

                // Redraw days
                for (let d = 0; d < daysInMonth; d++) {
                    const angle = (2 * Math.PI * d) / daysInMonth;
                    const x = centerX + Math.cos(angle - Math.PI / 2) * radiusDays;
                    const y = centerY + Math.sin(angle - Math.PI / 2) * radiusDays;

                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fillStyle = (hoveredSection && hoveredSection.type === 'day' && hoveredSection.index === d)
                        ? "#ffcc00" : "#fff6d0";
                    ctx.fill();
                }

                // Highlight current day
                const angleToday = (2 * Math.PI * currentDay) / daysInMonth;
                const xToday = centerX + Math.cos(angleToday - Math.PI / 2) * radiusDays;
                const yToday = centerY + Math.sin(angleToday - Math.PI / 2) * radiusDays;

                ctx.beginPath();
                ctx.arc(xToday, yToday, 5, 0, 2 * Math.PI);
                ctx.fillStyle = "#ffcc00";
                ctx.fill();

                ctx.font = "12px Garamond";

                // Redraw weekdays
                weekdays.forEach((day, i) => {
                    const angle = (2 * Math.PI * i) / weekdays.length;
                    const x = centerX + Math.cos(angle - Math.PI / 2) * radiusWeekdays;
                    const y = centerY + Math.sin(angle - Math.PI / 2) * radiusWeekdays;

                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(angle);
                    ctx.fillStyle = (i === currentWeekday) ? "#ffcc00" : "#e0c080";
                    ctx.fillText(day, 0, 0);
                    ctx.restore();
                });
            };
            img.src = backgroundImage;
        }
    }
}