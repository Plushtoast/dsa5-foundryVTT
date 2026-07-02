export default class PowersourceBar {
  static prepareSheetContext(actor, prepare) {
    const powersource = {
      ...actor.powersource,
      segments: (actor.powersource?.segments ?? []).map((segment, i) => ({ ...segment, colorIndex: i })),
    };

    prepare.powersource = powersource;
    prepare.powersourceBar = !!prepare.magic?.hasSpells && powersource.max > 0;
    prepare.powersourceBarLayout = prepare.powersourceBar
      ? this.prepareLayout(actor, powersource)
      : null;
  }

  static prepareLayout(actor, powersource) {
    const personalMax = Number(actor.system.status.astralenergy.max) || 0;
    const personalValue = Number(actor.system.status.astralenergy.value) || 0;
    const ksMax = powersource?.max || 0;
    const totalMax = personalMax + ksMax;
    if (totalMax <= 0) return null;

    let offset = personalMax / totalMax;
    const segments = (powersource?.segments || []).map((segment) => {
      const width = segment.max / totalMax;
      const layout = {
        ...segment,
        offset,
        width,
        fillRatio: segment.max > 0 ? segment.value / segment.max : 0,
      };
      offset += width;
      return layout;
    });

    return {
      totalMax,
      personalMax,
      personalValue,
      personalOffset: 0,
      personalWidth: personalMax / totalMax,
      personalFillRatio: personalMax > 0 ? personalValue / personalMax : 0,
      segments,
    };
  }
}
