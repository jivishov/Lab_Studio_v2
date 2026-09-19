# Hand-Warmer Calorimetry Source Traceability — Phase 2

This is the action-to-implementation contract. It reconciles the fidelity-corrected
atomic specification with printed pages 99–105 of the student manual. The generated
2.2.0 technique implements the session-input and physical-transfer boundaries called
out below; the matrices remain the source contract and do not claim broad runtime QA.

## Authority and basis

Authority order:

1. Explicit current-session corrections and approved decisions.
2. The source student manual.
3. The approved fidelity-corrected atomic procedure.
4. Existing maintainable Lab Studio conventions.
5. Clearly labeled implementation assumptions.

Basis codes:

- **M** — explicitly required by the manual.
- **F** — visible in Figure 1 or supported by the materials list.
- **R** — implicit real-life action needed to complete a manual step faithfully.
- **C** — implementation or teacher-configuration choice, not a manual claim.
- Combined codes preserve mixed authority, for example `M/R`.

In the matrices, **P** means procedural state and **S** means scientific state.
“Trial scope” means that evidence must carry its trial or determination identity
and must have been created after that scope began. “Preserve” means that invalid
input changes neither scientific state nor previously accepted evidence.

## Verified manual map

| PDF page | Printed page | Verified content |
| --- | --- | --- |
| 1 | 99 | Approximately 50 mL hand warmer; 20 °C increase without exceeding it; speed, cost, safety, and environmental criteria. |
| 2 | 100 | Materials; two 8 oz polystyrene cups; safety, spill, oxidizer, and teacher-directed disposal. |
| 3 | 101 | Part 1 quantities, two trials, instructor 10% check and retry; Figure 1; calibration start. |
| 4 | 102 | Both initial temperatures; immediate mixing; cover; 15-second reading; repetitions; three-solid inquiry; 2012 costs; 10 g limit. |
| 5 | 103 | Calibration balance; `q = mcΔT`; density and heat-capacity assumptions; inconsistent dissolution notation. |
| 6 | 104 | Solution heat-capacity approximation; kJ/mol; 20 °C design calculation; CER. |
| 7 | 105 | Postlab extension questions. These are source content but are outside the approved core implementation scope. |

## Fidelity decisions and unresolved confirmations

| Topic | Phase 2 treatment | Authority/status |
| --- | --- | --- |
| Initial ring state | Start at `CAL-00` with stand and support ring preattached. | Figure-supported implementation assumption (`F/C`); retain as configuration until teacher confirms. |
| Calibration count | Default to three total determinations because “Repeat this determination twice” most naturally means two additional determinations. | Manual wording plus interpretation (`M/C`); teacher-configurable and not silently fixed. |
| Calibration stirring | Preserve the materials-list alternative: configured stir bar or stirring rod. Part 1 remains stir-bar-specific. | `F/C`; the manual does not prescribe which method is used during calibration. |
| Dissolution notation | Use normalized internal terms (`q_thermal`, `q_cal`, `q_dissolution`) and map them to printed labels. | Manual formulas are internally inconsistent; final labels/sign convention await teacher key (`M/C`). |
| Heating tolerance | Accept a teacher-configured reasonable range around 50 °C. | “Approximately 50°C” is manual-stated; numeric tolerance is `C`. |
| Cool-water tolerance | Accept a teacher-configured reasonable range around 20 °C. | “Approximately 20°C” is manual-stated; numeric tolerance is `C`. |
| Part 1 10% target | Require instructor-configured expected value and comparison basis. | The 10% check is `M`; expected value is absent from the student manual. |
| Simulator peak profile | Require a current-session teacher value when the simulator needs a practice response peak; never serialize a fixed peak as if the manual supplied it. | The manual requires observation of the highest temperature but supplies no expected peak (`M/C`). |
| Simulator calorimeter constant | Require a current-session teacher value when the mixing simulator needs a thermal response constant; the student's reported calorimeter constant remains a derived, teacher-reviewed result. | The manual requires the student to derive the constant and provides no numeric answer key (`M/C`). |
| Student records and calculations | Capture temperatures, explanations, plans, CER fields, and calculation submissions as student input. Numeric derived results are teacher-reviewed and carry no embedded expected value. | Student work is required by the manual (`M`); runtime input and review mode are implementation choices (`C`). |
| Cleanup | Dilution and teacher-directed disposal are mandatory; rinse/replace, stir-bar recovery, and dry/reset details are teacher-configurable. | `M` for dilution/disposal; `R/C` for physical reset. |
| Inquiry validation | Enforce the 10 g maximum and safety; treat equality of mass/moles, water volume, endpoint, and repeat count only as teacher rules or scientific warnings. | Manual inquiry constraint is limited to at most 10 g of each solid. |
| MgSO₄ container | Accept a plastic Dixie cup or configured weighing boat. | Manual procedure says plastic cup; materials list supplies Dixie cups or weighing boats (`M/F/C`). |

## Matrix conventions

- Existing generic interactions to prefer where faithful: placement/snap, `pourInto`,
  volume measurement, weighing, instrument reading, notebook entry, calculation
  submission, and ordinary observation.
- Proposed generic extensions: apparatus open/close and probe-contact validation,
  stir controls and splash validation, stable/periodic/live/peak temperature evidence,
  exact timer gate, trial-scoped fresh evidence, partial reset, interleavable branches,
  plan validation, and plan-driven execution.
- A visual-state ID is a rendering consequence only; it is never the sole source of
  procedural or scientific truth.
- All invalid-action messages below imply: do not mutate contents, quantities,
  temperatures, apparatus attachments, timer state, or accepted evidence.

## Safety prerequisite

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAF-01 `M` | Put on splash-proof safety goggles. | PPE representation; place/toggle PPE. | Lab start. | P: goggles worn. S: none. | Trial-independent safety evidence; correct PPE type. | “Splash-proof goggles are required”; select and wear them. | Goggles-on avatar/PPE badge. | Generic PPE technique. |
| SAF-02 `M` | Put on protective gloves. | Gloves; place/toggle PPE. | Lab start. | P: gloves worn. S: none. | Safety evidence; gloves active. | “Protective gloves are required”; put them on. | Gloves-on avatar/PPE badge. | Generic PPE technique. |
| SAF-03 `M` | Review the eye- and skin-irritant warning. | Safety card; acknowledge. | Safety briefing open. | P: general warning acknowledged. | Timestamped acknowledgement of exact warning. | “Review the irritant warning”; reopen card and acknowledge. | Safety card marked reviewed. | Generic safety-card pattern. |
| SAF-04 `M` | Identify the teacher-designated waste location. | Configured waste container/location; select. | Teacher disposal configuration loaded. | P: disposal target known. | Selected target equals configured target. | “Use the teacher-designated waste location”; select highlighted configured target. | Waste target labeled/available. | Generic disposal setup. |
| SAF-05 `M` | If CaCl₂ is assigned, acknowledge its skin-burn hazard. | CaCl₂ safety card; conditional acknowledge. | Assigned-solids list known. | P: compound warning acknowledged or not applicable. | Conditional evidence required only when CaCl₂ assigned. | “Review CaCl₂ skin-burn hazard”; acknowledge before handling. | CaCl₂ hazard badge reviewed. | Generic conditional SDS warning. |
| SAF-06 `M` | If NH₄NO₃ is assigned, keep it away from heat and ignition sources. | NH₄NO₃ card plus placement rule. | Assigned-solids list known. | P: oxidizer rule acknowledged. S: hot-zone exclusion active. | Conditional acknowledgement and later placement validation. | “NH₄NO₃ is an oxidizer”; move it to the safe zone. | Oxidizer badge and protected hot zone. | Generic incompatibility rule. |
| SAF-07 `M` | If a skin spill occurs, rinse with copious water. | Spill scenario; choose emergency response. | Simulated skin spill event. | P: emergency response completed. S: exposure cleared. | Correct response selected; wrong responses do not clear spill. | “Rinse exposed skin with copious water”; choose rinse response. | Spill warning cleared/rinse cue. | Generic safety scenario. |

## Calorimeter assembly

