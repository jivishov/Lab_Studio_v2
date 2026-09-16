import { type KeyboardEvent, type ReactNode, useId, useState } from "react";

export type ContentTab = {
  content: ReactNode;
  detail?: string;
  id: string;
  label: string;
};

type ContentTabsProps = {
  ariaLabel: string;
  className?: string;
  defaultTabId?: string;
  tabs: ContentTab[];
};

const tabButtonId = (baseId: string, tabId: string) => `${baseId}-${tabId}-tab`;
const tabPanelId = (baseId: string, tabId: string) => `${baseId}-${tabId}-panel`;

export const ContentTabs = ({ ariaLabel, className, defaultTabId, tabs }: ContentTabsProps) => {
  const generatedId = useId();
  const [activeTabId, setActiveTabId] = useState(defaultTabId ?? tabs[0]?.id ?? "");

  if (tabs.length === 0) return null;

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab.id),
  );

  const activateTab = (index: number, shouldFocus = false) => {
    const nextTab = tabs[index];
    if (!nextTab) return;
    setActiveTabId(nextTab.id);
    if (shouldFocus) {
      const focusNextTab = () => document.getElementById(tabButtonId(generatedId, nextTab.id))?.focus();
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(focusNextTab);
      } else {
        focusNextTab();
      }
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      activateTab((index + 1) % tabs.length, true);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      activateTab((index - 1 + tabs.length) % tabs.length, true);
    }
    if (event.key === "Home") {
      event.preventDefault();
      activateTab(0, true);
    }
    if (event.key === "End") {
      event.preventDefault();
      activateTab(tabs.length - 1, true);
    }
  };

  return (
    <section className={["content-tabs-shell", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      <div className="content-tabs-list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab.id;
          return (
            <button
              aria-controls={tabPanelId(generatedId, tab.id)}
              aria-selected={isActive}
              id={tabButtonId(generatedId, tab.id)}
              key={tab.id}
              onClick={() => activateTab(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span>{tab.label}</span>
              {tab.detail && <small>{tab.detail}</small>}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={tabButtonId(generatedId, activeTab.id)}
        className="content-tab-panel"
        id={tabPanelId(generatedId, activeTab.id)}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab.content}
      </div>
    </section>
  );
};
