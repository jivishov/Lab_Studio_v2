/// <reference types="webmcp-types" />

import {
  compactWebMCPResult,
  type JsonValue,
  type WebMCPResult,
  type WebMCPSurface,
} from "./result";

export const WEBMCP_TOOL_DESCRIPTION_BUDGET = 500;
export const WEBMCP_PARAMETER_DESCRIPTION_BUDGET = 150;
export const WEBMCP_NAME_BUDGET = 30;

export interface WebMCPExecutionContext {
  signal: AbortSignal;
}

export type WebMCPInputValidation<TInput extends Record<string, unknown>> =
  | { ok: true; value: TInput }
  | { ok: false; result: WebMCPResult<JsonValue> };

export interface WebMCPToolDescriptor<
  TInput extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: WebMCP.ToolAnnotations;
  validateInput: (input: unknown) => WebMCPInputValidation<TInput>;
  execute: (
    input: TInput,
    context: WebMCPExecutionContext,
  ) => WebMCPResult<JsonValue> | Promise<WebMCPResult<JsonValue>>;
}

export interface WebMCPToolSetDefinition {
  surface: WebMCPSurface;
  allowedNames: readonly string[];
  tools: readonly WebMCPToolDescriptor[];
}

const assertParameterDescriptionBudgets = (value: unknown, path = "inputSchema"): void => {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertParameterDescriptionBudgets(item, `${path}[${index}]`));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === "properties" && child && typeof child === "object" && !Array.isArray(child)) {
      for (const parameterName of Object.keys(child)) {
        if (parameterName.length > WEBMCP_NAME_BUDGET) {
          throw new Error(
            `${childPath}.${parameterName} exceeds the ${WEBMCP_NAME_BUDGET}-character parameter-name budget.`,
          );
        }
      }
    }
    if (
      key === "description" &&
      typeof child === "string" &&
      child.length > WEBMCP_PARAMETER_DESCRIPTION_BUDGET
    ) {
      throw new Error(
        `${childPath} exceeds the ${WEBMCP_PARAMETER_DESCRIPTION_BUDGET}-character parameter-description budget.`,
      );
    }
    assertParameterDescriptionBudgets(child, childPath);
  }
};

const assertToolDescriptor = (tool: WebMCPToolDescriptor): void => {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) {
    throw new Error(
      `${tool.name || "Unnamed tool"} must use 1-128 ASCII letters, digits, underscores, periods, or hyphens.`,
    );
  }
  if (tool.name.length > WEBMCP_NAME_BUDGET) {
    throw new Error(
      `${tool.name} exceeds the ${WEBMCP_NAME_BUDGET}-character tool-name budget.`,
    );
  }
  if (tool.description.length === 0) {
    throw new Error(`${tool.name} must have a non-empty description.`);
  }
  if (tool.description.length > WEBMCP_TOOL_DESCRIPTION_BUDGET) {
    throw new Error(
      `${tool.name} exceeds the ${WEBMCP_TOOL_DESCRIPTION_BUDGET}-character tool-description budget.`,
    );
  }
  if (tool.annotations) {
    const annotationNames = Object.keys(tool.annotations);
    const unexpectedAnnotations = annotationNames.filter(
      (name) => name !== "readOnlyHint" && name !== "untrustedContentHint",
    );
    if (unexpectedAnnotations.length > 0) {
      throw new Error(
        `${tool.name} uses unsupported WebMCP annotations: ${unexpectedAnnotations.join(", ")}.`,
      );
    }
  }
  try {
    const serializedSchema = JSON.stringify(tool.inputSchema);
    if (serializedSchema === undefined) throw new TypeError("Schema serialized to undefined.");
  } catch {
    throw new Error(`${tool.name} must provide a JSON-serializable input schema.`);
  }
  assertParameterDescriptionBudgets(tool.inputSchema);
};

