# Findings

- User requests high operational density explicitly, satisfying page-specific density preference.
- app/support.tsx currently adds 260px permanent sidebar and a large metadata block above telemetry.
- Support dialogs already provide the house modal with close/footer and scrolling.
- Existing uncommitted Support replication work touches screen, dialogs, client and tests; retain it.
- UI/UX Pro Max local ux search returned Active State and Keyboard Navigation guidance; React Native stack confirms responsive dimensions/flexbox. Image result is irrelevant and omitted.
- Palette: ink #E8EBF0, muted #8A94A8, background #0B1422, surface #101B2B, action #147D78, active text #6ED5C4; existing light semantic tokens. Inter headings/body, monospace technical details.
- Signature: workspace tabs visually connected to a full-width telemetry canvas. Avoid added decorative metrics/hero.
- Knowledge retrieval exceeded initial three-section budget to resolve page-specific UI requirements; further scope is only the canonical Support widget page for maintenance.
