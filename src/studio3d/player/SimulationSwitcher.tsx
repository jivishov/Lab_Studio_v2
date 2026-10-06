import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { loadSimulations3D, type Simulation3D as Simulation } from "../practice";
import { studio3DRouteHash } from "../routes3d";
import { Icon } from "../ui/Icon";

/**
 * The 3D simulations a learner can move between: Pack 1's techniques in catalogue order, then each
 * later pack's practice versions (Pack 2 decision 1A, 2026-10-05), under a heading per pack.
 */
const loadSimulations = (): Promise<Simulation[]> => loadSimulations3D();

/**
 * The top bar's title as a switcher (decided 2026-09-26): it opens a list of the 3D simulations,
 * the current one marked. Leaving a run that has progress asks first, since a run is not kept (G-13).
 */
export const SimulationSwitcher = ({ currentId, title, hasProgress, onLeave }: {
  currentId: string;
  title: string;
  hasProgress: boolean;
  /** Called before navigating, so the player can stop the camera. */
  onLeave?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [leaving, setLeaving] = useState<Simulation>();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let active = true;
    loadSimulations().then((list) => { if (active) setSimulations(list); }, () => undefined);
    return () => { active = false; };
  }, []);

  // Closes on a press outside it; focus goes to the current simulation when it opens.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("pointerdown", onDown);
    listRef.current?.querySelector<HTMLButtonElement>("[aria-current='true'], button")?.focus();
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setLeaving(undefined);
  };
  const go = (simulation: Simulation) => {
    onLeave?.();
    close();
    window.location.hash = studio3DRouteHash({ view: "technique", techniqueId: simulation.id });
  };
  const choose = (simulation: Simulation) => {
    if (simulation.id === currentId) close();
    else if (hasProgress) setLeaving(simulation);
    else go(simulation);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    event.preventDefault();
  };
  const packs = [...new Set(simulations.map((simulation) => simulation.pack))];

  return (
    <div className="s3d-switcher" ref={rootRef} onKeyDown={onKey}>
      <button type="button" className="s3d-switcher__trigger" aria-haspopup="true" aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}>
        <span className="s3d-topbar__title">{title}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open ? (
        <div className="s3d-switcher__panel" role="dialog" aria-label="3D simulations">
          <p className="s3d-switcher__eyebrow">3D simulations</p>
          {leaving ? (
            <div className="s3d-switcher__confirm" role="alertdialog" aria-label="Leave this run?">
              <p><strong>Leave this run?</strong> Your progress here is not kept. {leaving.title} starts from the beginning.</p>
              <div className="s3d-switcher__actions">
                <button type="button" className="s3d-button" onClick={() => setLeaving(undefined)}>Stay</button>
                <button type="button" className="s3d-button s3d-button--primary" autoFocus onClick={() => go(leaving)}>Leave</button>
              </div>
            </div>
          ) : (
            <ul className="s3d-switcher__list" ref={listRef}>
              {packs.map((pack) => (
                <Fragment key={pack}>
                  {packs.length > 1 ? <li className="s3d-switcher__pack" aria-hidden="true">Pack {pack}{pack > 1 ? " · practice" : ""}</li> : null}
                  {simulations.filter((simulation) => simulation.pack === pack).map((simulation, index) => {
                    const current = simulation.id === currentId;
                    return (
                      <li key={simulation.id}>
                        <button type="button" className={`s3d-switcher__item${current ? " is-current" : ""}`}
                          aria-current={current ? "true" : undefined} aria-label={`Pack ${pack}, ${simulation.title}`} onClick={() => choose(simulation)}>
                          <span className="s3d-switcher__index">{index + 1}</span>
                          <span className="s3d-switcher__text">
                            <span className="s3d-switcher__name">{simulation.title}</span>
                            <span className="s3d-switcher__desc">{simulation.description}</span>
                          </span>
                          {current ? <span className="s3d-switcher__here"><Icon name="check" size={14} />Open</span> : <Icon name="arrow-right" size={16} className="s3d-switcher__go" />}
                        </button>
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
