import fs from 'node:fs';
const load = name => JSON.parse(fs.readFileSync(new URL(`./${name}-source.json`, import.meta.url)));
const clone = value => structuredClone(value);
const version = '3.0.1';
const atoms = () => new Map(JSON.parse(fs.readFileSync(new URL('../../../src/domain/atomRegistry.json', import.meta.url))).atoms.map(a => [a.id, a]));
export const sourceInputs = () => ({ acid: load('acid-base'), beverage: load('beverage'), redox: load('redox'), endpoint: load('endpoint') });
const feedback = label => ({ success: `${label}: completed.`, invalid: 'Follow the approved method and resolve missing evidence before continuing.' });
export const makeAction = (id, verb, label, parameters = {}, atomId, equipmentRoleBindings) => ({ id, verb, label, parameters, ...(atomId ? {atomId, equipmentRoleBindings} : {}), interaction: {type: 'recordNotebook', successCue: label, invalidCue: 'Resolve this operation before continuing.', accessibleLabel: label}, prerequisites: [], stateChanges: [label], invalidCases: [{id: `${id}-invalid`, when: 'Missing current equipment, approval, or evidence', message: 'This operation is not ready.', recovery: 'Complete the approved prerequisite operation.'}], feedback: feedback(label), evidence: [id] });
const text = (id, label, note, teacher = false) => makeAction(id, 'observe', label, {note, tag: id, inputMode: teacher ? 'choice' : 'text', inputRole: teacher ? 'teacherConfiguration' : 'studentResponse', inputRequired: true, inputLabel: label, ...(teacher ? {inputOptions: ['Teacher approved'], configurationRequired: true, unlocked: false} : {})});
const node = (a,i) => ({id: `${a.id}-node`, type: a.verb === 'calculate' ? 'calculation' : 'action', title:a.label, description:a.parameters.note ?? a.label, actionId:a.id, layout:{x:40,y:60+i*100,lane:'procedure',display:'expanded'},config:{},validation:[{id:`${a.id}-complete`,type:'actionEvidence',label:`${a.label} completed`,actionId:a.id}],hints:[],feedback:{success:a.feedback.success,retry:a.feedback.invalid}});
const edge = (from,to,label='Next') => ({from,to,label,condition:{type:'validationPassed'}});

export function finalizeTechnique(id, title, actions, equipment, models, extraEdges = []) {
  const registry = atoms();
  for (const action of actions) {
    action.prerequisites = [];
    action.interaction ??= {type: action.verb === "calculate" ? "submitCalculation" : "recordNotebook",successCue:action.label,invalidCue:"Complete the current operation.",accessibleLabel:action.label};
    delete action.effect;
    if (action.parameters.expected !== undefined) delete action.parameters.expected;
    if (action.atomId && !action.equipmentRoleBindings) action.equipmentRoleBindings = {};
  }
  const defaults={endpointWindowMl:0.05,persistenceSeconds:5,maximumIncrementMl:1,indicatorVolumeMl:0.1,wasteProtocol:'Instructor-defined waste route required before running',preparationProtocol:'Instructor-defined sample/indicator/probe protocol required before running',...(id==='beverage-ph-volume-titration'?{beverageAliquotMl:10}:{})};
  for(const a of actions){
    const p=a.parameters;
    for(const key of ['endpointWindowMl','persistenceSeconds','maximumIncrementMl'])if(typeof p[key]==='number')p[key]=`{{config.${key}}}`;
    if(p.titrationOperation==='deliver')p.inputMax='{{config.maximumIncrementMl}}';
    if(a.atomId?.includes('indicator')&&a.verb==='transfer')p.volumeMl='{{config.indicatorVolumeMl}}';
    if(id==='beverage-ph-volume-titration'&&/beverage-.*-(measure-acid|transfer-acid-flask)$/.test(a.id))p.volumeMl='{{config.beverageAliquotMl}}';
    if(p.titrationOperation)p.wasteProtocol='{{config.wasteProtocol}}';
    if(a.id.includes('approve')||a.id==='beverage-source-boundary')p.preparationProtocol='{{config.preparationProtocol}}';
    if(a.interaction.type==='submitCalculation'){
      const trial=actions.find(x=>x.parameters.titrationOperation==='record-final' && x.parameters.measurementId===p.finalBuretteMeasurementId);
      if(trial)p.trialReferenceId=trial.parameters.trialReferenceId;
    }
  }
  const nodes = actions.map(node);
  for(const n of nodes) {
    const a=actions.find(a=>a.id===n.actionId);
    if(a.verb==='calculate' && !a.parameters.titrationOperation) n.validation=[{id:`${a.id}-calculation-valid`,type:'calculationWithinTolerance',label:'Calculation matches this trial\'s recorded evidence.',calculationId:a.parameters.calculationId,tolerance:a.parameters.tolerance??0}];
  }
  const technique = {id,title,learningGoal:'Perform source-bound titration with independent operations and trial evidence.',requiredEquipment:[...new Set(equipment.map(e=>e.definitionId))],initialState:{equipment:clone(equipment)},actions,process:{startNodeId:nodes[0].id,nodes,edges:[...nodes.slice(1).map((n,i)=>edge(nodes[i].id,n.id)),...extraEdges]},successCriteria:[],commonMistakes:[],resetBehavior:'resetTechnique',metadata:{version,author:'Lab Studio',updatedAt:'2026-09-05T00:00:00.000Z',tags:['technique','titration','composition']},titrationModels:clone(models)};
  const roles = new Map();
  for (const a of actions) for (const [role,def] of Object.entries(a.equipmentRoleBindings??{})) {if(!roles.has(role))roles.set(role,new Set());roles.get(role).add(def);}
  const ports=[{id:'entry',kind:'entry',nodeId:nodes[0].id,label:'Prepare approved investigation'},{id:'exit',kind:'exit',nodeId:nodes.at(-1).id,label:'Evidence and cleanup complete'}];
  technique.composition={schemaVersion:1,ports,equipmentRoles:[...roles].map(([role,defs])=>({roleId:role,required:true,allowedDefinitionIds:[...defs],sourceInstanceIds:equipment.filter(e=>defs.has(e.definitionId)).map(e=>e.id)})),modelSlots:models.map(m=>({id:m.id,kind:'titration',sourceModelId:m.id,required:true})),configurationSlots:Object.entries(defaults).map(([id,value])=>({id,required:true,valueType:typeof value,defaultValue:value})),approvalGates:[],variants:[],evidenceOutputs:[],completion:{exitPortIds:['exit'],requiredEvidenceOutputIds:[],requiredValidationRuleIds:[]},catalogDisposition:'lab-scoped',legacyActionEffects:actions.filter(a=>!a.atomId).map(a=>({actionId:a.id,effect:a.interaction.type==='submitCalculation'?{classes:['calculation-analysis'],targets:[{domain:'analysis'},{domain:'evidence'}]}:{classes:['evidence-recording'],targets:[{domain:'evidence'}]}}))};
  for(const a of actions) if(a.atomId && !registry.has(a.atomId)) throw Error(`Missing atom ${a.atomId}`);
  return technique;
}

export function composeLab(source, technique) {
  const lab=clone(source);
  lab.initialState=clone(technique.initialState);lab.equipment=clone(technique.requiredEquipment);lab.titrationModels=clone(technique.titrationModels);
  lab.actions=[];lab.techniques=[];delete lab.techniqueRefs;lab.process={startNodeId:technique.process.startNodeId,nodes:[],edges:[]};lab.assessments=[];
  const bindings={equipment:{},models:Object.fromEntries(technique.composition.modelSlots.map(s=>[s.id,s.sourceModelId])),configuration:Object.fromEntries(technique.composition.configurationSlots.map(s=>[s.id,s.defaultValue]))};
  for(const role of technique.composition.equipmentRoles) bindings.equipment[role.roleId]={sourceInstances:role.sourceInstanceIds.map(id=>({sourceInstanceId:id,definitionId:lab.initialState.equipment.find(e=>e.id===id).definitionId,instanceId:id}))};
  // Preserve already-public action/node/evidence identities for this single family instance.
  const refs=new Set(); const collect=(v,k='')=>{if(Array.isArray(v))v.forEach(x=>collect(x,k));else if(v&&typeof v==='object')Object.entries(v).forEach(([key,x])=>collect(x,key));else if(typeof v==='string' && !v.startsWith('{{config.') && (/MeasurementIds?$|CalculationIds?$|ReferenceIds?$|OutputIds?$|ProgressIds?$|EvidenceId$|EvidenceScopeId$|NotebookTag$|DataSeriesIds?$/i.test(k)||['sourceMeasurements','timeMeasurements','measuredComponentMassIds','tareMassIds','repeatGroupId','nextScopeId','pairId','systemId'].includes(k)))refs.add(v);};collect(technique.actions);
  lab.techniqueInstances=[{instanceId:'investigation',techniqueId:technique.id,version:technique.metadata?.version ?? version,bindings,preserveIds:{actions:Object.fromEntries(technique.actions.map(a=>[a.id,a.id])),nodes:Object.fromEntries(technique.process.nodes.map(n=>[n.id,n.id])),references:Object.fromEntries([...refs].map(r=>[r,r]))}}];
  lab.compositionStart={kind:'technique-port',instanceId:'investigation',portId:'entry'};lab.compositionConnections=[];lab.reachabilityWitnesses=[{id:'default',configuration:{},approvalGates:{}}];
  lab.metadata={...lab.metadata,version,updatedAt:'2026-09-05T00:00:00.000Z'};
  return lab;
}

