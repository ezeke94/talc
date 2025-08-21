// Audit/notification helpers: notification features removed.
// Provide no-op functions so code referencing them won't break.
export async function sendNotification(/* payload */) {
  // no-op
  return null;
}

export async function logAudit(/* auditPayload */) {
  // no-op
  return null;
}
