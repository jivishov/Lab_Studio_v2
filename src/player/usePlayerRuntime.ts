import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RuntimeActionRequest, RuntimeState } from "../domain/types";
import {
  appendFailedAssessmentAttempt,
  createRuntimeState,
  getActions,
  getProcess,
  performRuntimeAction,
  runInteractionSequence,
  type RuntimeDefinition,
  type RuntimeInteractionIntent,
} from "../runtime";

export const usePlayerRuntime = (
  definition: RuntimeDefinition,
  initialMode: RuntimeState["mode"] = "guided",
  focusNodeId?: string,
  focusVersion = 0,
) => {
  const focusedNodeId = useCallback(
    () => {
      const process = getProcess(definition);
      return focusNodeId && process.nodes.some((node) => node.id === focusNodeId)
        ? focusNodeId
        : undefined;
    },
    [definition, focusNodeId],
  );

  const createFocusedState = useCallback(
    (nextMode: RuntimeState["mode"]) => {
      const nextState = createRuntimeState(definition, nextMode);
      const nodeId = focusedNodeId();
      return nodeId ? { ...nextState, currentNodeId: nodeId } : nextState;
    },
    [definition, focusedNodeId],
  );
  const [mode, setMode] = useState<RuntimeState["mode"]>(initialMode);
  const [state, setState] = useState(() => createFocusedState(initialMode));
  const stateRef = useRef(state);
  const commitState = useCallback((nextState: RuntimeState) => {
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }, []);
  stateRef.current = state;
  const definitionKey = definition.id;
  const previousDefinitionKey = useRef(definitionKey);
  const process = useMemo(() => getProcess(definition), [definition]);
  const actions = useMemo(() => getActions(definition), [definition]);
  const currentNode = process.nodes.find((node) => node.id === state.currentNodeId) ?? process.nodes[0];
  const expectedAction = actions.find((action) => action.id === currentNode?.actionId);

  useLayoutEffect(() => {
    if (previousDefinitionKey.current === definitionKey) return;
    previousDefinitionKey.current = definitionKey;
    commitState(createFocusedState(stateRef.current.mode));
  }, [commitState, createFocusedState, definitionKey]);

  useLayoutEffect(() => {
    const process = getProcess(definition);
    const nodeId = focusNodeId && process.nodes.some((node) => node.id === focusNodeId)
      ? focusNodeId
      : undefined;
    if (!nodeId) return;
    const current = stateRef.current;
    if (current.currentNodeId !== nodeId) {
      commitState({ ...current, currentNodeId: nodeId });
    }
  }, [commitState, definition, focusNodeId, focusVersion]);

  const performAction = useCallback(
    (request: RuntimeActionRequest) => {
      const current = stateRef.current;
      return commitState(performRuntimeAction(definition, current, request));
    },
    [commitState, definition],
  );

  const performIntents = useCallback(
    (intents: readonly RuntimeInteractionIntent[], signal?: AbortSignal) => {
      const result = runInteractionSequence(definition, stateRef.current, intents, signal);
      if (result.state !== stateRef.current) commitState(result.state);
      return result;
    },
    [commitState, definition],
  );

  const reset = useCallback(() => {
    return commitState(createFocusedState(stateRef.current.mode));
  }, [commitState, createFocusedState]);

  const getState = useCallback(() => stateRef.current, []);

  const switchMode = useCallback(
    (nextMode: RuntimeState["mode"]) => {
      setMode(nextMode);
      commitState({ ...stateRef.current, mode: nextMode });
    },
    [commitState],
  );

  const recordAssessmentFailure = useCallback(
    (message: string) => {
      const current = stateRef.current;
      const next = (() => {
        if (current.mode !== "assessment") return current;
        const currentProcess = getProcess(definition);
        const node = currentProcess.nodes.find((candidate) => candidate.id === current.currentNodeId);
        const action = node?.actionId
          ? getActions(definition).find((candidate) => candidate.id === node.actionId)
          : undefined;
        if (!node || !action) return current;
        return appendFailedAssessmentAttempt(current, {
          nodeId: node.id,
          actionId: action.id,
          verb: action.verb,
          message,
          timestamp: new Date().toISOString(),
        });
      })();
      if (next !== current) commitState(next);
    },
    [commitState, definition],
  );

  return {
    actions,
    currentNode,
    expectedAction,
    mode,
    performAction,
    performIntents,
    process,
    recordAssessmentFailure,
    reset,
    setMode: switchMode,
    state,
    getState,
  };
};
