import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildFamilies, buildReusableTrial, sourceInputs } from './generatorInputs/titration/build.mjs';

const root = 'planning/2026-08-30_lab-studio-technique-composition-remediation';
const lane = `${root}/evidence/lane-07`;
const read = path => JSON.parse(fs.readFileSync(path));
const hash = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const write = (name, value) => fs.writeFileSync(`${lane}/${name}.json`, `${JSON.stringify(value, null, 2)}\n`);
const products = buildFamilies();
const techniques = [...products.map(p=>p.technique),buildReusableTrial()];
const interfaceProducts=[...products,{lab:{id:null},technique:techniques.at(-1)}];
const owners = [...products.flatMap(({lab, technique}) => [`lab:${lab.id}`, `technique:${technique.id}`]), `technique:${techniques.at(-1).id}`];
const ledger = read(`${root}/_CYCLE_STATUS.json`);
const baseline = {
  baselineRevision: ledger.parallelExecution.baselineRevision,
  baselineManifestSha256: ledger.parallelExecution.baselineManifestSha256,
  baselineAggregateSha256: ledger.parallelExecution.baselineAggregateSha256,
  baselineDisposition: 'Historical frozen predecessor; explicit user-authorized shared amendments follow reconciliation commit 055d766.',
  frozenTechniqueAuditSha256: hash(`${root}/TECHNIQUE_ATOMICITY_AUDIT.json`),
  frozenLabAuditSha256: hash(`${root}/LAB_COMPOSITION_AUDIT.json`),
  frozenRegistrySha256: hash('docs/architecture/source-trace-registry.json'),
};
const header = schema => ({schema:`lab-studio/${schema}@1`, lane:'07', ...baseline, owners, validationBoundary:'Source/static evidence only; runtime, browser and detailed tests intentionally not run.'});
const beverage = 'acid-in-fruit-juice-and-soft-drinks_2026-07-27.md';
const redox = 'hydrogen-peroxide-redox-titration_2026-07-27.md';
function provenance(t, a) {
  if(t.id === 'titration-endpoint') return {sourceFile:null, sourceTable:null, step:null, basis:'R/C', rationale:'Disclosed reference scenario; no selected authoritative manual is claimed.'};
  const op = a.parameters.titrationOperation?.replace(/^practice-/, '');
  if(['beverage-ph-volume-titration','ph-volume-titration-trial'].includes(t.id)) {
    let step = 'IQ-01 through IQ-06';
    if(a.id.startsWith('practice-hcl')) step = 'PR-01 through PR-03';
    else if(a.id.startsWith('practice-acetic')) step = 'PR-04';
    else if(a.id.includes('concentration') || a.id.includes('equivalence')) step = 'A-01 through A-03';
    else if(a.id.includes('class') || a.id.includes('postlab')) step = 'A-04';
    else if(op) step = ({'read-initial':'T-03','record-initial':'T-03',deliver:'T-06',mix:'T-07',observe:'T-07','read-ph':a.id.includes('initial')?'T-05':'T-07','record-point':'T-08',decide:'T-09','decide-curve':'T-09','read-final':'T-09','record-final':'T-09','archive-retry':'A-03','select-equivalence':'A-01 through A-02','approve-equivalence':'IQ-06','calculate-curve':'A-01'})[op] ?? 'T-01 through T-09';
    else if(a.atomId) step = a.atomId.includes('indicator')?'T-04':/ring-stand|funnel|burette|tip|rinsate/.test(a.id)?'T-03':a.id.includes('probe')?'T-04':/dispose|rinse/.test(a.id)?'A-03':'T-02';
    return {sourceFile:beverage,sourceTable:'Section 8 procedure phases',step,basis:a.id.includes('rinse')||a.id.includes('dispose')?'R/C':'M/R/C',rationale:'Source operation retained; atomic splitting and supported acetic-acid/phenolphthalein model are C; quantities, prepared-sample protocol, endpoint rule and fixed two-trial classroom plan are disclosed C.'};
  }
  let step = a.id.includes('practice')?'PA-01 through PA-08':a.id.includes('standardization')?'ST-01 through ST-06':a.id.includes('sample')?'HP-01 through HP-04, AN-01 through AN-02':a.id.includes('report')?'PA-08':a.id.includes('approval')||a.id.includes('approve')?'PB-02':'ST-01';
  return {sourceFile:redox,sourceTable:'Section 8 procedure phases',step,basis:/rinse|dispose|purge|tip/.test(a.id)?'R/C':'M/R/C',rationale:'Permanganate/iron/peroxide source chemistry and independent-trial order retained. Atomic decomposition is R; endpoint persistence/window, local waste, modeled unknowns and three/two trial counts are explicit C.'};
}

