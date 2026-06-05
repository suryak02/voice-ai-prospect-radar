// Bounding box covering the UK (incl. Northern Ireland). Used both as the Google
// Places `locationRestriction` and as a hard guard when mapping/reading results,
// so an ambiguous query (e.g. "Manchester" → Manchester, USA) can never surface.
export const UK_BOUNDS = {
  minLat: 49.8,
  maxLat: 60.9,
  minLng: -8.65,
  maxLng: 1.77,
};

export function isInUk(latitude: number, longitude: number): boolean {
  return (
    latitude >= UK_BOUNDS.minLat &&
    latitude <= UK_BOUNDS.maxLat &&
    longitude >= UK_BOUNDS.minLng &&
    longitude <= UK_BOUNDS.maxLng
  );
}
