import { ModeNotice } from "@/components/mode-kit/notice";

/**
 * Shown while the real-staff team release is held and the server answers with
 * the invented sample team, so a sample is never mistaken for a real roster.
 */
export function RosterSampleNotice({ sample }: { readonly sample: boolean | undefined }) {
  if (!sample) return null;
  return (
    <ModeNotice testId="roster-sample-notice">
      Sample team. Every name and shift here is made up so you can see the layout. Team rosters aren&apos;t switched on
      for real staff yet, so changes won&apos;t be saved.
    </ModeNotice>
  );
}