function reconcileBaseline(r) {
  const t=techniques.find(t=>t.id===r.techniqueId)??products.find(p=>p.lab.id===r.labId)?.technique;
  const patterns={
    'add-approved-indicator-and-probe':/add-indicator|immerse-endpoint-ph-probe/,
    'assemble-burette-setup':/place-ring-stand|mount-burette|position-flask/,
    'calculate-beverage-acid-concentration':/concentration$/,
    'condition-fill-and-read-burette':/condition-burette|fill-burette|initial-burette/,
    'distinguish-endpoint-and-equivalence':/equivalence/,
    'prepare-beverage-as-approved':/beverage-source-boundary/,
    'prepare-quantitative-aliquot':/measure-acid|transfer-acid-flask/,
    'record-approved-run-configuration':/beverage-source-boundary/,
    'record-ph-volume-color-series':/record-point|initial-row/,
    'record-replicate-and-provenance':/equivalence-analysis|compare-class/,
    'acidify-analyte':/acidify-.*-analyte|measure-.*-acid/,
    'calculate-hydrogen-peroxide':/calculate-sample/,
    'deliver-permanganate':/^dispense-.*permanganate(-mix|-observe|-record-point|-decide)?$/,
    'fill-permanganate-burette':/fill-practice-burette|initial-burette-refill/,
    'measure-analyte':/measure-.*-aliquot/,
    'mount-permanganate-burette':/mount-redox-burette/,
    'place-redox-flask':/position-redox-receiver/,
    'read-redox-initial-burette':/^read-.*-initial-burette$/,
    'record-redox-final':/^record-.*-final-burette$/,
    'record-redox-initial':/^record-.*-initial-burette$/,
    'transfer-analyte':/^transfer-.*-aliquot$/,
  };
  const replacementActionIds=t?.actions.filter(a=>a.id===r.actionId||a.id.startsWith(r.actionId+'-')||a.id.endsWith('-'+r.actionId)||patterns[r.actionId]?.test(a.id)).map(a=>a.id)??[];
  return {rowId:r.rowId,replacementActionIds,disposition:replacementActionIds.length?'Reconciled to named current operations; source/static scope only.':'Retired original orchestration; represented by the approved family configuration and source-subset boundary, not claimed as a retained physical operation.',sourceSubsetLimitation:r.actionId==='prepare-beverage-as-approved'?'Prepared samples and degassing remain external instructor-confirmed prerequisites.':null,evaluated:true};
}

