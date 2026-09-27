import { cardSurface } from "@/components/card-recipes";
import { ModeDialRow } from "@/components/mode-kit/dial-row";
import { cn } from "@/components/ui-primitives";
import { WA_CRISIS_CONTACTS } from "@/lib/crisis-contacts";
import { displayPhoneNumber } from "@/lib/admin/phone-display";
import { formatUpdatedMonth } from "@/lib/admin/renewal-dates";

/**
 * Crisis lines, first on every state of Help (spec: "Crisis lines sit at the
 * top, reusing the app's existing crisis list"). A plain white card — no tint,
 * no red border — built from the shared `ModeDialRow`, so 000 gets the kit's
 * one quiet-red emergency tone and every other number is an outlined 34px
 * call disc inside a 48px tap area. Never filtered by "Find in Help", and
 * never hidden by a failed load: this section renders before that check.
 */
export function AdminCrisisLines() {
  return (
    <section data-testid="admin-help-crisis" aria-label="Crisis lines" className={cn(cardSurface, "overflow-hidden")}>
      <ul role="list">
        {WA_CRISIS_CONTACTS.map((contact) => (
          <ModeDialRow
            key={contact.id}
            testId={`admin-help-crisis-${contact.id}`}
            label={contact.name}
            subtitle={contact.availability}
            tone={contact.isEmergencyService ? "emergency" : "default"}
            number={{
              display: displayPhoneNumber(contact.telephoneDisplay, "outside"),
              tel: `tel:${contact.telephoneUri}`,
            }}
            meta={
              <span className="grid gap-0.5">
                {contact.caveat ? (
                  <span className="text-xs text-[color:var(--text-muted)]">{contact.caveat}</span>
                ) : null}
                <span className="text-xs text-[color:var(--text-muted)]">
                  Updated {formatUpdatedMonth(contact.verifiedOn)}
                </span>
              </span>
            }
          />
        ))}
      </ul>
    </section>
  );
}
