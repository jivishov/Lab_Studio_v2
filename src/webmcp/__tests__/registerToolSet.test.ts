/// <reference types="webmcp-types" />

import { describe, expect, it, vi } from "vitest";
import { actionCatalog } from "../../assistant/actionCatalog";
import {
  defineWebMCPToolSet,
  registerWebMCPToolSet,
  replaceWebMCPToolSet,
  WEBMCP_NAME_BUDGET,
  WEBMCP_PARAMETER_DESCRIPTION_BUDGET,
  WEBMCP_TOOL_DESCRIPTION_BUDGET,
  type WebMCPToolDescriptor,
} from "../registerToolSet";
import { WebMCPRegistryController } from "../useWebMCPRegistry";
import {
  serializedResultLength,
  WEBMCP_RESULT_CHARACTER_BUDGET,
  type JsonValue,
  type WebMCPResult,
} from "../result";

interface CapturedRegistration {
  tool: WebMCP.ModelContextTool;
  signal?: AbortSignal;
}

const createModelContext = () => {
  const registrations: CapturedRegistration[] = [];
  const registerTool = vi.fn(
    async (tool: WebMCP.ModelContextTool, options?: WebMCP.ModelContextRegisterToolOptions) => {
      registrations.push({ tool, signal: options?.signal });
    },
  );
  return {
    modelContext: { registerTool } as unknown as WebMCP.ModelContext,
    registrations,
    registerTool,
  };
};

const result = (
  revision = 1,
  data?: JsonValue,
): WebMCPResult<JsonValue> => ({
  ok: true,
  code: "OK",
  message: "Tool completed.",
  ...(data === undefined ? {} : { data }),
  state: { surface: "studio", revision },
});

const descriptor = (
  overrides: Partial<WebMCPToolDescriptor> = {},
): WebMCPToolDescriptor => ({
  name: "inspect_cycle_foundation",
  title: "Inspect cycle foundation",
  description: "Return the current foundation revision.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  validateInput: (input) => ({ ok: true, value: input as Record<string, unknown> }),
  execute: () => result(),
  ...overrides,
});