const traceRows = techniques.flatMap(t => t.actions.map(a => ({rowId:`technique:${t.id}#${a.id}`,owner:`technique:${t.id}`,actionId:a.id,atomId:a.atomId??null,...provenance(t,a),evaluated:true})));
write('source-trace-overlay', {...header('source-trace-overlay'),rows:traceRows,labLocalActions:products.map(({lab})=>({owner:`lab:${lab.id}`,actionCount:0,disposition:'All procedure actions supplied by one exact-version technique instance; context remains in the lab.'}))});
const registry = new Map(read('src/domain/atomRegistry.json').atoms.map(a=>[a.id,a]));
write('technique-atomicity-overlay', {...header('technique-atomicity-overlay'),rows:techniques.flatMap(t=>t.actions.map(a=>({rowId:`${t.id}@${t.metadata.version}#${a.id}`,techniqueId:t.id,techniqueVersion:t.metadata.version,actionId:a.id,atomId:a.atomId??null,effect: a.atomId?registry.get(a.atomId).effectContract:t.composition.legacyActionEffects.find(e=>e.actionId===a.id).effect,roleBindings:a.equipmentRoleBindings??{},nodeConsumers:t.process.nodes.filter(n=>n.actionId===a.id).map(n=>n.id),decision:a.atomId?'keep: one handler-dispatched bench or evidence operation':'nonphysical: learner/instructor response',prerequisites:{authored:a.prerequisites,attachmentState:a.parameters.requiredAttachmentState??null,assignedSource:a.parameters.sourceInstanceId??null,assignedReceiver:a.parameters.targetInstanceId??null,trial:a.parameters.trialReferenceId??null,operation:a.parameters.titrationOperation??a.verb,model:a.parameters.titrationPreparationModelId??a.parameters.titrationModelId??null},pausePoint:a.label,recoveryBoundary:a.invalidCases,configurationParameters:Object.fromEntries(Object.entries(a.parameters).filter(([,v])=>typeof v==='string'&&v.startsWith('{{config.'))),evidenceBoundary:{declared:a.evidence,acquisition:a.parameters.measurementId??null,calculation:a.parameters.calculationId??null},reviewBoundary:'Static handler/source review; no executed physical or browser validation' ,configurationWitness:'Exact lab bindings plus required teacher setup; default values are static compilation witnesses, not approved classroom prescriptions.',sourceConflict:provenance(t,a).rationale,evaluated:true}))),baselineRows:read(`${root}/TECHNIQUE_ATOMICITY_AUDIT.json`).rows.filter(r=>products.some(p=>p.technique.id===r.techniqueId)).map(reconcileBaseline)});
write('lab-composition-overlay', {...header('lab-composition-overlay'),rows:products.flatMap(({lab,technique:t})=>t.process.nodes.map(n=>({rowId:`${lab.id}#${n.id}`,labId:lab.id,nodeId:n.id,actionId:n.actionId,techniqueId:t.id,techniqueVersion:t.metadata.version,instanceId:'investigation',reachability:'static authored edges; physical predicates listed separately',incoming:t.process.edges.filter(e=>e.to===n.id),outgoing:t.process.edges.filter(e=>e.from===n.id),effect:t.actions.find(a=>a.id===n.actionId)?.atomId??'nonphysical response',evaluated:true}))),baselineRows:read(`${root}/LAB_COMPOSITION_AUDIT.json`).rows.filter(r=>products.some(p=>p.lab.id===r.labId)).map(reconcileBaseline),carriers:[{id:'acid-base-titration-state',disposition:'Equipment merged by concrete identity into explicit lab initialState and role bindings; setup review replaced by executable preparation.'},{id:'beverage-acidity-inquiry-context',disposition:'Inquiry context retained in lab metadata/description and teacher/source-boundary actions; uncalibrated practice and quantitative pH paths now execute separately.'}]});
write('cycle-10-interface', {...header('cycle-10-interface'),techniques:interfaceProducts.map(({lab,technique:t})=>({id:t.id,version:t.metadata.version,catalogDisposition:t.composition.catalogDisposition,labId:lab.id,ports:t.composition.ports,equipmentRoles:t.composition.equipmentRoles,modelSlots:t.composition.modelSlots,configurationSlots:t.composition.configurationSlots,evidenceOutputs:t.composition.evidenceOutputs,completion:t.composition.completion})),integrationRules:['Use the published 3.0.1 ports and explicit bindings. These are complete lab-scoped procedures, not interchangeable legacy fragments.','Cycle 10 consumes ph-volume-titration-trial at 3.0.1 with separate instance scopes, equipment, chemistry-model and configuration bindings; do not extract or copy family procedure code. The supported domain is monoprotic acid with strong-base titrant and approved phenolphthalein thresholds.','The opt-in shared titrationOperation handler supports initial/intermediate pH, separate final acquisition/recording, and explicit decision edges. Other routes retain their prior handler.','Do not infer arbitrary beverage chemistry or physical validation from the illustrative proxy model.']});
console.log(`Documented ${traceRows.length} action rows across ${products.length} exact-version compositions.`);
