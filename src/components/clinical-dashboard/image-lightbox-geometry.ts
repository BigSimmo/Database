/**
 * Pure viewer geometry for the image lightbox.
 *
 * No React, no DOM: jsdom performs no layout, so every number the lightbox
 * depends on would be untestable if it lived in the component. Keeping the maths
 * here means the rotation compensation, the opening scale, the pan bounds and
 * the double-tap anchor are all proven in the node test project, and the
 * component is left holding only measurement and state.
 *
 * All four behaviours derive from the same four measurements, which is what
 * makes this one fix rather than four patches.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;

/**
 * Scale 1 means "the whole image, contained in the stage, in its current
 * orientation". For a wide clinical table that is a heavy downscale — a 1800px
 * table across a 393px phone renders ~65px tall, which is unreadable — so the
 * viewer opens closer to the source's own pixels rather than at the thumbnail
 * the card was already showing.
 */
export const LEGIBLE_OPEN_MAX = 3;

/**
 * Only open zoomed when the contained fit leaves the stage mostly empty, i.e.
 * the crop's shape is badly mismatched to the screen. A near-square diagram
 * fills enough of the stage that its overall shape is worth seeing first, and
 * dropping the reader into its top-left corner would lose that. Roughly: crops
 * wider than ~2:1 on a tall phone intervene, 3:2 and squarer do not.
 */
export const LEGIBILITY_FLOOR = 0.35;

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export type LightboxGeometry = {
  /** Stage (the scrollport the image is centred in), in CSS pixels. */
  stage: Size;
  /** Intrinsic source pixels. */
  natural: Size;
};

export const clampScale = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)) : MIN_SCALE;

const usable = (geometry: LightboxGeometry | null): geometry is LightboxGeometry =>
  Boolean(
    geometry &&
    [geometry.stage.width, geometry.stage.height, geometry.natural.width, geometry.natural.height].every(
      (value) => Number.isFinite(value) && value > 0,
    ),
  );

/** 90 and 270 degrees swap the on-screen axes; 0 and 180 do not. */
export const isQuarterTurn = (rotation: number) => Math.abs(Math.round(rotation)) % 180 === 90;

/**
 * The `<img>` layout box at scale 1 — the `object-contain` fit, unrotated.
 * This is what `offsetWidth`/`offsetHeight` report, because those ignore
 * transforms.
 */
function containedSize(geometry: LightboxGeometry): Size & { fit: number } {
  const fit = Math.min(geometry.stage.width / geometry.natural.width, geometry.stage.height / geometry.natural.height);
  return { width: geometry.natural.width * fit, height: geometry.natural.height * fit, fit };
}

/**
 * `object-contain` sizes the image to the *unrotated* fit and `rotate()` is a
 * pure transform that does not resize that box — so a wide table rotated upright
 * overflowed the stage instead of re-fitting it. This factor re-fits the swapped
 * bounding box against the stage, which makes "scale 1 = whole image, fitted"
 * true in every orientation, and therefore makes one rule serve the readout, the
 * reset button and the pan clamp alike.
 */
export function rotationFitScale(geometry: LightboxGeometry | null, rotation: number): number {
  if (!usable(geometry) || !isQuarterTurn(rotation)) return 1;
  const { width, height } = containedSize(geometry);
  return Math.min(geometry.stage.width / height, geometry.stage.height / width);
}

/** The bounding box the reader actually sees, in stage pixels. */
export function displayedSize(geometry: LightboxGeometry | null, rotation: number, scale: number): Size {
  if (!usable(geometry)) return { width: 0, height: 0 };
  const { width, height } = containedSize(geometry);
  const applied = scale * rotationFitScale(geometry, rotation);
  return isQuarterTurn(rotation)
    ? { width: height * applied, height: width * applied }
    : { width: width * applied, height: height * applied };
}

/**
 * Pan is bounded by the overflow on each axis. Without this the image could be
 * dragged clean out of the stage and lost, with no gesture that brings it back.
 * Returns `{0,0}` whenever the content already fits, so "nothing to pan" and
 * "panned to the edge" are the same code path.
 */
