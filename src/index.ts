/**
 * LUX Engine — Public API
 * 
 * Exports:
 *   - Semantic graph engine (TypeScript codebase parser)
 *   - Proof system (formal specification + verification)
 *   - Type-level proofs (Curry-Howard in TypeScript)
 */

// Core engine
export {
  TypeScriptParser,
  SemanticGraphBuilder,
  PatchApplier,
  type SemanticGraph,
  type SemanticNode,
  type SemanticEdge,
  type SemanticPatch,
  type PatchResult,
  type NodeId,
  type NodeKind,
} from "./core/semantic-graph";

// Proof system
export {
  SpecVerifier,
  VerifiedFunction,
  VerificationError,
  generatePropertyTestCode,
  type FunctionSpec,
  type Precondition,
  type Postcondition,
  type Invariant,
  type EdgeCase,
  type RoundtripProperty,
  type VerificationResult,
  type ClauseResult,
  type Verdict,
} from "./proof/spec";

// Decision Receipts (POPDD — Proof of Proof)
export {
  HmacSigner,
  ReceiptChain,
  type Signer,
  type DecisionReceipt,
  type ProofPayload,
  type ChainVerification,
} from "./proof/receipt";

// Spec Linter (catches "throws on baseline input" trap)
export {
  lintSpec,
  printLintIssues,
  type LintIssue,
  type LintSeverity,
} from "./proof/spec-linter";
