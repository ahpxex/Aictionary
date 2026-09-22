# Aictionary Privacy Policy

Last updated: September 22, 2026

Aictionary is an open-source dictionary. It does not require an Aictionary
account and does not operate a service that collects your searches, vocabulary,
or API keys. The app contains no advertising or developer-operated analytics SDK.

## Data on your device

Settings, lookup history, usage statistics, downloaded dictionaries, generated
entries, and provider credentials are stored locally in the app's storage.
Offline dictionary lookups do not send the searched word to a server. Device
backups may include app data according to your operating system settings.

## Network features you use

- **Dictionary downloads:** the app contacts GitHub to find and download public
  dictionary releases and checksums. GitHub receives ordinary request metadata,
  such as your IP address. The downloaded dictionary supports subsequent offline
  searches.
- **AI explanations and comparisons:** when enabled and used, the app sends the
  requested word or text and the relevant prompt directly to the AI endpoint you
  configure, using your credentials. That provider's privacy and retention
  policies apply. AI is optional and is not needed for offline lookups.
- **Pronunciation:** when you request audio, the selected text and voice settings
  are sent to your selected speech provider. The default Edge speech service is
  operated by Microsoft. Other providers use the endpoint and credentials you
  configure. These providers may receive connection metadata and handle requests
  under their own policies.
- **Anki:** when you choose to add a card, the selected entry and card fields are
  sent to your configured AnkiConnect address. The app requests local-network
  access when needed to reach a service you configure on that network.
- **External links:** opening project, support, or provider links is subject to
  the destination's privacy policy.

Aictionary does not send provider credentials to its developer. Keep credentials
private and choose providers you trust. A configured network proxy can observe
connection metadata; a custom certificate authority you install may allow its
operator to inspect traffic.

## TestFlight

Apple distributes beta builds through TestFlight. Apple may collect testing,
crash, and diagnostic information and share it with the developer according to
Apple's TestFlight terms and privacy policy. Feedback you deliberately submit
through TestFlight may include your message, screenshots, and contact details.
Please avoid including secrets or sensitive content in feedback.

## Control and contact

You can clear lookup history and change provider settings in the app. Removing
the app and its data removes the locally stored information, subject to device
backups. Requests sent to third-party providers are governed by those providers;
removing local app data does not delete their records.

For privacy questions, contact **AHpx@yandex.com**. General issues can also be
reported at [GitHub](https://github.com/ahpxex/Aictionary/issues), but those reports
are public. Changes to this policy will be published in this repository.
