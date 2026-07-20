// Reference subscribers wiring (Sprint 8). NOT auto-invoked: registering these is an
// owner-gated integration step (behind EVENT_BUS_ENABLED), so the bus ships with a
// demonstrated but DORMANT consumer set. Real consumer rewiring (Mission Control,
// Arena, Kai, Notifications, Operator Network) is deferred + coordinated with the
// packages that own those files.
import { subscribe } from "../registry";
import { systemEventAuditEcho } from "./systemEventAuditEcho";
import { notificationCreatedHandler } from "./notificationCreated";

export function registerReferenceSubscribers(): void {
  subscribe("system-audit-echo", "SYSTEM_EVENT", systemEventAuditEcho);
  subscribe("notification-created", "NOTIFICATION_CREATED", notificationCreatedHandler);
}

export { systemEventAuditEcho } from "./systemEventAuditEcho";
export { notificationCreatedHandler, makeNotificationCreatedHandler } from "./notificationCreated";
