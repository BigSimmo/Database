import { describe, expect, it } from "vitest";

import { actorId } from "@/lib/caring-contacts/ids";
import {
  ALERT_CLASSES,
  alertBodyFor,
  defaultNotificationPreferences,
  setAlertOptIn,
} from "@/lib/caring-contacts/notification-preferences";

describe("notification preferences", () => {
  it("opts a new user in to nothing", () => {
    expect(defaultNotificationPreferences(actorId("A")).optedIn).toEqual([]);
  });

  it("adds and removes a single alert class without touching the others", () => {
    let preferences = defaultNotificationPreferences(actorId("A"));
    preferences = setAlertOptIn(preferences, "serviceSafetyStop", true);
    preferences = setAlertOptIn(preferences, "exceptionBacklog", true);
    preferences = setAlertOptIn(preferences, "serviceSafetyStop", false);
    expect(preferences.optedIn).toEqual(["exceptionBacklog"]);
  });

  it("writes an alert body carrying no identifier of any kind", () => {
    for (const alertClass of ALERT_CLASSES) {
      const body = alertBodyFor(alertClass, 3);
      expect(body).toContain("3");
      expect(body).not.toMatch(/SYN-|\+61|Rowan|Mira/);
    }
  });
});
