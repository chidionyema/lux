#!/usr/bin/env python3
"""
LUX POPDD Test Runner

Runs the LUX test suite and signs the result into a POPDD chain.
Demonstrates that POPDD works in the LUX project as a real, integrated
component — not a demo file.

Usage:
    python scripts/popdd_verify.py
"""

import subprocess
import sys
from pathlib import Path

# Add the popdd-py package to the path so we can import it.
# The script lives at lux/scripts/, so ../../popdd-py points at the sibling package.
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "popdd-py"))

from popdd_agent import PopddAgent  # noqa: E402


def main():
    ROOT = Path(__file__).parent.parent
    agent = PopddAgent.at_path(ROOT)

    # Step 1: pre-test receipt
    agent.sign_generic(
        action="test-run:start",
        target="lux:test-suite",
        **{"verdict": "STARTED", "command": "npx vitest run"},
    )

    # Step 2: run the test suite
    print("Running LUX test suite...")
    result = subprocess.run(
        ["npx", "vitest", "run", "--reporter=basic"],
        capture_output=True,
        text=True,
        timeout=120,
    )

    output = result.stdout + result.stderr
    passed = 0
    failed = 0
    for line in output.splitlines():
        if "passed" in line and "Tests" in line:
            # Try to extract numbers
            import re
            m = re.search(r"(\d+)\s+passed", line)
            if m:
                passed = int(m.group(1))
            m = re.search(r"(\d+)\s+failed", line)
            if m:
                failed = int(m.group(1))

    verdict = "PASS" if result.returncode == 0 and failed == 0 else "FAIL"

    # Step 3: post-test receipt
    agent.sign_generic(
        action="test-run:complete",
        target="lux:test-suite",
        **{
            "verdict": verdict,
            "passed": passed,
            "failed": failed,
            "exitCode": result.returncode,
        },
    )

    # Step 4: verify the chain
    verify = agent.verify_chain()

    # (auto-saved by PopddAgent)

    print(f"\n{'=' * 60}")
    print(f"  LUX POPDD Run Complete")
    print(f"{'=' * 60}")
    print(f"  Test verdict:  {verdict} ({passed} passed, {failed} failed)")
    print(f"  Chain valid:   {verify['valid']}")
    print(f"  Verifier ID:   {agent.verifier_id}")
    print(f"{'=' * 60}\n")

    sys.exit(0 if verify['valid'] and verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
