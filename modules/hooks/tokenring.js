export function connectTokenRing() {
  Hooks.once('initializeDynamicTokenRingConfig', (tokenring) => {
    const configs = [
      {
        id: 'dsa5token',
        label: 'DSA5_TOKENRING.normal',
        spritesheet: 'systems/dsa5/icons/tokenring/texture.json',
      },
      {
        id: 'dsa5token_blank',
        label: 'DSA5_TOKENRING.blank',
        spritesheet: 'systems/dsa5/icons/tokenring/texture_blankbg.json',
      },
    ];
    for (const config of configs) {
      tokenring.addConfig(config.id, new foundry.canvas.placeables.tokens.DynamicRingData(config));
    }
  });

  //CONFIG.Token.ring.debugColorBands = true;
}
