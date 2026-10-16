/**
 * Compact overlay for picking a discrete status (quest / objective) without cycling.
 * Markup matches the combat ammo picker: a trigger button plus `.statusEffectMenu`.
 */
export default class JournalStatusPicker {
    static PARTIAL = 'systems/dsa5/templates/journal/parts/status-picker.hbs';

    static async preload() {
        await foundry.applications.handlebars.loadTemplates([this.PARTIAL]);
    }

    static open(target) {
        const menu = target.closest('.journal-status-picker')?.querySelector('.statusEffectMenu ul');
        if (!menu) return;

        const root = target.closest('.window-app, .journal-entry-page, .dsaCalendarPicker') || document;
        root.querySelectorAll('.journal-status-picker .statusEffectMenu ul').forEach(ul => {
            if (ul !== menu) ul.style.display = 'none';
        });
        $(menu).fadeIn('fast');
    }

    static bind(root) {
        if (!root) return;
        root.querySelectorAll('.journal-status-picker .statusEffectMenu ul').forEach(ul => {
            if (ul.dataset.statusPickerBound) return;
            ul.dataset.statusPickerBound = '1';
            ul.addEventListener('mouseleave', () => $(ul).fadeOut('fast'));
        });
    }
}
