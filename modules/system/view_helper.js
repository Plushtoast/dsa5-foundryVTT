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

export async function itemFromDrop(dragData, actorId, toObject = true) {
    let item
    let selfTarget
    if(dragData.type == "Actor"){
        item = await Actor.implementation.fromDropData(dragData)
        selfTarget = actorId === item.id
    }else{
        item = await Item.implementation.fromDropData(dragData)
        selfTarget = actorId === item.parent?.uuid
    }
    let typeClass = item?.type
    
    if (toObject) {
        item = item.toObject()
    }

    if(dragData.amount) item.system.quantity.value = Number(dragData.amount)
    
    return { item, typeClass, selfTarget }
}

export function slist(html, target, callback, itemTag = "div") {
    target = html.find(target)[0];
    if (!target) return

    target.classList.add("slist");

    let items = target.querySelectorAll(itemTag),
        current = null;
    for (let i of items) {
        i.draggable = true;

        i.addEventListener("dragstart", function(ev) {
            current = this;
        });

        i.addEventListener("dragover", function(evt) {
            evt.preventDefault();
        });

        i.addEventListener("drop", async function(evt) {
            evt.preventDefault();
            if (this != current) {
                let currentpos = 0,
                    droppedpos = 0;
                for (let it = 0; it < items.length; it++) {
                    if (current == items[it]) { currentpos = it; }
                    if (this == items[it]) { droppedpos = it; }
                }
                if (currentpos < droppedpos) {
                    this.parentNode.insertBefore(current, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(current, this);
                }
                await callback(target)
            }
        });
    }
}

export function tinyNotification(message) {
    let container = $('.tinyNotifications')
    if (!container.length) {
        $('body').append('<ul class="tinyNotifications"></ul>')
        container = $('.tinyNotifications')
    }
    const elem = $(`<li>${message}</li>`)
    container.prepend(elem)
    setTimeout(function() { elem.remove() }, 1500)
}