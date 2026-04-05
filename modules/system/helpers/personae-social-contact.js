import { DSAPersonaEntry } from '../../data/journal/dsapersonaedramatis.js';

export class PersonaeSocialContactService {
  static MODIFIER_ID = 'dsa5.personaeSocialContact';

  static supportsSkill(skill) {
    if (!skill?.name) return false;

    const modifierData = game.dsa5.config.SKILL?.[_loc(`LocalizedSkills.${skill.name}`)];
    return modifierData?.some((e) => e.group === 'SKILL_CHECK_MODIFIERS.GROUPS.socialconflict') ?? false;
  }

  static async lookupModifier(actor, targetActor) {
    const speakerUuid = (game.actors?.get(actor?.id) || actor)?.uuid;
    const targetUuid = (game.actors?.get(targetActor?.id) || targetActor)?.uuid;
    const fallback = { value: 0, source: _loc('PERSONAE.title') };

    if (!speakerUuid || !targetUuid) return fallback;

    const speakerKey = speakerUuid.replaceAll('.', '_');
    const activated = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME)?.activated || [];

    for (const ref of activated) {
      const journal = await fromUuid(ref.uuid).catch(() => null);
      if (!journal) continue;

      for (const page of journal.pages) {
        if (page.type !== 'dsapersonaedramatis') continue;

        for (const entry of Object.values(page.system?.personae || {})) {
          if (entry?.actor_uuid !== targetUuid) continue;

          const level = Number(entry.socialContact?.[speakerKey]?.level);
          return {
            value: Number.isFinite(level) ? Math.max(-4, Math.min(4, level - 5)) : 0,
            source: entry.name || page.name || fallback.source,
          };
        }
      }
    }

    return fallback;
  }

  static getSingleTarget() {
    const targets = [...(game.user?.targets || [])].filter((t) => t.actor);
    return targets.length === 1 ? targets[0].actor : null;
  }

  static async appendModifierForSkill(situationalModifiers, { skill, actor } = {}) {
    if (!this.supportsSkill(skill)) return;

    const { value, source } = await this.lookupModifier(actor, this.getSingleTarget());
    situationalModifiers.push({
      name: _loc('SKILL_CHECK_MODIFIERS.SOCIAL.socialContact.label'),
      value,
      selected: true,
      source,
      ref: { id: this.MODIFIER_ID },
    });
  }

  static async refreshWidget(widget, { skill, actor } = {}) {
    if (!widget || !this.supportsSkill(skill)) return;

    const { value, source } = await this.lookupModifier(actor, this.getSingleTarget());
    if (widget.getModifiers().some((m) => m.ref?.id === this.MODIFIER_ID)) {
      widget.updateModifier(this.MODIFIER_ID, { value, source });
    } else {
      widget.addModifier({
        name: _loc('SKILL_CHECK_MODIFIERS.SOCIAL.socialContact.label'),
        value,
        selected: true,
        source,
        ref: { id: this.MODIFIER_ID },
      });
    }

    return true;
  }
}