`CAL-00` is the configured initial state, not a student action: ring stand and
support ring are preattached (`F/C`). Adding attachment/tightening actions would
require a separate teacher decision and is not part of this approved sequence.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAL-01 `F/R` | Place the magnetic stirrer beneath the support ring. | Ring stand, support ring, stirrer; drag/snap. | `CAL-00`; heat control off. | P: stirrer snapped under ring. S: heating remains off. | Placement evidence; correct item, target, orientation, and heat-off state. | “Place the stirrer beneath the ring with heat off”; move or switch it off. | `CAL-01`. | Generic apparatus assembly. |
| CAL-02 `F/R` | Lower the outer polystyrene cup through the support ring. | Outer cup; drag/snap to ring. | `CAL-01`. | P: outer cup supported upright and centered. | Attachment evidence; correct cup, ring target, upright/centered. | “Use the outer cup and center it in the ring”; reposition. | `CAL-02`. | Generic snap/assembly. |
| CAL-03 `F/R` | Nest the second cup inside the outer cup. | Inner cup; drag/snap into outer cup. | `CAL-02`. | P: two distinct cups nested. | Parent-child evidence; inner cup, correct target, full nesting. | “Nest the second cup inside the supported cup”; retry with inner cup. | `CAL-03`. | Generic nested-container assembly. |
| CAL-04 `F/R` | Place the wooden cover on the inner cup. | Wooden cover; drag/snap. | `CAL-03`; inner cup empty/open. | P: cover attached. | Cover attachment evidence; hole orientation valid. | “Seat the wooden cover on the inner cup”; align and retry. | `CAL-04`. | Generic lid/cover placement. |
| CAL-05 `F/R` | Insert the thermometer through the cover hole. | Thermometer; insert/snap. | `CAL-04`. | P: probe attached through cover; contact constraint armed. | Attachment evidence; passes hole, not cup wall/bottom. Immersion deferred until liquid exists. | “Insert through the hole without touching the cups”; reposition probe. | `CAL-05`. | Generic probe insertion plus generic contact validation. |

## Reusable water-measurement technique

This is one parameterized reusable technique. For this experiment the target is
`100.0 mL`; the technique must not hard-code that target.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VOL-01 `R` | Place the clean graduated cylinder upright on the bench. | 100 mL cylinder; place. | Clean cylinder available. | P: cylinder on bench. | Placement evidence; correct definition, upright, clean. | “Use a clean upright graduated cylinder”; correct placement. | Empty upright cylinder. | Existing measuring-volume technique, parameterize. |
| VOL-02 `M` | Pour water toward the 100.0 mL line. | Water source and cylinder; `pourInto`. | `VOL-01`. | P: fill in progress. S: cylinder water volume increases. | Volume state between 0 and capacity. | “Pour water into the cylinder”; wrong target/overflow preserves prior valid volume. | Part-filled cylinder. | Existing transfer/volume interaction. |
| VOL-03 `R` | Reduce the pouring rate near the line. | Water source; fine-dispense control. | Volume within configured approach band. | P: precision mode active. S: smaller volume increments. | Fine-rate evidence near target. | “Use a slower pour near the mark”; switch to fine control. | Near-target meniscus. | Generic precision-dispense extension/reuse. |
| VOL-04 `R` | View the meniscus at eye level. | Cylinder/inspection view; inspect. | Liquid present. | P: eye-level view completed. | Observation evidence; view alignment valid. | “Read the meniscus at eye level”; align view. | Eye-level meniscus close-up. | Generic meniscus-reading technique. |
| VOL-05 `M` | Stop at 100.0 mL at the bottom of the meniscus. | Cylinder; stop/confirm fill control. | `VOL-03` and `VOL-04`. | P: fill stopped. S: measured volume locked. | Bottom-of-meniscus value meets target and tolerance; no overflow. | “Adjust to 100.0 mL at the bottom of the meniscus”; add/remove by allowed fine correction. | 100.0 mL meniscus state. | Parameterized measure-volume. |
| VOL-06 `R` | Confirm the measured volume. | Measurement UI; confirm instrument reading. | `VOL-05`. | P: sample volume accepted in current scope. | Trial-scoped volume evidence with full-precision value, display value, and unit. | “Confirm only after an eye-level reading at target”; return to measurement. | Accepted-volume badge; cylinder unchanged. | Existing measurement evidence, add trial scope. |

## Part 1 — calorimetry practice

