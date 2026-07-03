import { createFeatureSelector, createSelector } from "@ngrx/store";
import { ImagePolygonsState } from "./reducer";

export const selectImagePolygonsState = createFeatureSelector<ImagePolygonsState>('imagePolygons');

export const selectImagePolygons = createSelector(
  selectImagePolygonsState,
  state => state
);