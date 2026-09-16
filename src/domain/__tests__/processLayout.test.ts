import { describe, expect, it } from "vitest";
import { autoLayoutProcessMap } from "../../studio/autoLayoutProcessMap";
import { demoLab } from "../fixtures";
import { generatedLayoutForNode, getProcessNodeLayout } from "../processLayout";

describe("process layout", () => {
  it("generates a compact three-column snake for unpositioned sample lab nodes", () => {
    const layouts = demoLab.process.nodes.map((node, index) => generatedLayoutForNode(node, index));

    expect(layouts.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 32, y: 44 },
      { x: 262, y: 44 },
      { x: 492, y: 44 },
      { x: 492, y: 172 },
      { x: 262, y: 172 },
      { x: 32, y: 172 },
      { x: 32, y: 300 },
      { x: 262, y: 300 },
      { x: 492, y: 300 },
    ]);
    expect(Math.min(...layouts.map((layout) => layout.x))).toBe(32);
    expect(Math.max(...layouts.map((layout) => layout.x))).toBe(492);
    expect(Math.max(...layouts.map((layout) => layout.y))).toBe(300);
  });

  it("preserves authored coordinates when generating and auto-laying out nodes", () => {
    const authoredLayout = {
      x: 940,
      y: 260,
      lane: "authored",
      display: "compact" as const,
    };
    const authoredNode = {
      ...demoLab.process.nodes[0],
      layout: authoredLayout,
    };

    expect(getProcessNodeLayout(authoredNode, 0)).toEqual(authoredLayout);

    const laidOutNodes = autoLayoutProcessMap([authoredNode, demoLab.process.nodes[1]]);

    expect(laidOutNodes[0].layout).toEqual(authoredLayout);
    expect(laidOutNodes[1].layout).toEqual({
      x: 262,
      y: 44,
      lane: "procedure",
      display: "expanded",
    });
  });
});