The following sequence is instantiated separately for Trial 1 and Trial 2.
Trial 2 begins with fresh physical materials and a new scope; Trial 1 evidence
remains visible but cannot satisfy Trial 2 prerequisites.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 `M/F` | Complete the calorimeter assembly. | `CAL-01`–`CAL-05`; composite completion. | Safety complete; Part 1 scope active. | P: assembled apparatus accepted. S: heater off. | All five fresh assembly relations valid. | “Complete each assembly step with heat off”; return to first missing/invalid relation. | `CAL-05`; closed empty calorimeter. | Reusable apparatus technique. |
| P1-02 `M` | Measure exactly 100.0 mL of water. | `VOL-01`–`VOL-06`. | `P1-01`; clean cylinder. | P: measured sample ready. S: 100.0 mL water in cylinder. | Current-trial volume evidence. | “Measure a fresh 100.0 mL sample”; redo current trial measurement. | Cylinder at 100.0 mL beside setup. | Reusable volume technique. |
| P1-03 `R` | Lift the cover-and-thermometer assembly. | Cover/probe composite; open action. | `P1-02`; stirrer off. | P: calorimeter open; cover/probe retained as composite. | Open-state evidence; correct cover assembly moved. | “Lift the cover and thermometer together”; use cover assembly, not cup. | Open empty calorimeter. | Generic apparatus access extension. |
| P1-04 `M/R` | Pour the entire measured water sample into the inner cup. | Cylinder to inner cup; `pourInto`. | `P1-03`; accepted 100.0 mL sample. | P: transfer complete. S: cylinder empty; inner cup +100.0 mL water. | Transfer evidence; correct source/target, entire sample, capacity valid. | “Pour all measured water into the inner cup”; correct target or finish transfer. | Water-filled open calorimeter. | Generic transfer technique. |
| P1-05 `R` | Replace the cover and thermometer. | Cover/probe composite; close/snap. | `P1-04`. | P: calorimeter closed. | Cover attached; probe present. | “Replace the cover-and-thermometer assembly”; align and retry. | Closed water-filled calorimeter. | Generic apparatus access extension. |
| P1-06 `R` | Adjust the thermometer depth. | Probe; constrained vertical adjustment. | `P1-05`; water present. | P: valid probe placement. S: probe immersed, no cup contact. | Depth/contact evidence; immersed in liquid, not wall/bottom. | “Immerse the probe without touching the cups”; raise/lower/recenter. | Closed setup with immersed probe. | Generic probe-placement extension. |
| P1-07 `R` | Wait for the initial reading to stabilize. | Thermometer; stability detector. | `P1-06`; stirrer/heater off. | P: stable-reading gate met. S: stability window stored. | Current-trial stable interval meets configured slope/duration. | “Wait until the reading stabilizes”; keep probe correctly immersed. | Stable readout indicator. | Generic stable-instrument extension. |
| P1-08 `M` | Read the initial water temperature. | Thermometer; instrument read. | `P1-07`. | P: reading observed. S: observed initial value captured, not yet notebook data. | Instrument-reading evidence from current stable value. | “Read the stabilized thermometer”; wait/reposition if unstable. | Live readout highlighted. | Generic instrument reading. |
| P1-09 `M` | Record the initial temperature. | Notebook; record measurement. | Fresh `P1-08` evidence. | P: initial-temperature record complete. S: trial initial temperature stored. | Notebook evidence matches observed value/unit/precision and trial. | “Record the value you read”; correct mismatched value or unit. | Notebook row filled; apparatus unchanged. | Generic notebook record plus trial scope. |
| P1-10 `R` | Lift the cover-and-thermometer assembly. | Cover/probe composite; open action. | `P1-09`; stirrer off. | P: calorimeter open. | Open-state evidence. | “Open the calorimeter using the cover assembly”; retry. | Open water-filled calorimeter. | Generic apparatus access extension. |
| P1-11 `M` | Add one clean magnetic stir bar. | Clean stir bar to inner cup; drop/transfer. | `P1-10`; water present. | P: stir bar added. S: exactly one clean bar in water. | Content/attachment evidence; correct item, clean, count one. | “Add one clean magnetic stir bar”; remove wrong/extra item and retry. | Open setup with stir bar in water. | Generic solid-object transfer. |
| P1-12 `R` | Replace the cover and thermometer. | Cover/probe composite; close/snap. | `P1-11`. | P: calorimeter closed; prior valid probe constraint restored. | Cover/probe attachment evidence. | “Replace the cover before stirring”; close and adjust probe if needed. | Closed stir-bar setup. | Generic apparatus access extension. |
| P1-13 `M` | Turn on the magnetic stirrer. | Stirrer control; set enabled. | `P1-12`; heater off; centered cups. | P: stirrer on. S: stir bar rotating. | Control evidence; stir enabled, heat disabled. | “Turn on stirring, not heating”; switch heat off or recenter apparatus. | Stirring animation starts. | Generic stir-control extension. |
| P1-14 `M/R` | Adjust the speed so the water stirs without splashing. | Stirrer speed control; set/adjust. | `P1-13`. | P: acceptable speed locked. S: mixing active; no splash/material loss. | Speed within modelled mixing/no-splash band. | “Adjust to steady stirring without splashing”; lower excessive or raise ineffective speed. | Closed non-splashing vortex state. | Generic stir/splash extension. |
| P1-15 `M/F` | Place an empty Dixie cup or weighing boat on the balance. | Configured plastic weighing container; place in balance. | Calibrated balance available; container empty/dry. | P: container on pan. S: gross empty mass readable. | Correct empty container and balance placement. | “Place the configured empty plastic container on the balance”; empty/dry or replace it. | Empty container on balance. | Existing weighing technique, parameterize container. |
| P1-16 `R` | Tare the balance. | Balance; tare control. | `P1-15`; stable mass. | P: tare accepted. S: displayed/net mass 0.00 g. | Tare evidence tied to container. | “Tare with the empty container in place”; stabilize/empty container, then tare. | Balance reads 0.00 g. | Generic tare interaction. |
| P1-17 `M/R` | Scoop anhydrous MgSO₄ into the weighing container. | MgSO₄ stock, scoop, container; dispense solid. | `P1-16`; correct stock; PPE. | P: weighing in progress. S: MgSO₄ net mass increases; stock decreases. | Dispense evidence; identity correct, no contamination/spill. | “Use anhydrous MgSO₄ and the clean scoop”; select correct stock/tool. | Part-filled container; live balance mass. | Generic solid dispensing/weighing. |
| P1-18 `R` | Add or remove small portions to reach 5.00 g. | Scoop/container/stock or correction vessel; fine adjust. | `P1-17`. | P: fine weighing. S: net mass adjusted without duplication. | Stable net mass reaches target tolerance. | “Adjust in small portions to 5.00 g”; add/remove safely; no return of contaminated excess unless configured. | Balance approaches 5.00 g. | Generic precision weighing. |
| P1-19 `M/R` | Confirm the 5.00 g mass. | Balance; confirm instrument reading. | `P1-18`; stable reading. | P: salt sample accepted. S: actual mass stored in current trial. | Trial-scoped mass evidence includes identity, actual value, unit. | “Confirm only a stable 5.00 g MgSO₄ sample”; continue adjustment. | Balance 5.00 g accepted. | Existing mass evidence plus trial scope. |
| P1-20 `M` | Keep the thermometer reading visible immediately before addition. | Thermometer; live-monitor control/time series. | `P1-19`; `P1-14`; probe valid. | P: pre-addition monitoring active. S: temperature history sampling active. | Current live value and timeline timestamped before addition. | “Restore valid stirring and probe placement to monitor temperature”; correct state. | Thermometer and live trace visible. | Generic live time-series extension. |
| P1-21 `R` | Move the cover enough to provide access. | Cover/probe assembly; partial-open action. | `P1-20`; temperature monitoring retained where physically/model valid. | P: addition opening available. | Access-state evidence; cover not fully removed/lost. | “Open only enough for addition”; move correct component. | Solid-addition access state. | Generic apparatus access extension. |
| P1-22 `M` | Quickly pour all MgSO₄ into the calorimeter. | Weighing container to inner cup; timed `pourInto`. | `P1-21`; accepted current-trial sample; stirring active. | P: addition event timestamped. S: all sample transferred; solution response begins. | Correct identity/source/target, entire accepted mass, within configured rapid-transfer window. | “Transfer the entire MgSO₄ sample quickly into the inner cup”; correct target or finish transfer; no duplicate addition. | Solid entering/open reacting calorimeter. | Generic quantitative transfer plus timed event. |
| P1-23 `R` | Empty any remaining visible solid from the weighing container. | Weighing container; inspect/finish transfer. | `P1-22`. | P: source confirmed empty. S: transferred mass equals accepted mass. | Empty-source observation; mass conservation passes. | “Transfer the visible remainder”; tap/pour into correct target. | Empty container; solid in calorimeter. | Generic complete-transfer validation. |
| P1-24 `R` | Immediately replace the cover. | Cover/probe composite; close action. | `P1-22`; access open. | P: calorimeter closed; timeline continues. | Close timestamp within configured prompt window; probe valid. | “Replace the cover immediately”; close and correct probe placement. | Closed reacting solution. | Generic apparatus access plus timing validation. |
| P1-25 `M` | Continue observing the live temperature. | Thermometer/time-series view; observe. | Addition timestamp; probe valid; stirring without splash. | P: observation active. S: post-addition temperature history accumulates. | Time-series evidence covers response through detected peak. | “Keep the live temperature visible with correct stirring”; restore valid state. | Closed stirring setup with live trace. | Generic time-series extension. |
| P1-26 `M` | Identify the highest temperature reached. | Temperature trace/readout; select peak. | Sufficient `P1-25` history; peak has occurred. | P: peak selected. S: observed peak candidate stored separately from stable values. | Selection equals actual maximum of valid sampled history, with timestamp. | “Select the actual highest reading, not a later stable value”; inspect trace and retry. | Peak point highlighted. | Generic peak-observation extension. |
| P1-27 `M` | Record the highest temperature. | Notebook; record measurement. | Accepted `P1-26`. | P: peak record complete. S: trial highest temperature stored. | Notebook value matches selected peak/unit/precision and trial. | “Record the selected highest temperature”; correct value/unit. | Notebook peak row filled. | Generic notebook record plus trial scope. |
| P1-28 `M/R` | Inspect for undissolved MgSO₄. | Calorimeter contents; inspect observation. | Addition complete; access/view method available. | P: dissolution inspected. S: visible-solid state observed. | Observation evidence records dissolved/undissolved without revealing expected thermal answer. | “Inspect the solution for visible solid”; use the inspection view. | Solution view with any visible particles. | Generic dissolution observation. |
| P1-29 `M/R` | Continue stirring until no visible solid remains. | Stirrer and solution; wait/observe. | `P1-28`; solid remains or completion not yet verified. | P: dissolution completion accepted. S: undissolved mass reaches zero; no splash. | Fresh no-visible-solid evidence under valid stirring. | “Continue safe stirring until all visible solid dissolves”; adjust speed/wait. | Dissolved solution (`CAL-12` equivalent). | Generic dissolve/stir extension. |

### Part 1 disposal and scoped reset

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-D01 `R` | Turn off the magnetic stirrer. | Stirrer control; set disabled. | Peak recorded; dissolution completed. | P: stirring off. S: stir bar stopped; heater remains off. | Control evidence; both stirring and heat off. | “Turn off the stirrer before opening”; switch it off. | Used solution, still liquid. | Generic equipment shutdown. |
| P1-D02 `R` | Remove the cover and thermometer. | Cover/probe composite; open/remove. | `P1-D01`. | P: calorimeter open; probe safely removed. | Open-state evidence. | “Turn off stirring, then remove the cover assembly”; complete prerequisite. | Open used solution. | Generic apparatus access. |
| P1-D03 `M` | Add water to dilute the resulting solution. | Water source to inner cup; `dilute`. | `P1-D02`; used solution present. | P: dilution complete. S: water volume increases, concentration decreases; capacity valid. | Dilution evidence meets teacher-configured amount/criterion. | “Dilute before disposal without overflowing”; add configured water amount safely. | Diluted solution. | Existing dilution technique, parameterize. |
| P1-D04 `M` | Dispose of the diluted solution in the teacher-designated location. | Calorimeter to configured waste; transfer/dispose. | `P1-D03`; `SAF-04`. | P: disposal complete. S: cup emptied; waste inventory increases. | Correct waste target, diluted state, complete transfer, mass conservation. | “Use the designated waste location after dilution”; select correct target/finish transfer. | Waste transfer then empty used cup. | Generic disposal interaction. |
| P1-D05 `R` | Recover the stir bar. | Stir-bar retrieval tool or direct configured action. | Solution disposed; stir bar remains. | P: stir bar recovered. S: bar removed without losing/duplicating it. | Retrieval evidence; exactly one bar accounted for. | “Recover the stir bar using the configured method”; use correct tool/location. | Empty cup; recovered bar. | Generic recovery, teacher-configured method. |
| P1-D06 `R/C` | Rinse or replace equipment as directed. | Used cup/probe/cylinder/container; rinse or replace workflow. | `P1-D04`; `P1-D05`. | P: configured cleanup complete. S: required items clean/dry/uncontaminated. | Teacher-configured equipment checklist passes. | “Follow the configured cleanup procedure”; clean/replace listed items. | Clean/replacement equipment states. | Generic cleanup, teacher-configured. |
| P1-D07 `R` | Restore a usable calorimeter for the next trial. | Scoped reset action. | `P1-D06`; trial data accepted. | P: physical state reset; prior trial records preserved; next scope created. S: fresh materials, empty/dry apparatus as configured. | Reset evidence; no material duplication; next scope cannot consume prior evidence. | “Finish cleanup before starting a fresh trial”; complete missing item. | Reset `CAL-05` or configured clean assembly. | Generic partial-reset extension. |