const toolSet = (tool: WebMCPToolDescriptor = descriptor()) =>
  defineWebMCPToolSet({
    surface: "studio",
    allowedNames: [tool.name],
    tools: [tool],
  });

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe("direct WebMCP registry foundation", () => {
  it("treats a missing browser API as an unsupported progressive-enhancement state", async () => {
    const registration = await registerWebMCPToolSet(toolSet(), {
      resolveModelContext: () => undefined,
    });

    expect(registration.status).toBe("unsupported");
    await expect(registration.whenRetired()).resolves.toBeUndefined();
  });

  it("registers explicit descriptors with one registration owner and cleans them up", async () => {
    const { modelContext, registrations, registerTool } = createModelContext();
    const registration = await registerWebMCPToolSet(toolSet(), {
      resolveModelContext: () => modelContext,
    });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registrations[0]?.tool.name).toBe("inspect_cycle_foundation");
    expect(registrations[0]?.tool.annotations).toEqual({ readOnlyHint: true });
    expect(registrations[0]?.signal?.aborted).toBe(false);

    registration.dispose();
    expect(registrations[0]?.signal?.aborted).toBe(true);
  });

  it("passes execution cancellation to the application handler", async () => {
    const { modelContext, registrations } = createModelContext();
    const execute = vi.fn((_input, context) => {
      expect(context.signal.aborted).toBe(false);
      return result();
    });
    await registerWebMCPToolSet(toolSet(descriptor({ execute })), {
      resolveModelContext: () => modelContext,
    });
    const executionController = new AbortController();

    await registrations[0]?.tool.execute({}, { signal: executionController.signal });

    expect(execute).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ signal: executionController.signal }),
    );
  });

  it("retains owner cancellation when an experimental client omits its signal", async () => {
    const { modelContext, registrations } = createModelContext();
    const pending = deferred<WebMCPResult<JsonValue>>();
    let applicationSignal: AbortSignal | undefined;
    const execute = vi.fn((_input, context) => {
      applicationSignal = context.signal;
      return pending.promise;
    });
    const registration = await registerWebMCPToolSet(toolSet(descriptor({ execute })), {
      resolveModelContext: () => modelContext,
    });

    const activeExecution = registrations[0]?.tool.execute(
      {},
      {} as WebMCP.ToolExecuteCallbackOptions,
    );
    registration.dispose();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(applicationSignal).toBeInstanceOf(AbortSignal);
    expect(applicationSignal?.aborted).toBe(true);
    pending.resolve(result());
    await activeExecution;
  });

  it("rejects malformed input at the required validation boundary before controller access", async () => {
    const { modelContext, registrations } = createModelContext();
    const execute = vi.fn(() => result());
    await registerWebMCPToolSet(
      toolSet(
        descriptor({
          validateInput: () => ({
            ok: false,
            result: {
              ok: false,
              code: "INVALID_TOOL_INPUT",
              message: "The input did not match the registered schema.",
              state: { surface: "studio", revision: 3 },
            },
          }),
          execute,
        }),
      ),
      { resolveModelContext: () => modelContext },
    );

    const invalid = await registrations[0]?.tool.execute(
      { unexpected: true },
      { signal: new AbortController().signal },
    );

    expect(invalid).toMatchObject({ ok: false, code: "INVALID_TOOL_INPUT" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("signals active application work when the registry is disposed", async () => {
    const { modelContext, registrations } = createModelContext();
    const pending = deferred<WebMCPResult<JsonValue>>();
    let applicationSignal: AbortSignal | undefined;
    const registration = await registerWebMCPToolSet(
      toolSet(
        descriptor({
          execute: (_input, context) => {
            applicationSignal = context.signal;
            return pending.promise;
          },
        }),
      ),
      { resolveModelContext: () => modelContext },
    );

    const activeExecution = registrations[0]?.tool.execute(
      {},
      { signal: new AbortController().signal },
    );
    registration.dispose();

    expect(applicationSignal?.aborted).toBe(true);
    pending.resolve(result());
    await activeExecution;
  });

  it("retires the source set only after its active transition call settles", async () => {
    const { modelContext, registrations } = createModelContext();
    const pending = deferred<WebMCPResult<JsonValue>>();
    const source = await registerWebMCPToolSet(
      toolSet(descriptor({ execute: () => pending.promise })),
      { resolveModelContext: () => modelContext },
    );
    expect(source.status).toBe("ready");
    if (source.status !== "ready") throw new Error("Expected ready source registration.");

    const activeExecution = registrations[0]?.tool.execute(
      {},
      { signal: new AbortController().signal },
    );
    const destination = await replaceWebMCPToolSet(
      source,
      defineWebMCPToolSet({
        surface: "rehearsal",
        allowedNames: ["inspect_rehearsal_foundation"],
        tools: [
          descriptor({
            name: "inspect_rehearsal_foundation",
            execute: () => ({
              ...result(),
              state: { surface: "rehearsal", revision: 1 },
            }),
          }),
        ],
      }),
      { resolveModelContext: () => modelContext },
    );

    expect(destination.status).toBe("ready");
    expect(source.signal.aborted).toBe(false);

    pending.resolve(result());
    await activeExecution;
    await source.whenRetired();
    expect(source.signal.aborted).toBe(true);
  });

  it("preserves the source set when destination registration fails partway", async () => {
    const registrations: CapturedRegistration[] = [];
    let rejectedName: string | undefined;
    const modelContext = {
      registerTool: vi.fn(
        async (
          tool: WebMCP.ModelContextTool,
          options?: WebMCP.ModelContextRegisterToolOptions,
        ) => {
          registrations.push({ tool, signal: options?.signal });
          if (tool.name === rejectedName) throw new Error("Destination registration failed.");
        },
      ),
    } as unknown as WebMCP.ModelContext;
    const source = await registerWebMCPToolSet(toolSet(), {
      resolveModelContext: () => modelContext,
    });
    expect(source.status).toBe("ready");
    if (source.status !== "ready") throw new Error("Expected ready source registration.");
    rejectedName = "rehearsal_broken";

    await expect(
      replaceWebMCPToolSet(
        source,
        defineWebMCPToolSet({
          surface: "rehearsal",
          allowedNames: ["rehearsal_ready", "rehearsal_broken"],
          tools: [
            descriptor({ name: "rehearsal_ready" }),
            descriptor({ name: "rehearsal_broken" }),
          ],
        }),
        { resolveModelContext: () => modelContext },
      ),
    ).rejects.toThrow("Destination registration failed.");

    expect(source.signal.aborted).toBe(false);
    expect(registrations.find((entry) => entry.tool.name === "rehearsal_ready")?.signal?.aborted)
      .toBe(true);
  });

  it("cancels a pending registration request during controller disposal", async () => {
    const pendingRegistration = deferred<void>();
    const registrationStarted = deferred<AbortSignal>();
    const modelContext = {
      registerTool: vi.fn(
        async (
          _tool: WebMCP.ModelContextTool,
          options?: WebMCP.ModelContextRegisterToolOptions,
        ) => {
          if (!options?.signal) throw new Error("Expected registration signal.");
          registrationStarted.resolve(options.signal);
          await pendingRegistration.promise;
        },
      ),
    } as unknown as WebMCP.ModelContext;
    const controller = new WebMCPRegistryController({
      resolveModelContext: () => modelContext,
    });

    const activation = controller.activate(toolSet());
    const registrationSignal = await registrationStarted.promise;
    controller.dispose();

    expect(registrationSignal.aborted).toBe(true);
    pendingRegistration.resolve(undefined);
    await expect(activation).resolves.toMatchObject({ status: "error" });
  });

  it("does not re-register a stable major surface when descriptor identity changes", async () => {
    const { modelContext, registerTool } = createModelContext();
    const controller = new WebMCPRegistryController({
      resolveModelContext: () => modelContext,
    });

    await expect(controller.activate(toolSet())).resolves.toEqual({ status: "ready", surface: "studio" });
    await expect(
      controller.activate(toolSet(descriptor({ execute: () => result(9) }))),
    ).resolves.toEqual({ status: "ready", surface: "studio" });

    expect(registerTool).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("keeps the active source surface when controller destination registration fails", async () => {
    const registrations: CapturedRegistration[] = [];
    const modelContext = {
      registerTool: vi.fn(
        async (
          tool: WebMCP.ModelContextTool,
          options?: WebMCP.ModelContextRegisterToolOptions,
        ) => {
          registrations.push({ tool, signal: options?.signal });
          if (tool.name === "rehearsal_broken") {
            throw new Error("Destination registration failed.");
          }
        },
      ),
    } as unknown as WebMCP.ModelContext;
    const controller = new WebMCPRegistryController({
      resolveModelContext: () => modelContext,
    });
    await controller.activate(toolSet());

    const destination = await controller.activate(
      defineWebMCPToolSet({
        surface: "rehearsal",
        allowedNames: ["rehearsal_broken"],
        tools: [descriptor({ name: "rehearsal_broken" })],
      }),
    );

    expect(destination).toMatchObject({ status: "error" });
    expect(registrations[0]?.signal?.aborted).toBe(false);
    controller.dispose();
  });

  it("registers the destination first and defers source retirement through an active transition call", async () => {
    const { modelContext, registrations } = createModelContext();
    const controller = new WebMCPRegistryController({ resolveModelContext: () => modelContext });
    const pendingStart = deferred<WebMCPResult<JsonValue>>();
    await controller.activate(toolSet(descriptor({
      name: "start_lab_rehearsal",
      execute: () => pendingStart.promise,
    })));
    const sourceSignal = registrations[0]?.signal;
    const activeStart = registrations[0]?.tool.execute(
      {},
      {} as WebMCP.ToolExecuteCallbackOptions,
    );

    const destination = await controller.activate(defineWebMCPToolSet({
      surface: "rehearsal",
      allowedNames: ["inspect_rehearsal"],
      tools: [descriptor({ name: "inspect_rehearsal" })],
    }));

    expect(destination).toEqual({ status: "ready", surface: "rehearsal" });
    expect(registrations.map((entry) => entry.tool.name)).toEqual([
      "start_lab_rehearsal",
      "inspect_rehearsal",
    ]);
    expect(sourceSignal?.aborted).toBe(false);

    pendingStart.resolve(result());
    await activeStart;
    await Promise.resolve();
    expect(sourceSignal?.aborted).toBe(true);
    controller.dispose();
  });

  it("reads current controller state instead of a registration-time snapshot", async () => {
    const { modelContext, registrations } = createModelContext();
    const controller = { revision: 1 };
    await registerWebMCPToolSet(
      toolSet(descriptor({ execute: () => result(controller.revision) })),
      { resolveModelContext: () => modelContext },
    );
    controller.revision = 7;

    const current = await registrations[0]?.tool.execute(
      {},
      { signal: new AbortController().signal },
    );

    expect(current).toMatchObject({ state: { surface: "studio", revision: 7 } });
  });

  it("cannot auto-promote the separate Assistant catalog past an exact allowlist", () => {
    const assistantCommit = actionCatalog.find(
      (action) => action.name === "studio_commit_transaction",
    );
    expect(assistantCommit).toBeDefined();

    expect(() =>
      defineWebMCPToolSet({
        surface: "studio",
        allowedNames: ["inspect_cycle_foundation"],
        tools: [descriptor({ name: assistantCommit?.name ?? "missing" })],
      }),
    ).toThrow(/exactly match its explicit allowlist/);
  });

  it("enforces description, parameter, and compact output budgets", async () => {
    expect(() =>
      toolSet(descriptor({ name: "x".repeat(WEBMCP_NAME_BUDGET + 1) })),
    ).toThrow(/tool-name budget/);
    expect(() =>
      toolSet(descriptor({ description: "x".repeat(WEBMCP_TOOL_DESCRIPTION_BUDGET + 1) })),
    ).toThrow(/tool-description budget/);
    expect(() =>
      toolSet(
        descriptor({
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "x".repeat(WEBMCP_PARAMETER_DESCRIPTION_BUDGET + 1),
              },
            },
          },
        }),
      ),
    ).toThrow(/parameter-description budget/);
    expect(() =>
      toolSet(
        descriptor({
          inputSchema: {
            type: "object",
            properties: {
              ["x".repeat(WEBMCP_NAME_BUDGET + 1)]: { type: "string" },
            },
          },
        }),
      ),
    ).toThrow(/parameter-name budget/);

    const { modelContext, registrations } = createModelContext();
    await registerWebMCPToolSet(
      toolSet(descriptor({ execute: () => result(1, "x".repeat(2_000)) })),
      { resolveModelContext: () => modelContext },
    );
    const compacted = await registrations[0]?.tool.execute(
      {},
      { signal: new AbortController().signal },
    );

    expect(compacted).toMatchObject({ ok: false, code: "RESULT_BUDGET_EXCEEDED" });
    expect(serializedResultLength(compacted)).toBeLessThanOrEqual(
      WEBMCP_RESULT_CHARACTER_BUDGET,
    );
  });

  it("rejects values that JSON.stringify would silently coerce", async () => {
    const { modelContext, registrations } = createModelContext();
    await registerWebMCPToolSet(
      toolSet(
        descriptor({
          execute: () => result(1, { reading: Number.NaN } as unknown as JsonValue),
        }),
      ),
      { resolveModelContext: () => modelContext },
    );

    const nonSerializable = await registrations[0]?.tool.execute(
      {},
      { signal: new AbortController().signal },
    );

    expect(nonSerializable).toMatchObject({ ok: false, code: "NON_SERIALIZABLE_RESULT" });
  });
});
