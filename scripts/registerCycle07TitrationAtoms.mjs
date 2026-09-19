import fs from 'node:fs';
import { titrationOperations } from '../src/domain/titrationOperations.ts';
const path = 'src/domain/atomRegistry.json';
const registry = JSON.parse(fs.readFileSync(path));
registry.atoms=registry.atoms.filter(a=>!['atom.measureVolume.titration-read-initial','atom.measureVolume.titration-read-final','atom.observe.titration-tip-inspection'].includes(a.id));
for (const [operation, contract] of Object.entries(titrationOperations)) {
  const id = `atom.${contract.verb}.titration-${operation}`;
  const atom = { id, family: 'titration', documentationLabel: `Titration: ${operation}`, verb: contract.verb,
    allowedInteractionTypes: ['recordNotebook'], effectContract: contract.effect,
    requiredRoles: operation==='read-ph' ? ['immersed-probe-instrument','immersed-probe-vessel'] : ['mix','observe','practice-mix','practice-observe'].includes(operation) ? [operation.startsWith('practice-')?'reaction-vessel':'analyte-receiver'] : operation.startsWith('practice-') ? ['liquid-source', 'reaction-vessel'] : ['titrant-delivery-device', 'analyte-receiver'], optionalRoles: [],
    proceduralConstraints: ['Use only the named trial and its current physical equipment and recorded evidence.', 'Teacher-approved quantities, persistence, and disposal remain configuration.'],
    evidence: 'An independently observable typed titration state transition or scoped evidence operation.',
    sourceExamples: [{ sourceFile: 'acid-in-fruit-juice-and-soft-drinks_2026-07-27.md', sourceTable: 'phase', step: 'T-03 through T-09', basis: 'R' }], contentExamples: [] };
  const index = registry.atoms.findIndex(a => a.id === id);
  if (index < 0) registry.atoms.push(atom); else registry.atoms[index] = atom;
}
const sourceExamplesById = {
  'atom.observe.titration-read-final': [
    { sourceFile: 'acid-in-fruit-juice-and-soft-drinks_2026-07-27.md', sourceTable: 'phase', step: 'T-08', basis: 'M' },
    { sourceFile: 'acid-base-titration-curves_2026-07-27.md', sourceTable: 'phase', step: 'T-09', basis: 'M' },
    { sourceFile: 'hydrogen-peroxide-redox-titration_2026-07-27.md', sourceTable: 'phase', step: 'ST-04', basis: 'M' },
  ],
  'atom.transfer.discard-titrated-mixture': [
    { sourceFile: 'hydrogen-peroxide-redox-titration_2026-07-27.md', sourceTable: 'safety', step: 'S-08', basis: 'M/C' },
  ],
};
for (const [id, sourceExamples] of Object.entries(sourceExamplesById)) {
  const atom = registry.atoms.find(a => a.id === id);
  if (atom) atom.sourceExamples = sourceExamples;
}
for (const [id, sourceId, role] of [['atom.transfer.discard-practice-mixture','atom.transfer.discard-titrated-mixture','analyte-receiver'],['atom.transfer.add-practice-indicator','atom.transfer.add-indicator','analyte-receiver']]) {
  const atom=structuredClone(registry.atoms.find(a=>a.id===sourceId));atom.id=id;atom.requiredRoles=atom.requiredRoles.map(r=>r===role?'reaction-vessel':r);atom.documentationLabel+=' (test-tube practice)';atom.sourceExamples=[{sourceFile:'acid-in-fruit-juice-and-soft-drinks_2026-07-27.md',sourceTable:'safety',step:'S-05',basis:'M/C'}];atom.contentExamples=[];
  const index=registry.atoms.findIndex(a=>a.id===id);if(index<0)registry.atoms.push(atom);else registry.atoms[index]=atom;
}
for(const [id,sourceId,roles] of [['atom.transfer.burette-rinsate-to-waste','atom.transfer.discard-titrated-mixture',['titrant-delivery-device','waste-receiver']],['atom.rinse.clean-titration-receiver','atom.rinse.quantitative-transfer',['rinse-water-source','rinsed-vessel']]]) {
  const atom=structuredClone(registry.atoms.find(a=>a.id===sourceId));Object.assign(atom,{id,documentationLabel:id.endsWith('waste')?'Route burette rinsate or tip purge to approved waste':'Rinse an empty titration receiver with the approved rinse quantity',requiredRoles:roles,contentExamples:[]});
  if (id === 'atom.rinse.clean-titration-receiver') atom.sourceExamples = [
    { sourceFile: 'acid-in-fruit-juice-and-soft-drinks_2026-07-27.md', sourceTable: 'safety', step: 'S-05', basis: 'M/C' },
    { sourceFile: 'acid-base-titration-curves_2026-07-27.md', sourceTable: 'safety', step: 'S-07', basis: 'M/C' },
    { sourceFile: 'hydrogen-peroxide-redox-titration_2026-07-27.md', sourceTable: 'safety', step: 'S-08', basis: 'M/C' },
  ];
  const index=registry.atoms.findIndex(a=>a.id===id);if(index<0)registry.atoms.push(atom);else registry.atoms[index]=atom;
}
// Refresh only examples owned by the migrated family; preserve other lanes' examples.
const tipAtom = {id:'atom.observe.burette-tip-inspection',family:'titration',documentationLabel:'Inspect the prepared burette tip',verb:'observe',allowedInteractionTypes:['recordNotebook'],effectContract:{classes:['measurement-direct-observation-acquisition','evidence-recording'],targets:[{domain:'measurement-observation'},{domain:'evidence'}]},requiredRoles:['titrant-delivery-device'],optionalRoles:[],proceduralConstraints:['Inspect after the separate tip purge.'],evidence:'Learner records the observed tip condition.',sourceExamples:[{sourceFile:'acid-in-fruit-juice-and-soft-drinks_2026-07-27.md',sourceTable:'phase',step:'T-03',basis:'R/C'}],contentExamples:[]};
const tipIndex=registry.atoms.findIndex(a=>a.id===tipAtom.id);if(tipIndex<0)registry.atoms.push(tipAtom);else registry.atoms[tipIndex]=tipAtom;
const migratedLabs=new Set(['lab:acid-base-titration','lab:beverage-acidity','lab:hydrogen-peroxide-redox-titration']);
for(const atom of registry.atoms) atom.contentExamples=(atom.contentExamples??[]).filter(e=>!migratedLabs.has(e.owner));
const owners=['titration-endpoint','beverage-ph-volume-titration','redox-titration','ph-volume-titration-trial'];
const ownedExamples=owners.filter(id=>fs.existsSync(`public/techniques/${id}.json`)).flatMap(id=>JSON.parse(fs.readFileSync(`public/techniques/${id}.json`)).actions.filter(a=>a.atomId).map(a=>({atomId:a.atomId,owner:`technique:${id}`,actionId:a.id})));
for(const atom of registry.atoms){
  const candidates=ownedExamples.filter(e=>e.atomId===atom.id);
  const old=atom.contentExamples??[];
  if(candidates.length||old.some(e=>owners.some(id=>e.owner===`technique:${id}`))){
    atom.contentExamples=[...old.filter(e=>!owners.some(id=>e.owner===`technique:${id}`)),...owners.flatMap(id=>{const found=candidates.find(e=>e.owner===`technique:${id}`);return found?[{owner:found.owner,actionId:found.actionId}]:[]})];
  }
}
fs.writeFileSync(path, JSON.stringify(registry, null, 2) + '\n');
