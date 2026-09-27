"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { RosterInviteSheet } from "@/components/roster/invite/roster-invite-sheet";
import { postRosterAction, useRosterRead } from "@/components/roster/use-roster-team";
import { ROSTER_GRADES, type RosterPerson, type RosterTeam } from "@/lib/roster/team/model";

function PersonEditor({ person, team, refresh }: { person: RosterPerson; team: RosterTeam; refresh: () => void }) {
  const [name, setName] = useState(person.rosterName ?? "");
  const [grade, setGrade] = useState(person.grade ?? "");
  const [rotation, setRotation] = useState(person.rotationEndsOn ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function save(remove = false) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await postRosterAction(
      team.serviceId,
      remove
        ? { action: "member.remove", userId: person.userId }
        : {
            action: "role.set",
            userId: person.userId,
            ...(name !== (person.rosterName ?? "") ? { rosterName: name.trim() || null } : {}),
            ...(grade !== (person.grade ?? "") ? { grade: (grade || null) as RosterPerson["grade"] } : {}),
            ...(rotation !== (person.rotationEndsOn ?? "") ? { rotationEndsOn: rotation || null } : {}),
          },
    );
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setConfirm(false);
    setMessage(remove ? "Removed" : "Saved");
    refresh();
  }
  return (
    <div className="grid gap-3 p-3">
      <h3 className="font-normal">
        {person.displayName ?? "Name not available"}
        {person.role === "manager" ? " · Roster manager" : ""}
      </h3>
      <label className="grid gap-1 text-sm">
        Grade
        <select
          className="min-h-12 rounded border bg-background p-2"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
        >
          <option value="">Grade not set</option>
          {ROSTER_GRADES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Name in roster file"
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label="Rotation ends"
        type="date"
        value={rotation}
        onChange={(event) => setRotation(event.target.value)}
      />
      {message ? <p role="status">{message}</p> : null}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void save()}>
          Save person
        </Button>
        {person.serviceRole === "member" ? (
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Remove
          </Button>
        ) : (
          <span>Remove in On call</span>
        )}
      </div>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        mobilePlacement="bottom"
        title={`Remove ${person.displayName ?? "this person"} from ${team.name}?`}
      >
        <p>They leave this team in On call, Teaching and Roster, and their open requests are cancelled.</p>
        {message ? <p role="alert">{message}</p> : null}
        <Button disabled={busy} onClick={() => void save(true)}>
          Remove from team
        </Button>
      </Sheet>
    </div>
  );
}
export function RosterPeopleList({ team }: { team: RosterTeam }) {
  const people = useRosterRead(team.serviceId, "people");
  const [invite, setInvite] = useState(false);
  return (
    <>
      <section className="grid gap-2">
        <h2>People</h2>
        <ul className="divide-y rounded-xl border">
          {people.data?.people.map((person) => (
            <li key={person.userId}>
              <PersonEditor person={person} team={team} refresh={people.reload} />
            </li>
          ))}
        </ul>
      </section>
      {people.message ? <p role="alert">{people.message}</p> : null}
      <Button onClick={() => setInvite(true)}>Invite by email</Button>
      {invite ? (
        <RosterInviteSheet serviceId={team.serviceId} teamName={team.name} onClose={() => setInvite(false)} />
      ) : null}
    </>
  );
}
