export class SpellModifiers {
  static get(actor, name, sourceType) {
    const result = [];
    const keys = ['FP', 'step', 'QL', 'TPM', 'FW', 'CMP'];
    
    for (const key of keys) {
      const type = key === 'step' ? '' : key;
      const modifiers = actor.system.skillModifiers[key];
      
      if (Array.isArray(modifiers)) {
        result.push(
          ...modifiers
            .filter(modifier => modifier.target === name)
            .map(modifier => ({
              name: modifier.source,
              value: modifier.value,
              source: modifier.item,
              type,
            }))
        );
      }
      
      const sourceModifiers = actor.system.skillModifiers[sourceType]?.[key];
      if (Array.isArray(sourceModifiers)) {
        result.push(
          ...sourceModifiers.map(modifier => ({
            name: modifier.target || modifier.source,
            value: modifier.value,
            source: modifier.source,
            type,
          }))
        );
      }
    }
    
    return result;
  }
}