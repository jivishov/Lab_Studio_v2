import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Beaker,
  ChevronDown,
  CircleDot,
  Columns3,
  Filter,
  Flame,
  FlaskConical,
  ListFilter,
  MousePointer2,
  Ruler,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { EquipmentDefinition } from "../domain/types";
import { equipmentById, groupedEquipment } from "../equipment/catalog";
import { EquipmentView } from "./EquipmentView";

interface EquipmentShelfProps {
  availableIds?: string[];
  currentStepEquipmentIds?: string[];
  gestureGrabbedDefinitionId?: string;
  hybridPresentation?: boolean;
  onPlace?: (definition: EquipmentDefinition) => void;
  placedCounts?: Record<string, number>;
  shelfCounts?: Record<string, number>;
  showGuidance?: boolean;
  variant?: "grid" | "row";
  shelfFitMaxWidth?: number;
}

const categoryLabels: Record<string, string> = {
  container: "Container",
  chromatography: "Chromatography",
  filtration: "Filtration",
  heating: "Heating",
  measurement: "Measurement",
  reagent: "Reagent",
  sample: "Sample",
  tool: "Tools",
};

const categoryIcons: Record<string, LucideIcon> = {
  container: Beaker,
  chromatography: Columns3,
  filtration: Filter,
  heating: Flame,
  measurement: Ruler,
  reagent: FlaskConical,
  sample: CircleDot,
  tool: Wrench,
};

const itemCountLabel = (count: number): string => `${count} ${count === 1 ? "item" : "items"}`;

interface ShelfRevealTarget {
  category?: string;
  definitionId?: string;
}

