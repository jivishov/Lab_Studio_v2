/** Cycle 07-owned definitions. Other AP families remain unchanged. */
import { buildFamilies } from '../titration/build.mjs';
export const refineTitrationDefinition = definition => ['titration-endpoint','redox-titration'].includes(definition.id)
  ? buildFamilies().find(item=>item.technique.id===definition.id).technique : definition;
