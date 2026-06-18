# LUX Voice — Senior Architect Review

**Prototype tested. StreamCoreAI running. DeepSeek LLM connected. Edge TTS active.**

---

## 1. Architecture: StreamCoreAI vs. Voxray

| Factor | StreamCoreAI | Voxray | Verdict |
|--------|-------------|--------|---------|
| **Language** | Go (performance) | Go (performance) | Equal |
| **Transport** | WebRTC (browser native) | WebSocket + WebRTC | StreamCoreAI — cleaner WebRTC |
| **Plugin system** | Python + TypeScript + JS + native Go | MCP tools only | **StreamCoreAI wins** — we can write Hermes integration in Python |
| **Skills system** | Markdown-based (like Hermes!) | None | **StreamCoreAI wins** — natural fit |
| **RAG** | Built-in (pgvector, Supabase) | None | StreamCoreAI |
| **STT providers** | Deepgram, OpenAI, VibeVoice (local) | 10+ providers | Voxray has more |
| **TTS providers** | Cartesia, Deepgram, ElevenLabs, VibeVoice | 15+ providers | Voxray has more |
| **License** | MIT | Apache 2.0 | Both fine |
| **Production readiness** | Docker, EC2 deploy | Docker, telephony | Both ready |
| **Documentation** | Clean, SDKs in 4 languages | Mintlify docs, extensive | Both good |

**Verdict: StreamCoreAI.** Plugin system lets us write Hermes integration in Python. Skills system maps naturally to Hermes skills. MIT license. Cleaner WebRTC implementation.

## 2. Hermes Integration Pattern

### Recommended: Python Plugin (StreamCoreAI native)

```
StreamCoreAI Go Server
  │
  ├── Audio pipeline (Go, real-time)
  │   VAD → STT → [plugin call] → TTS
  │
  └── Python Plugin (Hermes Bridge)
      │
      ├── Receives: transcribed user text
      ├── Calls: hermes -z "{text}" 
      │   (same Hermes agent, same memory, same specs)
      ├── Receives: Hermes response text
      │   (includes LUX verification results)
      └── Returns: text for TTS
```

**Why Python plugin:**
- StreamCoreAI natively supports Python plugins via JSON-RPC
- Hermes is Python-based — same runtime, zero IPC overhead
- Can call `hermes -z` directly (subprocess) or import Hermes as a library
- LUX verification results are injected into the response text → spoken by TTS

**Alternative (REST API):**
- Wrap Hermes in a lightweight HTTP server
- StreamCoreAI calls it as a custom LLM provider
- More overhead, but language-agnostic

## 3. Latency Budget Analysis

```
Component          Best Case    Realistic    Optimized
─────────────────────────────────────────────────────
Audio capture      20ms         50ms         20ms
VAD                10ms         30ms         10ms
STT (Deepgram)     100ms        300ms        100ms  (streaming)
LLM first token    150ms        400ms        100ms  (DeepSeek is fast)
TTS first chunk    50ms         200ms        50ms   (Edge TTS)
Audio playback     20ms         50ms         20ms
─────────────────────────────────────────────────────
TOTAL              350ms        1030ms       300ms
```

**To get under 500ms:**
1. **Streaming STT** — Deepgram returns interim results. Start LLM on partial transcript, refine when full transcript arrives.
2. **Streaming LLM** — DeepSeek returns first token in ~150ms. Start TTS immediately.
3. **Streaming TTS** — Edge TTS streams first audio chunk before full text is synthesized.
4. **Overlap** — TTS starts before LLM finishes. LLM starts before STT finishes. Three stages run simultaneously.
5. **Edge TTS is free but slow (200ms).** ElevenLabs/Cartesia are faster (50-100ms) but cost money. Worth it for production.

**Realistic with optimization: 300-500ms first-word latency.**

## 4. LUX Proof Audio Integration

### How to Speak Verification Results

```
LLM generates: "The discount calculation has been fixed."
                [LUX verification runs in background]
                
If PASS:  Append to TTS text: "All 847 specs verified. No regressions."
          Audio: Soft confirmation chime before speaking results
          
If FAIL:  Append to TTS text: "WARNING. 2 specs failed. Rate limit edge case returns null."
          Audio: Alert tone (different frequency, urgency) before speaking
```

### Implementation

```python
# In the Hermes Python plugin
def process_hermes_response(text):
    # Hermes response already includes LUX verification
    # because Hermes' soul instructs it to verify after edits
    
    if "✅" in text or "PASS" in text:
        # Verification passed — add confirmation chime
        return play_chime("confirm") + text
    elif "❌" in text or "FAIL" in text:
        # Verification failed — add alert tone
        return play_chime("alert") + text
    return text
```

