import { API_BASE_URL } from "./apiClient";
import { remoteImageSource } from "./mediaUrl";

describe("remoteImageSource", () => {
  it("caches uploaded media by its stable path, whatever the signature", () => {
    const first = remoteImageSource("/media/files/abc123.jpg?exp=100&sig=aa");
    const resigned = remoteImageSource("/media/files/abc123.jpg?exp=200&sig=bb");

    expect(first?.uri).toBe(`${API_BASE_URL}/media/files/abc123.jpg?exp=100&sig=aa`);
    expect(first?.cacheKey).toBe("/media/files/abc123.jpg");
    expect(resigned?.cacheKey).toBe(first?.cacheKey);
  });

  it("leaves other images to the default cache key", () => {
    expect(remoteImageSource("https://example.com/photo.png")).toEqual({
      uri: "https://example.com/photo.png",
    });
    expect(remoteImageSource("file:///tmp/pick.jpg")).toEqual({ uri: "file:///tmp/pick.jpg" });
  });

  it("returns nothing without a uri", () => {
    expect(remoteImageSource(null)).toBeUndefined();
    expect(remoteImageSource("")).toBeUndefined();
  });
});
