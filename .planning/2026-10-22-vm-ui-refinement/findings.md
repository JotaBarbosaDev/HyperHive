# Findings

The current VM page uses nested host/card borders, six large summary tiles and unlabeled icon controls. Existing VM tests already expect local filters and failed/stale inventory states absent from the current screen. Keep vmsBySlave unfiltered because migration destinations also consume it; filter only display entries. Canonical guidance: knowledge/projects/HyperHive/frontend/ui-rework-guidelines. User explicitly requests preserving the idea and no questions.
