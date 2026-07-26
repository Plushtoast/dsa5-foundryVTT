import { registerCommonKnowledgeHooks } from './common_knowledge.js';
import { registerPracticalApplicationHooks } from './practical_application.js';
import { registerVisionOfTheDeityHooks } from './vision-der-gottheit.js';
import { registerVisionOfTrueFaithHooks } from './vision-des-wahren-glaubens.js';

export class BurgerMenuRegistry {
  static registerHooks() {
    registerCommonKnowledgeHooks();
    registerPracticalApplicationHooks();
    registerVisionOfTheDeityHooks();
    registerVisionOfTrueFaithHooks();
  }
}