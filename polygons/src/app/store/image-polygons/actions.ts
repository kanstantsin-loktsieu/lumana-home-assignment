import { createActionGroup, props } from "@ngrx/store";
import { Polygon } from "../../core/model/polygon";

export const ImagePolygonsActions = createActionGroup({
  source: 'Images',
  events: {
    'AddPolygon': props<{ imageId: number, polygon: Polygon }>(),
  }
});