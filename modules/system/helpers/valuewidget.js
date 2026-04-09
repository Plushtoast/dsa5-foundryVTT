export class ValueWidget {
    constructor(container) {
        this.container = container;
        this.min = Number(container.dataset.min) || 0;
        this.max = Number(container.dataset.max) || 0;
        this.value = this.clamp(Number(container.dataset.value) || 0);
        this.name = container.dataset.name || 'valuewidget';
        this.render();
        this.bindEvents();
        this.updateUI();
    }

    clamp(val) {
        return Math.clamp(val, this.min, this.max);
    }

    render() {
        this.container.innerHTML = `
<div class="flexrow vw-controls">
    <div class="flexcol flex0">
        <button type="button" class="vw-decrease">–</button>
        <div class="vw-pip vw-minPip">${this.min}</div>
    </div>
    <div class="flexcol">
        <input type="number" class="vw-valueInput" name="${this.name}" value="${this.value}">
    </div>
    <div class="flexcol flex0">
        <button type="button" class="vw-increase">+</button>
        <div class="vw-pip vw-maxPip">${this.max}</div>
    </div>
</div>
`;

        this.input = this.container.querySelector('.vw-valueInput');
        this.btnDecrease = this.container.querySelector('.vw-decrease');
        this.btnIncrease = this.container.querySelector('.vw-increase');
        this.minPip = this.container.querySelector('.vw-minPip');
        this.maxPip = this.container.querySelector('.vw-maxPip');
    }

    bindEvents() {
        this.btnDecrease.addEventListener('click', () => {
            this.setValue(this.value - 1);
        });

        this.btnIncrease.addEventListener('click', () => {
            this.setValue(this.value + 1);
        });

        this.input.addEventListener('input', () => {
            this.setValue(Number(this.input.value) || 0);
        });
    }

    setValue(val) {
        this.value = this.clamp(val);
        this.updateUI();
    }

    updateUI() {
        this.input.value = this.value;
        this.minPip.classList.toggle('vw-active', this.value === this.min);
        this.maxPip.classList.toggle('vw-active', this.value === this.max);
    }
}