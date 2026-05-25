import { json, handleError, requireDatabase } from "../../../_utils/http.js";
export async function onRequestGet({ data, env }) {
  try {
    const db = requireDatabase(env); const sessionId = data.adminSession?.id;
    const [session, attempts, activity, locks] = await Promise.all([
      db.prepare("SELECT created_at, last_seen_at, expires_at FROM admin_sessions WHERE id = ? LIMIT 1").bind(sessionId).first(),
      db.prepare("SELECT success, attempted_at, failure_reason FROM admin_login_attempts ORDER BY attempted_at DESC, id DESC LIMIT 10").all(),
      db.prepare("SELECT action, resource_type, resource_id, metadata_json, created_at FROM admin_audit_logs ORDER BY created_at DESC, id DESC LIMIT 20").all(),
      db.prepare("SELECT lock_key, locked_until FROM admin_login_locks WHERE datetime(locked_until) > CURRENT_TIMESTAMP ORDER BY locked_until DESC").all(),
    ]);
    return json({ session, attempts: attempts.results || [], activity: activity.results || [], activeLocks: (locks.results || []).map(({ locked_until }) => ({ locked_until })) });
  } catch (error) { return handleError(error); }
}
