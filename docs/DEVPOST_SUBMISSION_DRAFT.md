# Devpost Submission Draft

Status: English draft only. Live URL, public repository/license, video URL, commit/build identity, and submission record are **UNRESOLVED / UNRUN**.

## Project description

Lab Studio Grounded Experiment Composer helps chemistry teachers and trainers turn a learning goal and the laboratory resources they actually have into a staged, inspectable pre-lab. The challenge build deliberately supports one family: estimating the molarity of a synthetic monoprotic-acid sample with standardized NaOH and a phenolphthalein endpoint.

WebMCP is a strong fit because this workflow depends on structured state that an agent should not guess from the page. Lab Studio exposes exact operations for capability and inventory inspection, revision-checked inventory replacement, bounded experiment compilation, guided rehearsal, and deterministic Protocol Check. Studio and rehearsal have separate stable tool sets, and each agent action changes the same live application state the human sees.

The result is a better experience than DOM scraping or canvas clicking. The agent can map natural-language equipment to supported IDs, recover from missing inventory or stale revisions, stage without overwriting the current draft, rehearse wrong-target and early-endpoint recovery through the ordinary simulator, and return to a visible scientific-limitation report. The teacher keeps final authority: WebMCP has no Apply, Discard, Save, Export, or Publish tool. Only a visible human click can apply or discard the staged experiment.

Implementation uses direct `document.modelContext.registerTool()` calls in a static React/TypeScript app. All 13 tool inputs use strict AJV schemas. Registration is owned by AbortSignals, surface transitions register the destination first, results are compact and sanitized, and the simulator resolver/reducer remains authoritative. Protocol Check runs ten isolated declared cases; it is not scientific or safety certification.

Lab Studio states its limits: the sample is synthetic, the aliquot uses modeled graduated-cylinder precision, no full pH/equilibrium model is present, external physical samples are not characterized, declared facilities are not a comprehensive safety review, and client-side answers are not cryptographically secret. The optional pH P1 module is omitted.

## Judge testing instructions

- Live URL: `UNRESOLVED`
- Public repository and detected license: `UNRESOLVED`
- Submitted commit/build identity: `UNRESOLVED`
- Tested client/version/origin: `UNRUN`

Local source instructions while release is pending:

1. Use Node.js 24 and run `npm install`, then `npm run dev`.
2. Open `http://127.0.0.1:5175/#/studio` in ChatGPT's in-app browser. Alternatively use a current Chrome build after enabling `chrome://flags/#enable-webmcp-testing` and restarting; record the exact tested client/version/origin in the final instructions.
3. Confirm exactly seven Studio tools. Use the prompt in the root README.
4. Confirm the staged review appears while the current draft title remains unchanged.
5. Open rehearsal through `start_lab_rehearsal`; confirm exactly six rehearsal tools.
6. Make a wrong-target attempt and recover. Attempt endpoint acceptance early, then use coarse delivery, one-drop delivery, accept, record evidence, and submit the calculation.
7. Close rehearsal, run Protocol Check, and inspect the ten cases plus the scientific/safety/physical limitations.
8. Confirm the agent cannot Apply or Discard. Click **Apply to Studio** yourself only after reviewing the exact passing current report.

Expected tool names and scientific boundaries are in `docs/WEBMCP.md` and `docs/FIDELITY.md`. If authentication is later added, judge credentials must appear only in the authorized private submission field, never in the public repository.

These are instructions, not evidence that the journey passed. The final live URL and judge journey remain **UNRUN**.

## Official requirements snapshot

Verified against the [OpenAI challenge page](https://openai.com/webmcp-challenge/), [Devpost overview](https://webmcp.devpost.com/), and [official rules](https://webmcp.devpost.com/rules) on 2026-08-29. Current requirements include an accessible working live URL, English materials, a public functional source repository with a detectable open-source license, and a public YouTube demo under three minutes with audio. The submission period ends September 3, 2026 at 1:00 p.m. Pacific. Rules may change; refresh them immediately before release.
