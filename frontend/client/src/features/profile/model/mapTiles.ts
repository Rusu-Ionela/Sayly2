export const TILE_SIZE = 256;

export type MapTile = { key: string; url: string; left: number; top: number };

/**
 * Which OpenStreetMap tiles (and where) fill a width x height box centred on a point.
 * Web-Mercator slippy-map maths; tiles outside the world vertically are skipped and
 * horizontally wrapped.
 * shortcut: plain OSM tile server (attribution required, light use only); swap the URL for a keyed provider at scale.
 */
export function tileLayout(input: {
  latitude: number;
  longitude: number;
  zoom: number;
  width: number;
  height: number;
}): MapTile[] {
  const { latitude, longitude, zoom, width, height } = input;
  const tilesPerSide = 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;
  const worldX = ((longitude + 180) / 360) * tilesPerSide * TILE_SIZE;
  const worldY = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * tilesPerSide * TILE_SIZE;
  const originX = worldX - width / 2;
  const originY = worldY - height / 2;

  const tiles: MapTile[] = [];
  for (
    let ty = Math.floor(originY / TILE_SIZE);
    ty <= Math.floor((originY + height) / TILE_SIZE);
    ty++
  ) {
    if (ty < 0 || ty >= tilesPerSide) continue;
    for (
      let tx = Math.floor(originX / TILE_SIZE);
      tx <= Math.floor((originX + width) / TILE_SIZE);
      tx++
    ) {
      const wrappedX = ((tx % tilesPerSide) + tilesPerSide) % tilesPerSide;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}
