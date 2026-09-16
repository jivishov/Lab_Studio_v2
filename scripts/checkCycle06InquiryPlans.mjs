// Basic canonical source-composition lint. No runtime fixture, test runner or simulated procedure.
import { readFile } from 'node:fs/promises';
import { applyLabSetup } from '../src/data/labSetup.ts';
import { compileLabComposition } from '../src/data/compileLabComposition.ts';
const read=async(path)=>JSON.parse(await readFile(path,'utf8'));
const resolve=async(id)=>read(`public/techniques/${id}.json`);
const compile=async(id,setup)=>compileLabComposition(applyLabSetup(await read(`public/labs/${id}.json`),setup),resolve);
const paper={baselineHeightMm:15,solventDepthMm:5,spotVolumeMl:0.01,solventVolumeMl:10,spotterLoadVolumeMl:0.1,paperLengthMm:120,stopFrontMm:80};
for(const solvent of ['water','propanol','ethanol','acetone','chromatography-solvent']) for(const count of [1,2,3]) {
 const other=solvent==='water'?'propanol':'water';
 const result=await compile('paper-chromatography',{...paper,trials:[{solvent,bands:Array.from({length:count},(_,i)=>({label:`Observed region ${i+1}`,color:'#445566',distanceMm:10*(i+1)}))},{solvent:other}]});
 if(result.actions.filter(a=>a.verb==='developChromatogram').length!==2) throw Error('Wrong selected trial count');
}
for(const selectedProcedure of ['appearance,water,conductivity,ph','ph,ethanol,appearance,melting','hcl,naoh,magnet,conductivity']) {
 const result=await compile('bonding-unknown-solids',{knownCount:4,blindCount:4,conductivityThresholds:10,phThresholds:7,meltingApparatusLimits:150,selectedProcedure});
 if(!result.compositionManifest.origins.length) throw Error('Missing bonding origins');
}
const quick={organicRecoveryMethod:'external-unheated-evaporation',aqueousRecoveryMethod:'external-unheated-evaporation',drynessCriterion:'Classroom observed dry endpoint',coolingLimitC:25,acidEndpointPh:3,organicDensity:0.9,aqueousDensity:1};
for(const filtrationMethod of ['gravity','vacuum']) for(const extractionCount of [1,5]) for(const recoveryOrder of ['organic,acidic,aqueous','acidic,aqueous,organic']) {
 const result=await compile('quick-ache-relief-separation',{...quick,filtrationMethod,extractionCount,recoveryOrder});
 if(result.actions.filter(a=>a.extractionIdentity).length!==extractionCount) throw Error('Missing round-local layer identity');
}
console.log('Canonical inquiry composition lint passed: 15 custom paper region/solvent selections; 3 bonding orders; 8 Quick Ache wash/method/order combinations. No runtime executed.');
