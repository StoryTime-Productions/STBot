const TIMEZONE = "America/Toronto";
/** The summary job fires at 00:00; the poll steps aside for the first few minutes in case that job runs late. */
const SUMMARY_WINDOW_MINUTES = 5;

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/**
 * True during the weekly summary's own minute (Monday 00:00 Eastern). The poll skips that tick so it
 * cannot announce the same songs the summary is listing, whichever of the two jobs runs first; its
 * state is untouched, so the next poll (00:30) picks up anything it skipped.
 */
export function isWeeklySummaryTick(now: Date): boolean {
  const parts = Object.fromEntries(clock.formatToParts(now).map((part) => [part.type, part.value]));
  return (
    parts["weekday"] === "Mon" &&
    Number(parts["hour"]) === 0 &&
    Number(parts["minute"]) < SUMMARY_WINDOW_MINUTES
  );
}