export const defineWebMCPToolSet = (
  definition: WebMCPToolSetDefinition,
): WebMCPToolSetDefinition => {
  const allowedNames = new Set(definition.allowedNames);
  const toolNames = new Set(definition.tools.map((tool) => tool.name));

  if (allowedNames.size !== definition.allowedNames.length) {
    throw new Error(`The ${definition.surface} WebMCP allowlist contains duplicate names.`);
  }
  if (toolNames.size !== definition.tools.length) {
    throw new Error(`The ${definition.surface} WebMCP tool set contains duplicate names.`);
  }

  const unexpected = [...toolNames].filter((name) => !allowedNames.has(name));
  const missing = [...allowedNames].filter((name) => !toolNames.has(name));
  if (unexpected.length || missing.length) {
    throw new Error(
      `The ${definition.surface} WebMCP tool set must exactly match its explicit allowlist. ` +
        `Unexpected: ${unexpected.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    );
  }

  definition.tools.forEach(assertToolDescriptor);
  const tools = definition.tools.map((tool) =>
    Object.freeze({
      ...tool,
      annotations: tool.annotations
        ? Object.freeze({ ...tool.annotations })
        : undefined,
    }),
  );
  return Object.freeze({
    surface: definition.surface,
    allowedNames: Object.freeze([...definition.allowedNames]),
    tools: Object.freeze(tools),
  });
};

interface RegistrationOwner {
  controller: AbortController;
  executionController: AbortController;
  activeExecutions: number;
  retirementRequested: boolean;
  retirementPromise: Promise<void>;
  resolveRetirement: () => void;
  retired: boolean;
}

const createRegistrationOwner = (): RegistrationOwner => {
  let resolveRetirement: () => void = () => undefined;
  const retirementPromise = new Promise<void>((resolve) => {
    resolveRetirement = resolve;
  });
  return {
    controller: new AbortController(),
    executionController: new AbortController(),
    activeExecutions: 0,
    retirementRequested: false,
    retirementPromise,
    resolveRetirement,
    retired: false,
  };
};

const retireOwner = (owner: RegistrationOwner): void => {
  if (owner.retired || !owner.retirementRequested || owner.activeExecutions > 0) return;
  owner.retired = true;
  owner.controller.abort();
  owner.executionController.abort();
  owner.resolveRetirement();
};

const disposeOwner = (owner: RegistrationOwner): void => {
  if (owner.retired) return;
  owner.retired = true;
  owner.retirementRequested = true;
  owner.controller.abort();
  owner.executionController.abort();
  owner.resolveRetirement();
};

interface LinkedAbortSignal {
  signal: AbortSignal;
  dispose: () => void;
}

const linkAbortSignals = (...signals: AbortSignal[]): LinkedAbortSignal => {
  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const abortFrom = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    const listener = () => abortFrom(signal);
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      listeners.forEach((listener, signal) => signal.removeEventListener("abort", listener));
      listeners.clear();
    },
  };
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw signal.reason;
};

export interface ReadyWebMCPRegistration {
  status: "ready";
  surface: WebMCPSurface;
  signal: AbortSignal;
  retireWhenIdle: () => void;
  dispose: () => void;
  whenRetired: () => Promise<void>;
}

export interface UnsupportedWebMCPRegistration {
  status: "unsupported";
  surface: WebMCPSurface;
  retireWhenIdle: () => void;
  dispose: () => void;
  whenRetired: () => Promise<void>;
}

export type WebMCPRegistration = ReadyWebMCPRegistration | UnsupportedWebMCPRegistration;

export interface RegisterWebMCPToolSetOptions {
  resolveModelContext?: () => WebMCP.ModelContext | undefined;
  registrationRequestSignal?: AbortSignal;
}

const browserModelContext = (): WebMCP.ModelContext | undefined =>
  typeof document === "undefined" ? undefined : document.modelContext;

export const registerWebMCPToolSet = async (
  uncheckedDefinition: WebMCPToolSetDefinition,
  options: RegisterWebMCPToolSetOptions = {},
): Promise<WebMCPRegistration> => {
  const definition = defineWebMCPToolSet(uncheckedDefinition);
  const modelContext = (options.resolveModelContext ?? browserModelContext)();
  if (!modelContext) {
    return {
      status: "unsupported",
      surface: definition.surface,
      retireWhenIdle: () => undefined,
      dispose: () => undefined,
      whenRetired: () => Promise.resolve(),
    };
  }

  const owner = createRegistrationOwner();
  let registrationRequestCancelled = false;
  const cancelRegistrationRequest = () => {
    registrationRequestCancelled = true;
    owner.retirementRequested = true;
    retireOwner(owner);
  };
  options.registrationRequestSignal?.addEventListener("abort", cancelRegistrationRequest, {
    once: true,
  });
  if (options.registrationRequestSignal?.aborted) cancelRegistrationRequest();
  const registerTool = options.resolveModelContext
    ? (
        tool: WebMCP.ModelContextTool,
        registrationOptions: WebMCP.ModelContextRegisterToolOptions,
      ) => modelContext.registerTool(tool, registrationOptions)
    : (
        tool: WebMCP.ModelContextTool,
        registrationOptions: WebMCP.ModelContextRegisterToolOptions,
      ) => {
        if (!document.modelContext) {
          throw new Error("WebMCP became unavailable before tool registration completed.");
        }
        return document.modelContext.registerTool(tool, registrationOptions);
      };

  try {
    for (const descriptor of definition.tools) {
      if (registrationRequestCancelled) {
        throw options.registrationRequestSignal?.reason;
      }
      await registerTool(
        {
          name: descriptor.name,
          title: descriptor.title,
          description: descriptor.description,
          inputSchema: descriptor.inputSchema,
          annotations: descriptor.annotations,
          execute: async (input, options) => {
            owner.activeExecutions += 1;
            // Some experimental clients expose tool invocation before they supply the
            // declared per-call signal. Owner cancellation still keeps that execution bounded.
            const clientSignal = options?.signal ?? new AbortController().signal;
            const executionSignal = linkAbortSignals(
              clientSignal,
              owner.executionController.signal,
            );
            try {
              throwIfAborted(executionSignal.signal);
              const validation = descriptor.validateInput(input);
              if (!validation.ok) return compactWebMCPResult(validation.result);
              throwIfAborted(executionSignal.signal);
              return compactWebMCPResult(
                await descriptor.execute(validation.value, {
                  signal: executionSignal.signal,
                }),
              );
            } finally {
              executionSignal.dispose();
              owner.activeExecutions -= 1;
              retireOwner(owner);
            }
          },
        },
        { signal: owner.controller.signal },
      );
      if (registrationRequestCancelled) {
        throw options.registrationRequestSignal?.reason;
      }
    }
  } catch (error) {
    owner.retirementRequested = true;
    retireOwner(owner);
    throw error;
  } finally {
    options.registrationRequestSignal?.removeEventListener(
      "abort",
      cancelRegistrationRequest,
    );
  }

  return {
    status: "ready",
    surface: definition.surface,
    signal: owner.controller.signal,
    retireWhenIdle: () => {
      owner.retirementRequested = true;
      retireOwner(owner);
    },
    dispose: () => {
      disposeOwner(owner);
    },
    whenRetired: () => owner.retirementPromise,
  };
};

export const replaceWebMCPToolSet = async (
  previous: ReadyWebMCPRegistration | undefined,
  nextDefinition: WebMCPToolSetDefinition,
  options: RegisterWebMCPToolSetOptions = {},
): Promise<WebMCPRegistration> => {
  const next = await registerWebMCPToolSet(nextDefinition, options);
  if (next.status === "ready") previous?.retireWhenIdle();
  return next;
};
