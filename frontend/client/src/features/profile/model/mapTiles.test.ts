import { TILE_SIZE, tileLayout } from "./mapTiles";

describe("tileLayout", () => {
  it("centres the point: world centre at zoom 1 touches all four tiles", () => {
    const tiles = tileLayout({ latitude: 0, longitude: 0, zoom: 1, width: 256, height: 256 });
    expect(tiles.map((t) => t.url).sort()).toEqual([
      "https://tile.openstreetmap.org/1/0/0.png",
      "https://tile.openstreetmap.org/1/0/1.png",
      "https://tile.openstreetmap.org/1/1/0.png",
      "https://tile.openstreetmap.org/1/1/1.png",
    ]);
    const first = tiles.find((t) => t.key === "1/0/0");
    expect(first).toMatchObject({ left: -128, top: -128 });
  });

  it("covers the whole box with no gaps", () => {
    const width = 390;
    const height = 160;
    const tiles = tileLayout({ latitude: 55.76, longitude: 37.62, zoom: 10, width, height });
    expect(tiles.length).toBeGreaterThan(0);
    const minLeft = Math.min(...tiles.map((t) => t.left));
    const maxRight = Math.max(...tiles.map((t) => t.left + TILE_SIZE));
    const minTop = Math.min(...tiles.map((t) => t.top));
    const maxBottom = Math.max(...tiles.map((t) => t.top + TILE_SIZE));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(width);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxBottom).toBeGreaterThanOrEqual(height);
  });

  it("wraps tiles across the antimeridian", () => {
    const tiles = tileLayout({ latitude: 0, longitude: 179.9, zoom: 2, width: 400, height: 100 });
    const columns = new Set(tiles.map((t) => Number(t.url.split("/").at(-2))));
    expect(columns.has(3)).toBe(true);
    expect(columns.has(0)).toBe(true);
    expect(Math.max(...columns)).toBeLessThan(4);
  });

  it("skips tiles beyond the poles", () => {
    const tiles = tileLayout({ latitude: 84, longitude: 0, zoom: 2, width: 300, height: 600 });
    expect(tiles.every((t) => Number(t.url.split("/").at(-1)?.replace(".png", "")) >= 0)).toBe(
      true,
    );
  });

  it("puts a known city in the right tile (Moscow at zoom 10 is tile 619/320)", () => {
    const tiles = tileLayout({
      latitude: 55.7558,
      longitude: 37.6173,
      zoom: 10,
      width: 10,
      height: 10,
    });
    expect(tiles.map((t) => t.url)).toContain("https://tile.openstreetmap.org/10/619/320.png");
  });
});
