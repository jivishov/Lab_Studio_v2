export const declareBondingProcedure = (technique) => {
  const resource = (id, solvent = true) => ({ id, prepareActionIds: [`dispense-${id}-microsample`, ...(solvent ? [`apply-${id}-${['hcl','naoh'].includes(id) ? 'reagent' : 'solvent'}`] : [])], cleanupActionIds: [`dispose-${id}-test-line`] });
  const group = (id, actionIds, evidenceKind, resourceId) => ({ id, actionIds, evidenceKind, resourceId, testCount: 1 });
  technique.composition.orderedProcedure = {
    configurationSlotId: 'selectedProcedure', startActionIds: ['label-test-locations'], endActionIds: ['complete-sample-matrix'], minimumTests: 4, requireMixedEvidence: true,
    resources: ['water','ethanol','hexanes','dry','hcl','naoh'].map(id => resource(id, id !== 'dry')),
    groups: [group('appearance',['inspect-solid-appearance','record-solid-appearance'],'qualitative'),group('water',['inspect-water-solubility','record-water-solubility'],'qualitative','water'),group('conductivity',['read-aqueous-conductivity','record-aqueous-conductivity'],'quantitative','water'),group('ph',['read-ph-indicator','record-ph'],'quantitative','water'),group('ethanol',['inspect-ethanol-solubility','record-ethanol-solubility'],'qualitative','ethanol'),group('hexanes',['inspect-hexanes-solubility','record-hexanes-solubility'],'qualitative','hexanes'),group('magnet',['test-magnetic-response','record-magnetic-response'],'qualitative','dry'),{...group('melting',['stage-melting-sample','read-melting-behavior','record-melting-behavior'],'quantitative','dry'),requiresEarlier:['magnet']},group('hcl',['inspect-hcl-response','record-hcl-response'],'qualitative','hcl'),group('naoh',['inspect-naoh-response','record-naoh-response'],'qualitative','naoh')]
  };
  technique.composition.configurationSlots.push({ id:'selectedProcedure',required:true,valueType:'string' });
  technique.metadata.version = '1.2.0';
};
const clone = (value) => structuredClone(value);
const rewrite = (value, substitutions) => {
  if (typeof value === 'string') { for (const [a,b] of substitutions) value = value.split(a).join(b); return value; }
  if (Array.isArray(value)) return value.map(item => rewrite(item, substitutions));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,rewrite(item,substitutions)]));
  return value;
};
export const preparePaperChoices = (technique, lab) => {
  const instructions = {
    'select-solvents': 'Use the solvents and trial order selected in classroom setup. Record a pre-result rationale for each selected source-listed solvent; at least two distinct solvents are required.',
    'configure-repeatable-procedure': 'Document the approved paper dimensions, pencil origin, solvent depth and volume, loaded sample and spot volume, and solvent-front stop distance from classroom setup. Keep the origin above solvent, dry the spot, close the chamber, measure to the nearest millimetre, and use fresh labeled paper and solvent for each selected trial.',
    'evaluate-hypothesis': 'State whether the collected evidence for your selected solvents supports, partly supports, or refutes the pre-result IMF hypothesis. Distinguish an unexpected result from an invalid trial.'
  };
  for (const action of lab.actions) if (instructions[action.id]) {
    action.parameters.note = instructions[action.id];
    for (const key of ['configuredTrialSolvents','paperWidthMm','paperLengthMm','baselineHeightMm','solventDepthMm','sampleVolumeMl','solventFrontStopMm']) delete action.parameters[key];
    action.interaction.accessibleLabel = instructions[action.id];
    for (const node of lab.process.nodes.filter(node=>node.actionId===action.id)) node.description = instructions[action.id];
  }

  for (const action of lab.actions) if (['record-imf-hypothesis','configure-repeatable-procedure','design-data-table','evaluate-hypothesis','write-cer-conclusion'].includes(action.id)) {
    action.parameters.prompt = action.parameters.note ?? action.parameters.prompt;
    Object.assign(action.parameters, { inputMode:'text',inputRole:'studentResponse',inputKey:`${action.id}-student-response`,inputLabel:action.parameters.prompt,inputRequired:true });
    delete action.parameters.note;
    action.interaction.valueParameter='inputKey';
  }
  // Rebuild solely from the two canonical source trials, never from a prior generated variant.
  const originalActions = technique.actions.filter(a => !a.id.includes('choice-'));
  const originalNodes = technique.process.nodes.filter(n => !n.id.includes('choice-'));
  const originalEquipment = technique.initialState.equipment.filter(e => !e.id.includes('choice-'));
  const originalModels = technique.chromatographyModels.filter(m => !m.id.includes('choice-'));
  technique.actions = [...originalActions]; technique.process.nodes = [...originalNodes];
  technique.initialState.equipment = [...originalEquipment]; technique.chromatographyModels = [...originalModels];
  lab.initialState.equipment = lab.initialState.equipment.filter(e => !e.id.includes('choice-'));
  lab.chromatographyModels = lab.chromatographyModels.filter(m => !m.id.includes('choice-'));
  const groups = [];
  const waterNodes = originalNodes.filter(n => n.actionId !== 'place-metric-ruler' && originalActions.some(a => a.id === n.actionId && a.id.includes('water')));
  const baseBands = ['purple-overlap','yellow'];
  for (const solvent of ['water','propanol','ethanol','acetone','chromatography-solvent']) for (const count of [1,2,3]) {
    const supplied = solvent === 'water' && count === 2 || solvent === 'propanol' && count === 3;
    const id = `choice-${solvent}-${count}`;
    if (supplied) { groups.push({ id: solvent, family: solvent, actionIds: originalNodes.filter(n => n.actionId !== 'place-metric-ruler' && n.actionId?.includes(solvent)).map(n=>n.actionId),testCount:1,evidenceKind:'procedure' }); }
    const mapping = [['distilled-water-bottle','reagent-bottle'],['distilled water',solvent],['water',id]];
    const actions = waterNodes.map(n => originalActions.find(a=>a.id===n.actionId)).filter(a=>!baseBands.some(b => a.id === `measure-water-${b}` || a.id === `record-water-${b}`)).map(a=>rewrite(a,mapping));
    const bandIds = Array.from({length:count},(_,i)=>`region-${i+1}`);
    const insertAt = actions.findIndex(a=>a.id===`calculate-${id}-rf`);
    const pairs = bandIds.flatMap(b=>['measure','record'].map(op=>rewrite(originalActions.find(a=>a.id===`${op}-water-purple-overlap`),[...mapping,['purple-overlap',b],['Purple unresolved overlap',b]])));
    actions.splice(insertAt,0,...pairs);
    const calc = actions.find(a=>a.id===`calculate-${id}-rf`);
    calc.parameters.bandIds = bandIds; calc.parameters.bandMeasurementIds = bandIds.map(b=>`${id}-band-${b}`);
    calc.prerequisites = [{ id:`${calc.id}--front`,type:'measurementRecorded',measurementId:`${id}-solvent-front`,label:'Record the trial front.' },...bandIds.map(b=>({id:`${calc.id}--${b}`,type:'measurementRecorded',measurementId:`${id}-band-${b}`,label:'Record this observed region.'}))];
    for (const action of actions) {
      if (action.id===`dispose-${id}-solvent` && solvent !== 'water') {
        action.parameters.targetInstanceId='organic-waste-receiver'; action.parameters.wasteStream='organic';
        action.label=`Dispose ${solvent} in approved organic waste`; action.parameters.instruction=action.label;
        action.interaction.accessibleLabel=action.label; action.feedback.success=action.label;
      }
    }
    for (const action of actions) {
      for (const key of ['label','parameters','interaction','feedback','stateChanges']) action[key]=rewrite(action[key],[['5 mL','the approved solvent volume'],['15 mm','configured'],['5 mm','configured'],['80 mm','configured'],['Distilled '+id,solvent]]);
    }
    const nodes=actions.map(a=>({id:`${a.id}-node`,type:'action',title:a.label,description:a.label,actionId:a.id,config:{},validation:[{id:`${a.id}-node--completed`,type:'actionEvidence',actionId:a.id,label:'Complete this trial operation.'}],hints:[],feedback:{success:'Complete',retry:'Follow the approved trial.'}}));
    technique.actions.push(...actions);technique.process.nodes.push(...nodes);
    for (const baseId of ['water-chamber','water-paper','water-solvent-bottle']) {
      const item = rewrite(originalEquipment.find(e=>e.id===baseId),mapping);
      item.label=`${solvent} trial ${count}-region ${baseId.split('-').slice(1).join(' ')}`;
      if (baseId === 'water-solvent-bottle') { item.contents.label=solvent; item.contents.solutes=[]; }
      technique.initialState.equipment.push(item);lab.initialState.equipment.push(clone(item));
    }
    const model={id:`${id}-food-dyes-paper`,solventFrontMm:80,requiresClassroomDataset:true,bands:bandIds.map(b=>({id:b,label:b,color:'#666666',distanceMm:0,expectedRf:0}))};
    technique.chromatographyModels.push(model);lab.chromatographyModels.push(clone(model));
    groups.push({id,family:solvent,actionIds:actions.map(a=>a.id),testCount:1,evidenceKind:'procedure'});
  }
  // A canonical full traversal is only a validation scaffold; approved selection is required.
  technique.process.edges=technique.process.nodes.slice(1).map((n,i)=>({from:technique.process.nodes[i].id,to:n.id,label:'Next',condition:{type:'validationPassed'}}));
  for (const action of technique.actions) for (const key of ['label','parameters','interaction','feedback','stateChanges']) action[key]=rewrite(action[key],[['5 mL','the approved solvent volume'],['15 mm','configured'],['5 mm','configured'],['80 mm','configured']]);
  technique.inquiryGroups=groups;
};
export const declarePaperProcedure = (technique) => {
  technique.composition.orderedProcedure={configurationSlotId:'selectedProcedure',startActionIds:['place-metric-ruler'],endActionIds:[],minimumTests:2,resources:[],groups:technique.inquiryGroups};
  delete technique.inquiryGroups;
  technique.composition.configurationSlots.push({id:'selectedProcedure',required:true,valueType:'string'});
  technique.composition.ports = [{id:'entry-label-water-trial-node',kind:'entry',nodeId:technique.process.nodes[0].id,label:'Entry'},{id:'exit-dispose-propanol-solvent-node',kind:'exit',nodeId:technique.process.nodes.at(-1).id,label:'Exit'}];
  technique.composition.completion.exitPortIds=['exit-dispose-propanol-solvent-node'];
  technique.metadata.version='1.2.0';
};
export const prepareQuickChoices = (technique, lab) => {
  // Emulsion is an unsuccessful observation retained at the same retryable observation step.
  // It is not a mandatory operation after successful separated-layer evidence.
  technique.actions=technique.actions.filter(a=>!a.id.startsWith('plan-') && a.id !== 'qar-recover-from-emulsion');
  technique.process.nodes=technique.process.nodes.filter(n=>!n.actionId?.startsWith('plan-') && n.actionId !== 'qar-recover-from-emulsion');
  for (const id of ['qar-drain-upper-layer','qar-charge-funnel-organic-phase','qar-decant-filtrate-to-beaker']) technique.actions.find(a=>a.id===id).parameters.requireFullTransfer=true;
  const original=clone(technique.actions); const byId=new Map(original.map(a=>[a.id,a]));
  const nodes=new Map(technique.process.nodes.map(n=>[n.actionId,n]));
  const group=(id,actionIds,family,requiresEarlier=[])=>({id,actionIds,family,requiresEarlier,testCount:family?1:0,evidenceKind:'procedure'});
  const organicIds=['qar-dry-organic-phase-with-mgso4','qar-dry-organic-phase','qar-weigh-organic-watch-glass-tare','qar-remove-drying-agent','qar-recover-organic-component','qar-wash-organic-solid','qar-collect-organic-residue','qar-dry-organic-solid','qar-cool-organic-solid','qar-weigh-organic-solid'];
  const aqueousStart=original.findIndex(a=>a.id==='qar-decant-filtrate-to-beaker');
  const aqueousEnd=original.findIndex(a=>a.id==='qar-weigh-aqueous-solid');
  const aqueousIds=original.slice(aqueousStart,aqueousEnd+1).map(a=>a.id);
  const acidicIds=original.slice(original.findIndex(a=>a.id==='qar-adjust-approved-acid-base-endpoint'),original.findIndex(a=>a.id==='qar-weigh-acidic-solid')+1).filter(a=>!organicIds.includes(a.id)).map(a=>a.id);
  const endIds=original.slice(original.findIndex(a=>a.id==='qar-dry-recovered-fractions')).map(a=>a.id);
  const grouped=new Set([...organicIds,...aqueousIds,...acidicIds,...endIds]);
  const startIds=original.filter(a=>!grouped.has(a.id)).map(a=>a.id);
  const groups=[];
  const append=(actions)=>{ technique.actions.push(...actions);for(const a of actions) technique.process.nodes.push({id:`${a.id}-node`,type:'action',title:a.label,description:a.label,actionId:a.id,config:{},validation:[{id:`${a.id}-node--complete`,type:'actionEvidence',actionId:a.id,label:'Complete approved operation.'}],hints:[],feedback:{success:'Complete',retry:'Preserve the named fraction and approved procedure.'}}); };
  const washSource=['qar-charge-funnel-organic-phase','qar-charge-funnel-aqueous-phase','qar-mix-and-vent','qar-vent-extraction-funnel','qar-settle-and-observe-layers','qar-inspect-separated-layers','qar-identify-layer-from-evidence','qar-drain-lower-layer','qar-drain-upper-layer'];
  for(let round=2;round<=5;round++) {
    const actions=washSource.map(id=>rewrite(byId.get(id),washSource.map(old=>[old,`plan-wash-${round}-${old}`])));
    const transfer=actions[0];transfer.parameters.sourceInstanceId='qar-organic-fraction-flask';transfer.parameters.sourceDefinitionId='erlenmeyer-flask-250ml';transfer.interaction.sourceDefinitionId='erlenmeyer-flask-250ml';transfer.equipmentRoleBindings['extraction-phase-source']='erlenmeyer-flask-250ml';transfer.parameters.requireFullTransfer=true;
    transfer.prerequisites=[]; transfer.label=`Wash ${round}: return the complete retained organic phase`;
    for(const action of actions) {action.parameters.instruction=`Approved wash ${round}: ${action.label}. Acquire fresh evidence for this round.`;}
    append(actions);groups.push(group(`wash-${round}`,actions.map(a=>a.id),undefined,groups.map(g=>g.id)));
  }
  groups.push(group('organic',organicIds,'organic'));
  groups.push(group('acidic-vacuum',acidicIds,'acidic'));
  groups.push({...group('aqueous-vacuum',aqueousIds,'aqueous',['acidic-vacuum']),requiresSelected:['acidic-vacuum']});
  const replacements=[['qar-buchner-funnel','plan-gravity-funnel'],['qar-side-arm-flask','plan-gravity-receiver'],['buchner-funnel','funnel-stand'],['side-arm-filter-flask','erlenmeyer-flask-250ml'],['funnel-stand-paper-seat','funnel-stand-paper-seat'],['funnel-stand-receiver-neck','funnel-receiving-vessel-zone'],['Buchner funnel','gravity funnel'],['Buchner','gravity funnel'],['vacuum','gravity'],['side-arm flask','gravity receiver'],['side-arm filter flask','gravity receiver'],['perforated plate','gravity paper seat']];
  const gravityIds=acidicIds.filter(id=>!['qar-place-vacuum-source','qar-assemble-vacuum-filtration'].includes(id));
  const gravityActions=gravityIds.map(id=>rewrite(byId.get(id),[...acidicIds.map(old=>[old,`plan-gravity-${old}`]),...replacements]));
  for (const action of gravityActions) { action.prerequisites=action.prerequisites.filter(rule=>!rule.actionId?.includes('qar-assemble-vacuum-filtration')); if(action.verb==='filter') {action.parameters.receiverInstanceId='plan-gravity-receiver';action.parameters.requireVacuum=false;} }
  append(gravityActions);groups.push({...group('acidic-gravity',gravityActions.map(a=>a.id),'acidic'),actionAliases:Object.fromEntries(gravityIds.map((id,index)=>[id,gravityActions[index].id]))});
  const gravityAqueous=aqueousIds.map(id=>rewrite(byId.get(id),[...aqueousIds.map(old=>[old,`plan-gravity-${old}`]),...acidicIds.map(old=>[old,`plan-gravity-${old}`]),...replacements]));
  append(gravityAqueous);groups.push({...group('aqueous-gravity',gravityAqueous.map(a=>a.id),'aqueous',['acidic-gravity']),requiresSelected:['acidic-gravity'],actionAliases:Object.fromEntries(aqueousIds.map((id,index)=>[id,gravityAqueous[index].id]))});
  for(const [id,definitionId] of [['plan-gravity-funnel','funnel-stand'],['plan-gravity-receiver','erlenmeyer-flask-250ml']]) {
    const item={id,definitionId,label:`Approved gravity ${definitionId==='funnel-stand'?'funnel':'filtrate receiver'}`,location:'shelf',contents:{kind:'empty',label:'Empty',solutes:[],contamination:[],wetState:'dry',visualState:'empty'}};
    for(const owner of [technique,lab]) {owner.initialState.equipment=owner.initialState.equipment.filter(e=>e.id!==id);owner.initialState.equipment.push(clone(item));}
  }
  // Both methods preserve the same acquired masses, scoped to the chosen canonical path.
  for(const action of gravityActions.concat(gravityAqueous)) {
    for(const key of ['outputMeasurementId','referenceId']) if(action.mass?.[key]) action.mass[key]=action.mass[key].replace(/^plan-gravity-/, '');
  }
  technique.process.nodes=technique.actions.map(a=>technique.process.nodes.find(n=>n.actionId===a.id));
  technique.process.edges=technique.process.nodes.slice(1).map((n,i)=>({from:technique.process.nodes[i].id,to:n.id,label:'Canonical scaffold',condition:{type:'validationPassed'}}));
  technique.inquiryPlan={configurationSlotId:'selectedProcedure',startActionIds:startIds,endActionIds:endIds,minimumTests:3,selectionCount:{configurationSlotId:'extractionCount',baseCount:1,groupIds:['wash-2','wash-3','wash-4','wash-5']},requiredFamilies:['organic','acidic','aqueous'],resources:[],groups};
};
export const declareQuickProcedure = (technique) => {
  technique.composition.orderedProcedure=technique.inquiryPlan;delete technique.inquiryPlan;
  const countAction = technique.actions.find(a=>a.id==='qar-repeat-approved-extractions');
  Object.assign(countAction.parameters,{inputMin:'{{config.extractionCount}}',inputMax:'{{config.extractionCount}}',inputLabel:'Confirm the approved total extraction count before the additional wash subflows execute.'});
  technique.composition.configurationSlots.push({id:'extractionCount',required:true,valueType:'number'});
  technique.composition.configurationSlots.push({id:'selectedProcedure',required:true,valueType:'string'});
  technique.composition.ports=[{id:'entry-qar-starting-mass-node',kind:'entry',nodeId:technique.process.nodes[0].id,label:'Entry'},{id:'exit-qar-record-masses-node',kind:'exit',nodeId:technique.process.nodes.at(-1).id,label:'Exit'}];
  technique.composition.completion.exitPortIds=['exit-qar-record-masses-node'];
  technique.metadata.version='1.3.0';
};
