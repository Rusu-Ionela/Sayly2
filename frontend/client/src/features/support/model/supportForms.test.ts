import { FAQ_CATEGORIES } from "./faqContent";
import {
  MESSAGE_MAX,
  SUBJECT_MAX,
  SUPPORT_FORMS,
  SUPPORT_TOPIC_OPTIONS,
  normalizeSupportForm,
  validateSupportForm,
} from "./supportForms";

describe("support form rules", () => {
  it("normalises text like the server", () => {
    expect(
      normalizeSupportForm({
        subject: "  Chat    freezes ",
        message: "Line one   \r\n\r\n\r\n\r\n  Line two  ",
      }),
    ).toEqual({ subject: "Chat freezes", message: "Line one\n\nLine two" });
  });

  it("checks lengths after normalising", () => {
    expect(validateSupportForm({ subject: "  a  ", message: "short" })).toEqual({
      subject: expect.stringMatching(/at least/),
      message: expect.stringMatching(/at least/),
    });
    expect(
      validateSupportForm({
        subject: "x".repeat(SUBJECT_MAX + 1),
        message: "y".repeat(MESSAGE_MAX + 1),
      }),
    ).toEqual({
      subject: expect.stringMatching(/under/),
      message: expect.stringMatching(/under/),
    });
    expect(
      validateSupportForm({ subject: "Dark mode", message: "Please add a dark chat theme." }),
    ).toEqual({});
  });

  it("maps every form to a backend ticket kind", () => {
    expect(SUPPORT_FORMS.contact.ticketKind).toBe("CONTACT");
    expect(SUPPORT_FORMS.feature.ticketKind).toBe("FEATURE_REQUEST");
    expect(SUPPORT_FORMS.bug.ticketKind).toBe("BUG_REPORT");
    // Contact messages always carry app details; bug reports let the member choose.
    expect(SUPPORT_FORMS.contact.device).toBe("always");
    expect(SUPPORT_FORMS.bug.device).toBe("optional");
  });

  it("offers every FAQ category as a contact topic", () => {
    const topics = SUPPORT_TOPIC_OPTIONS.map((option) => option.id);
    for (const category of FAQ_CATEGORIES) {
      expect(topics).toContain(category.id);
      expect(category.entries.length).toBeGreaterThan(0);
    }
  });
});