function addTrial(actions, dispense, equipment, {ph=false, initialId, aliquotId, initialReadId, finalRecordId, restartId}={}) {
  const p=dispense.parameters;
  const prefix=dispense.id;
  const burette=equipment.find(e=>e.definitionId==='burette-50ml');
  const flask=equipment.find(e=>e.definitionId==='erlenmeyer-flask-250ml');
  const meter=equipment.find(e=>e.definitionId==='ph-meter');
  const common={sourceDefinitionId:burette.definitionId,targetDefinitionId:flask.definitionId,trialReferenceId:prefix,buretteInstanceId:burette.id,receiverInstanceId:flask.id,titrationModelId:p.titrationModelId,aliquotMeasurementId:aliquotId,initialMeasurementId:initialId,finalMeasurementId:p.finalBuretteMeasurementId,endpointWindowMl:0.05,maximumIncrementMl:1,maximumDeliveryMl:p.practiceAllocationMl??45,persistenceSeconds:5,requirePh:ph, ...(meter?{meterInstanceId:meter.id,readinessNotebookTag:'ph-meter-ready'}:{})};
  const op=(id,operation,label,extra={})=>{const verbs={'read-initial':'observe','record-initial':'record',deliver:'transfer',mix:'mix',observe:'observe','read-ph':'observe','record-point':'record',decide:'observe','decide-curve':'observe','read-final':'observe','record-final':'record','archive-retry':'observe'};const verb=verbs[operation];return makeAction(id,verb,label,{...common,titrationOperation:operation,...extra},`atom.${verb}.titration-${operation}`,{'titrant-delivery-device':burette.definitionId,'analyte-receiver':flask.definitionId});};
  const read=actions.find(a=>a.id===initialReadId);Object.assign(read,op(read.id,'read-initial',read.label,{measurementId:initialId}));
  const record=actions.find(a=>a.parameters.measurementId===initialId&&a.verb==='record');if(record)Object.assign(record,op(record.id,'record-initial',record.label,{measurementId:initialId}));
  const final=actions.find(a=>a.id===finalRecordId);Object.assign(final,op(final.id,'record-final',final.label,{measurementId:p.finalBuretteMeasurementId}));
  const start=actions.findIndex(a=>a.id===dispense.id);
  const sequence=[op(prefix,'deliver','Deliver one student-selected titrant increment',{inputMode:'numeric',inputRole:'studentResponse',inputRequired:true,inputMin:0,inputMinExclusive:true,inputMax:1,inputStep:0.01,inputLabel:'Addition in mL (smaller drops near endpoint)'}),op(`${prefix}-mix`,'mix','Mix the current addition'),op(`${prefix}-observe`,'observe','Observe the mixed solution')];
  if(ph)sequence.push(op(`${prefix}-read-ph`,'read-ph','Read the pH of this mixed addition',{measurementId:`${prefix}-ph`}));
  sequence.push(op(`${prefix}-record-point`,'record-point','Record this addition and observation'));
  const decide=op(`${prefix}-decide`,'decide','Decide whether to continue, accept, or restart',{inputMode:'choice',inputRole:'studentResponse',inputRequired:true,inputLabel:'Titration decision',inputOptions:['Continue delivery','Accept endpoint','Dispose and restart trial'],continueNodeId:`${prefix}-node`,retryNodeId:`${prefix}-retry-dispose-node`});
  sequence.push(decide);
  decide.parameters.loopNodeIds=sequence.map(a=>`${a.id}-node`);
  sequence.push(op(`${prefix}-read-final`,'read-final','Read the final burette level',{measurementId:p.finalBuretteMeasurementId}));
  actions.splice(start,1,...sequence);
  const waste=equipment.find(e=>e.definitionId==='waste-beaker');
  const discardTemplate=sourceInputs().redox.actions.find(a=>a.id==='discard-practice-mixture');
  const discard=clone(discardTemplate);discard.id=`${prefix}-retry-dispose`;discard.label='Dispose of the rejected trial by the approved route';discard.parameters={...discard.parameters,sourceInstanceId:flask.id,targetInstanceId:waste.id};
  const archive=op(`${prefix}-retry-reset`,'archive-retry','Reset only the rejected trial evidence',{restartNodeId:`${restartId}-node`});
  const retryNodes=[discard,archive];
  return {prefix,sequence,retryNodes,archive,edges:[edge(`${prefix}-decide-node`,`${prefix}-node`,'Continue'),edge(`${prefix}-decide-node`,`${prefix}-retry-dispose-node`,'Reject and prepare fresh trial'),edge(`${prefix}-retry-dispose-node`,`${prefix}-retry-reset-node`),edge(`${prefix}-retry-reset-node`,`${restartId}-node`,'Fresh trial')]};
}

export function buildFamilies() {
  const seeds=sourceInputs();
  const acid=clone(seeds.acid); const redox=clone(seeds.redox);
  const acidActions=clone(seeds.endpoint.actions);
  // The embedded carrier is data only: preserve its material state through explicit lab state.
  const initial=new Map([...seeds.endpoint.initialState.equipment,...(acid.techniques??[]).flatMap(t=>t.initialState?.equipment??[]),...(acid.initialState?.equipment??[])].map(e=>[e.id,e]));
  acid.initialState={equipment:[...initial.values()]};
  acidActions.unshift(text('approve-reference-configuration','Approve the reference scenario and disposal route','R/C reference exercise: 25 mL weak acetic-acid model, 0.100 M NaOH, phenolphthalein. Confirm the endpoint window, persistence, increment limit, instrument protocol, and waste route entered in teacher setup. These are simulation configuration, not a manual prescription.',true));
  const finalIndex=acidActions.findIndex(a=>a.id==='record-final-burette');
  acidActions.splice(finalIndex,0,...clone(acid.actions));
  acidActions.forEach(a=>{if(a.id==='confirm-endpoint')a.parameters.note='Describe the accepted endpoint color without treating it as a pH measurement.';});
  const acidTrial=addTrial(acidActions,acidActions.find(a=>a.id==='deliver-titrant'),acid.initialState.equipment,{initialId:'burette-initial-volume',aliquotId:'acid-aliquot-volume',initialReadId:'read-initial-burette',finalRecordId:'record-final-burette',restartId:'seat-burette-funnel'});
  const acceptedPh=acidActions.find(a=>a.id==='read-endpoint-ph');Object.assign(acceptedPh,clone(acidTrial.sequence.find(a=>a.parameters.titrationOperation==='observe')),{id:'read-endpoint-ph',label:'Read accepted-endpoint pH',atomId:'atom.observe.titration-read-ph',parameters:{...acidTrial.sequence[0].parameters,titrationOperation:'read-ph',measurementId:'endpoint-ph',meterInstanceId:acid.initialState.equipment.find(e=>e.definitionId==='ph-meter').id,readinessNotebookTag:'ph-meter-ready'}});delete acceptedPh.parameters.inputMode;delete acceptedPh.parameters.inputRequired;
  acidActions.find(a=>a.id==='immerse-endpoint-ph-probe').parameters.trialReferenceId='deliver-titrant';
  const dispose=clone(seeds.redox.actions.find(a=>a.id==='discard-practice-mixture'));dispose.id='dispose-reference-mixture';dispose.label='Dispose of the reference titration mixture by the approved route';delete dispose.parameters.note;acidActions.push(dispose);
  const products=[];
  function finish(lab,id,title,actions,trials) {
    const tail=actions.at(-1).id;
    const extra=[];
    for(const trial of trials){const start=actions.findIndex(a=>a.id===trial.archive.parameters.restartNodeId.replace(/-node$/,''));const end=actions.findIndex(a=>a.id===`${trial.prefix}-decide`);trial.archive.parameters.trialNodeIds=[...actions.slice(start,end+1),...trial.retryNodes].map(a=>`${a.id}-node`);actions.push(...trial.retryNodes);extra.push(...trial.edges);}
    const t=finalizeTechnique(id,title,actions,lab.initialState.equipment,lab.titrationModels,extra);
    // Retry islands are reachable only through explicit retry edges; normal completion skips them.
    const retryIds=new Set(trials.flatMap(t=>t.retryNodes.map(a=>`${a.id}-node`)));
    t.process.edges=t.process.edges.filter(e=>!retryIds.has(e.from)&&!retryIds.has(e.to)).concat(extra);
    t.composition.ports.find(p=>p.id==='exit').nodeId=`${tail}-node`;
    const composed=composeLab(lab,t);products.push({lab:composed,technique:t});
  }
  finish(acid,'titration-endpoint','Acid-base endpoint and pH procedure',acidActions,[acidTrial]);
  const redoxActions=clone(redox.actions);
  // Mandatory physical receiver positioning was absent from the old local procedure.
  const receiver=clone(seeds.endpoint.actions.find(a=>a.id==='position-flask-under-burette'));receiver.id='position-redox-receiver';redoxActions.splice(4,0,receiver);
  redoxActions.unshift(text('approve-redox-configuration','Approve the configured redox scenario','C simulation settings: three standardization and two trials for each assigned peroxide sample. Confirm the aliquot plan and the endpoint window, persistence, increment limit, and waste protocol entered in teacher setup. All standardization must precede both sample analyses.',true));
  const trials=[];
  for(const dispense of [...redoxActions].filter(a=>a.interaction?.type==='dispenseDrops')){
    const p=dispense.parameters, stem=dispense.id.replace(/^dispense-/,'').replace(/-permanganate$/,'');
    const aliquot=redoxActions.find(a=>a.id===`measure-${stem}-aliquot`);
    const aliquotTransfer=redoxActions.find(a=>a.id===`transfer-${stem}-aliquot`);
    aliquotTransfer.volume={source:'measurement',referenceId:aliquot.parameters.measurementId};
    for(const key of Object.keys(aliquotTransfer.parameters))if(key.startsWith('input')||['volumeMl','configurationParameter'].includes(key))delete aliquotTransfer.parameters[key];
    // Remove fixed acid-volume records; each acidification now acquires its actual transferred amount.
    const acidify=redoxActions.find(a=>a.id===`acidify-${stem}-analyte`);
    const measureAcid=clone(aliquot);measureAcid.id=`measure-${stem}-acid`;measureAcid.label='Measure the approved acidification volume';measureAcid.parameters={...acidify.parameters,targetDefinitionId:'graduated-pipette-10ml',measurementId:`${stem}-acid-volume`,inputRequired:true};measureAcid.atomId='atom.measure.variable-volume';measureAcid.equipmentRoleBindings=clone(aliquot.equipmentRoleBindings);measureAcid.interaction=clone(aliquot.interaction);
    redoxActions.splice(redoxActions.indexOf(acidify),0,measureAcid);
    acidify.volume={source:'measurement',referenceId:`${stem}-acid-volume`};acidify.parameters={sourceDefinitionId:'graduated-pipette-10ml',targetDefinitionId:'erlenmeyer-flask-250ml'};acidify.atomId='atom.transfer.measured-liquid';acidify.equipmentRoleBindings=clone(redoxActions.find(a=>a.id===`transfer-${stem}-aliquot`).equipmentRoleBindings);acidify.interaction=clone(redoxActions.find(a=>a.id===`transfer-${stem}-aliquot`).interaction);
    const acidRecord=redoxActions.find(a=>a.id===`record-${stem}-acid-volume`);delete acidRecord.parameters.value;acidRecord.parameters.copyExistingMeasurementOnly=true;
    measureAcid.equipmentRoleBindings={'variable-volume-measuring-device':'graduated-pipette-10ml','liquid-source':'reagent-bottle'};
    measureAcid.interaction={...measureAcid.interaction,sourceDefinitionId:'reagent-bottle',targetDefinitionId:'graduated-pipette-10ml',accessibleLabel:'Measure the approved sulfuric-acid volume with the graduated pipette.'};
    measureAcid.stateChanges=['The approved acid volume is measured; transfer into the analyte remains separate.'];
    aliquot.parameters.inputRequired=true;
    if(!stem.startsWith('sample-')) {
      // The single 10 mL pipette cannot represent the full source 5–15 mL practice range.
      aliquot.parameters.targetDefinitionId='graduated-cylinder';
      aliquot.equipmentRoleBindings['variable-volume-measuring-device']='graduated-cylinder';
      aliquot.interaction.targetDefinitionId='graduated-cylinder';
      aliquot.interaction.accessibleLabel='Measure the approved fresh iron aliquot in the graduated cylinder.';
      aliquot.interaction.invalidCue='Use the assigned iron standard and measuring cylinder.';
      aliquotTransfer.parameters.sourceDefinitionId='graduated-cylinder';
      aliquotTransfer.interaction.sourceDefinitionId='graduated-cylinder';
      for(const role of Object.keys(aliquotTransfer.equipmentRoleBindings))if(aliquotTransfer.equipmentRoleBindings[role]==='graduated-pipette-10ml')aliquotTransfer.equipmentRoleBindings[role]='graduated-cylinder';
    }
    trials.push(addTrial(redoxActions,dispense,redox.initialState.equipment,{initialId:p.initialBuretteMeasurementId,aliquotId:aliquot.parameters.measurementId,initialReadId:`read-${stem}-initial-burette`,finalRecordId:`record-${stem}-final-burette`,restartId:`measure-${stem}-aliquot`}));
  }
  finish(redox,'redox-titration','Approved permanganate standardization and peroxide investigation',redoxActions,trials);
  products.push(buildBeverage(seeds));
  return products.map(enhancePreparation).map(refineReviewedFamily);
}