### Trial 2 and retry integrity

`P1-02` through `P1-D07` repeat in a new scope for Trial 2. `P1-01` may
remain satisfied only if the configured physical reset preserves a valid assembly.
Every sample, initial reading, peak reading, and disposal event is fresh. A required
additional trial after the tolerance check uses the same scoped repetition contract.

### Part 1 calculations

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-C01 `M` | Calculate Trial 1 temperature change. | Calculator/notebook; submit calculation. | Trial 1 initial and peak records. | P: Trial 1 ΔT calculated. S: `T_high - T_initial`. | Formula, operands, value, and °C validated from Trial 1 evidence. | “Use Trial 1 recorded initial and highest temperatures”; fix missing/wrong operand/sign. | Trial 1 calculation row. | Generic calculation. |
| P1-C02 `M` | Divide Trial 1 temperature change by its MgSO₄ mass. | Calculator/notebook; submit calculation. | `P1-C01`; Trial 1 actual mass. | P: normalized result calculated. S: ΔT/g stored. | Correct trial-scoped operands and °C/g unit. | “Use Trial 1 ΔT and actual Trial 1 mass”; correct scope/value/unit. | Trial 1 ΔT/g row. | Generic calculation. |
| P1-C03 `M` | Calculate Trial 2 temperature change. | Calculator/notebook; submit calculation. | Trial 2 initial and peak records. | P: Trial 2 ΔT calculated. S: trial-specific ΔT. | Correct formula/operands/unit from Trial 2 evidence. | “Use Trial 2 records”; fix scope/value/sign. | Trial 2 calculation row. | Generic calculation. |
| P1-C04 `M` | Divide Trial 2 temperature change by its MgSO₄ mass. | Calculator/notebook; submit calculation. | `P1-C03`; Trial 2 actual mass. | P: normalized result calculated. S: Trial 2 ΔT/g stored. | Correct operands and °C/g unit. | “Use Trial 2 ΔT and actual mass”; correct entry. | Trial 2 ΔT/g row. | Generic calculation. |
| P1-C05 `M` | Average the two temperature-change-per-gram values. | Calculator/notebook; submit calculation. | `P1-C02`, `P1-C04`. | P: two-trial average calculated. S: mean stored. | Arithmetic mean of accepted values with unit/rounding. | “Average both accepted trial values”; include both and correct arithmetic. | Average row. | Generic calculation. |
| P1-C06 `M/C` | Submit the average for the instructor’s 10% check. | Submission/check action. | `P1-C05`; instructor target configured. | P: tolerance decision recorded. S: percent deviation calculated internally/displayed as configured. | Compare accepted mean with instructor target using configured inclusive tolerance. | “A complete two-trial average is required”; finish calculations or correct unit. | Pass/retry decision card. | Generic tolerance check, teacher-configured target. |
| P1-C07 `M/R` | If outside tolerance, review measurement, probe placement, splashing, and dissolution. | Diagnostic checklist; select/review. | `P1-C06` outside tolerance. | P: diagnostic review recorded; no prior data edited. | All specified causes reviewed; selected diagnosis may be explanatory, not retroactive evidence. | “Review each listed source before retrying”; complete checklist. | Diagnostic panel; preserved trial table. | Generic guided error review. |
| P1-C08 `M` | Complete an additional full trial if required. | New scoped trial instance. | Failed `P1-C06`; `P1-C07`; physical reset complete. | P: retry scope opened. S: fresh samples/readings required. | Full `P1-02`–`P1-D07` evidence from retry scope, then recalculation/recheck. | “Do not reuse or edit prior trial data”; begin fresh measurement and sample. | Reset apparatus plus preserved prior records. | Generic scoped retry extension. |

## Part 2 — calorimeter calibration

Hot-water preparation and cool-water preparation are interleavable branches.
The join for mixing requires both branches and both initial-temperature records.

### Hot-water preparation

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-H01 `M` | Select a clean, dry 150 mL beaker. | Beaker; select/place. | Safety; calibration scope active. | P: hot-water vessel ready. S: clean/dry state verified. | Correct size, clean, dry. | “Use a clean, dry 150 mL beaker”; clean/dry or replace. | Empty beaker on bench. | Generic equipment selection. |
| P2-H02 `M` | Measure exactly 100.0 mL of water. | `VOL-01`–`VOL-06`. | `P2-H01`; clean cylinder. | P: hot-water sample measured. S: fresh 100.0 mL water. | Determination-scoped volume evidence. | “Measure a fresh 100.0 mL sample”; complete volume technique. | Filled cylinder beside beaker. | Reusable volume technique. |
| P2-H03 `M/R` | Pour the measured water into the beaker. | Cylinder to beaker; `pourInto`. | `P2-H02`. | P: transfer complete. S: beaker +100.0 mL; cylinder empty. | Correct source/target, entire sample, no spill/overflow. | “Pour the entire measured sample into the 150 mL beaker”; correct/finish transfer. | Water-filled beaker. | Generic transfer. |
| P2-H04 `M/R` | Place the beaker on the hot plate. | Beaker and hot plate; place-in-instrument/snap. | `P2-H03`; plate initially off; NH₄NO₃ excluded. | P: beaker on heater. | Correct vessel/target; stable placement; incompatible solids outside hot zone. | “Place only the water-filled beaker on the hot plate”; remove incompatible/wrong items. | Water-filled beaker on hot plate. | Generic instrument placement. |
| P2-H05 `F/C` | Use the configured stirring method: stir bar or stirring rod. | Stir bar or rod; conditional add/select. | `P2-H04`; teacher method configured. | P: stirring method ready. S: selected method stored for determination. | Correct configured method; clean item; no forced method absent configuration. | “Use the configured stirring method”; choose the allowed stir bar or rod. | Beaker with bar or rod. | Generic choice/configuration. |
| P2-H06 `M` | Begin heating. | Hot-plate control; set heat. | `P2-H04`; `P2-H05`; valid water volume. | P: heating active. S: deterministic temperature response begins. | Heat control on within safe range; stir mode consistent with chosen method. | “Heat only the prepared water beaker”; correct placement/method, then enable heat. | Heating beaker. | Generic calorimetry heat extension. |
| P2-H07 `M` | Stir the water occasionally. | Stirrer control or rod action; periodic stir. | `P2-H06`. | P: required stirring events logged. S: sample temperature remains well mixed. | Configured minimum occasional-stir criterion; no splash. | “Stir occasionally without splashing”; perform safe stir action. | Periodic stirring state. | Generic stir extension. |
| P2-H08 `R` | Measure the water temperature periodically. | Thermometer; repeated instrument reads. | `P2-H06`; valid probe placement. | P: monitoring active. S: heating time series sampled. | Periodic readings within configured cadence; not necessarily notebook entries. | “Check the water temperature with the probe immersed safely”; reposition/read again. | Live heating readout/history. | Generic periodic instrument monitoring. |
| P2-H09 `M/C` | Stop heating at approximately 50 °C. | Hot-plate control; heat off. | `P2-H08`; current valid reading. | P: target-range heating complete. S: heat input stops at observed temperature. | Reading within teacher-configured range around 50 °C; heat disabled. | “Stop near 50 °C”; continue heating if low, or record overheated sample as invalid and recover per configured rule. | Beaker near 50 °C; heat off. | Generic heat-to-range extension. |
| P2-H10 `M` | Remove the beaker from the hot plate. | Beaker; remove/move. | `P2-H09`; heat off. | P: beaker removed safely. S: cooling response may begin. | Correct vessel; heat off; safe handling path. | “Turn off heat, then remove the water beaker”; complete prerequisite. | Hot beaker moving off plate. | Generic remove-from-instrument. |
| P2-H11 `M` | Place the hot-water beaker on the lab bench. | Beaker; place. | `P2-H10`. | P: hot sample ready on bench. | Stable bench placement; hot status preserved. | “Place the hot-water beaker on the bench”; use safe open area. | Hot beaker on bench. | Generic placement. |

