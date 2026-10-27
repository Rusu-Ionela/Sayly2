import { replyDraft } from "./model";

describe("reply draft", () => {
  it("quotes the question and the answer", () => {
    expect(replyDraft("Coffee or tea?", "Tea, always")).toBe(
      'Hi! I saw your answer to "Coffee or tea?": "Tea, always" ',
    );
  });

  it("shortens long answers", () => {
    const draft = replyDraft("Q?", "x".repeat(200));
    expect(draft).toContain(`"${"x".repeat(77)}…"`);
  });
});
