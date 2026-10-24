/** In-app copies of the legal and company pages, keyed by route name. */

const PRIVACY_BODY = `Sayly helps you practice languages with real people.

What we collect
• Account details you provide (email, display name, password hash)
• Profile information you choose to share (languages, country, age band, photo, bio)
• Messages and media you send to language partners
• Basic device and security signals needed to keep accounts safe

How we use it
• To run language-exchange features (discovery, connections, chat, learning tools)
• To protect the community (blocks, reports, abuse prevention)
• To improve reliability and fix bugs

What we do not do
• We do not sell your personal data
• We do not use romantic or dating-style ranking of partners

Your choices
• You can edit or clear profile fields, hide from Discover, block users, and sign out
• Contact support@sayly.app if you need help with your account

This in-app summary is provided so Privacy Policy links always work while the full public site is prepared.`;

const TERMS_BODY = `Welcome to Sayly — a language learning and practice product, not a dating app.

By creating an account you agree to:
• Use Sayly to practice languages respectfully with other learners
• Be at least 18 years old
• Not harass, spam, or share illegal or harmful content
• Not attempt to bypass safety, security, or rate limits

Accounts
• You are responsible for keeping your login details secure
• We may suspend accounts that violate these terms or put others at risk

Content
• You keep rights to content you create
• You grant Sayly permission to store and deliver that content so partners can see it in chat and profiles

Service
• Features may change as we improve the product
• Realtime chat and media depend on your network and device permissions

Contact
• Questions: support@sayly.app

This in-app summary is provided so Terms of Service links always work while the full public site is prepared.`;

const IMPRINT_BODY = `Sayly — language exchange app

Contact
• Email: support@sayly.app
• Web: https://sayly.app

Responsible for content
• The Sayly team, reachable at the address above

Online dispute resolution
• We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration board.

Questions about this imprint: support@sayly.app`;

const ABOUT_BODY = `Sayly connects people who want to learn each other's languages.

Our mission
• Make real conversation the easiest way to learn a language
• Keep the community friendly, safe and focused on learning — never dating

How it works
• Tell us what you speak and what you are learning
• Find partners in the Community, follow them and start chatting
• Correct each other, save useful expressions and grow your Collection

Get in touch
• Feedback and ideas: support@sayly.app
• Careers: see Jobs in Settings`;

export const LEGAL_DOCUMENTS = {
  PrivacyPolicy: { title: "Privacy Policy", body: PRIVACY_BODY },
  TermsOfService: { title: "Terms of Service", body: TERMS_BODY },
  Imprint: { title: "Imprint", body: IMPRINT_BODY },
  AboutUs: { title: "About Sayly", body: ABOUT_BODY },
} as const;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;
