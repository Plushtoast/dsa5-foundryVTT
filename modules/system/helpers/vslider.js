export class VerticalSlider {
    SLIDERHEIGHT = 5;

    constructor(container, identifier, { min = 0, max = 100, value = 50, onChange = null } = {}) {
        this.container = container;
        this.min = min;
        this.max = max;
        this.value = value;
        this.onChange = onChange;

        // render HTML
        this.container.classList.add("v-slider");
        this.container.innerHTML = `
            <div class="v-slider ${identifier}">
                <div class="v-slider-track">
                    <div class="v-slider-fill"></div>
                    <div class="v-slider-thumb"></div>
                </div>
            </div>
            `;

        this.track = this.container.querySelector(".v-slider-track");
        this.fill = this.container.querySelector(".v-slider-fill");
        this.thumb = this.container.querySelector(".v-slider-thumb");

        this.dragging = false;

        this._attachListeners();
        this.setValue(value);
    }

    _attachListeners() {
        this.thumb.addEventListener("mousedown", () => {
            this.dragging = true;
            this.thumb.style.cursor = "grabbing";
        });

        document.addEventListener("mouseup", () => {
            if (this.dragging && this.onChange) {
                this.onChange(this.value);
            }
            this.dragging = false;
            this.thumb.style.cursor = "grab";
        });

        document.addEventListener("mousemove", (e) => {
            if (!this.dragging) return;
            const val = this._getValueFromY(e.clientY);
            this.setValue(val);
        });

        this.track.addEventListener("click", (e) => {
            const val = this._getValueFromY(e.clientY);
            this.setValue(val);
        });
    }

    _getValueFromY(y) {
        const rect = this.track.getBoundingClientRect();
        let offset = rect.bottom - y + this.SLIDERHEIGHT;
        offset = Math.max(0, Math.min(offset, rect.height));
        return Math.round(this.min + (offset / rect.height) * (this.max - this.min));
    }

    _updateUI() {
        const pct = (this.value - this.min) / (this.max - this.min);
        const pos = pct * this.track.clientHeight - this.SLIDERHEIGHT;
        
        this.thumb.style.bottom = `${pos}px`;
        this.fill.style.height = `${pos}px`;
    }

    setValue(val) {
        this.value = Math.clamp(val, this.min, this.max);
        this._updateUI();
    }

    getValue() {
        return this.value;
    }
}
