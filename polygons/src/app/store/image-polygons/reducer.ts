import { createReducer, on } from "@ngrx/store";
import { Polygon } from "../../core/model/polygon";
import { ImagePolygonsActions } from "./actions";

export interface ImagePolygonsState {
  [id: number]: Polygon[]
}

export const initialImagePolygonsState: ImagePolygonsState = {};

export const imagePolygonsReducer = createReducer(
  initialImagePolygonsState,
  on(ImagePolygonsActions.addPolygon, (state, { imageId, polygon }) => ({
    ...state,
    [imageId]: [...state[imageId] ?? [], polygon]
  })),
)