/** One canonical trial, generated from the same reviewed subflow used by beverage trials. */
export function buildReusableTrial() {
  const family=buildFamilies().find(p=>p.lab.id==='beverage-acidity');
  const source=family.technique;
  const prefix='beverage-a-sample-trial-1-';
  const actions=clone(source.actions.filter(a=>a.id.startsWith(prefix)));
  const referenced=new Set();
  for(const a of actions)for(const [key,value]of Object.entries(a.parameters))if(key.endsWith('InstanceId')&&typeof value==='string')referenced.add(value);
  const equipment=source.initialState.equipment.filter(e=>referenced.has(e.id));
  const models=source.titrationModels.filter(m=>m.id==='beverage-a-sample');
  const t=finalizeTechnique('ph-volume-titration-trial','Single acid-base pH-volume titration trial',actions,equipment,models);
  const nodes=new Set(t.process.nodes.map(n=>n.id));
  t.process.edges=clone(source.process.edges.filter(e=>nodes.has(e.from)&&nodes.has(e.to)));
  t.process.startNodeId=`${prefix}place-ring-stand-node`;
  t.composition.ports=[{id:'entry',kind:'entry',nodeId:t.process.startNodeId,label:'Prepare one approved fresh trial'}, {id:'exit',kind:'exit',nodeId:`${prefix}dispose-discard-rinse-node`,label:'Recorded curve, approved inference, calculation and cleanup'}];
  t.composition.catalogDisposition='composable';
  t.composition.configurationSlots=clone(source.composition.configurationSlots);
  t.composition.evidenceOutputs=clone(source.composition.evidenceOutputs.filter(e=>actions.some(a=>a.id===e.actionId)));
  t.composition.completion={exitPortIds:['exit'],requiredEvidenceOutputIds:t.composition.evidenceOutputs.map(e=>e.id),requiredValidationRuleIds:[]};
  return t;
}

/**
 * Indicator-free formal pH-volume trial for the three Investigation 14 context identities.
 *
 * This is complementary to ph-volume-titration-trial@3.0.1. The reviewed Cycle 07 trial and its
 * consumers remain byte-stable; only this definition opts into recorded-curve stability handling.
 */
