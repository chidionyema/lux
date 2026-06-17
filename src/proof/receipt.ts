/**
 * LUX Decision Receipt — re-exports from @lux/popdd
 *
 * POPDD (Proof of Proof-Driven Development) is a standalone package
 * (`@lux/popdd`) that LUX depends on. This file exists as a
 * compatibility shim — all LUX code should import from the package
 * directly going forward, but this re-export keeps existing imports
 * working.
 *
 * @see https://github.com/chidionyema/popdd-ts for the standalone package
 */

export {
  HmacSigner,
  ReceiptChain,
  type Signer,
  type DecisionReceipt,
  type ProofPayload,
  type ChainVerification,
} from "@lux/popdd";
