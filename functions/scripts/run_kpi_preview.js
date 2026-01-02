// Run a local dry-run preview of KPI reminders
// Usage: cd functions && node scripts/run_kpi_preview.js

const kpi = require('../kpiNotifications');

(async () => {
  try {
    console.log('Running KPI reminders dry-run preview...');
    const res = await kpi.runWeeklyKPIReminders(true);
    console.log('Preview result:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error running KPI preview:', e);
    process.exitCode = 1;
  }
})();