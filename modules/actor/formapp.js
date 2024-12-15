import { DefaultAppv2 } from "./baseapp.js"

export class FormAppv2 extends DefaultAppv2  {
    static DEFAULT_OPTIONS = {
        tag: "form",
        window: {
            contentClasses: ["standard-form"]
        }
    };
}