export function buildFormalPhVolumeTrial() {
  const source = buildReusableTrial();
  const excluded = [
    '-add-indicator',
    '-deliver-titrant-post',
    '-deliver-titrant-mix-post',
    '-deliver-titrant-observe-post',
    '-deliver-titrant-read-ph-post',
    '-deliver-titrant-record-point-post',
    '-finish-curve',
    '-concentration-select-equivalence',
    '-concentration-justify-equivalence',
    '-concentration-approve-equivalence',
    '-concentration',
    '-equivalence-analysis',
  ];
  const keepAction = action => !excluded.some(suffix => action.id.endsWith(suffix));
  const rewriteString = value => value
    .replaceAll('beverage-a-sample-trial-1', 'formal-trial')
    .replaceAll('beverage-a-sample', 'formal-analyte-stock')
    .replaceAll('quantitative-naoh-010', 'formal-titrant-stock')
    .replaceAll('quantitative-pipette', 'formal-aliquot-cylinder')
    .replaceAll('beverage-flask', 'formal-receiver')
    .replaceAll('beverage-burette', 'formal-burette')
    .replaceAll('beverage-ring-stand', 'formal-ring-stand')
    .replaceAll('beverage-ph-meter', 'formal-ph-meter')
    .replaceAll('rinse-wash-bottle', 'formal-rinse-water')
    .replaceAll('teacher-directed-waste', 'formal-waste')
    .replaceAll('funnel-1', 'formal-funnel')
    .replaceAll('measure-acid', 'measure-analyte')
    .replaceAll('transfer-acid-flask', 'transfer-analyte-to-receiver')
    .replaceAll('acid-aliquot-volume', 'analyte-aliquot-volume')
    .replaceAll('initial-color', 'inspect-prepared-analyte')
    .replaceAll('config.beverageAliquotMl', 'config.aliquotMl')
    .replaceAll('graduated-pipette-10ml', 'graduated-cylinder-25ml')
    .replaceAll('naoh-bottle', 'reagent-bottle')
    .replaceAll('Beverage', 'Formal-trial')
    .replaceAll('beverage', 'formal-trial')
    .replaceAll('NaOH', 'configured titrant')
    .replaceAll('standard sodium hydroxide', 'configured titrant')
    .replaceAll('unknown acid', 'configured analyte')
    .replaceAll('Unknown acid', 'Configured analyte')
    .replaceAll('unknown-acid', 'configured-analyte')
    .replaceAll('Acid aliquot', 'Analyte aliquot')
    .replaceAll('acid aliquot', 'analyte aliquot')
    .replaceAll('the measured acid', 'the measured analyte')
    .replaceAll('measured acid', 'measured analyte')
    .replaceAll('the acid this step measures', 'the configured analyte this step measures')
    .replaceAll('the acid into', 'the configured analyte into')
    .replaceAll('the acid before', 'the configured analyte before')
    .replaceAll('Add indicator to the analyte before positioning the flask for titration.', 'Position the prepared indicator-free receiver beneath the burette.')
    .replaceAll('endpoint colour', 'pH-volume evidence')
    .replaceAll('endpoint color', 'pH-volume evidence');
  const rewrite = value => typeof value === 'string' ? rewriteString(value)
    : Array.isArray(value) ? value.map(rewrite)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]))
      : value;
  const actions = rewrite(source.actions.filter(keepAction));
  const equipment = rewrite(source.initialState.equipment.filter(item => item.definitionId !== 'phenolphthalein-dropper'));
  const byId = new Map(equipment.map(item => [item.id, item]));
  Object.assign(byId.get('formal-analyte-stock'), {
    label: 'Configured formal-trial analyte',
    contents: {
      kind: 'solution',
      label: 'Configured formal-trial analyte; identity is supplied by the selected context model',
      volumeMl: 125,
      concentration: {value: 0.1, unit: 'M'},
      solutes: [], contamination: [], wetState: 'wet', visualState: 'clear-solution',
    },
  });
  Object.assign(byId.get('formal-titrant-stock'), {
    label: 'Configured formal-trial titrant',
    contents: {
      kind: 'solution',
      label: 'Configured formal-trial titrant; identity is supplied by the selected context model',
      volumeMl: 250,
      concentration: {value: 0.1, unit: 'M'},
      solutes: [], contamination: [], wetState: 'wet', visualState: 'clear-solution',
    },
  });
  Object.assign(byId.get('formal-aliquot-cylinder'), {
    label: '25 mL graduated cylinder for the configured 10-25 mL aliquot',
  });
  Object.assign(byId.get('formal-receiver'), {label: 'Indicator-free formal titration receiver'});
  Object.assign(byId.get('formal-burette'), {label: 'Formal-trial titrant burette'});

  // Keep each Cycle 10 combination bound to an exact model identity. The selected
  // composition instance supplies `titrationModelId`; the runtime still checks that
  // the bound model matches its selected formalContextId before any evidence is accepted.
  const models = [
    {
      id: 'formal-strong-acid-strong-base-model',
      type: 'acidBase',
      analyte: {formula: 'HCl', role: 'acid', strength: 'strong'},
      titrant: {formula: 'NaOH', role: 'base', strength: 'strong'},
      analyteMolarityM: 0.1,
      analyteVolumeMl: 25,
      titrantMolarityM: 0.1,
      stoichiometricRatio: {analyte: 1, titrant: 1},
      dropVolumeMl: 0.05,
      endpointOffsetDrops: 0,
      maxExtraDrops: 0,
      temperatureC: 25,
      waterIonProduct: 1e-14,
      phPrecision: 2,
    },
    {
      id: 'formal-weak-acid-strong-base-model',
      type: 'acidBase',
      analyte: {formula: 'CH3COOH', role: 'acid', strength: 'weak', equilibriumConstant: 0.000018},
      titrant: {formula: 'NaOH', role: 'base', strength: 'strong'},
      analyteMolarityM: 0.08,
      analyteVolumeMl: 25,
      titrantMolarityM: 0.1,
      stoichiometricRatio: {analyte: 1, titrant: 1},
      dropVolumeMl: 0.05,
      endpointOffsetDrops: 0,
      maxExtraDrops: 0,
      temperatureC: 25,
      waterIonProduct: 1e-14,
      phPrecision: 2,
    },
    {
      id: 'formal-weak-base-strong-acid-model',
      type: 'acidBase',
      analyte: {formula: 'NH3', role: 'base', strength: 'weak', equilibriumConstant: 0.000018},
      titrant: {formula: 'HCl', role: 'acid', strength: 'strong'},
      analyteMolarityM: 0.075,
      analyteVolumeMl: 25,
      titrantMolarityM: 0.1,
      stoichiometricRatio: {analyte: 1, titrant: 1},
      dropVolumeMl: 0.05,
      endpointOffsetDrops: 0,
      maxExtraDrops: 0,
      temperatureC: 25,
      waterIonProduct: 1e-14,
      phPrecision: 2,
    },
  ];

  for (const action of actions) {
    const p = action.parameters;
    if (p.titrationModelId) {
      // Keep the ordinary identity concrete for standalone-definition validation. A composed
      // formal instance overrides it through the explicit context-model binding below.
      p.titrationModelId = 'formal-strong-acid-strong-base-model';
    }
    for (const key of ['endpointWindowMl', 'persistenceSeconds', 'indicatorStartPh', 'indicatorStrongPh']) delete p[key];
    if (p.titrationOperation) {
      Object.assign(p, {
        endpointEvidenceMode: 'recorded-ph-curve-stability',
        formalContextId: '{{config.contextId}}',
        formalContextModelId: '{{config.formalContextModelId}}',
        indicatorPolicy: '{{config.indicatorPolicy}}',
        minimumAliquotMl: 10,
        maximumAliquotMl: 25,
        minimumIncrementMl: 0.1,
        maximumIncrementMl: '{{config.maximumIncrementMl}}',
        maximumDeliveryMl: '{{config.maximumDeliveryMl}}',
        stabilityDeltaPh: '{{config.stabilityDeltaPh}}',
        stabilityConsecutiveReadings: '{{config.stabilityConsecutiveReadings}}',
        minimumPostSteepRegionMl: '{{config.minimumPostSteepRegionMl}}',
      });
    }
    if (action.id === 'formal-trial-measure-analyte') {
      action.label = 'Measure the configured formal-trial analyte aliquot';
      p.volumeMl = '{{config.aliquotMl}}';
      action.equipmentRoleBindings = {
        'liquid-source': 'sample-bottle',
        'variable-volume-measuring-device': 'graduated-cylinder-25ml',
      };
    }
    if (action.id === 'formal-trial-transfer-analyte-to-receiver') {
      action.label = 'Transfer the measured analyte aliquot to the trial receiver';
      p.volumeMl = '{{config.aliquotMl}}';
      action.equipmentRoleBindings = {
        'measured-solvent-source': 'graduated-cylinder-25ml',
        'receiving-vessel': 'erlenmeyer-flask-250ml',
      };
    }
    if (action.id === 'formal-trial-probe-ready') {
      p.note = 'Confirm the configured probe calibration, rinse, immersion, and reading-stability rules before the indicator-free formal trial.';
      p.inputLabel = 'Confirm indicator-free formal-trial pH meter readiness';
    }
    if (action.id === 'formal-trial-inspect-prepared-analyte') {
      action.label = 'Observe the prepared analyte without indicator';
    }
    if (action.id === 'formal-trial-initial-ph') action.label = 'Read initial pH at zero titrant addition';
    if (action.id === 'formal-trial-initial-row') action.label = 'Record the initial pH-volume row';
    if (action.id === 'formal-trial-deliver-titrant-observe') action.label = 'Observe the mixed solution without indicator';
    if (action.id === 'formal-trial-deliver-titrant-record-point') action.label = 'Record this titrant-volume and pH point';
    if (action.id === 'formal-trial-deliver-titrant-decide') {
      action.label = 'Continue, finish after curve-stability review, or restart';
      p.titrationOperation = 'decide-curve';
      action.atomId = 'atom.observe.titration-decide-curve';
      p.inputRole = 'teacherConfiguration';
      p.inputLabel = 'Formal curve decision from recorded pH-volume evidence';
      p.inputOptions = ['Continue delivery', 'Finish after stability review', 'Dispose and restart trial'];
    }
    if (/-dispose(?:-discard-rinse)?$/.test(action.id) || action.id.endsWith('-retry-dispose')) {
      if (typeof p.note === 'string') p.note = 'Use only the configured acid-base waste route for the selected formal context.';
      action.label = action.id.includes('retry')
        ? 'Dispose of the rejected formal trial by the configured route'
        : action.id.endsWith('discard-rinse')
          ? 'Transfer formal-trial rinsate to the configured waste receiver'
          : 'Dispose of the completed formal trial by the configured route';
    }
    for (const field of ['label', 'stateChanges', 'invalidCases', 'feedback', 'interaction']) {
      action[field] = rewrite(action[field]);
    }
    if (Array.isArray(p.trialNodeIds)) p.trialNodeIds = p.trialNodeIds.filter(nodeId => !excluded.some(suffix => nodeId.includes(`${suffix}-node`)));
  }

  const t = finalizeTechnique(
    'ph-volume-formal-titration-trial',
    'Indicator-free formal pH-volume titration trial',
    actions,
    equipment,
    models,
  );
  const retainedNodes = new Set(t.process.nodes.map(item => item.id));
  t.process.edges = rewrite(source.process.edges)
    .filter(connection => retainedNodes.has(connection.from) && retainedNodes.has(connection.to));
  // Removing the indicator action removes the source graph's only bridge into the
  // measurement apparatus; keep the authored preparation sequence connected.
  t.process.edges.push(edge(
    'formal-trial-transfer-analyte-to-receiver-node',
    'formal-trial-position-flask-under-burette-node',
    'Position the indicator-free receiver beneath the burette',
  ));
  const finalRecordNode = 'formal-trial-record-final-burette-node';
  const disposalNode = 'formal-trial-dispose-node';
  t.process.edges.push(edge(finalRecordNode, disposalNode, 'Dispose only after preserving the completed curve evidence'));
  const decisionEdge = t.process.edges.find(connection => connection.from === 'formal-trial-deliver-titrant-decide-node' && connection.to === 'formal-trial-deliver-titrant-read-final-node');
  if (decisionEdge) decisionEdge.label = 'Finish after stability review';
  t.metadata = {
    ...t.metadata,
    version: '1.0.0',
    updatedAt: '2026-09-06T00:00:00.000Z',
    tags: ['technique', 'titration', 'composition', 'indicator-free', 'formal-trial'],
  };
  t.learningGoal = 'Acquire an indicator-free pH-volume curve for one configured acid/base orientation, preserve the recorded stability evidence, and clean up without selecting or disclosing an equivalence answer.';
  t.resetBehavior = 'resetTechnique';
  t.composition.ports = [
    {id: 'entry', kind: 'entry', nodeId: t.process.startNodeId, label: 'Prepare one configured indicator-free formal trial'},
    {id: 'exit', kind: 'exit', nodeId: 'formal-trial-dispose-discard-rinse-node', label: 'Recorded curve and configured cleanup complete'},
  ];
  t.composition.configurationSlots = [
    {id: 'contextId', required: true, valueType: 'string', allowedValues: ['strong-acid-strong-base', 'weak-acid-strong-base', 'weak-base-strong-acid'], defaultValue: 'strong-acid-strong-base'},
    {id: 'formalContextModelId', required: true, valueType: 'string', allowedValues: models.map(model => model.id), defaultValue: 'formal-strong-acid-strong-base-model'},
    {id: 'aliquotMl', required: true, valueType: 'number', defaultValue: 25},
    {id: 'maximumIncrementMl', required: true, valueType: 'number', defaultValue: 5},
    {id: 'maximumDeliveryMl', required: true, valueType: 'number', defaultValue: 50},
    {id: 'stabilityDeltaPh', required: true, valueType: 'number', defaultValue: 0.12},
    {id: 'stabilityConsecutiveReadings', required: true, valueType: 'number', defaultValue: 2},
    {id: 'minimumPostSteepRegionMl', required: true, valueType: 'number', defaultValue: 6},
    {id: 'conditioningVolumeMl', required: true, valueType: 'number', defaultValue: 1},
    {id: 'tipPurgeMl', required: true, valueType: 'number', defaultValue: 0.2},
    {id: 'rinseVolumeMl', required: true, valueType: 'number', defaultValue: 2},
    {id: 'indicatorPolicy', required: true, valueType: 'string', allowedValues: ['indicator-free-formal'], defaultValue: 'indicator-free-formal'},
    {id: 'preparationProtocol', required: true, valueType: 'string', defaultValue: 'Teacher-approved sample, apparatus, probe, increment, and stability configuration required before running'},
    {id: 'wasteProtocol', required: true, valueType: 'string', defaultValue: 'Teacher-approved acid-base neutralization and disposal route required before running'},
  ];
  t.composition.variants = [
    {id: 'strong-acid-strong-base', label: 'Known strong acid analyte with known strong base titrant', enabledWhen: {kind: 'configuration', slotId: 'contextId', equals: 'strong-acid-strong-base'}},
    {id: 'weak-acid-strong-base', label: 'Unknown weak acid analyte with known strong base titrant', enabledWhen: {kind: 'configuration', slotId: 'contextId', equals: 'weak-acid-strong-base'}},
    {id: 'weak-base-strong-acid', label: 'Unknown weak base analyte with known strong acid titrant', enabledWhen: {kind: 'configuration', slotId: 'contextId', equals: 'weak-base-strong-acid'}},
  ];
  t.composition.evidenceOutputs = [
    {id: 'formal-initial-point-evidence', kind: 'notebook', actionId: 'formal-trial-initial-row', referenceId: 'formal-trial-initial-row', required: true},
    {id: 'formal-curve-point-evidence', kind: 'notebook', actionId: 'formal-trial-deliver-titrant-record-point', referenceId: 'formal-trial-deliver-titrant-record-point', required: true},
    {id: 'formal-curve-stability-evidence', kind: 'notebook', actionId: 'formal-trial-deliver-titrant-decide', referenceId: 'formal-trial-deliver-titrant-decide', required: true},
    {id: 'formal-final-burette-evidence', kind: 'measurement', actionId: 'formal-trial-record-final-burette', referenceId: 'formal-trial-burette-final-volume', required: true},
  ];
  t.composition.completion = {
    exitPortIds: ['exit'],
    requiredEvidenceOutputIds: t.composition.evidenceOutputs.map(output => output.id),
    requiredValidationRuleIds: [],
  };
  return t;
}