Chimes are short WAV files (<500ms). StreamCoreAI can play them as audio before TTS starts.

## 5. Barge-in + Context Handling

```
User: "Fix the login" 
Agent: "I'll look at the auth module. The issue appears to be—"
User: [interrupts] "No, the TIMEOUT issue, not auth"
Agent: [stops immediately] "Got it. Checking the timeout configuration..."

What happens technically:
1. VAD detects user speech during agent TTS
2. StreamCoreAI sends barge_in event
3. TTS stops mid-stream
4. Partial LLM response is SAVED as context
5. New user text + partial response → sent to Hermes
6. Hermes understands the correction because it has the partial context
```

The partial response is NOT discarded. It's prepended to the next turn as context: "I was saying: [partial response]. User interrupted with: [new text]." This preserves conversational continuity.

## 6. Multi-Device Handoff

```
Phone (car) → Desktop (office)

1. Phone WebRTC session active
2. User arrives at desk, opens desktop client
3. Desktop sends "handoff" request with same session ID
4. Server transfers WebRTC stream to new peer
5. Hermes session is UNCHANGED (same session file, same memory)
6. Conversation continues seamlessly

Implementation: StreamCoreAI session ID = Hermes session ID.
Both clients connect to the same session. Server routes audio to active peer.
```

## 7. Privacy: Fully Local Alternative

| Component | Cloud Option | Local Option | Quality Tradeoff |
|-----------|-------------|--------------|-----------------|
| **Wake word** | None needed | Porcupine / Picovoice (on-device) | Excellent |
| **STT** | Deepgram (best) | whisper.cpp (local) | Good enough for coding commands |
| **LLM** | DeepSeek API | Ollama + local model | Slower, less capable |
| **TTS** | Edge TTS (free) | Piper TTS (local) | Robotic but functional |

**Recommendation**: Wake word + STT local (privacy). LLM + TTS can be cloud (quality). Audio never leaves the device until wake word detected. After wake word, only transcribed text is sent to the LLM.

For fully offline mode: whisper.cpp + Ollama + Piper TTS. Works on a MacBook, no internet needed. Quality is lower but privacy is absolute.

## 8. Reliability & Degradation

| Failure Mode | Degradation Strategy |
|-------------|---------------------|
| Network drops | "Connection lost. I'll continue working. Say 'LUX' when you're back." |
| STT misrecognition | "I heard 'fix the logan bug.' Did you mean 'login bug'?" (ask for clarification) |
| LLM timeout | "Thinking... this is taking longer than usual." (status update, not silence) |
| TTS failure | Fall back to text display on screen. "I can't speak right now. Check your screen." |
| Background noise | "I'm having trouble hearing you. Can you move to a quieter spot?" |

The agent should NEVER go silent. Always acknowledge, always provide an alternative.

## 9. Minimum Viable Voice Feature

### Phase 1: Read-Only Voice (Week 1)
```
"LUX, health check" → speaks project health summary
"LUX, what's the deploy status?" → speaks status
"LUX, any failed specs?" → speaks failures
```
Zero risk. Read-only. Proves the pipeline works.

### Phase 2: Voice Coding (Week 2)
```
"LUX, fix the login timeout" → reads code, proposes fix, speaks verification
"LUX, deploy the fix" → deploys, speaks confirmation
```
Same Hermes agent. Same safety model. Voice is just the input method.

### Phase 3: Continuous Conversation (Week 3)
```
Full barge-in, context carryover, multi-device handoff
```

## 10. Competitive Analysis

| Competitor | Voice Coding? | Proof Verification? | Status |
|------------|--------------|---------------------|--------|
| GitHub Copilot | Yes (Copilot Voice, 2025) | No | Ships |
| Cursor | No (text only) | No | Ships |
| Claude Code | No (text only) | No | Ships |
| Devin | No (text only) | No | Ships |
| **LUX Voice** | **Yes (continuous, barge-in)** | **Yes (spoken aloud)** | **Prototype working** |

**The differentiator**: No one else speaks verification results. "847 specs pass" spoken aloud after every change is uniquely LUX. It's the audible equivalent of the green checkmark in the dashboard.

---

## What To Build First

```bash
# TODAY: StreamCoreAI is running with DeepSeek. Voice pipeline works.
# NEXT: Write the Python Hermes Bridge plugin
#        └── Receives transcribed text from StreamCoreAI
#        └── Calls hermes -z "{text}"
#        └── Returns Hermes response for TTS
#        └── Injects LUX verification audio cues

# THEN: Add local wake word (Picovoice)
# THEN: Ship read-only voice queries
# THEN: Add voice coding (edits, verification)
# THEN: Continuous conversation with barge-in
```
