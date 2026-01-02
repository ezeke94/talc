Functions helper scripts

- `npm run smoke:kpi-preview` — runs a dry-run preview of KPI reminders (safe, read-only).
- `npm run smoke:kpi-manual` — runs manual runner; by default runs a dry-run. Set `FORCE=1 DANGEROUS_RUN=1` to perform a forced send (dangerous: will send real notifications).

Notes:
- Use these scripts cautiously; running with `DANGEROUS_RUN=1` will perform real sends to production users.
- Prefer using the admin callable `runWeeklyKPIReminders` via the admin UI for production manual sends.