/** Source-reviewed amendments shared by every generated trial, never hand-edited JSON. */
function refineReviewedFamily({lab, technique}) {
  const t = technique;
  if(lab.id !== 'hydrogen-peroxide-redox-titration') {
    t.composition.configurationSlots.push({id:'indicatorStartPh',required:true,valueType:'number',defaultValue:8.2},{id:'indicatorStrongPh',required:true,valueType:'number',defaultValue:10});
    for(const a of t.actions)if(a.parameters.titrationOperation)Object.assign(a.parameters,{indicatorStartPh:'{{config.indicatorStartPh}}',indicatorStrongPh:'{{config.indicatorStrongPh}}'});
  }
  if (lab.id === 'hydrogen-peroxide-redox-titration') {
    const removed = new Set(t.actions.filter(a=>a.id.startsWith('dispense-practice-permanganate-retry-')).map(a=>`${a.id}-node`));
    t.actions = t.actions.filter(a=>!removed.has(`${a.id}-node`));
    t.process.edges = t.process.edges.filter(e=>!removed.has(e.from)&&!removed.has(e.to));
    const decision=t.actions.find(a=>a.id==='dispense-practice-permanganate-decide');
    decision.parameters.inputOptions=['Continue delivery','Accept endpoint','Report incomplete practice'];
    decision.parameters.boundedPractice=true;delete decision.parameters.retryNodeId;
    const final=t.actions.find(a=>a.id==='record-practice-final-burette');
    final.parameters.incompleteDisposalNodeId='discard-practice-mixture-node';
    t.process.edges.push(edge(`${final.id}-node`,'discard-practice-mixture-node','No accepted endpoint: preserve incomplete practice'));
    const observation=t.actions.find(a=>a.id==='observe-practice-endpoint');
    observation.parameters.note='Describe the observed color and whether a persistent endpoint was accepted. An exhausted or overshot practice has no valid standardization result.';
    const report=t.actions.find(a=>a.id==='submit-one-minute-report');
    report.parameters.note='Report the actual practice readings, observed color, and method. If no endpoint was accepted, report no valid concentration and explain the redesign needed within the allocation.';
    t.composition.completion.requiredEvidenceOutputIds=t.composition.completion.requiredEvidenceOutputIds.filter(id=>id!=='calculate-practice-evidence');
    const mean=t.actions.find(a=>a.id==='accept-standardized-kmno4');
    delete mean.parameters.maximumRangeM;mean.parameters.evidenceDerivedMean=true;
    const review=clone(t.actions.find(a=>a.id==='dispense-standardization-3-permanganate-decide'));
    review.id='review-standardization-concordance';review.label='Review standardization precision with the instructor';
    review.atomId='atom.observe.titration-review-standardization';
    review.parameters={...review.parameters,titrationOperation:'review-standardization',inputRole:'teacherConfiguration',inputLabel:review.label,inputOptions:['Accept concordance','Repeat standardization'],calculationIds:mean.parameters.calculationIds,standardizationRangeM:'{{config.standardizationRangeM}}',restartNodeId:'measure-standardization-1-aliquot-node',repeatGroupId:'standardization-trials',trialReferenceIds:[1,2,3].map(i=>`dispense-standardization-${i}-permanganate`)};
    for(const key of ['continueNodeId','retryNodeId','loopNodeIds'])delete review.parameters[key];
    const start=t.actions.findIndex(a=>a.id==='measure-standardization-1-aliquot'),end=t.actions.indexOf(mean);
    review.parameters.trialNodeIds=[...t.actions.slice(start,end+1),...t.actions.filter(a=>a.id.startsWith('dispense-standardization-')&&a.id.includes('-retry-')),review].map(a=>`${a.id}-node`);
    t.actions.splice(end+1,0,review);
    t.process.edges=t.process.edges.map(e=>e.from===`${mean.id}-node`?{...e,from:`${review.id}-node`}:e);
    t.process.edges.push(edge(`${mean.id}-node`,`${review.id}-node`),edge(`${review.id}-node`,review.parameters.restartNodeId,'Repeat fresh standardizations'));
    t.composition.configurationSlots.push({id:'standardizationRangeM',required:true,valueType:'number',defaultValue:0.0001});
  }
  const equipment = t.initialState.equipment;
  for (const e of equipment) {
    const c = e.contents;
    if (c.concentration?.unit === 'M' && c.solutes.length === 1 && c.solutes[0].unit === 'mol')
      c.solutes[0].amount = Number((c.concentration.value * c.volumeMl / 1000).toPrecision(12));
  }
  const waste = equipment.find(e => e.definitionId === 'waste-beaker');
  const before = new Map();
  for (const a of t.actions) {
    const p = a.parameters;
    p.enforceInstanceIdentity = true;
    if(p.titrationOperation) {
      p.sourceInstanceId=p.buretteInstanceId;
      p.targetInstanceId=p.receiverInstanceId;
      if(p.titrationOperation==='read-ph') {
        p.sourceInstanceId=p.meterInstanceId;p.sourceDefinitionId='ph-meter';
        a.equipmentRoleBindings={'immersed-probe-instrument':'ph-meter','immersed-probe-vessel':'erlenmeyer-flask-250ml'};
      }
      if(p.titrationOperation.endsWith('mix') || p.titrationOperation==='observe' || p.titrationOperation==='practice-observe') {
        p.sourceInstanceId=p.receiverInstanceId;p.sourceDefinitionId=p.targetDefinitionId;
        a.equipmentRoleBindings={[p.titrationOperation.startsWith('practice-')?'reaction-vessel':'analyte-receiver']:p.targetDefinitionId};
        a.label=p.titrationOperation.endsWith('mix')?'Swirl the receiving vessel to mix the current addition':'Inspect the mixed solution in the receiving vessel';
      }
    }
    for (const side of ['source', 'target']) {
      const def = p[`${side}DefinitionId`] ?? (side === 'source' ? p.equipmentDefinitionId : undefined);
      const matches = equipment.filter(e => e.definitionId === def);
      if (!p[`${side}InstanceId`] && matches.length === 1) p[`${side}InstanceId`] = matches[0].id;
    }
    if (a.atomId === 'atom.rinse.condition-burette') {
      // This approved method introduces titrant directly through the open mouth.
      for (const key of ['requiredAttachmentState','attachmentParentDefinitionId','attachmentChildDefinitionId','attachmentSnapZoneId']) delete p[key];
      p.note = 'Condition the empty burette directly through its open mouth with the approved titrant portion. Filling through the funnel is a later operation.';
      const drain = clone(t.actions.find(x => x.id === `${a.id}-discard-rinsate`));
      drain.id = `${a.id}-drain-residual`; drain.label = 'Drain any residual titrant to the approved waste receiver';
      drain.parameters.allowEmptySource = true;
      before.set(a.id, [drain]);
    }
    if (lab.id === 'beverage-acidity') {
      if (a.id.startsWith('practice-') && a.verb === 'measureVolume') p.label = a.label;
      if (typeof p.note === 'string') p.note = p.note.replace('redox waste container', 'acid-base waste container');
      if (p.titrationOperation === 'calculate-curve') {
        const select=clone(a); select.id=`${a.id}-select-equivalence`;select.verb='observe';select.label='Select an equivalence volume from the recorded curve';select.parameters.titrationOperation='select-equivalence';select.atomId='atom.observe.titration-select-equivalence';
        const justify=text(`${a.id}-justify-equivalence`,'Justify the selected equivalence region','Refer to the recorded pH-volume change, balanced equation and indicator endpoint; explain the uncertainty of the selected equivalence volume.');
        const approve=clone(select);approve.id=`${a.id}-approve-equivalence`;approve.label='Instructor review of the justified inference';approve.atomId='atom.observe.titration-approve-equivalence';approve.parameters={...approve.parameters,titrationOperation:'approve-equivalence',inputMode:'choice',inputRole:'teacherConfiguration',inputLabel:approve.label,inputOptions:['Approve justified inference'],preparationProtocol:'{{config.preparationProtocol}}'};
        before.set(a.id,[select,justify,approve]);
        p.inputLabel='Calculated concentration from approved equivalence, aliquot and stoichiometry (mol/L; 1% arithmetic tolerance)';delete p.inputMax;
        t.composition.legacyActionEffects.push({actionId:justify.id,effect:{classes:['evidence-recording'],targets:[{domain:'evidence'}]}});
      }
    }
    if (a.id.includes('check-tip')) {
      a.atomId = 'atom.observe.burette-tip-inspection';
      a.equipmentRoleBindings = {'titrant-delivery-device':'burette-50ml'};
      p.sourceDefinitionId='burette-50ml';p.sourceInstanceId=equipment.find(e=>e.definitionId==='burette-50ml').id;
      p.inputOptions=['No visible air bubbles','Bubbles remain: purge again'];
      p.repeatPurgeNodeId=`${a.id.replace(/-check-tip$/,'-purge-tip')}-node`;
      p.tipInspectionOperation=true;
      t.process.edges.push(edge(`${a.id}-node`,p.repeatPurgeNodeId,'Purge again after observing bubbles'));
    }
    if (lab.id === 'hydrogen-peroxide-redox-titration' && a.verb === 'measureVolume') {
      const stem = a.id.replace(/^measure-/, '').replace(/-(aliquot|acid)$/, '');
      const delivery = t.actions.find(x => x.id === `dispense-${stem}-permanganate`);
      if (delivery && (a.id.endsWith('-acid') || stem !== 'practice')) {
        p.titrationPreparationModelId = delivery.parameters.titrationModelId;
        if (a.id.endsWith('-acid')) p.titrationAcidAliquotMeasurementId = delivery.parameters.aliquotMeasurementId;
        else if (stem !== 'practice') p.maximumTrialDeliveryMl = 45;
      }
    }
  }
  const expanded = t.actions.flatMap(a => [...(before.get(a.id) ?? []), a]);
  for(const a of expanded) a.parameters.enforceInstanceIdentity=true;
  const first = id => `${before.get(id)?.[0]?.id ?? id}-node`;
  t.process.edges = t.process.edges.map(e => ({...e,to:first(e.to.replace(/-node$/,''))}));
  for (const [id, items] of before) {
    const chain=[...items.map(a=>a.id),id];
    t.process.edges.push(...chain.slice(1).map((next,i)=>edge(`${chain[i]}-node`,`${next}-node`)));
  }
  for (const a of expanded) for (const key of ['trialNodeIds','loopNodeIds']) if (Array.isArray(a.parameters[key]))
    a.parameters[key] = a.parameters[key].flatMap(n => [...(before.get(n.replace(/-node$/,'')) ?? []).map(x=>`${x.id}-node`),n]);
  t.actions = expanded; t.process.nodes = expanded.map(node);
  for (const n of t.process.nodes) {
    const a = t.actions.find(x=>x.id===n.actionId);
    if(a.verb==='calculate' && !a.parameters.titrationOperation) n.validation=[{id:`${a.id}-calculation-valid`,type:'calculationWithinTolerance',label:'Calculation matches recorded evidence.',calculationId:a.parameters.calculationId,tolerance:a.parameters.tolerance??0}];
  }
  t.composition.legacyActionEffects = t.composition.legacyActionEffects.filter(e=>!t.actions.find(a=>a.id===e.actionId)?.atomId);
  if(lab.id==='hydrogen-peroxide-redox-titration') {
    const rename=value=>typeof value==='string'?(value==='measure-practice-acid'?'measure-redox-practice-acid':value==='measure-practice-acid-node'?'measure-redox-practice-acid-node':value):Array.isArray(value)?value.map(rename):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rename(v)])):value;
    const renamed=rename(t);return {technique:renamed,lab:composeLab(lab,renamed)};
  }
  return {technique:t,lab:composeLab(lab,t)};
}

