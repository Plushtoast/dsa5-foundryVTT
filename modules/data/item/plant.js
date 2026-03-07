import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import ObfuscableTemplate from './templates/obfuscable.js';

// ObjectField hinzugefügt für die methodenbasierte Speicherung
const { NumberField, BooleanField, StringField, SchemaField, HTMLField, ArrayField, ObjectField } = foundry.data.fields;
const { TextEditor } = foundry.applications.ux;

/**
 * Vollständiges Datenmodell für Pflanzen.
 * Registrierung: CONFIG.Item.dataModels.plant = PlantData;
 */
export default class PlantData extends ItemDataModel.mixin(DescriptionTemplate, EquipmentTemplate, ObfuscableTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      obfuscation: new SchemaField({
        description: new BooleanField({ initial: false }),
        details: new BooleanField({ initial: false }),
        effects: new BooleanField({ initial: false }),
        enchantment: new BooleanField({ initial: false }),
        work: new BooleanField({ initial: false })
      }),
      
      // Bereich für Haltbarkeit und Zustände
      mundane: new SchemaField({ 
        shelfLife: new SchemaField({ 
            // nullable: true verhindert den "finite number" Fehler bei leeren Eingaben
            value: new NumberField({ initial: null, nullable: true, min: 0 }) 
        }) 
      }),
      supernatural: new SchemaField({ 
        factor: new NumberField({ initial: 1, min: 0 }) 
      }),
      remaining: new SchemaField({ 
        shelfLife: new SchemaField({ 
            // nullable: true erlaubt leere Felder für korrekte Placeholder-Anzeige
            value: new NumberField({ initial: null, nullable: true, min: 0 }) 
        }) 
      }),
      
      // Der "Roh"-Einheitswert (Standard)
      shelfLife: new SchemaField({ 
        unit: new StringField({ initial: 'days' }) 
      }),

      // NEU: Separater Pfad für die verarbeitete Einheit (verhindert das Zurückspringen)
      processed: new SchemaField({
        shelfLife: new SchemaField({
            unit: new StringField({ initial: "" }) 
        })
      }),

      plantState: new StringField({ initial: 'Roh' }),
      preservationMethod: new StringField({ initial: "" }),
      isSpoiled: new BooleanField({ initial: false }),

      /**
       * Methodenbasiertes Schema für alternative Wirkungen und zusätzliche Erzeugnisse.
       */
      preservationDetails: new SchemaField({
        methods: new ObjectField({ initial: {} })
      }),

      // Rezepte
      auxiliaryRecipes: new ArrayField(new SchemaField({ id: new StringField(), name: new StringField(), img: new StringField(), uuid: new StringField() }), { initial: [] }),
      poisonRecipes: new ArrayField(new SchemaField({ id: new StringField(), name: new StringField(), img: new StringField(), uuid: new StringField() }), { initial: [] }),
      drugRecipes: new ArrayField(new SchemaField({ id: new StringField(), name: new StringField(), img: new StringField(), uuid: new StringField() }), { initial: [] }),
      
      // Pflanzenteile (Bestandteile)
      plantPart: new SchemaField({
        leaves: new BooleanField({ initial: false }), 
        blossom: new BooleanField({ initial: false }), 
        thorns: new BooleanField({ initial: false }),
        fibers: new BooleanField({ initial: false }), 
        fruitingBody: new BooleanField({ initial: false }), 
        resin: new BooleanField({ initial: false }),
        woodBark: new BooleanField({ initial: false }), 
        juice: new BooleanField({ initial: false }),
        seeds: new BooleanField({ initial: false }), 
        stem: new BooleanField({ initial: false }), 
        shoots: new BooleanField({ initial: false }),
        oil: new BooleanField({ initial: false }), 
        roots: new BooleanField({ initial: false }), 
        bulbs: new BooleanField({ initial: false }),
      }),
      mainIngredient: new StringField({ initial: "" }),

      // Preise und Fundorte
      price: new SchemaField({ raw: new NumberField({ initial: 0 }), value: new NumberField({ initial: 0 }) }),
      location: new SchemaField({ landscape: new StringField({ initial: '', label: 'PLANT.landscape' }), region: new StringField({ initial: '', label: 'PLANT.region' }) }),
      difficulty: new SchemaField({ search: new NumberField({ initial: 0, label: 'PLANT.search' }), identify: new NumberField({ initial: 0, label: 'PLANT.identify' }) }),
      
      // Beschreibungen und Typen
      usages: new StringField({ initial: '0/0/0/0/0/0', label: 'PLANT.usages' }),
      effect: new HTMLField({ initial: '', label: 'effect' }),
      infos: new HTMLField({ initial: '' }),
      recipes: new HTMLField({ initial: '' }),
      // Checkboxen für Icons (initial: false für saubere Registrierung)
      planttype: new SchemaField({ 
        healing: new BooleanField({ initial: false }), 
        poison: new BooleanField({ initial: false }), 
        physical: new BooleanField({ initial: false }), 
        psychic: new BooleanField({ initial: false }), 
        crop: new BooleanField({ initial: false }), 
        defensive: new BooleanField({ initial: false }), 
        supernatural: new BooleanField({ initial: false }) 
      }),
      
      // Verfügbarkeiten
      availability: new SchemaField({
        highNorth: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }), 
        grasLands: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        swamps: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }), 
        woods: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        jungle: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }), 
        mountains: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        desert: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }), 
        maraskan: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
      }),
    });
  }

  async getSheetData(data) {
    const doc = data.document;
    data.isGM = game.user.isGM;

    // Dynamische Generierung der Pflanzenteile für das Sheet
    data.plantPartList = [
      { key: 'leaves', label: 'PLANT.leaves' }, 
      { key: 'blossom', label: 'PLANT.blossom' }, 
      { key: 'thorns', label: 'PLANT.thorns' },
      { key: 'fibers', label: 'PLANT.fibers' }, 
      { key: 'fruitingBody', label: 'PLANT.fruitingBody' }, 
      { key: 'resin', label: 'PLANT.resin' },
      { key: 'woodBark', label: 'PLANT.woodBark' }, 
      { key: 'juice', label: 'PLANT.juice' },
      { key: 'seeds', label: 'PLANT.seeds' }, 
      { key: 'stem', label: 'PLANT.stem' }, 
      { key: 'shoots', label: 'PLANT.shoots' },
      { key: 'oil', label: 'PLANT.oil' }, 
      { key: 'roots', label: 'PLANT.roots' }, 
      { key: 'bulbs', label: 'PLANT.bulbs' }
    ].map(part => ({
      ...part,
      localizedLabel: game.i18n.localize(part.label),
      value: doc.system.plantPart[part.key] || false,
      path: `system.plantPart.${part.key}`,
      isMain: doc.system.mainIngredient === part.key
    }));

    data.attributes = Object.keys(doc.system.planttype).map(x => ({ name: x, checked: doc.system.planttype[x] }));
    data.shelfLifeOptions = game.i18n.translations.PLANT?.shelfLifeUnits || {};
    
    // HTML Anreicherung
    data.enrichedEffect = await TextEditor.enrichHTML(doc.system.effect, { secrets: doc.isOwner, async: true });
    data.enrichedRecipes = await TextEditor.enrichHTML(doc.system.recipes, { secrets: doc.isOwner, async: true });
    data.enrichedInformation = await TextEditor.enrichHTML(doc.system.gmdescription?.value || doc.system.infos || "", { secrets: doc.isOwner, async: true });

    // Daten für die neue Preservation-GUI
    data.preservationDetails = doc.system.preservationDetails;

    // WICHTIG: Rückgabe der modifizierten Daten
    return data;
  }

  static chatData(data) {
    return [{ key: 'effect', val: data.effect }, { key: 'PLANT.recipes', val: data.recipes }, { key: 'PLANT.usages', val: data.usages }];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();   
    if (this.parent) {
      item.system.preparedWeight = this.parent.system.preparedWeight;
    }
    return item;
  }
}
