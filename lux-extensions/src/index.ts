/**
 * LUX EXTENSIONS — Combined entry point
 * 
 * All 6 buildable breakthroughs in one OMP extension.
 * 
 * Install: omp plugin install lux-extensions
 * Or: add to your OMP config:
 *   extensions:
 *     - lux-extensions
 * 
 * Each breakthrough is independently enabled/disabled:
 *   lux:
 *     adversarial: true
 *     speculative: true
 *     autonomy: true
 *     health: true
 *     propertyTests: true
 *     universalEmbeddings: true
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import luxAdversarial from "./adversarial";
import luxSpeculative from "./speculative";
import luxAutonomy from "./autonomy";
import luxHealth from "./health";
import luxPropertyTests from "./property-tests";
import luxUniversalEmbeddings from "./universal-embeddings";

export default function lux(pi: ExtensionAPI) {
  // Register all LUX extensions
  luxAdversarial(pi);
  luxSpeculative(pi);
  luxAutonomy(pi);
  luxHealth(pi);
  luxPropertyTests(pi);
  luxUniversalEmbeddings(pi);
  
  pi.setLabel("LUX — 1000× Autonomous Engineering");
}