function buildBeverage(seeds) {
  const lab=clone(seeds.beverage);
  const equipment=clone(lab.initialState.equipment);
  // Reuse the source lab's concrete sample/context identities; add only the existing filling funnel.
  const funnel=clone(seeds.endpoint.initialState.equipment.find(e=>e.definitionId==='funnel'));equipment.push(funnel);
  const stockBySample=['beverage-a-sample','beverage-b-sample'];
  const modelBase=clone(seeds.acid.titrationModels[0]);
  lab.titrationModels=[...stockBySample.map((id)=>({...clone(modelBase),id,analyteVolumeMl:10})),{...clone(modelBase),id:'practice-hcl',analyte:{formula:'HCl',role:'acid',strength:'strong'},analyteMolarityM:0.1,analyteVolumeMl:5},{...clone(modelBase),id:'practice-acetic',analyteMolarityM:0.1,analyteVolumeMl:5}];
  lab.description+=' Quantitative examples initially use a disclosed acetic-acid proxy model; the instructor supplies the actual supported monoprotic acid configuration before starting. Mixed/polyprotic beverages require an appropriate representative model and qualified interpretation.';
  const actions=[];const extras=[];const retries=[];
  const physical=(original,id,parameters)=>{const a=clone(original);a.id=id;a.parameters={...a.parameters,...parameters};return a;};
  actions.push(text('beverage-source-boundary','Approve the beverage investigation setup','Approve sample identities, supported acid models, stoichiometry, aliquots, indicator, increments, endpoint window/persistence, replicates, probe readiness, and disposal. The example acid model is illustrative and must not be passed off as measured beverage composition.',true));
  const device=equipment.find(e=>e.id==='quantitative-pipette');
  const originalMeasure=seeds.redox.actions.find(a=>a.id==='measure-practice-aliquot');
  const originalTransfer=seeds.redox.actions.find(a=>a.id==='transfer-practice-aliquot');
  const originalDispose=seeds.redox.actions.find(a=>a.id==='discard-practice-mixture');
  const practiceSource=equipment.find(e=>e.id==='practice-naoh-bottle');
  for(const kind of ['hcl','acetic']){
    const prefix=`practice-${kind}`,tube=equipment.find(e=>e.id===`${prefix}-tube`),sample=equipment.find(e=>e.id===(kind==='hcl'?'practice-hcl-bottle':'practice-acetic-acid-bottle'));
    const measure=physical(originalMeasure,`${prefix}-measure`,{sourceInstanceId:sample.id,sourceDefinitionId:sample.definitionId,targetInstanceId:device.id,targetDefinitionId:device.definitionId,measurementId:`${prefix}-aliquot`,volumeMl:5,inputRequired:false});
    for(const key of Object.keys(measure.parameters).filter(k=>k.startsWith('input')))delete measure.parameters[key];
    measure.label='Measure the source-stated 5.0 mL practice acid';actions.push(measure);
    const transfer=physical(originalTransfer,`${prefix}-transfer`,{sourceInstanceId:device.id,sourceDefinitionId:device.definitionId,targetInstanceId:tube.id,targetDefinitionId:tube.definitionId,volumeMl:5});transfer.equipmentRoleBindings={'measured-solvent-source':device.definitionId,'receiving-vessel':tube.definitionId};transfer.interaction={...transfer.interaction,sourceDefinitionId:device.definitionId,targetDefinitionId:tube.definitionId};for(const key of Object.keys(transfer.parameters).filter(k=>k.startsWith('input')))delete transfer.parameters[key];actions.push(transfer);
    actions.push(text(`${prefix}-indicator-choice`,'Confirm the practice indicator',kind==='hcl'?'The manual specifies phenolphthalein for HCl. Record the approved few-drop amount.':'This supported practice selects phenolphthalein for acetic acid. Justify its suitability against the expected equivalence region. A different student-selected indicator requires a different supported color model and a fresh approved activity.'));
    const indicator=physical(originalTransfer,`${prefix}-indicator`,{sourceInstanceId:'phenolphthalein-practice-dropper',sourceDefinitionId:'phenolphthalein-dropper',targetInstanceId:tube.id,targetDefinitionId:'test-tube',volumeMl:0.1});indicator.atomId='atom.transfer.add-practice-indicator';indicator.equipmentRoleBindings={'indicator-source':'phenolphthalein-dropper','reaction-vessel':'test-tube'};indicator.interaction={...indicator.interaction,sourceDefinitionId:'phenolphthalein-dropper',targetDefinitionId:'test-tube'};for(const key of Object.keys(indicator.parameters).filter(k=>k.startsWith('input')))delete indicator.parameters[key];indicator.label='Add the approved practice indicator amount';actions.push(indicator);
    const common={trialReferenceId:prefix,buretteInstanceId:practiceSource.id,receiverInstanceId:tube.id,titrationModelId:prefix,aliquotMeasurementId:`${prefix}-aliquot`,initialMeasurementId:`${prefix}-initial`,endpointWindowMl:0.05,maximumIncrementMl:1,maximumDeliveryMl:10,persistenceSeconds:5};
    const verbs={'read-initial':'observe',deliver:'transfer',mix:'mix',observe:'observe','record-point':'record',decide:'observe','archive-retry':'observe'};
    const op=(operation,label,params={})=>makeAction(`${prefix}-${operation}`,verbs[operation],label,{...common,titrationOperation:`practice-${operation}`,sourceDefinitionId:practiceSource.definitionId,targetDefinitionId:tube.definitionId,...params},`atom.${verbs[operation]}.titration-practice-${operation}`,{'liquid-source':practiceSource.definitionId,'reaction-vessel':tube.definitionId});
    actions.push(op('read-initial','Start a fresh uncalibrated drop-count practice'));
    const loop=[op('deliver','Add one uncalibrated practice drop'),op('mix','Mix the practice addition'),op('observe','Observe the practice indicator'),op('record-point','Record drop count and color')];
    loop.push(op('decide','Continue, accept, or retry practice',{inputMode:'choice',inputRole:'studentResponse',inputRequired:true,inputLabel:'Practice endpoint decision',inputOptions:['Continue delivery','Accept endpoint','Dispose and restart trial'],continueNodeId:`${prefix}-deliver-node`,retryNodeId:`${prefix}-retry-dispose-node`}));loop.at(-1).parameters.loopNodeIds=loop.map(a=>`${a.id}-node`);actions.push(...loop);
    const dispose=physical(originalDispose,`${prefix}-dispose`,{sourceInstanceId:tube.id,sourceDefinitionId:tube.definitionId,targetInstanceId:'teacher-directed-waste'});dispose.atomId='atom.transfer.discard-practice-mixture';dispose.equipmentRoleBindings={'reaction-vessel':tube.definitionId,'waste-receiver':'waste-beaker'};dispose.interaction={...dispose.interaction,sourceDefinitionId:tube.definitionId};actions.push(dispose);
    const retry=clone(dispose);retry.id=`${prefix}-retry-dispose`;
    const reset=op('archive-retry','Archive rejected practice and prepare a fresh aliquot',{restartNodeId:`${prefix}-measure-node`,trialNodeIds:actions.filter(a=>a.id.startsWith(prefix)).map(a=>`${a.id}-node`).concat(`${retry.id}-node`)});
    retries.push(retry,reset);extras.push(edge(`${prefix}-decide-node`,`${prefix}-deliver-node`,'Continue practice'),edge(`${prefix}-decide-node`,`${retry.id}-node`,'Retry'),edge(`${retry.id}-node`,`${reset.id}-node`),edge(`${reset.id}-node`,`${prefix}-measure-node`));
  }
  actions.push(...clone(seeds.beverage.actions.filter(a=>['submit-research-question-hypothesis','submit-variables-equipment-plan','record-three-safety-precautions','submit-acid-models-indicator-justification','record-teacher-approval'].includes(a.id))));
  const quantitativeTrials=[];
  for(const sampleId of stockBySample) for(let replicate=1;replicate<=2;replicate++){
    const prefix=`${sampleId}-trial-${replicate}`,sample=equipment.find(e=>e.id===sampleId);
    const set=clone(seeds.endpoint.actions).filter(a=>a.id!=='calculate-acid-molarity');
    // Bind original technique equipment identities explicitly; no first-of-definition sample lookup.
    const byDef={'unknown-acid-bottle':sample.definitionId,'graduated-cylinder':device.definitionId};
    const byInstance={'unknown-acid-bottle':sample.id,'graduated-cylinder':device.id,'naoh-bottle':'quantitative-naoh-010','erlenmeyer-flask-250ml':'beverage-flask','burette-50ml':'beverage-burette','ring-stand-clamp':'beverage-ring-stand','funnel':funnel.id,'waste-beaker':'teacher-directed-waste','phenolphthalein-dropper':'phenolphthalein-practice-dropper'};
    for(const a of set){a.id=`${prefix}-${a.id}`;for(const [key,value]of Object.entries(a.parameters)){if(key.endsWith('DefinitionId')&&byDef[value])a.parameters[key]=byDef[value];if(key.endsWith('MeasurementId')||key==='measurementId')a.parameters[key]=`${prefix}-${value}`;}for(const key of ['sourceDefinitionId','targetDefinitionId','equipmentDefinitionId']){const original=Object.entries(byDef).find(([,v])=>v===a.parameters[key])?.[0]??a.parameters[key];if(byInstance[original])a.parameters[key.replace('DefinitionId','InstanceId')]=byInstance[original];}if(a.equipmentRoleBindings)for(const role of Object.keys(a.equipmentRoleBindings))a.equipmentRoleBindings[role]=byDef[a.equipmentRoleBindings[role]]??a.equipmentRoleBindings[role];for(const key of ['sourceDefinitionId','targetDefinitionId'])if(a.interaction[key])a.interaction[key]=byDef[a.interaction[key]]??a.interaction[key];
      if(a.id.endsWith('measure-acid')||a.id.endsWith('transfer-acid-flask'))a.parameters.volumeMl=10;
      if(a.id.endsWith('fill-burette')){delete a.parameters.volumeMl;a.volume={source:'target-remaining-capacity'};}
      if(a.parameters.titrationModelId)a.parameters.titrationModelId=sampleId;
    }
    const readiness=text(`${prefix}-probe-ready`,'Confirm pH meter readiness','Instructor-approved calibration, probe rinsing, stability criterion, and sample color interference are confirmed.',true);readiness.parameters.tag='ph-meter-ready';
    const phActions=clone(seeds.acid.actions.filter(a=>['place-ph-meter-on-workbench','immerse-endpoint-ph-probe'].includes(a.id)));
    for(const a of phActions){a.id=`${prefix}-${a.id}`;a.parameters.equipmentInstanceId='beverage-ph-meter';a.parameters.sourceInstanceId='beverage-ph-meter';if(a.parameters.phProbeOperation)a.parameters.targetInstanceId='beverage-flask';a.parameters.trialReferenceId=`${prefix}-deliver-titrant`;delete a.parameters.dispenseActionId;}
    const deliveryIndex=set.findIndex(a=>a.id.endsWith('-deliver-titrant'));
    set.splice(deliveryIndex,0,readiness,...phActions);
    const trial=addTrial(set,set.find(a=>a.id===`${prefix}-deliver-titrant`),equipment,{ph:true,initialId:`${prefix}-burette-initial-volume`,aliquotId:`${prefix}-acid-aliquot-volume`,initialReadId:`${prefix}-read-initial-burette`,finalRecordId:`${prefix}-record-final-burette`,restartId:`${prefix}-seat-burette-funnel`});
    const copyOp=(operation,id,label)=>{const a=clone(trial.sequence.find(a=>a.parameters.titrationOperation===operation));a.id=id;a.label=label;return a;};
    // Initial pH/color row at zero addition is separate from every subsequent point.
    const first=set.findIndex(a=>a.id===trial.prefix);
    set.splice(first,0,copyOp('observe',`${prefix}-initial-color`,'Observe initial color'),copyOp('read-ph',`${prefix}-initial-ph`,'Read initial pH at zero NaOH addition'),copyOp('record-point',`${prefix}-initial-row`,'Record the initial pH/volume/color row'));
    const post=trial.sequence.slice(0,-1).filter(a=>a.parameters.titrationOperation!=='decide').map(a=>{const next=clone(a);next.id=`${a.id}-post`;next.parameters.allowPostEndpoint=true;return next;});
    const finishCurve=clone(trial.sequence.find(a=>a.parameters.titrationOperation==='decide'));finishCurve.id=`${prefix}-finish-curve`;finishCurve.parameters.titrationOperation='decide-curve';finishCurve.atomId='atom.observe.titration-decide-curve';finishCurve.parameters.inputOptions=['Continue delivery','Finish curve'];finishCurve.parameters.continueNodeId=`${post[0].id}-node`;finishCurve.parameters.loopNodeIds=[...post,finishCurve].map(a=>`${a.id}-node`);post.push(finishCurve);set.push(...post);trial.edges.push(edge(`${finishCurve.id}-node`,`${post[0].id}-node`,'Continue after endpoint'));
    const calculate=clone(seeds.endpoint.actions.find(a=>a.id==='calculate-acid-molarity'));calculate.id=`${prefix}-concentration`;calculate.parameters={...calculate.parameters,calculationId:`${prefix}-concentration`,titrationModelId:sampleId,analyteVolumeMeasurementId:`${prefix}-acid-aliquot-volume`,initialBuretteMeasurementId:`${prefix}-burette-initial-volume`,finalBuretteMeasurementId:`${prefix}-burette-final-volume`,requireStudentValue:true,inputMode:'numeric',inputRole:'studentResponse',inputRequired:true,inputLabel:'Acid-equivalent concentration from recorded endpoint readings (mol/L)'};Object.assign(calculate,makeAction(calculate.id,'calculate','Calculate acid concentration from the recorded curve',{...trial.sequence[0].parameters,titrationOperation:'calculate-curve',calculationId:calculate.parameters.calculationId,inputMode:'numeric',inputRole:'studentResponse',inputRequired:true,inputMin:0,inputMinExclusive:true,inputMax:45,inputLabel:'Equivalence volume selected from the recorded pH curve (mL)'},'atom.calculate.titration-calculate-curve',clone(trial.sequence[0].equipmentRoleBindings)));set.push(calculate);
    delete finishCurve.parameters.retryNodeId;
    set.push(text(`${prefix}-equivalence-analysis`,'Compare indicator endpoint with curve equivalence','Use the recorded pH-volume-color curve to identify the equivalence region; compare it with the indicator endpoint. Show the balanced equation and any model-dependent or mixed-acid limitations.'));
    const dispose=physical(originalDispose,`${prefix}-dispose`,{sourceInstanceId:'beverage-flask',targetInstanceId:'teacher-directed-waste'});set.push(dispose);
    actions.push(...set);quantitativeTrials.push(trial);
  }
  actions.push(...clone(seeds.beverage.actions.filter(a=>['compare-class-data-with-provenance','submit-postlab-reasoning'].includes(a.id))));
  const terminal=actions.at(-1).id;
  for(const t of quantitativeTrials){const start=actions.findIndex(a=>`${a.id}-node`===t.archive.parameters.restartNodeId),end=actions.findIndex(a=>a.id===`${t.prefix}-decide`);t.archive.parameters.trialNodeIds=actions.slice(start,end+1).concat(t.retryNodes).map(a=>`${a.id}-node`);retries.push(...t.retryNodes);extras.push(...t.edges);}
  const technique=finalizeTechnique('beverage-ph-volume-titration','Beverage practice and quantitative pH-volume investigation',[...actions,...retries],equipment,lab.titrationModels,extras);
  const retryIds=new Set(retries.map(a=>`${a.id}-node`));technique.process.edges=technique.process.edges.filter(e=>!retryIds.has(e.from)&&!retryIds.has(e.to)).concat(extras.filter(e=>retryIds.has(e.from)||retryIds.has(e.to)));technique.composition.ports.find(p=>p.id==='exit').nodeId=`${terminal}-node`;
  return{technique,lab:composeLab(lab,technique)};
}