export const EquipmentShelf = ({
  availableIds,
  currentStepEquipmentIds = [],
  gestureGrabbedDefinitionId,
  hybridPresentation = true,
  onPlace,
  placedCounts = {},
  shelfCounts,
  showGuidance = true,
  shelfFitMaxWidth,
  variant = "grid",
}: EquipmentShelfProps) => {
  const shelfId = useId();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [hasMoreEquipment, setHasMoreEquipment] = useState(false);
  const shelfScrollRef = useRef<HTMLDivElement>(null);
  const pendingRevealRef = useRef<number | undefined>(undefined);
  const allowed = useMemo(() => new Set(availableIds), [availableIds]);
  const currentStepIds = useMemo(() => new Set(currentStepEquipmentIds), [currentStepEquipmentIds]);
  const groups = useMemo(
    () =>
      Object.entries(groupedEquipment)
        .map(([category, items]) => [
          category,
          (availableIds ? items.filter((item) => allowed.has(item.id)) : items).filter(
            (item) => item.shelfPlaceable !== false,
          ),
        ] as const)
        .filter(([, items]) => items.length > 0),
    [allowed, availableIds],
  );
  const currentStepItems = useMemo(
    () =>
      currentStepEquipmentIds
        .map((definitionId) => equipmentById.get(definitionId))
        .filter(
          (item, index, items): item is EquipmentDefinition =>
            Boolean(
              item &&
                item.shelfPlaceable !== false &&
                (!availableIds || allowed.has(item.id)) &&
                items.findIndex((candidate) => candidate?.id === item.id) === index,
            ),
        ),
    [allowed, availableIds, currentStepEquipmentIds],
  );

  const updateOverflowCue = useCallback(() => {
    const scrollRegion = shelfScrollRef.current;
    if (!scrollRegion) {
      setHasMoreEquipment(false);
      return;
    }
    const remaining = scrollRegion.scrollHeight - scrollRegion.clientHeight - scrollRegion.scrollTop;
    setHasMoreEquipment(scrollRegion.scrollHeight > scrollRegion.clientHeight + 1 && remaining > 8);
  }, []);

  const cancelPendingReveal = useCallback(() => {
    if (pendingRevealRef.current === undefined) return;
    window.clearTimeout(pendingRevealRef.current);
    pendingRevealRef.current = undefined;
  }, []);

  const revealShelfTarget = useCallback((target: ShelfRevealTarget) => {
    const scrollRegion = shelfScrollRef.current;
    if (!scrollRegion) return;

    const equipmentElements = Array.from(
      scrollRegion.querySelectorAll<HTMLElement>(".equipment-view[data-definition-id]"),
    );
    const matchedEquipment = target.definitionId
      ? equipmentElements.find((element) => element.dataset.definitionId === target.definitionId)
      : undefined;
    const targetElement = target.definitionId
      ? matchedEquipment?.getClientRects().length
        ? matchedEquipment
        : matchedEquipment?.closest<HTMLElement>("[data-shelf-category]")?.querySelector<HTMLElement>(".shelf-toggle")
      : target.category
        ? scrollRegion
            .querySelector<HTMLElement>(`[data-shelf-category="${target.category}"]`)
            ?.querySelector<HTMLElement>(".equipment-view[data-definition-id]")
        : undefined;
    if (!targetElement) return;

    const scrollBounds = scrollRegion.getBoundingClientRect();
    const targetBounds = targetElement.getBoundingClientRect();
    const topDelta = targetBounds.top - scrollBounds.top;
    const bottomDelta = targetBounds.bottom - scrollBounds.bottom;
    const delta = topDelta < 0 ? topDelta : bottomDelta > 0 ? bottomDelta : 0;
    if (delta === 0) return;

    const nextScrollTop = Math.max(0, scrollRegion.scrollTop + delta);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (typeof scrollRegion.scrollTo === "function") {
      scrollRegion.scrollTo({
        behavior: reduceMotion ? "auto" : "smooth",
        top: nextScrollTop,
      });
    } else {
      scrollRegion.scrollTop = nextScrollTop;
    }
  }, []);

  const scheduleReveal = useCallback(
    (target: ShelfRevealTarget) => {
      cancelPendingReveal();
      pendingRevealRef.current = window.setTimeout(() => {
        pendingRevealRef.current = undefined;
        revealShelfTarget(target);
      }, 0);
    },
    [cancelPendingReveal, revealShelfTarget],
  );

  useEffect(() => {
    if (!showGuidance || variant !== "grid") {
      cancelPendingReveal();
      return;
    }

    const firstCurrentStepItem = currentStepItems[0];
    if (!firstCurrentStepItem) return;

    const currentStepCategories = groups
      .filter(([, items]) =>
        items.some((item) => currentStepItems.some((currentItem) => currentItem.id === item.id)),
      )
      .map(([category]) => category);
    if (!currentStepCategories.length) return;

    setOpenCategories((current) => {
      const closedCategories = currentStepCategories.filter((category) => !current[category]);
      if (!closedCategories.length) return current;
      return Object.fromEntries([
        ...Object.entries(current),
        ...closedCategories.map((category) => [category, true]),
      ]);
    });
    scheduleReveal({ definitionId: firstCurrentStepItem.id });
  }, [
    cancelPendingReveal,
    currentStepEquipmentIds,
    groups,
    scheduleReveal,
    showGuidance,
    variant,
  ]);

  useEffect(() => {
    if (variant !== "grid") return;
    const scrollRegion = shelfScrollRef.current;
    if (!scrollRegion) return;
    const frame = window.requestAnimationFrame(updateOverflowCue);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateOverflowCue);
    observer?.observe(scrollRegion);
    if (scrollRegion.firstElementChild instanceof HTMLElement) observer?.observe(scrollRegion.firstElementChild);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [groups, openCategories, updateOverflowCue, variant]);

  useEffect(() => {
    if (variant !== "grid" || !gestureGrabbedDefinitionId) return;
    scheduleReveal({ definitionId: gestureGrabbedDefinitionId });
  }, [gestureGrabbedDefinitionId, scheduleReveal, variant]);

  useEffect(() => cancelPendingReveal, [cancelPendingReveal]);

  const renderItem = (item: EquipmentDefinition, placement: "browse" | "needed" = "browse") => {
    const isPlaced = (placedCounts[item.id] ?? 0) > 0;
    const hasShelfInstance = shelfCounts ? (shelfCounts[item.id] ?? 0) > 0 : true;
    const isNeededNow = currentStepIds.has(item.id);
    const placedCount = placedCounts[item.id] ?? 0;
    const statusBadge = isPlaced
      ? placedCount > 1
        ? `Placed · ${placedCount} on bench`
        : "Placed"
      : placement === "browse" && showGuidance && isNeededNow
        ? "Needed now"
        : undefined;
    return (
      <EquipmentView
        accessibilityHidden={hybridPresentation && placement === "browse" && showGuidance && isNeededNow}
        key={item.id}
        definition={item}
        disabled={!hasShelfInstance}
        gestureGrabbed={gestureGrabbedDefinitionId === item.id}
        onDragStart={(event) => {
          if (variant === "grid") scheduleReveal({ definitionId: item.id });
          event.dataTransfer.setData("application/x-lab-equipment", item.id);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onSelect={() => {
          if (variant === "grid") scheduleReveal({ definitionId: item.id });
          onPlace?.(item);
        }}
        statusBadge={statusBadge}
        shelfFitMaxWidth={variant === "grid" ? shelfFitMaxWidth : undefined}
      />
    );
  };

  const toggleCategory = (category: string) => {
    const willOpen = !openCategories[category];
    cancelPendingReveal();
    setOpenCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
    if (willOpen) scheduleReveal({ category });
  };

  if (variant === "row") {
    const rowItems = availableIds
      ? availableIds
          .map((id) => equipmentById.get(id))
          .filter((item): item is EquipmentDefinition => Boolean(item && item.shelfPlaceable !== false))
      : groups.flatMap(([, items]) => items);
    return (
      <aside className="equipment-shelf equipment-shelf-row" aria-label="Equipment shelf">
        <div className="panel-heading">
          <h2>Equipment</h2>
        </div>
        <div
          className="equipment-row"
          data-gesture-scroll-kind="equipmentRow"
          data-gesture-scroll-region="horizontal"
        >
          {rowItems.map((item) => renderItem(item))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="equipment-shelf" aria-label="Equipment shelf">
      <div className="panel-heading">
        <h2>Equipment</h2>
      </div>
      {hybridPresentation && showGuidance && currentStepItems.length > 0 ? (
        <section className="needed-equipment" aria-labelledby={`${shelfId}-needed-title`}>
          <h3 id={`${shelfId}-needed-title`}>Needed now</h3>
          <div className="needed-equipment-list">{currentStepItems.map((item) => renderItem(item, "needed"))}</div>
        </section>
      ) : null}
      {hybridPresentation ? <button
        className="browse-equipment-button"
        type="button"
        onClick={() => {
          cancelPendingReveal();
          const scrollRegion = shelfScrollRef.current;
          if (!scrollRegion) return;
          scrollRegion.scrollTo?.({ behavior: "smooth", top: 0 });
          scrollRegion.querySelector<HTMLButtonElement>(".shelf-toggle")?.focus();
          updateOverflowCue();
        }}
      >
        <ListFilter size={16} aria-hidden="true" /> Browse all equipment
      </button> : null}
      {hybridPresentation ? <p className="equipment-shelf-instruction">Click or drag items to the workbench.</p> : null}
      <div
        aria-label="All equipment categories"
        className="equipment-shelf-scroll"
        data-gesture-scroll-kind="shelf"
        data-gesture-scroll-region="vertical"
        onScroll={() => {
          cancelPendingReveal();
          updateOverflowCue();
        }}
        ref={shelfScrollRef}
      >
        {groups.map(([category, items]) => {
          const isOpen = Boolean(openCategories[category]);
          const categoryId = `${shelfId}-${category}-equipment`;
          const categoryLabel = categoryLabels[category] ?? category;
          const CategoryIcon = categoryIcons[category] ?? Wrench;
          const neededItems = items.filter((item) => currentStepIds.has(item.id));
          const hasNeededItems = showGuidance && neededItems.length > 0;
          return (
            <section
              className={`shelf-group ${isOpen ? "is-open" : ""}`}
              data-shelf-category={category}
              key={category}
            >
              <h3>
                <button
                  aria-controls={categoryId}
                  aria-expanded={isOpen}
                  className="shelf-toggle"
                  type="button"
                  onClick={() => toggleCategory(category)}
                >
                  <CategoryIcon className="shelf-category-icon" size={18} aria-hidden="true" />
                  <span className="shelf-summary">
                    <span className="shelf-title">{categoryLabel}</span>
                    <span className="shelf-count">{itemCountLabel(items.length)}</span>
                  </span>
                  <span className="shelf-action-stack">
                    {hasNeededItems ? <span className="shelf-needed">Needed now</span> : null}
                    <span className="shelf-collapse-cue">
                      <span className="sr-only">{isOpen ? "Collapse" : "Expand"}</span>
                      <ChevronDown className="shelf-chevron" size={16} aria-hidden="true" />
                    </span>
                  </span>
                </button>
              </h3>
              <div className="equipment-grid" hidden={!isOpen} id={categoryId}>
                {items.map((item) => renderItem(item))}
              </div>
            </section>
          );
        })}
      </div>
      {hybridPresentation && hasMoreEquipment ? (
        <p className="equipment-scroll-cue">
          <MousePointer2 size={18} aria-hidden="true" />
          <span>Scroll for more</span>
          <span aria-hidden="true">↕</span>
        </p>
      ) : null}
    </aside>
  );
};
