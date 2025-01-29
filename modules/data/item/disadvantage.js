import AdvantageData from './advantage.js';

export default class DisadvantageData extends AdvantageData {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {});
  }
}
