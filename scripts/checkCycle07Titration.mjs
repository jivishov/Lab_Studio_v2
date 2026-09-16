import fs from 'node:fs';
import { compileLabComposition } from '../src/data/compileLabComposition.ts';
import { validateTechniqueDefinition } from '../src/domain/validation.ts';
import assert from 'node:assert/strict';
import { buildFamilies, buildReusableTrial, composeLab } from './generatorInputs/titration/build.mjs';
const ids=['acid-base-titration','hydrogen-peroxide-redox-titration','beverage-acidity'];
const read=p=>JSON.parse(fs.readFileSync(p));
const products=buildFamilies();
const lane='planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-07';
const overlay=read(`${lane}/source-trace-overlay.json`);
let actionCount=0;
for(const id of ids){
  const lab=read(`public/labs/${id}.json`);
  assert.deepEqual(lab,products.find(p=>p.lab.id===id).lab,`${id}: generator drift`);
  assert.equal(lab.actions.length,0,'No local scientific actions');
  assert.equal(lab.techniques.length,0,'No inert embedded carriers');
  assert.equal(lab.techniqueInstances.length,1);
  assert.equal(lab.techniqueInstances[0].version,'3.0.1');
  const techniques=new Map(lab.techniqueInstances.map(i=>{const raw=read(`public/techniques/${i.techniqueId}.json`);const result=validateTechniqueDefinition(raw);if(!result.ok)throw Error(result.errors.join('\n'));return[i.techniqueId,result.value];}));
  const compiled=await compileLabComposition(lab,async id=>techniques.get(id));
  const technique=[...techniques.values()][0];
  assert.deepEqual(read(`public/techniques/${technique.id}.json`),products.find(p=>p.lab.id===id).technique,'Technique generator drift');
  const nodes=new Map(compiled.process.nodes.map(n=>[n.id,n]));
  const equipment=new Set(compiled.initialState.equipment.map(e=>e.id));
  const actions=new Map(compiled.actions.map(a=>[a.id,a]));
  const reached=new Set();const queue=[compiled.process.startNodeId];
  while(queue.length){const next=queue.pop();if(reached.has(next))continue;reached.add(next);queue.push(...compiled.process.edges.filter(e=>e.from===next).map(e=>e.to));}
  assert.equal(reached.size,nodes.size,'Every normal/loop/retry node is statically reachable');
  const starts=compiled.actions.filter(a=>a.parameters.titrationOperation?.endsWith('read-initial'));
  assert.equal(new Set(starts.map(a=>a.parameters.trialReferenceId)).size,starts.length,'Independent trial identities');
  for(const a of compiled.actions){
    assert(!JSON.stringify(a).includes('endpointDropCount'),'No hidden endpoint counter in owned actions');
    assert(a.interaction?.type!=='dispenseDrops','Owned delivery uses the explicit atomic contract');
    assert(overlay.rows.some(r=>r.owner===`technique:${technique.id}`&&r.actionId===a.id&&r.evaluated),'Every action has an evaluated source disposition');
    const node=[...nodes.values()].find(n=>n.actionId===a.id);assert(node,`Missing process endpoint ${a.id}`);
    const p=a.parameters;
    if(p.sourceInstanceId||p.targetInstanceId) assert(p.enforceInstanceIdentity,'Named equipment must be enforced, not a default');
    if(a.atomId==='atom.rinse.condition-burette') {
      assert.notEqual(p.requiredAttachmentState,'attached','Direct-mouth conditioning must not depend on the later filling funnel');
      assert(compiled.process.edges.some(e=>e.to===node.id&&e.from===`${a.id}-drain-residual-node`),'Conditioning requires a separate residual drain');
      assert(p.collectRinseVolume,'Rinse volume remains available for separate disposal');
    }
    if(p.titrationOperation){
      assert(a.atomId&&Object.keys(a.equipmentRoleBindings).length>=1,'Typed operation binds its actual apparatus role');
      assert(equipment.has(p.buretteInstanceId)&&equipment.has(p.receiverInstanceId),'Concrete apparatus binding');
      assert(starts.some(s=>s.parameters.trialReferenceId===p.trialReferenceId),'Trial producer exists');
      for(const key of ['continueNodeId','retryNodeId','restartNodeId'])if(p[key])assert(compiled.process.edges.some(e=>e.from===node.id&&e.to===p[key]),`${a.id}: ${key} must be an authored outgoing edge`);
      for(const key of ['loopNodeIds','trialNodeIds'])for(const value of p[key]??[])assert(nodes.has(value),'Scoped reset reference');
      if(p.titrationOperation==='deliver')assert(p.inputRequired&&p.inputMode==='numeric'&&p.maximumIncrementMl>0,'Learner controls the increment');
      if(p.titrationOperation==='archive-retry')assert(p.trialNodeIds.includes(p.restartNodeId),'Retry clears the fresh-trial entry');
      if(p.titrationOperation==='select-equivalence')assert(p.inputRequired&&p.inputLabel.includes('Equivalence volume'),'Learner selects curve inference');
      if(p.titrationOperation==='calculate-curve')assert(p.inputRequired&&p.inputLabel.includes('Calculated concentration'),'Learner submits arithmetic after approval');
    }
    if(a.verb==='calculate'&&a.interaction.type==='submitCalculation'&&p.finalBuretteMeasurementId){
      assert(node.validation.some(r=>r.type==='calculationWithinTolerance'&&r.calculationId===p.calculationId),'Arithmetic must pass before advancing');
      assert(p.trialReferenceId,'Calculation bound to accepted trial');
      assert(compiled.actions.some(other=>other.parameters.titrationOperation==='record-final'&&other.parameters.trialReferenceId===p.trialReferenceId&&other.parameters.measurementId===p.finalBuretteMeasurementId),'Calculation consumes its own recorded final reading');
    }
  }
  for(const e of compiled.initialState.equipment) {
    const c=e.contents;
    if(c.concentration?.unit==='M'&&c.solutes.length===1&&c.solutes[0].unit==='mol') assert(Math.abs(c.solutes[0].amount-c.volumeMl*c.concentration.value/1000)<1e-10,'Stock moles must agree with volume and molarity');
  }
  if(id==='hydrogen-peroxide-redox-titration')assert(!/NaOH|sodium hydroxide|base excess/i.test(JSON.stringify(compiled.actions)),'Redox terminology remains distinct');
  for(const output of technique.composition.evidenceOutputs)assert(actions.has(output.actionId),'Declared evidence producer exists');
  actionCount+=compiled.actions.length;
  console.log(`${id}: ${compiled.actions.length} actions, ${compiled.process.nodes.length} nodes`);
}
const reusable=buildReusableTrial();
assert.deepEqual(read(`public/techniques/${reusable.id}.json`),reusable);
const witness=composeLab({...products.find(p=>p.lab.id==='beverage-acidity').lab,id:'cycle07-reuse-static-witness'},reusable);
const compiledReuse=await compileLabComposition(witness,async()=>reusable);
assert.equal(compiledReuse.actions.length,reusable.actions.length);
const four=structuredClone(witness);
four.titrationModels=[1,2,3,4].map(i=>({...structuredClone(witness.titrationModels[0]),id:`approved-model-${i}`}));
four.techniqueInstances=[1,2,3,4].map(i=>{const instance=structuredClone(witness.techniqueInstances[0]);instance.instanceId=`trial-${i}`;delete instance.preserveIds;instance.bindings.models=Object.fromEntries(reusable.composition.modelSlots.map(slot=>[slot.id,`approved-model-${i}`]));return instance;});
four.compositionStart={kind:'technique-port',instanceId:'trial-1',portId:'entry'};
four.compositionConnections=[1,2,3].map(i=>({label:'Next independent approved trial',from:{kind:'technique-port',instanceId:`trial-${i}`,portId:'exit'},to:{kind:'technique-port',instanceId:`trial-${i+1}`,portId:'entry'}}));
const compiledFour=await compileLabComposition(four,async()=>reusable);
assert.equal(compiledFour.actions.length,reusable.actions.length*4);
assert.equal(new Set(compiledFour.actions.filter(a=>a.parameters.titrationOperation==='read-initial').map(a=>a.parameters.trialReferenceId)).size,4,'Independent consumer evidence namespaces');
assert.equal(overlay.rows.length,actionCount+reusable.actions.length,'Overlay covers families plus the published reusable trial');
assert.equal(read(`${lane}/technique-atomicity-overlay.json`).rows.length,actionCount+reusable.actions.length);
assert.equal(read(`${lane}/lab-composition-overlay.json`).rows.length,actionCount);
console.log('Static schemas, exact pins, generation, branch references, trial identities, evidence producers, and overlay coverage passed. No runtime actions executed.');
