import type { ProcessDefinition, ProcessNode } from "./types";

export interface ProcessNodeLayout {
  x: number;
  y: number;
  lane?: string;
  display?: "compact" | "expanded";
}

const columnsPerRow = 3;
const startX = 32;
const startY = 44;
const columnStep = 230;
const rowStep = 128;

const laneForType = (type: ProcessNode["type"]): string => {
  if (type === "teacherNote") return "context";
  if (type === "calculation") return "analysis";
  if (type === "checkpoint" || type === "decision") return "check";
  return "procedure";
};

export const generatedLayoutForNode = (
  node: ProcessNode,
  index: number,
): ProcessNodeLayout => {
  const lane = laneForType(node.type);
  const row = Math.floor(index / columnsPerRow);
  const column = index % columnsPerRow;
  const snakeColumn = row % 2 === 0 ? column : columnsPerRow - 1 - column;

  return {
    x: startX + snakeColumn * columnStep,
    y: startY + row * rowStep,
    lane,
    display: "expanded",
  };
};

export const getProcessNodeLayout = (
  node: ProcessNode,
  index: number,
): ProcessNodeLayout => ({
  ...generatedLayoutForNode(node, index),
  ...node.layout,
});

export const withGeneratedProcessLayouts = <T extends ProcessDefinition>(
  process: T,
): T => ({
  ...process,
  nodes: process.nodes.map((node, index) => ({
    ...node,
    layout: getProcessNodeLayout(node, index),
  })),
});