### Cool-water preparation

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-C01 `M` | Verify the calorimeter is clean and dry. | Calorimeter; inspect/confirm condition. | Calibration scope active; prior cleanup. | P: cool-water vessel accepted. S: clean/dry status true. | Condition evidence for inner cup and required probe/cover surfaces. | “Use a clean, dry calorimeter”; clean/dry or replace it. | Clean closed/ready calorimeter. | Generic condition check. |
| P2-C02 `M` | Measure exactly 100.0 mL of cool water. | `VOL-01`–`VOL-06`. | `P2-C01`. | P: cool sample measured. S: fresh 100.0 mL cool water. | Determination-scoped volume evidence. | “Measure a fresh 100.0 mL cool-water sample”; redo technique. | Filled cylinder beside calorimeter. | Reusable volume technique. |
| P2-C03 `R` | Open the calorimeter. | Cover/probe composite; open action. | `P2-C02`. | P: calorimeter open. | Open-state evidence. | “Open the clean calorimeter”; lift cover assembly. | Open empty calorimeter. | Generic apparatus access. |
| P2-C04 `M/R` | Pour the cool water into the calorimeter. | Cylinder to inner cup; `pourInto`. | `P2-C03`; accepted sample. | P: transfer complete. S: inner cup +100.0 mL; cylinder empty. | Correct source/target and entire sample. | “Pour all measured cool water into the inner cup”; correct/finish transfer. | Open cool-water calorimeter. | Generic transfer. |
| P2-C05 `R` | Replace the cover and thermometer. | Cover/probe composite; close/snap. | `P2-C04`. | P: calorimeter closed; probe inserted. | Cover and valid immersed probe. | “Replace the cover and position the thermometer safely”; close/reposition. | Closed cool-water calorimeter. | Generic apparatus access/probe placement. |
| P2-C06 `M/C` | Confirm the cool water is approximately 20 °C. | Thermometer; stable read/confirm range. | `P2-C05`; stable reading. | P: cool sample ready. S: observed temperature stored for readiness, not yet its required initial record. | Value within configured range around 20 °C. | “Use cool water near 20 °C”; wait/replace sample under configured recovery. | Cool-ready indicator. | Generic range check; tolerance configured. |

### Initial temperatures and mixing

`P2-M01`–`P2-M04` run for either sample first. `P2-M05`–`P2-M08`
complete the other sample when one thermometer is configured. With two
thermometers, the equivalent second branch still requires a separate read and
record. No hot-first or cool-first ordering may be imposed.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-M01 `M/R` | Place the thermometer in either water sample. | Thermometer and chosen sample; insert/move. | `P2-H11`, `P2-C06`; sample not yet measured first. | P: first sample selected. S: probe associated with hot or cool sample. | Correct sample association and safe immersed/no-contact placement. | “Measure either prepared sample with valid probe placement”; choose/reposition. | Probe in selected sample. | Generic probe reading. |
| P2-M02 `R` | Wait for that reading to stabilize. | Thermometer; stability detector. | `P2-M01`. | P: first stability gate met. S: stable interval stored. | Configured stable interval, current determination. | “Wait for a stable reading”; keep probe positioned. | Stable indicator. | Generic stable-instrument extension. |
| P2-M03 `M` | Read that sample’s temperature. | Thermometer; instrument read. | `P2-M02`. | P: first reading observed. S: observed value associated with sample identity. | Fresh reading evidence with timestamp/sample ID. | “Read the stabilized temperature”; wait/reposition. | First readout highlighted. | Generic instrument reading. |
| P2-M04 `M` | Record that sample’s initial temperature. | Notebook; record measurement. | `P2-M03`. | P: first initial record complete. S: hot or cool initial value stored. | Entry matches observed value/unit/sample/determination. | “Record the value for the sample you measured”; correct identity/value/unit. | First initial-temperature row. | Generic notebook plus scope. |
| P2-M05 `R/C` | Move the thermometer to the other sample if only one is provided. | Thermometer; move/insert. | `P2-M04`; other sample unrecorded. | P: second sample selected. S: probe association changes; first record preserved. | Correct other sample and safe placement; conditional skip only with second thermometer. | “Measure the other sample”; move to the unrecorded sample. | Probe in second sample. | Generic probe transfer/configuration. |
| P2-M06 `R` | Wait for the second reading to stabilize. | Thermometer; stability detector. | `P2-M05` or equivalent second-probe placement. | P: second stability gate met. | Fresh stable interval for other sample. | “Wait for the second reading to stabilize”; maintain placement. | Second stable indicator. | Generic stable-instrument extension. |
| P2-M07 `M` | Read the second temperature. | Thermometer; instrument read. | `P2-M06`. | P: second reading observed. S: value tied to other sample. | Fresh reading evidence; distinct sample ID. | “Read the other sample’s stabilized temperature”; correct sample/state. | Second readout highlighted. | Generic instrument reading. |
| P2-M08 `M` | Record the second initial temperature. | Notebook; record measurement. | `P2-M07`. | P: both initial records complete. S: hot and cool initial values stored distinctly. | Entry matches second reading; join validates one hot and one cool record. | “Record both distinct initial temperatures before mixing”; correct missing/duplicate identity. | Both initial-temperature rows filled. | Generic notebook plus scoped join. |
| P2-M09 `R` | Open the calorimeter. | Cover/probe composite; open action. | Both initial records; hot sample still valid. | P: mixing access open. | Open state; no initial evidence removed. | “Record both initial temperatures, then open the calorimeter”; complete join. | Open cool-water calorimeter with hot beaker nearby. | Generic apparatus access. |
| P2-M10 `M` | Immediately pour all hot water into the cool water. | Hot beaker to inner cup; timed `pourInto`. | `P2-M09`; correct hot/cool samples. | P: mixing event timestamped. S: beaker emptied; water amounts combined; thermal model begins. | Entire hot sample, correct target, capacity valid, prompt transfer timing. | “Pour the entire hot-water sample into the cool water”; correct target/finish transfer; invalid stale/overheated sample follows configured recovery. | Hot-water transfer composite. | Generic quantitative timed transfer. |
| P2-M11 `M/R` | Quickly replace the cover and thermometer. | Cover/probe composite; close action. | `P2-M10`. | P: calorimeter closed; mixture probe valid. | Close timestamp and probe placement pass. | “Replace the cover quickly and position the probe”; close/reposition. | Covered mixed-water calorimeter. | Generic apparatus access plus timing. |
| P2-M12 `R` | Start the 15-second timer. | Stopwatch/timer; start. | `P2-M11`; mixture event exists. | P: timer running. S: elapsed time anchored to start/mixing timestamps. | Single start evidence; no pre-start or duplicate start. | “Start the timer after covering the mixture”; cover first/start once. | Timer running from 0 s. | Generic exact-timer extension. |
| P2-M13 `M` | Wait until 15 seconds have elapsed. | Timer; wait gate. | `P2-M12`. | P: 15-second gate met. S: elapsed time = configured 15 s endpoint. | Deterministic timer evidence; reading action locked before 15 s. | “Wait until the timer reaches 15 seconds”; continue timer. | Timer reads 15 s. | Generic timer gate. |
| P2-M14 `M` | Read the mixture temperature. | Thermometer; instrument read. | `P2-M13`; valid probe. | P: mixture reading observed. S: temperature sampled at 15-second endpoint, not peak/stable endpoint. | Reading timestamp satisfies timer criterion and determination scope. | “Read at the 15-second mark with the probe correctly placed”; fix placement; late/missed policy configured. | 15-second readout highlighted. | Generic timed instrument reading. |
| P2-M15 `M/R` | Record the mixture temperature. | Notebook; record measurement. | `P2-M14`. | P: determination record complete. S: mixture temperature stored. | Entry matches timed reading/value/unit/determination. | “Record the 15-second reading”; correct value/unit. | Calibration data row complete. | Generic notebook plus scope. |

