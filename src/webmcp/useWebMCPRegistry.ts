import { useCallback, useEffect, useRef, useState } from "react";
import {
  registerWebMCPToolSet,
  type ReadyWebMCPRegistration,
  type RegisterWebMCPToolSetOptions,
  type WebMCPToolSetDefinition,
} from "./registerToolSet";

export type WebMCPRegistryStatus = "unsupported" | "registering" | "ready" | "error";

export interface WebMCPRegistryState {
  status: WebMCPRegistryStatus;
  error?: string;
  surface?: WebMCPToolSetDefinition["surface"];
}

export interface WebMCPRegistryHandle extends WebMCPRegistryState {
  activate: (definition: WebMCPToolSetDefinition) => Promise<WebMCPRegistryState>;
  retireActiveWhenIdle: () => void;
}

const waitWithSignal = async <T,>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw signal.reason;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
};

export class WebMCPRegistryController {
  private active?: ReadyWebMCPRegistration;
  private readonly retiring = new Set<ReadyWebMCPRegistration>();
  private pendingRegistration?: AbortController;
  private disposed = false;
  private requestedActivation = 0;
  private transition: Promise<void> = Promise.resolve();

  constructor(private readonly options: RegisterWebMCPToolSetOptions = {}) {}

  getActiveSurface(): WebMCPToolSetDefinition["surface"] | undefined {
    return this.active?.surface;
  }

  private trackRetirement(registration: ReadyWebMCPRegistration): void {
    registration.retireWhenIdle();
    this.retiring.add(registration);
    void registration.whenRetired().then(() => {
      this.retiring.delete(registration);
    });
  }

  private async waitForSurfaceRetirement(
    surface: WebMCPToolSetDefinition["surface"],
    signal: AbortSignal,
  ): Promise<void> {
    const matchingRetirements = [...this.retiring]
      .filter((registration) => registration.surface === surface)
      .map((registration) => registration.whenRetired());
    if (matchingRetirements.length === 0) return;
    await waitWithSignal(Promise.all(matchingRetirements).then(() => undefined), signal);
  }

  activate(definition: WebMCPToolSetDefinition): Promise<WebMCPRegistryState> {
    const activation = ++this.requestedActivation;
    const registrationRequest = new AbortController();
    this.pendingRegistration?.abort();
    this.pendingRegistration = registrationRequest;
    let resolveState: (state: WebMCPRegistryState) => void = () => undefined;
    const statePromise = new Promise<WebMCPRegistryState>((resolve) => {
      resolveState = resolve;
    });

    this.transition = this.transition
      .catch(() => undefined)
      .then(async () => {
        if (this.disposed || activation !== this.requestedActivation) {
          if (this.pendingRegistration === registrationRequest) {
            this.pendingRegistration = undefined;
          }
          resolveState({ status: "error", error: "WebMCP activation was superseded." });
          return;
        }
        if (this.active?.surface === definition.surface) {
          if (this.pendingRegistration === registrationRequest) {
            this.pendingRegistration = undefined;
          }
          resolveState({ status: "ready", surface: this.active.surface });
          return;
        }

        try {
          await this.waitForSurfaceRetirement(definition.surface, registrationRequest.signal);
          const next = await registerWebMCPToolSet(definition, {
            ...this.options,
            registrationRequestSignal: registrationRequest.signal,
          });
          if (this.disposed || activation !== this.requestedActivation) {
            if (next.status === "ready") this.trackRetirement(next);
            resolveState({ status: "error", error: "WebMCP activation was superseded." });
            return;
          }
          if (next.status === "unsupported") {
            resolveState(
              this.active
                ? {
                    status: "error",
                    error: "The destination WebMCP surface is unavailable; the source registry remains active.",
                  }
                : { status: "unsupported" },
            );
            return;
          }
          const previous = this.active;
          this.active = next;
          if (previous) this.trackRetirement(previous);
          resolveState({ status: "ready", surface: next.surface });
        } catch (error) {
          if (this.disposed || activation !== this.requestedActivation) {
            resolveState({ status: "error", error: "WebMCP activation was superseded." });
            return;
          }
          resolveState({
            status: "error",
            error: error instanceof Error ? error.message : "WebMCP tool registration failed.",
          });
        } finally {
          if (this.pendingRegistration === registrationRequest) {
            this.pendingRegistration = undefined;
          }
        }
      });

    return statePromise;
  }

  retireActiveWhenIdle(): void {
    this.requestedActivation += 1;
    this.pendingRegistration?.abort();
    this.pendingRegistration = undefined;
    if (this.active) this.trackRetirement(this.active);
    this.active = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.requestedActivation += 1;
    this.pendingRegistration?.abort();
    this.pendingRegistration = undefined;
    this.active?.dispose();
    this.active = undefined;
    this.retiring.forEach((registration) => registration.dispose());
    this.retiring.clear();
  }
}

export const useWebMCPRegistry = (
  definition: WebMCPToolSetDefinition | null,
): WebMCPRegistryHandle => {
  const controllerRef = useRef<WebMCPRegistryController | null>(null);
  if (!controllerRef.current) controllerRef.current = new WebMCPRegistryController();
  const definitionRef = useRef(definition);
  definitionRef.current = definition;
  const surface = definition?.surface ?? null;
  const [state, setState] = useState<WebMCPRegistryState>(() => ({
    status: typeof document !== "undefined" && document.modelContext ? "registering" : "unsupported",
  }));

  const activate = useCallback(async (
    nextDefinition: WebMCPToolSetDefinition,
  ): Promise<WebMCPRegistryState> => {
    const controller = controllerRef.current ?? new WebMCPRegistryController();
    controllerRef.current = controller;
    setState({ status: "registering", surface: controller.getActiveSurface() });
    const nextState = await controller.activate(nextDefinition);
    setState(nextState);
    return nextState;
  }, []);

  const retireActiveWhenIdle = useCallback(() => {
    controllerRef.current?.retireActiveWhenIdle();
    setState({ status: "unsupported" });
  }, []);

  useEffect(() => {
    const controller = controllerRef.current ?? new WebMCPRegistryController();
    controllerRef.current = controller;
    const currentDefinition = definitionRef.current;
    if (!currentDefinition) {
      controller.retireActiveWhenIdle();
      setState({ status: "unsupported" });
      return;
    }

    let current = true;
    setState({ status: "registering", surface: controller.getActiveSurface() });
    void controller.activate(currentDefinition).then((nextState) => {
      if (current) setState(nextState);
    });
    return () => {
      current = false;
    };
  }, [surface]);

  useEffect(
    () => {
      const controller = controllerRef.current;
      return () => {
        controller?.dispose();
        if (controllerRef.current === controller) controllerRef.current = null;
      };
    },
    [],
  );

  return { ...state, activate, retireActiveWhenIdle };
};
