import { registerCommonKnowledgeHooks } from './common_knowledge.js';
import { registerPracticalApplicationHooks } from './practical_application.js';

export class BurgerMenuRegistry {
  static registerHooks() {
    registerCommonKnowledgeHooks();
    registerPracticalApplicationHooks();
  }
}