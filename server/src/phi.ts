/**
 * PHI brnded types.
 *
 * These are compile-time only. They help make it explicit which strings are PHI-bearing
 * (ex: transcripts) vs de-identified. They DO NOT provide runtime protection.
 *
 * Runtime PHI protection lives in `server/src/ai/*` (de-identification + PHI guards).
 */

declare const __phiBrand: unique symbol
declare const __deidentifiedBrand: unique symbol

export type PhiText = string & { readonly [__phiBrand]: true }
export type DeidentifiedText = string & { readonly [__deidentifiedBrand]: true }

export function asPhiText(value: string): PhiText {
  return value as PhiText
}

export function asDeidentifiedText(value: string): DeidentifiedText {
  return value as DeidentifiedText
}