function enhancePreparation({lab,technique}) {
  const t=clone(technique),equipment=t.initialState.equipment;
  let water=equipment.find(e=>e.definitionId==='wash-bottle');
  if(!water){water={id:'titration-rinse-water',definitionId:'wash-bottle',label:'Approved rinse water',location:'shelf',contents:{kind:'liquid',label:'Rinse water',volumeMl:500,solutes:[],contamination:[],wetState:'wet',visualState:'clear-liquid'}};equipment.push(water);}
  const waste=equipment.find(e=>e.definitionId==='waste-beaker');
  const burette=equipment.find(e=>e.definitionId==='burette-50ml');
  const stock=equipment.find(e=>e.id==='permanganate-stock-1')??equipment.find(e=>e.id==='quantitative-naoh-010')??equipment.find(e=>e.definitionId==='naoh-bottle');
  const insertAfter=new Map(),insertBefore=new Map();
  const wasteAction=(id,source,volume)=>{
    const a=clone(sourceInputs().redox.actions.find(a=>a.id==='discard-practice-mixture'));
    Object.assign(a,{id,label:'Transfer rinsate to the instructor-designated waste',atomId:source.definitionId==='burette-50ml'?'atom.transfer.burette-rinsate-to-waste':source.definitionId==='test-tube'?'atom.transfer.discard-practice-mixture':'atom.transfer.discard-titrated-mixture',equipmentRoleBindings:{[source.definitionId==='burette-50ml'?'titrant-delivery-device':source.definitionId==='test-tube'?'reaction-vessel':'analyte-receiver']:source.definitionId,'waste-receiver':waste.definitionId}});
    a.parameters={sourceInstanceId:source.id,sourceDefinitionId:source.definitionId,targetInstanceId:waste.id,targetDefinitionId:waste.definitionId,...(volume?{volumeMl:volume}:{}),note:'Use only the approved waste route entered before this run.'};a.interaction={...a.interaction,sourceDefinitionId:source.definitionId,targetDefinitionId:waste.definitionId};return a;
  };
  const fillTemplate=sourceInputs().endpoint.actions.find(a=>a.id==='fill-burette');
  const fillingTool = (id, seat) => {
    const a=clone(sourceInputs().endpoint.actions.find(a=>a.id===(seat?'seat-burette-funnel':'remove-burette-funnel')));
    a.id=id;
    return a;
  };
  for(const a of t.actions){
    if(a.atomId==='atom.rinse.condition-burette'){
      a.parameters.volumeMl='{{config.conditioningVolumeMl}}';a.parameters.collectRinseVolume=true;
      insertAfter.set(a.id,[wasteAction(`${a.id}-discard-rinsate`,burette)]);
    }
    if(a.atomId==='atom.transfer.fill-burette'){
      a.feedback=feedback('Fill the burette with the approved titrant');
      a.interaction.successCue=a.feedback.success;
      a.stateChanges=['Titrant transferred into the burette; tip purge and inspection remain separate.'];
      if(a.id==='fill-practice-burette'){a.parameters.volumeMl=10;}
      else {delete a.parameters.volumeMl;a.volume={source:'target-remaining-capacity'};}
      const purge=wasteAction(`${a.id}-purge-tip`,burette,'{{config.tipPurgeMl}}');purge.label='Clear the burette tip to the approved waste receiver';
      const inspect=text(`${a.id}-check-tip`,'Inspect the burette tip for air bubbles','Inspect the liquid-filled tip after the separate purge. If bubbles remain, do not proceed; repeat the approved purge preparation. This observation is independent of filling.');inspect.parameters.inputMode='choice';inspect.parameters.inputOptions=['No visible air bubbles after the approved purge'];
      insertAfter.set(a.id,[purge,inspect]);
      if(lab.id==='hydrogen-peroxide-redox-titration') {
        insertBefore.set(a.id,[fillingTool(`${a.id}-seat-funnel`,true)]);
        insertAfter.set(a.id,[fillingTool(`${a.id}-remove-funnel`,false),purge,inspect]);
      }
    }
    if(a.parameters.titrationOperation==='read-initial'&&lab.id==='hydrogen-peroxide-redox-titration'&&!a.id.includes('practice')){
      const fill=clone(fillTemplate);fill.id=`${a.id}-refill`;fill.label='Refill the burette for this independent trial';fill.parameters={sourceDefinitionId:stock.definitionId,sourceInstanceId:stock.id,targetDefinitionId:burette.definitionId,targetInstanceId:burette.id};fill.volume={source:'target-remaining-capacity'};fill.equipmentRoleBindings={'titrant-source':stock.definitionId,'titrant-delivery-device':burette.definitionId};fill.interaction={...fill.interaction,sourceDefinitionId:stock.definitionId,targetDefinitionId:burette.definitionId};
      const purge=wasteAction(`${a.id}-purge-tip`,burette,'{{config.tipPurgeMl}}');purge.label='Clear the refilled burette tip';
      const inspect=text(`${a.id}-check-tip`,'Inspect the liquid-filled tip','Confirm no visible air bubbles after the purge.');inspect.parameters.inputMode='choice';inspect.parameters.inputOptions=['No visible air bubbles'];
      fill.feedback=feedback('Refill with approved permanganate titrant');
      fill.interaction.successCue=fill.feedback.success;
      fill.interaction.invalidCue='Prepare the filling apparatus before refilling.';
      fill.interaction.accessibleLabel='Pour the approved permanganate titrant through the seated funnel into the burette.';
      fill.invalidCases=[];
      fill.stateChanges=['Permanganate titrant transferred into the burette.'];
      insertBefore.set(a.id,[fillingTool(`${fill.id}-seat-funnel`,true),fill,fillingTool(`${fill.id}-remove-funnel`,false),purge,inspect]);
    }
    if(['atom.transfer.discard-titrated-mixture','atom.transfer.discard-practice-mixture'].includes(a.atomId)){
      const source=equipment.find(e=>e.id===a.parameters.sourceInstanceId)??equipment.find(e=>e.definitionId===a.parameters.sourceDefinitionId);
      if(!source)throw Error(`Missing disposal source ${a.id}`);
      const rinse=makeAction(`${a.id}-rinse`,'rinse','Rinse the emptied trial receiver',{sourceDefinitionId:water.definitionId,sourceInstanceId:water.id,targetDefinitionId:source.definitionId,targetInstanceId:source.id,volumeMl:'{{config.rinseVolumeMl}}',rinseType:'rinse',collectRinseVolume:true},'atom.rinse.clean-titration-receiver',{'rinse-water-source':water.definitionId,'rinsed-vessel':source.definitionId});rinse.interaction={type:'rinseTarget',sourceDefinitionId:water.definitionId,targetDefinitionId:source.definitionId,successCue:rinse.label,invalidCue:'Empty the receiver first.',accessibleLabel:rinse.label};
      insertAfter.set(a.id,[rinse,wasteAction(`${a.id}-discard-rinse`,source)]);
    }
  }
  const actions=t.actions.flatMap(a=>[...(insertBefore.get(a.id)??[]),a,...(insertAfter.get(a.id)??[])]);
  const first=id=>(insertBefore.get(id)?.[0]?.id??id)+'-node';
  const last=id=>(insertAfter.get(id)?.at(-1)?.id??id)+'-node';
  const edges=t.process.edges.map(e=>({...e,from:last(e.from.replace(/-node$/,'')),to:first(e.to.replace(/-node$/,''))}));
  for(const a of t.actions){const chain=[...(insertBefore.get(a.id)??[]),a,...(insertAfter.get(a.id)??[])];edges.push(...chain.slice(1).map((next,i)=>edge(`${chain[i].id}-node`,`${next.id}-node`)));}
  for(const a of actions)for(const key of ['loopNodeIds','trialNodeIds'])if(Array.isArray(a.parameters[key]))a.parameters[key]=a.parameters[key].flatMap(nodeId=>{const id=nodeId.replace(/-node$/,'');return [...(insertBefore.get(id)??[]).map(a=>`${a.id}-node`),nodeId,...(insertAfter.get(id)??[]).map(a=>`${a.id}-node`)];});
  const final=finalizeTechnique(t.id,t.title,actions,equipment,t.titrationModels);
  final.process.edges=edges;final.process.startNodeId=first(t.process.startNodeId.replace(/-node$/,''));
  final.composition.ports=t.composition.ports.map(p=>({...p,nodeId:p.kind==='entry'?first(p.nodeId.replace(/-node$/,'')):last(p.nodeId.replace(/-node$/,''))}));
  for(const [id,defaultValue]of Object.entries({conditioningVolumeMl:1,tipPurgeMl:0.2,rinseVolumeMl:2}))final.composition.configurationSlots.push({id,valueType:'number',required:true,defaultValue});
  final.composition.evidenceOutputs=actions.flatMap(a=>{
    const op=a.parameters.titrationOperation;
    if(op?.endsWith('record-point'))return[{id:`${a.id}-evidence`,kind:'notebook',actionId:a.id,referenceId:a.id,required:true}];
    if(a.verb==='calculate'&&a.parameters.calculationId)return[{id:`${a.id}-evidence`,kind:'calculation',actionId:a.id,referenceId:a.parameters.calculationId,required:true}];
    if(op==='record-final')return[{id:`${a.id}-evidence`,kind:'measurement',actionId:a.id,referenceId:a.parameters.measurementId,required:true}];
    return[];
  });
  final.composition.completion.requiredEvidenceOutputIds=final.composition.evidenceOutputs.map(e=>e.id);
  return{technique:final,lab:composeLab(lab,final)};
}