export function clampTranslate(
  geometry: LightboxGeometry | null,
  rotation: number,
  scale: number,
  translate: Point,
): Point {
  if (!usable(geometry)) return { x: 0, y: 0 };
  const painted = displayedSize(geometry, rotation, scale);
  const maxX = Math.max(0, (painted.width - geometry.stage.width) / 2);
  const maxY = Math.max(0, (painted.height - geometry.stage.height) / 2);
  const x = Number.isFinite(translate.x) ? translate.x : 0;
  const y = Number.isFinite(translate.y) ? translate.y : 0;
  // `+ 0` normalises the signed zero that Math.max(-0, …) produces when the
  // bound is 0, so a fitted image reports {0,0} rather than {0,-0}.
  return {
    x: Math.max(-maxX, Math.min(maxX, x)) + 0,
    y: Math.max(-maxY, Math.min(maxY, y)) + 0,
  };
}

/**
 * The scale to open at: one source pixel per CSS pixel, capped, and only when
 * the contained fit leaves the stage mostly empty. Otherwise 1 — the whole
 * image — because surprising a reader with a zoomed corner is worse than a
 * small-but-complete figure.
 */
export function legibleOpenScale(geometry: LightboxGeometry | null, rotation: number): number {
  if (!usable(geometry)) return MIN_SCALE;
  const contained = containedSize(geometry);
  const rotationFit = rotationFitScale(geometry, rotation);
  const painted = displayedSize(geometry, rotation, 1);
  const occupancy = Math.min(painted.width / geometry.stage.width, painted.height / geometry.stage.height);
  if (occupancy >= LEGIBILITY_FLOOR) return MIN_SCALE;
  // At scale 1 the source is already rendered at `contained.fit * rotationFit`
  // of its own pixels, so this is what returns it to 1:1.
  return clampScale(Math.min(1 / (contained.fit * rotationFit), LEGIBLE_OPEN_MAX));
}

/**
 * Zoom while keeping the point under the reader's finger stationary — the
 * difference between "zoomed in" and "zoomed in somewhere else".
 *
 * `point` is relative to the stage's top-left. The transform is
 * `translate() scale()` about the stage centre, so a content offset `c` paints
 * at `centre + c * scale + translate`; holding that fixed across a scale change
 * gives the translate below.
 */
export function zoomAboutPoint({
  geometry,
  rotation,
  scale,
  translate,
  nextScale,
  point,
}: {
  geometry: LightboxGeometry | null;
  rotation: number;
  scale: number;
  translate: Point;
  nextScale: number;
  point: Point | null;
}): { scale: number; translate: Point } {
  const target = clampScale(nextScale);
  if (!usable(geometry) || !point || scale <= 0) {
    return { scale: target, translate: clampTranslate(geometry, rotation, target, translate) };
  }
  const fromCentreX = point.x - geometry.stage.width / 2;
  const fromCentreY = point.y - geometry.stage.height / 2;
  const ratio = target / scale;
  const next = {
    x: fromCentreX - (fromCentreX - translate.x) * ratio,
    y: fromCentreY - (fromCentreY - translate.y) * ratio,
  };
  return { scale: target, translate: clampTranslate(geometry, rotation, target, next) };
}

/**
 * Where to sit when the viewer opens zoomed: the image's top-left, so reading
 * starts at the first column and first row rather than somewhere in the middle
 * of the table.
 */
export function topLeftTranslate(geometry: LightboxGeometry | null, rotation: number, scale: number): Point {
  if (!usable(geometry)) return { x: 0, y: 0 };
  const painted = displayedSize(geometry, rotation, scale);
  return clampTranslate(geometry, rotation, scale, {
    x: Math.max(0, (painted.width - geometry.stage.width) / 2),
    y: Math.max(0, (painted.height - geometry.stage.height) / 2),
  });
}
