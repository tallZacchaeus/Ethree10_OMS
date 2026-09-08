/**
 * The caller's IP, for rate limiting public endpoints.
 *
 * `enforcePublicRateLimit` keys on whatever secret it is given. For a tracking
 * token that is right: the limit should follow the link. For guessing an
 * invoice code it is useless — every guess is a different code, so every guess
 * opens its own fresh window and the limiter never fires. Enumeration has to be
 * limited per caller instead.
 *
 * `x-forwarded-for` is a client-supplied header and an attacker will happily
 * send their own. It is only trustworthy to the extent that a proxy we control
 * appends to it, and nginx appends the real peer as the LAST entry. So we take
 * the last hop, not the first: the first is whatever the client claimed.
 *
 * A caller who can still spoof this can only spread their guessing across more
 * keys — the same position we were in before rate limiting existed — so the
 * check never makes things worse, and against an ordinary attacker it works.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }

  // Set by some proxies and by Cloudflare; single-valued, so no hop parsing.
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  // No usable header. One shared bucket is deliberate: it is more restrictive
  // than none, and the alternative — skipping the limit — is what we are here
  // to prevent.
  return "unknown";
}