### Calibration repetition

After `P2-M15`, perform a configured clean/dry partial reset that preserves the
completed determination. Repeat `P2-H01`–`P2-M15` with fresh measured water,
fresh initial readings, and a new timed mixture reading. Default count is three
total determinations but remains teacher-configurable pending confirmation.

## Investigation — preserve inquiry

### SDS review

`INV-S01`–`INV-S05` repeat in a separate evidence scope for each of the three
assigned solids. A record for one solid cannot satisfy another.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S01 `M` | Open the assigned solid’s SDS. | SDS document/card; open/select. | Assigned-solid identity. | P: correct SDS reviewed. | Document-open evidence tied to solid. | “Open the SDS for the current solid”; select matching document. | SDS view. | Generic source-review interaction. |
| INV-S02 `M` | Identify the principal hazards. | SDS response fields; record/select. | `INV-S01`. | P: hazard analysis entered. | Required hazard fields supported by SDS; compound scoped. | “Identify hazards from this SDS”; revise unsupported/missing entries. | Hazard notes for current solid. | Generic SDS analysis. |
| INV-S03 `M` | Identify required precautions. | SDS response fields; record/select. | `INV-S01`. | P: precautions entered. | Precautions are consistent with reviewed SDS and baseline PPE. | “Record precautions supported by the SDS”; revise. | Precaution notes. | Generic SDS analysis. |
| INV-S04 `M` | Identify disposal requirements. | SDS/teacher disposal fields; record/select. | `INV-S01`; teacher disposal config. | P: disposal plan entered. | Compound-specific disposal entry present and compatible with teacher rule. | “Record disposal requirements for this solid”; consult SDS/teacher rule. | Disposal notes. | Generic SDS/disposal analysis. |
| INV-S05 `M` | Record the SDS findings. | Notebook; submit grouped record. | `INV-S02`–`INV-S04`. | P: one solid’s SDS review complete. | Notebook evidence includes solid identity, hazards, precautions, disposal. | “Complete all findings for this solid”; fill missing section. | Completed SDS row/card. | Generic notebook/source analysis. |

### Historical cost comparison

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-C01 `M` | Review the manual’s 2012 cost table. | Historical table; open/acknowledge. | Three assigned solids known. | P: historical source reviewed. | Evidence ties values to 2012 table, not live prices. | “Use the supplied 2012 cost table”; reopen historical table. | 2012 cost table visible. | Generic source review; experiment data. |
| INV-C02 `M` | Place the least expensive assigned solid first. | Ranking UI; drag/select. | `INV-C01`. | P: first rank selected. | Selection is among assigned solids and matches table. | “Choose the least expensive assigned solid using 2012 values”; revise. | Rank slot 1 filled. | Generic ranking assessment. |
| INV-C03 `M` | Place the middle-cost solid second. | Ranking UI; drag/select. | `INV-C01`; rank 1 unique. | P: second rank selected. | Correct remaining middle value; no duplicate. | “Choose the middle-cost assigned solid”; revise/resolve duplicate. | Rank slot 2 filled. | Generic ranking assessment. |
| INV-C04 `M` | Place the most expensive assigned solid third. | Ranking UI; drag/select. | `INV-C01`; first two unique. | P: third rank selected. | Correct remaining/highest value. | “Choose the most expensive assigned solid”; revise. | Rank slot 3 filled. | Generic ranking assessment. |
| INV-C05 `M` | Submit the cost ranking. | Ranking submission. | Three unique ranked solids. | P: historical cost evidence accepted. | Exact order validated against assigned subset of manual table. | “Complete a unique least-to-most ranking”; correct order/duplicates. | Accepted ranking. | Generic ranking assessment. |

### Experimental-plan construction

The validator classifies each rule as manual-required, teacher-configured, or
scientific warning. Warnings do not become hidden mandatory rules.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-D01 `M/R` | Select the water amount per trial. | Plan builder; numeric input with unit. | SDS/cost review available. | P: water amount defined. S: planned water amount stored. | Positive, within equipment capacity; fixed value is not imposed by manual. | “Enter a feasible water amount and unit”; revise capacity/unit. | Plan water field complete. | Generic plan builder. |
| INV-D02 `M/R/C` | Select the solid amount or comparison basis. | Plan builder; numeric/rule input. | Assigned solids known. | P: quantity/comparison rule defined. S: per-solid plan values stored. | Each solid >0 and ≤10 g total; equality only if teacher rule or student choice. | “Keep each solid at or below 10 g and state the comparison basis”; revise. | Plan solid field complete. | Generic plan builder; manual max constraint. |
| INV-D03 `M` | Select the equipment to use. | Equipment checklist/plan builder. | Quantities selected. | P: equipment plan defined. | Selected equipment can measure chosen values and run calorimetry safely. | “Choose equipment capable of the planned measurements”; revise selections. | Equipment list in plan. | Generic plan builder. |
| INV-D04 `M/R` | Define how starting temperature will be measured. | Method field; structured choice/text. | Thermometer selected. | P: start method defined. S: planned sampling rule stored. | Method names sample, stabilization/read/record approach, and timing. | “Define a measurable starting-temperature method”; add missing criterion. | Start-method card. | Generic plan builder. |
| INV-D05 `M/R/C` | Define how ending temperature will be determined. | Endpoint-rule builder. | Temperature method/equipment selected. | P: endpoint criterion defined. S: student-selected endpoint rule stored distinctly from Part 1 peak and Part 2 timed endpoint. | Rule is observable and reproducible; do not force max/min. | “Define an observable ending-temperature criterion”; revise vague/unmeasurable rule. | Endpoint-method card. | Generic endpoint-rule extension. |
| INV-D06 `M/R` | Define controlled variables. | Plan builder; controls list. | Quantity and method fields. | P: controls defined. | At least scientifically relevant controls stated; exact list may be teacher rule/warning. | “State what will remain constant for a fair comparison”; add/revise controls. | Control-variable list. | Generic plan builder. |
| INV-D07 `M` | Add required safety precautions. | Plan builder; safety fields. | SDS findings for all assigned solids. | P: safety plan defined. | Baseline PPE and applicable compound precautions included. | “Include required general and compound-specific precautions”; add missing item. | Safety section complete. | Generic plan/SDS integration. |
| INV-D08 `M/R` | Add compound-specific disposal instructions. | Plan builder; disposal fields. | SDS disposal findings; teacher rule. | P: disposal plan defined. | Each assigned solid has compatible disposal method. | “Specify approved disposal for every solid”; fill/revise missing method. | Disposal section complete. | Generic plan/SDS integration. |
| INV-D09 `M` | State the measurements to record. | Plan builder; measurement checklist. | Quantities and endpoint method defined. | P: data schema defined. S: required plan evidence fields configured. | Includes actual amounts and starting/ending temperatures; other fields per plan. | “Include amounts used and starting and ending temperatures”; add missing records. | Measurement table preview. | Generic plan builder. |
| INV-D10 `M/R/C` | Submit the plan for validation. | Plan submission/validator. | `INV-D01`–`INV-D09`. | P: accepted plan version locked or returned with classified findings. S: execution configuration generated only on acceptance. | Manual rules enforced; teacher rules labeled; scientific warnings nonblocking unless explicitly configured. | Specific classified findings; revise named field without losing valid work. | Approved-plan badge or revision panel. | Generic plan-validation extension. |

### Executing an approved plan

