/**
 * Shared AV playback claim/release — only one chat media clip should play.
 */
import { claimMediaPlayback, releaseMediaPlayback } from "./mediaPlayback";

describe("mediaPlayback", () => {
  it("stops the previous owner when a new clip claims playback", () => {
    const firstStop = jest.fn();
    const secondStop = jest.fn();

    claimMediaPlayback("a", firstStop);
    claimMediaPlayback("b", secondStop);

    expect(firstStop).toHaveBeenCalledTimes(1);
    expect(secondStop).not.toHaveBeenCalled();

    releaseMediaPlayback("b");
    claimMediaPlayback("a", firstStop);
    expect(secondStop).not.toHaveBeenCalled();
  });
});
