import { randomInt } from "crypto";

/**
 * Unguessable codes for things a code alone is enough to open.
 *
 * An invoice code is the whole of the authorisation for /invoice/<code> and
 * /api/invoices/<code>/pay; a receipt code is the whole of it for
 * /receipt/<code>. There is no session behind either — the client is sent a
 * link and follows it. That makes the code a bearer token, and it has to be
 * treated as one.
 *
 * Every one of them used to come from `Math.random().toString(36)`. Two
 * separate problems:
 *
 *   1. Math.random is not a CSPRNG. V8 uses xorshift128+, whose entire internal
 *      state can be recovered from a handful of outputs. A client who legitimately
 *      holds one invoice — the normal case, they were sent theirs — is in a
 *      position to recover the generator state and derive the codes of invoices
 *      belonging to other clients, including the pay links.
 *
 *   2. `.toString(36).substring(2, 10)` is not reliably eight characters.
 *      Base-36 rendering of a float drops trailing zeros, so the slice is *up
 *      to* eight. Measured over two million draws: 7 characters about once in
 *      118,000, never shorter. That is the minor half of the defect — a 36x
 *      smaller space for one code in a hundred thousand — but it is the half
 *      that shows the length was never actually chosen, only inherited from
 *      how a float happens to print.
 *
 * These use crypto.randomInt, which draws from the OS CSPRNG and rejection-samples
 * so every symbol is uniform, and they are fixed length by construction.
 */

/**
 * Crockford base32: the decimal digits and the uppercase letters, minus I, L,
 * O and U. I/L/1 and O/0 are the pairs people confuse when reading a code off a
 * printed invoice, and U is dropped so that the alphabet cannot spell the
 * obvious. 32 symbols is exactly 5 bits each, so the entropy is countable:
 * `length * 5` bits, no rounding.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * `length` symbols from the CSPRNG. At the default 12 that is 60 bits — far
 * past the point where guessing beats every other way in, and short enough to
 * read down a phone line.
 */
export function secureCode(length = 12): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`secureCode length must be a positive integer, got ${length}`);
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * A zero-padded decimal code, for the one place a human has to retype digits
 * into a phone: the WhatsApp OTP.
 *
 * Drawing the whole number in one call and padding keeps it uniform — picking
 * digits one at a time would be uniform too, but this makes the range explicit.
 * Padding matters: without it a draw of 42 becomes a two-digit code, which is
 * both a smaller search space and a visibly odd thing to receive.
 *
 * Six digits is only a million possibilities, which is why the caller must also
 * expire the code and cap the attempts. The randomness alone does not carry it.
 */
export function secureNumericCode(digits = 6): string {
  if (!Number.isInteger(digits) || digits < 1 || digits > 15) {
    throw new RangeError(`secureNumericCode digits must be 1-15, got ${digits}`);
  }
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}
