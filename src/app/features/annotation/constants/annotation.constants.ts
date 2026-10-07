/** A polygon needs at least three vertices: a triangle is the smallest closed outline. */
export const MIN_POLYGON_VERTICES = 3;

export const ROTATE_HANDLE_RADIUS_PX = 9;

/**
 * Gap between a selected shape's bounding box and its dashed selection outline, in CSS pixels. The
 * rotate handle's stem hangs from that outline, so the renderer and the editor share the value.
 */
export const SELECTION_BOX_PADDING_PX = 6;
