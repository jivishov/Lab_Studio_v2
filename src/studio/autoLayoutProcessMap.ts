import { getProcessNodeLayout } from "../domain/processLayout";
import type { ProcessNode } from "../domain/types";

export const autoLayoutProcessMap = (nodes: ProcessNode[]): ProcessNode[] =>
  nodes.map((node, index) => ({
    ...node,
    layout: getProcessNodeLayout(node, index),
  }));
