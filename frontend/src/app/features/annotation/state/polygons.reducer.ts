import { createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { Polygon, PolygonsState } from '../models/polygon';
import { PolygonsActions } from './polygons.actions';

const polygonsAdapter = createEntityAdapter<Polygon>();

const initialState: PolygonsState = polygonsAdapter.getInitialState();

const EMPTY_POLYGONS: readonly Polygon[] = [];

export const polygonsFeature = createFeature({
  name: 'polygons',
  reducer: createReducer(
    initialState,
    on(PolygonsActions.polygonAdded, (state, { polygon }) =>
      polygonsAdapter.addOne(polygon, state),
    ),
    on(PolygonsActions.polygonChanged, (state, { id, points }) =>
      polygonsAdapter.updateOne({ id, changes: { points } }, state),
    ),
    on(PolygonsActions.polygonRemoved, (state, { id }) => polygonsAdapter.removeOne(id, state)),
    on(PolygonsActions.imagePolygonsCleared, (state, { imageId }) =>
      polygonsAdapter.removeMany((polygon) => polygon.imageId === imageId, state),
    ),
  ),
  extraSelectors: ({ selectPolygonsState }) => {
    const selectAllPolygons = createSelector(
      selectPolygonsState,
      polygonsAdapter.getSelectors().selectAll,
    );
    const selectPolygonsByImage = createSelector(selectAllPolygons, (polygons) => {
      const byImage: Record<string, Polygon[]> = {};
      for (const polygon of polygons) {
        (byImage[polygon.imageId] ??= []).push(polygon);
      }
      return byImage;
    });
    return { selectAllPolygons, selectPolygonsByImage };
  },
});

export const selectPolygonsForImage = (imageId: string) =>
  createSelector(
    polygonsFeature.selectPolygonsByImage,
    (byImage): readonly Polygon[] => byImage[imageId] ?? EMPTY_POLYGONS,
  );
