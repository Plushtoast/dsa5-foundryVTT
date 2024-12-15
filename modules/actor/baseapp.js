import { AppV2Mixin } from "./appv2_mixin.js";

export class DefaultAppv2 extends AppV2Mixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)) {

}