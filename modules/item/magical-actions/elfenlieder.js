import NoModificationsAction from './no-modifications.js';

export default class ElfenliederAction extends NoModificationsAction {
  static SUPPORT_SKILLS = ['LocalizedIDs.singing', 'LocalizedIDs.music'];

  applyDialogRestrictions(dialogData) {
    if (!super.applyDialogRestrictions(dialogData)) return;

    dialogData.showRightClothes = false;

    return true;
  }

  getBurgerMenuItems(dialogState) {
    return [
      {
        label: _loc('MAGICALACTION.elfenliederSupport'),
        icon: '<i class="fas fa-music"></i>',
        onClick: async (state) => {
          const { actor, dialog } = state;
          if (!actor) return;

          const skills = ElfenliederAction.SUPPORT_SKILLS.map((key) => _loc(key))
            .map((name) => actor.items.find((i) => i.type === 'skill' && i.name === name))
            .filter(Boolean);

          if (skills.length === 0) {
            ui.notifications.warn('MAGICALACTION.noSupportSkill', { localize: true });
            return;
          }

          const skill = skills.length === 1 ? skills[0] : await ElfenliederAction.#chooseSkill(skills);
          if (!skill) return;

          const setupData = await actor.setupSkill(skill, {}, 'roll');
          if (!setupData) return;

          const result = await actor.basicTest(setupData);
          const qs = result?.result?.qualityStep || 0;
          if (qs <= 0) return;

          const widget = dialog?.getSituationalModifiersWidget?.();
          if (!widget) return;

          const label = _loc('MAGICALACTION.elfenliederModifier');
          const modifiers = widget.getModifiers();
          const modifier = {
            name: label,
            value: qs,
            selected: true,
            source: _loc('MAGICALACTION.elfenliederSupport'),
          };
          const updated = modifiers.some((m) => m.name === label)
            ? modifiers.map((m) => (m.name === label ? { ...m, ...modifier } : m))
            : [...modifiers, modifier];
          widget.setModifiers(updated);

          dialog?.element?.querySelector?.('form')?.dispatchEvent(new Event('change', { bubbles: true }));
        },
      },
    ];
  }

  static async #chooseSkill(skills) {
    const buttons = skills.map((skill) => ({
      action: skill.id,
      label: skill.name,
    }));
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: 'MAGICALACTION.elfenliederSupport' },
      content: `<p>${_loc('MAGICALACTION.chooseSupportSkill')}</p>`,
      buttons,
    });
    return skills.find((s) => s.id === choice) ?? null;
  }
}