`INV-X01`–`INV-X12` are generated from the accepted plan for every assigned
solid and planned trial. They retain chosen quantities, methods, endpoint, controls,
and repeat count. The engine must not expose an expected exothermic/endothermic
direction before the student observes it.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-X01 `M/R` | Identify the solid and trial. | Plan/runtime selector; select. | Accepted plan; new execution scope. | P: solid/trial scope active. S: identity fixed for scope. | Selection is assigned, planned, unused scope. | “Select the planned solid and a fresh trial”; choose valid scope. | Labeled-but-no-answer trial header. | Generic scoped execution. |
| INV-X02 `M` | Measure and record the planned water amount. | Chosen volume equipment; measure then notebook record. | `INV-X01`; clean equipment. | P: water evidence complete. S: actual volume stored. | Follows accepted method; value/unit within plan tolerance/capacity and fresh scope. | “Measure and record the planned water amount”; correct method/value/unit. | Prepared water and filled trial row. | Plan-driven reusable measurement. |
| INV-X03 `M` | Measure and record the planned solid amount. | Balance/container/scoop; weigh then record. | `INV-X01`; PPE; solid identity. | P: solid evidence complete. S: actual mass stored; cumulative use ≤10 g per solid. | Accepted plan and manual 10 g cumulative maximum; fresh mass evidence. | “Use the planned amount without exceeding 10 g total”; reduce/remeasure. | Weighed solid and trial row. | Plan-driven reusable weighing. |
| INV-X04 `M` | Measure and record the starting temperature. | Chosen thermometer method; read then record. | Prepared water/apparatus; plan method. | P: start record complete. S: initial temperature stored. | Complies with accepted start method and scope. | “Follow the approved starting-temperature method”; complete missing stabilization/read/record. | Starting readout and trial row. | Plan-driven instrument evidence. |
| INV-X05 `M/R` | Add the solid using the approved procedure. | Weighed container to planned vessel; quantitative transfer. | `INV-X02`–`INV-X04`; apparatus ready. | P: addition timestamped. S: accepted mass enters water; response begins. | Correct identity, source, target, entire sample, approved handling. | “Follow the approved addition procedure”; correct target/state; no duplicate transfer. | Solid-addition state. | Plan-driven generic transfer. |
| INV-X06 `M/R` | Observe the temperature response. | Thermometer/time-series; observe. | `INV-X05`; valid probe. | P: observation active. S: response history collected without answer leak. | Valid sampling covers approved observation window. | “Keep observing with the thermometer correctly placed”; restore planned setup. | Live response trace. | Generic time-series extension. |
| INV-X07 `M/R/C` | Apply your approved ending-temperature criterion. | Endpoint-rule evaluator/student action. | `INV-X06`; accepted plan rule. | P: endpoint event accepted. S: ending sample selected by student rule. | Event satisfies the locked observable criterion; not forced to peak/minimum. | “Apply the endpoint rule in your approved plan”; continue observing or select valid point. | Endpoint point/state highlighted. | Generic plan-driven endpoint extension. |
| INV-X08 `M` | Record the ending temperature. | Notebook; record measurement. | `INV-X07`. | P: ending record complete. S: selected ending value stored. | Entry matches observed endpoint/value/unit/scope. | “Record the temperature selected by your endpoint rule”; correct value/unit. | Ending-temperature trial row. | Generic notebook plus scope. |
| INV-X09 `R` | Verify that the solid has dissolved. | Contents inspection; observe. | Addition and endpoint evidence. | P: dissolution check complete. S: visible-solid state stored. | No-visible-solid or documented plan-consistent recovery; does not alter endpoint retroactively. | “Inspect for undissolved solid”; continue approved mixing/wait or flag invalid trial. | Solution/visible-particle state. | Generic dissolution observation. |
| INV-X10 `M/R` | Record procedural observations. | Notebook; free/structured entry. | Trial actions performed. | P: observations recorded. | Trial-scoped entry; includes relevant deviations/qualitative observations without supplied conclusion. | “Record observations for this trial”; add missing trial identity/details. | Observation row. | Generic notebook. |
| INV-X11 `M/R` | Dispose of the solution by the approved method. | Vessel to configured waste; dilute if plan requires. | Records complete; disposal plan locked. | P: disposal complete. S: vessel emptied; waste inventory updated. | Correct solid-specific/teacher-approved method; complete transfer. | “Use the disposal method approved for this solid”; follow plan. | Disposal sequence. | Plan-driven generic disposal. |
| INV-X12 `R` | Reset equipment for the next trial. | Scoped partial reset. | `INV-X11`; stir bar/materials accounted for. | P: physical state reset; records preserved; next scope available. S: clean/dry/fresh state per plan. | No material duplication/loss; next trial cannot use prior evidence. | “Complete cleanup before the next fresh trial”; resolve listed equipment. | Reset planned apparatus. | Generic partial-reset extension. |

## Data analysis and final design actions

The corrected atomic specification supplied formulas but did not assign action
IDs to the manual’s calculation and argumentation instructions. Phase 2 assigns
the following traceability-only IDs so these approved/manual-required student
actions are not silently omitted. They may be renamed only with an explicit
crosswalk when lab JSON is authored.

| ID / basis | Student-facing instruction | Equipment and proposed interaction | Prerequisites | P/S state change | Evidence and validation | Invalid feedback and recovery | Resulting visual state | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DA-CAL-01 `M` | Calculate `q_cold = m_cold c ΔT_cold` for each accepted determination. | Calculator/notebook; calculation submission. | Calibration volumes and initial/mixture temperatures; `c`; density assumption. | P: cold-water calculation complete. S: signed `q_cold` stored per determination. | Uses actual scoped data, 1 g/mL, 4.184 J/(g·°C), correct units/sign/rounding. | “Use the recorded cold-water data and signed temperature change”; correct operand/unit/sign. | Calibration calculation row. | Generic formula calculation; calorimetry model. |
| DA-CAL-02 `M` | Classify and explain the cold-water process as endothermic or exothermic. | Structured response/notebook. | `DA-CAL-01`. | P: interpretation recorded. | Classification and explanation consistent with sign/temperature evidence. | “Use the sign and observed temperature change”; revise explanation. | Interpretation row. | Generic explanation assessment. |
| DA-CAL-03 `M` | Calculate `q_hot = m_hot c ΔT_hot` for each determination. | Calculator/notebook. | Calibration records/constants. | P: hot-water calculation complete. S: signed `q_hot` stored. | Actual scoped data, correct signed ΔT, unit, precision. | “Use recorded hot-water data and signed ΔT”; correct. | Calibration calculation row. | Generic formula/calorimetry model. |
| DA-CAL-04 `M` | Classify and explain the hot-water process as endothermic or exothermic. | Structured response/notebook. | `DA-CAL-03`. | P: interpretation recorded. | Consistent classification and evidence-based explanation. | “Relate the classification to sign and cooling”; revise. | Interpretation row. | Generic explanation assessment. |
| DA-CAL-05 `M` | Calculate `q_cal` from `q_hot = -(q_cold + q_cal)`. | Calculator/notebook. | `DA-CAL-01`, `DA-CAL-03`. | P: calorimeter heat calculated. S: `q_cal` stored per determination. | Algebra, signs, joule unit, scoped operands. | “Use both accepted water-energy values and the printed balance”; correct. | `q_cal` row. | Calorimetry-model calculation. |
| DA-CAL-06 `M` | Calculate `C_cal = q_cal / ΔT_cal`. | Calculator/notebook. | `DA-CAL-05`; cold initial and mixture temperature. | P: calorimeter constant calculated. S: J/°C value stored per determination. | `ΔT_cal = T_mix - T_cold,initial`; correct unit/sign and nonzero divisor. | “Use the calorimeter’s cold-water starting temperature and mixture temperature”; correct. | Calorimeter-constant row. | Calorimetry-model calculation. |
| DA-CAL-07 `M/C` | Determine the calibration value used for later calculations. | Calculator/teacher-configured aggregation. | Required determination constants complete. | P: calibration result accepted. S: configured aggregate/full-precision `C_cal` stored. | Uses configured count and aggregation; every source determination fresh/valid. | “Complete all configured determinations”; resolve invalid/missing calculation. | Accepted calibration summary. | Generic aggregation plus experiment config. |
| DA-SOL-01 `M/C` | Calculate the solution’s sensible heat, `q_thermal = m_solution c ΔT`, for each solid. | Calculator/notebook. | Valid inquiry actual masses/volumes/start/end temperatures and endpoint rules. | P: thermal calculation complete. S: signed `q_thermal` per solid/trial. | Uses actual evidence, configured mass convention, water heat-capacity approximation, correct units/sign. | “Use the accepted trial evidence and documented mass convention”; correct operands/unit/sign. | Candidate calculation table. | Calorimetry-model calculation. |
| DA-SOL-02 `M/C` | Calculate the calorimeter heat, `q_cal = C_cal ΔT`, for each solid. | Calculator/notebook. | `DA-CAL-07`; inquiry ΔT. | P: calorimeter correction complete. S: signed `q_cal` per trial. | Uses accepted full-precision constant and trial ΔT. | “Use the accepted calorimeter constant and this trial’s ΔT”; correct scope. | Candidate correction row. | Calorimetry-model calculation. |
| DA-SOL-03 `M/C` | Calculate dissolution heat, `q_dissolution = -(q_thermal + q_cal)`. | Calculator/notebook. | `DA-SOL-01`, `DA-SOL-02`. | P: dissolution energy complete. S: normalized `q_dissolution` stored. | Algebra/sign/unit correct; display explicitly maps to teacher-approved manual labels. | “Combine the thermal and calorimeter terms with the process sign”; revise. | Dissolution-energy row and notation note. | Calorimetry-model calculation; teacher label mapping. |
| DA-SOL-04 `M` | Calculate `ΔH_soln = q_dissolution / n_solute` in kJ/mol for each solid. | Calculator/notebook. | `DA-SOL-03`; actual solute mass and molar mass. | P: molar enthalpy complete. S: full-precision then displayed kJ/mol value stored. | Correct mole conversion, J→kJ, sign, unit, scoped identity. | “Use the actual solute mass, correct molar mass, and kJ/mol conversion”; correct. | Three-solid `ΔH_soln` table. | Generic stoichiometric/calorimetry calculation. |
| DA-CMP-01 `M` | Compare heat behavior, historical cost, safety, and environmental impact for all three solids. | Comparison table/notebook. | `DA-SOL-04`, `INV-C05`, all `INV-S05`. | P: comparison complete. | Every assigned solid has evidence in each criterion; does not substitute current prices. | “Complete every criterion for all three solids”; fill missing evidence. | Multi-criterion comparison. | Generic evidence comparison. |
| DA-SEL-01 `M` | Select the compound for the hand warmer. | Selection/submission. | `DA-CMP-01`; central challenge visible. | P: compound selected. S: selected identity stored. | Selection is one tested solid and is supported later in CER; no hidden single-factor answer. | “Select one tested compound after completing the comparison”; complete/revise. | Selected-compound card. | Experiment-specific decision using generic selection. |
| DA-AMT-01 `M` | Calculate the amount needed for about 50 mL to rise 20 °C, but no more. | Calculator/design submission. | `DA-SEL-01`; accepted selected-solid data/model. | P: design amount calculated. S: required mass/full-precision design result stored. | Uses experimental/calibrated evidence, correct scaling/units, 20 °C constraint, approximately 50 mL target. | “Show the evidence-based scaling and keep the predicted rise at or below 20 °C”; correct formula/value/unit. | Hand-warmer design summary. | Experiment-specific calculation model. |
| CER-01 `M` | State a claim naming the chosen chemical and amount. | CER notebook field. | `DA-SEL-01`, `DA-AMT-01`. | P: claim entered. | Explicit chemical and quantity with unit. | “State both the chosen chemical and amount”; revise. | CER claim section. | Generic CER assessment. |
| CER-02 `M` | Support the claim with experimental, cost, safety, and environmental evidence. | CER evidence field/link accepted records. | `DA-CMP-01`; `CER-01`. | P: evidence entered. | Uses the student’s accepted records for all required factors and distinguishes evidence from claim. | “Cite relevant evidence from every required factor”; add missing support. | CER evidence section. | Generic CER assessment. |
| CER-03 `M` | Explain why the evidence supports this choice over the other two solids. | CER reasoning field; submit. | `CER-01`, `CER-02`. | P: final argument submitted. | Reasoning links evidence to central criteria and addresses nonselected solids; no unsupported answer leak. | “Connect the evidence to the criteria and alternatives”; revise reasoning. | Completed CER/final result. | Generic CER assessment. |

