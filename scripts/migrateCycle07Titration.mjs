import fs from 'node:fs';
import { buildFamilies, buildFormalPhVolumeTrial, buildReusableTrial } from './generatorInputs/titration/build.mjs';
for (const {lab, technique} of buildFamilies()) {
  fs.writeFileSync(`public/techniques/${technique.id}.json`,JSON.stringify(technique,null,2)+'\n');
  fs.writeFileSync(`public/labs/${lab.id}.json`,JSON.stringify(lab,null,2)+'\n');
}
const reusable=buildReusableTrial();
fs.writeFileSync(`public/techniques/${reusable.id}.json`,JSON.stringify(reusable,null,2)+'\n');
const formal=buildFormalPhVolumeTrial();
fs.writeFileSync(`public/techniques/${formal.id}.json`,JSON.stringify(formal,null,2)+'\n');
const indexPath='public/techniques/index.json';
// The route-only formal candidate intentionally replaces the unowned Cycle 07 carrier entry;
// keep the fixed catalog count at 42 (41 ownership rows plus one explicit route-only entry).
const index=JSON.parse(fs.readFileSync(indexPath)).filter(e=>e.id!==reusable.id&&e.id!==formal.id);
index.push({id:formal.id,title:formal.title,description:'Route-only indicator-free formal trial for the three configured acid/base pH-volume contexts; the frozen Cycle 07 carrier remains generator-owned but is not a second indexed technique.',file:`${formal.id}.json`,tags:['technique','titration','composition','indicator-free','formal-trial']});
fs.writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');
