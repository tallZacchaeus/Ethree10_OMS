/**
 * Shown while a signed-in page streams in.
 *
 * Without a loading boundary the previous page stays frozen on screen until the
 * next one is fully ready, which reads as an unresponsive click rather than a
 * slow one. A skeleton is not decoration here — it is the difference between
 * "working" and "broken" to the person waiting.
 */
export default function AppLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
    </div>
  );
}