## Required visual-state crosswalk

These are deterministic visual transitions, not additional scientific actions.
Phase 3 must audit whether each state can be layered from existing assets.

| Sequence | Transition and producing action(s) | Required visual result |
| --- | --- | --- |
| Assembly | Initial `CAL-00` | Ring stand and empty support ring; preattachment remains configurable. |
| Assembly | `CAL-01` | Magnetic stirrer beneath the ring, heat off. |
| Assembly | `CAL-02` | Outer cup supported upright and centered. |
| Assembly | `CAL-03` | Second cup visibly nested inside outer cup. |
| Assembly | `CAL-04` | Wooden cover seated on inner cup. |
| Assembly | `CAL-05` | Thermometer through cover hole; no impossible cup contact. |
| Water loading | `P1-01` → `P1-03` | Closed empty calorimeter → open calorimeter. |
| Water loading | `P1-04` → `P1-05` | Open water-filled calorimeter → closed water-filled calorimeter. |
| Stir-bar addition | `P1-10` → `P1-11` → `P1-12` | Closed water setup → open → one stir bar in water → closed. |
| Stirring | `P1-13`–`P1-14` | Bar rotating with non-splashing water; heat remains off. |
| Solid weighing/addition | `P1-19` → `P1-21` → `P1-22`/`P1-23` → `P1-24` | Weighed solid beside calorimeter → access open → complete transfer/empty source → closed reacting solution. |
| Dissolution | `P1-25`–`P1-29` | Live temperature history/peak selection and visible particles transitioning to dissolved solution. |
| Cleanup | `P1-D03` → `P1-D04` → `P1-D07` | Used solution → diluted solution → waste transfer/empty vessel → reset apparatus with records preserved. |
| Calibration heating | `P2-H04` → `P2-H06`–`P2-H09` → `P2-H11` | Water-filled beaker on hot plate → heating near 50 °C → hot beaker on bench. |
| Cool preparation | `P2-C03` → `P2-C04` → `P2-C05` | Clean calorimeter open → cool water inside → covered/probed cool-water state. |
| Initial readings | `P2-M01`–`P2-M08` | Probe may move hot→cool or cool→hot; both notebook records visible before mixing. |
| Hot/cold mixing | `P2-M09` → `P2-M10` → `P2-M11` | Hot beaker + cool calorimeter → open calorimeter → hot-water transfer → covered mixed-water calorimeter. |
| Timed reading | `P2-M12`–`P2-M15` | Timer running → 15 s → mixture readout highlighted → determination row complete. |
| Inquiry execution | `INV-X02`–`INV-X12` | Plan-selected amounts/equipment drive measurement, addition, response, endpoint, disposal, and clean reset without revealing thermal direction. |

## Reconciliation findings

1. The manual says to weigh MgSO₄ “in a plastic cup”; the approved specification
   permits a Dixie cup or weighing boat because both appear in the materials list.
   Treat this as configured equipment, not as an exact manual equivalence.
2. Figure 1 supports the ring stand, support ring, nested cups, wooden cover, probe,
   and stirrer arrangement. It does not explicitly instruct each drag action; those
   are `F/R`, not `M`.
3. The manual explicitly says “highest temperature reached.” Stabilization is used
   only for acquiring initial readings; the Part 1 endpoint must be the actual peak.
4. The manual does not prescribe hot-first or cool-first temperature measurement.
   Both orders are valid and must join only after two sample-identified records exist.
5. The manual says to put on the cover after hot/cold mixing but does not instruct
   post-mixing stirring. No such action is authorized.
6. “Repeat this determination twice” supports but does not conclusively prove three
   total calibration determinations. Keep the count configurable pending confirmation.
7. The manual delegates disposal to the teacher. Only dilution before Part 1 disposal
   and teacher-directed disposal are fixed; recovery/rinsing/drying behavior is configured.
8. The printed dissolution discussion swaps or ambiguously uses `qsoln` and `qrxn`.
   Normalized internal terms prevent silent sign/label errors; teacher-key mapping remains
   unresolved.
9. The investigation requires amounts and starting/ending temperatures but does not
   require equal masses, equal moles, a fixed water volume, a peak/minimum endpoint, or
   a fixed repeat count. Such restrictions cannot be presented as manual requirements.
10. The manual’s postlab questions are documented source content but were not included
    in the approved core process. Adding them requires an explicit scope decision.

## Phase 3 handoff

Audit, in this order:

1. Existing reusable techniques and generic runtime support named in the matrices.
2. Actual equipment definitions and realistic v1 PNG/SVG assets, without inferring
   existence from IDs alone.
3. Required new states, nondestructive derivatives, standalone assets, composites,
   code overlays, and UI-only elements.
4. Update `asset-manifest.json` with verified paths, dimensions, alpha, state coverage,
   provenance, generation status, and QA status.

Do not generate proof assets until that audit identifies the genuinely missing set.
