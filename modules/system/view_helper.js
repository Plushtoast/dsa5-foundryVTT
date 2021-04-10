export function svgAutoFit(elem, width = 320, height = 40) {
    elem.attr({
        'width': width * 0.8,
        'viewBox': `0 0 ${width} ${height}`
    })
    const text = elem.find('text')
    const bb = text.get(0).getBBox();
    const widthTransform = width / bb.width;
    const heightTransform = height / bb.height;
    const transformW = widthTransform < heightTransform
    const value = transformW ? widthTransform : heightTransform;
    if (isFinite(value)) {
        text.attr({
            "transform": "matrix(" + value + ", 0, 0, " + value + ", 0,0)",
            "x": Math.max(0, (width - bb.width) / 2),
            "y": height * 0.75 / (transformW ? 1 : value)
        });
    }
}