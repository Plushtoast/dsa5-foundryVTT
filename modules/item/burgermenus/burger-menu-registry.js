import { registerCommonKnowledgeHooks } from './common_knowledge.js';
import { registerPracticalApplicationHooks } from './practical_application.js';
import { registerVisionOfTheDeityHooks } from './vision-der-gottheit.js';

export class BurgerMenuRegistry {
  static registerHooks() {
    registerCommonKnowledgeHooks();
    registerPracticalApplicationHooks();
    registerVisionOfTheDeityHooks();
  }
}