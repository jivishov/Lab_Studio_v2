# WebMCP Integration

Status: source implemented; one final local Codex in-app Browser Composer journey passed at `1440x900`. E1-E9, deployed-origin verification, normal-browser fallback, and broader client/viewport matrices remain **UNRUN**.

Lab Studio uses the browser-native imperative API directly. Production code feature-detects `document.modelContext`, then registers explicit descriptors with `document.modelContext.registerTool(...)`. There is no backend MCP server, API key, SSE connection, or `stdio` transport for this feature: the tools operate the same live client-side state that the human sees.

## Why direct WebMCP matters

The Composer is not a set of DOM shortcuts. A useful agent must understand the current inventory revision, strict supported family, compiler failures, staged artifact identity, draft staleness, current simulator step, evidence gates, and Protocol report. Direct tools give the agent bounded operations and descriptive recovery codes without asking it to scrape controls, infer hidden process state, or click through hundreds of drops.

## Exact tool inventory

Studio registers exactly seven tools while `#/studio` is active:

1. `inspect_lab_capabilities`
2. `inspect_lab_inventory`
3. `replace_lab_inventory`
4. `preview_lab_experiment`
5. `inspect_lab_preview`
6. `start_lab_rehearsal`
7. `run_lab_protocol_check`

Guided rehearsal registers exactly six different tools:

1. `inspect_rehearsal`
2. `act_current_step`
3. `operate_titration` with `coarse`, `drop`, or `accept`
4. `record_step_evidence`
5. `submit_step_calculation`
6. `reset_rehearsal`

There is no WebMCP Apply, Discard, Save, Export, Publish, arbitrary JSON patch, assessment-completion, or Assistant transaction tool. Apply and Discard remain visible human-only controls.

## Registration lifecycle

- One `AbortController` owns each surface registration.
- Tool execution receives a linked client/owner cancellation signal.
- Handlers read current controller refs instead of registration-time React snapshots.
- A major-surface transition registers every destination tool first. Only after destination readiness does the source registration retire when its active call settles.
- This post-settlement retirement also protects experimental clients with pre-Chrome-153 in-flight cancellation behavior.
- Partial destination registration rolls back; the previous surface remains active.
- Closing rehearsal performs the reverse destination-first activation and keeps the rehearsal visible if Studio restoration fails.

## Schemas, annotations, and outputs

All 13 input schemas are frozen, AJV-validated again in application code, use `additionalProperties: false`, and carry bounded strings, numbers, and arrays. Descriptions observe the local 500-character tool and 150-character parameter budgets. Results use one serializable envelope and fail closed above 1,500 serialized characters.

`readOnlyHint` appears only on inspections. `untrustedContentHint` appears when output may contain bounded user-authored title/objective content. The app does not invent annotations or use `exposedTo` for this same-origin client.

Public outputs exclude the full definition, private draft fingerprint, analyte ground truth, endpoint/equivalence counts, expected calculation value, and complete future answer path. This is output minimization, not cryptographic secrecy; see [Fidelity](FIDELITY.md).

## Progressive enhancement

Without `document.modelContext`, no tool registration is attempted. Teacher Studio, manual Composer controls, ordinary Student Player controls, import/export, and static routes remain usable. Assessment mode does not provide a guided rehearsal controller and therefore cannot register rehearsal action tools.

## Local inspection

1. Run `npm install` and `npm run dev`.
2. Open `http://127.0.0.1:5175/#/studio` in ChatGPT's in-app browser, or a current Chrome build after enabling `chrome://flags/#enable-webmcp-testing` and restarting. Record the exact client/version used as evidence.
3. Confirm seven Studio tools are discoverable.
4. Use the copyable prompt in the root README.
5. After rehearsal opens, confirm the surface contains six rehearsal tools and no Studio mutation tools.
6. Close rehearsal and confirm the seven Studio tools return.

These steps remain the repeatable inspection instructions. Separately, the final authorized local sample ran in the Codex in-app Browser on 2026-08-29 at `1440x900` against the current uncommitted checkout and Vite development origin `http://127.0.0.1:5197`. It observed all seven Studio and six rehearsal tools, completed the 12-step rehearsal with one deliberate rejection/recovery, returned Protocol Check `10/10` with limitation counts `8/3/1`, kept the accessibility bridge visually hidden, and left human Apply/Discard untouched. The client version was unavailable from the read-only runtime. See [E10](AGENT_EVALS.md#e10--complete-challenge-journey) and the [complete 46-call evidence ledger](../planning/2026-08-29_lab-studio-webmcp-grounded-composer/evidence/2026-08-29T17-06-36-05-00/RUN.md).

This is one local real-client journey, not deployed-origin, normal-browser fallback, broad client, multi-viewport, automated accessibility, performance, or release proof. Cycle 01's temporary `http://127.0.0.1:4175` handshake remains separate and is not relabeled as final Composer evidence.

Primary implementation references: the [WebMCP Community Group Report](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api), and [Chrome tool security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools).
