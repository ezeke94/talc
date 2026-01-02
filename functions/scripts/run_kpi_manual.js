// Manual runner for KPI reminders
// Usage:
//  - Dry preview: DUMMY=1 node scripts/run_kpi_manual.js
//  - Forced send (DANGEROUS): DANGEROUS_RUN=1 FORCE=1 node scripts/run_kpi_manual.js

const kpi = require('../kpiNotifications');

(async () => {
  try {
    const force = !!process.env.FORCE;
    const dangerous = !!process.env.DANGEROUS_RUN;
    const dry = !dangerous; // by default, run as dry-run unless DANGEROUS_RUN is set

    if (force && !dangerous) {
      console.warn('FORCE=true without DANGEROUS_RUN=1 will run a dry-run only. Set DANGEROUS_RUN=1 to actually perform sends.');
    }

    console.log(`Running KPI reminders (dry=${dry}, force=${force})`);
    const res = await kpi.runWeeklyKPIReminders(dry, { force });
    console.log('Result:', JSON.stringify(res, null, 2));

    if (!dry && dangerous) {
      console.log('Manual send completed. Check _admin/kpiRunLogs for audit details and _notificationLog for dedupe entries.');
    }
  } catch (e) {
    console.error('Error running KPI manual runner:', e);
    process.exitCode = 1;
  }
})();