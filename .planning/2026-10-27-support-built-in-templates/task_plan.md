# Support built-in templates

Goal: A Linux Machine dashboard with a clear operational hierarchy and readable values.

Current design: 20 widgets and 18 default streams. A four-column/three-row identity card has four compact readings in a two-by-two block beneath it. Service failures fill the remaining eight columns across all five rows. Full-width warnings/errors lead the log area, followed by the journal, kernel/service logs and activity. Four charts (CPU, RAM, network receive/transmit) and inventory follow lower down. Existing dashboards are not rewritten.

Presentation: uptime adapts to days/hours or smaller durations; byte values/rates reuse the existing binary-unit formatter. Percentages use one decimal. Raw copied values and inspected chart samples preserve source precision.

Design rationale: retain the house navy surfaces, teal accents, Inter UI and monospace logs. Spend visual emphasis on wide diagnostic messages and failure context rather than equal-sized resource tiles.

Validation: backend suite passes (36 tests). All 83 frontend Support tests and the web export pass. Desktop preview checked for hierarchy and identity text fit.

Status: complete; the final desktop preview is open with readable values and the new hierarchy. Collector installation and live deployment remain separate. SilverBullet tools remain unavailable.
