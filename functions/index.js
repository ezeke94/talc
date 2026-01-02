/**
 * TALC Management Application - Firebase Cloud Functions
 * Budget-conscious notification system for improved user experience
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, limit concurrent containers
setGlobalOptions({ maxInstances: 10 });

// Import notification modules
const eventNotifications = require('./eventNotifications');
const kpiNotifications = require('./kpiNotifications');
const eventChangeNotifications = require('./eventChangeNotifications');
const operationalNotifications = require('./operationalNotifications');
const { sendTestNotification } = require('./sendTestNotification');
const adminRunners = require('./adminRunners');

// Export all notification functions
exports.sendOwnerEventReminders = eventNotifications.sendOwnerEventReminders;
exports.sendNotificationsOnEventCreate = eventNotifications.sendNotificationsOnEventCreate;
exports.sendWeeklyKPIReminders = kpiNotifications.sendWeeklyKPIReminders;
exports.notifyEventReschedule = eventChangeNotifications.notifyEventReschedule;
exports.notifyEventUpdate = eventChangeNotifications.notifyEventUpdate;
exports.notifyEventCancellation = eventChangeNotifications.notifyEventCancellation;
exports.notifyEventCompletion = eventChangeNotifications.notifyEventCompletion;
exports.notifyEventDelete = eventChangeNotifications.notifyEventDelete;
exports.sendTestNotification = sendTestNotification;
// Admin-invokable runner (for UI-triggered smoke tests)
// REMOVED: runOwnerEventReminders was removed as part of cleanup
// Admin callables
exports.previewWeeklyKPIReminders = adminRunners.previewWeeklyKPIReminders;
exports.runWeeklyKPIReminders = adminRunners.runWeeklyKPIReminders;
// HTTP CORS-enabled endpoints for cross-origin admin usage
exports.previewWeeklyKPIRemindersHttp = adminRunners.previewWeeklyKPIRemindersHttp;
exports.runWeeklyKPIRemindersHttp = adminRunners.runWeeklyKPIRemindersHttp;
// Note: migrateEventTimestamps callable was removed after migration was executed (cleanup)

// Keep the hello world function for testing
exports.helloWorld = onRequest((request, response) => {
	logger.info("TALC Functions deployed successfully!", {structuredData: true});
	response.send("TALC Management Functions are running!");
});
