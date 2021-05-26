import DSA5_Utility from "./utility-dsa5.js";

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

export async function itemFromDrop(dragData, actorId){
    let item
    let typeClass
    let selfTarget = dragData.actorId && dragData.actorId == actorId

    if (dragData.id && dragData.pack) {
        item = await DSA5_Utility.findItembyIdAndPack(dragData.id, dragData.pack);
        typeClass = item.data.type
    } else if (dragData.id && dragData.type == "Actor") {
        item = DSA5_Utility.findActorbyId(dragData.id);
        typeClass = item.data.type
    } else if (dragData.id) {
        item = DSA5_Utility.findItembyId(dragData.id);
        typeClass = item.data.type
    } else {
        item = dragData.data
        typeClass = item.type
    }

    //TODO might not need the creature filter here
    // also might use ToObject(false)
    if (typeof item.toObject === 'function' && typeClass != 'creature') {
        item = item.toObject(true)
    }

    return { item, typeClass, selfTarget }
}