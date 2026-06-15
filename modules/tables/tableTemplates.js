const { renderTemplate } = foundry.applications.handlebars;

const PATHS = {
  opportunityAttackCard: 'systems/dsa5/templates/tables/opportunity-attack-card.hbs',
  accidentalAttackDefenseCard: 'systems/dsa5/templates/tables/accidental-attack-defense-card.hbs',
  chatCheckMarker: 'systems/dsa5/templates/tables/parts/chat-check-marker.hbs',
  gearDropped: 'systems/dsa5/templates/tables/gear-dropped.hbs',
  tableCard: 'systems/dsa5/templates/tables/tableCard.hbs',
};

export default class TableTemplates {
  static paths = PATHS;

  static opportunityAttackCard({ actorName, targetName, modifiers, weapons = [] }) {
    return renderTemplate(PATHS.opportunityAttackCard, {
      actorName,
      targetName,
      modifiers,
      weapons,
      notFoundMessage: _loc('DSAError.notFound', {
        category: _loc('TYPES.Item.meleeweapon'),
        name: _loc('WEAPON.Item'),
      }),
    });
  }

  static accidentalAttackDefenseCard({ sourceActorName, sourceName, targetName, defendable }) {
    return renderTemplate(PATHS.accidentalAttackDefenseCard, {
      sourceActorName,
      sourceName,
      targetName,
      defendable,
    });
  }

  static chatCheckMarker(tooltip) {
    return renderTemplate(PATHS.chatCheckMarker, { tooltip });
  }

  static gearDropped({ message, rollHtml }) {
    return renderTemplate(PATHS.gearDropped, { message, rollHtml });
  }

  static tableCard(context) {
    return renderTemplate(PATHS.tableCard, context);
  }
}
