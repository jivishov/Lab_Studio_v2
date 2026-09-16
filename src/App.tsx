import {
  applyTechniqueConfiguration,
  unresolvedConfigurationMessage,
  unresolvedConfigurationSlots,
} from "./data/techniqueConfiguration";
import { TechniqueSetupForm } from "./player/TechniqueSetupForm";
import type { TechniqueDefinition } from "./domain/types";
import { TitrationSetupForm } from "./player/TitrationSetupForm";
import { lazy, Suspense, type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import { PaperSetupForm } from "./player/PaperSetupForm";
import { BondingSetupForm } from "./player/BondingSetupForm";
import { HardWaterSetupForm } from "./player/HardWaterSetupForm";
import { QuickAcheSetupForm } from "./player/QuickAcheSetupForm";
import { ClipboardCheck, FlaskConical, Grid3X3, PanelsTopLeft, Workflow } from "lucide-react";
import { ContentTabs, type ContentTab } from "./components/ContentTabs";
import { SortToggle, type SortDirection } from "./components/SortToggle";
import {
  bundledLabSummaries,
  loadBundledLab,
  loadBundledLabSummaries,
  type BundleSummary,
} from "./data/loadBundledLabs";
import {
  bundledTechniqueSummaries,
  loadBundledTechnique,
  loadBundledTechniqueSummaries,
} from "./data/loadBundledTechniques";
import { parseHashRoute, type AppRoute } from "./routes";
import { getStudioFeatureFlags } from "./platform/featureFlags";
import type { RuntimeDefinition } from "./runtime";
import {
  AssayLibraryRoute,
  AssayResultsRoute,
  AssayStudioRoute,
} from "./assay/AssayRoutes";
import "@xyflow/react/dist/style.css";
import "./styles/app.css";

const AcidBaseTitrationCaseRoute = lazy(() =>
  import("./cases/AcidBaseTitrationCase").then(({ AcidBaseTitrationCase }) => ({
    default: AcidBaseTitrationCase,
  })),
);
const AcidBaseTitrationCurvesInvestigationRoute = lazy(() =>
  import("./investigations/acidBaseTitrationCurves/AcidBaseTitrationCurvesInvestigation").then(
    ({ AcidBaseTitrationCurvesInvestigation }) => ({
      default: AcidBaseTitrationCurvesInvestigation,
    }),
  ),
);
const PurifyMixtureGreenChemistryRoute = lazy(() =>
  import(
    "./investigations/purifyMixtureGreenChemistry/PurifyMixtureGreenChemistryPlayer"
  ).then(({ PurifyMixtureGreenChemistryPlayer }) => ({
    default: PurifyMixtureGreenChemistryPlayer,
  })),
);
const StudentPlayerRoute = lazy(() =>
  import("./player/StudentPlayer").then(({ StudentPlayer }) => ({ default: StudentPlayer })),
);
const TeacherStudioRoute = lazy(() =>
  import("./studio/TeacherStudio").then(({ TeacherStudio }) => ({ default: TeacherStudio })),
);
const BunsenBurner4dgsTrialRoute = lazy(() =>
  import("./trials/BunsenBurner4dgsTrial").then(({ BunsenBurner4dgsTrial }) => ({
    default: BunsenBurner4dgsTrial,
  })),
);
const GoblinAnimationTrialRoute = lazy(() =>
  import("./trials/GoblinAnimationTrial").then(({ GoblinAnimationTrial }) => ({
    default: GoblinAnimationTrial,
  })),
);
const GoblinThreeJsTrialRoute = lazy(() =>
  import("./trials/GoblinThreeJsTrial").then(({ GoblinThreeJsTrial }) => ({
    default: GoblinThreeJsTrial,
  })),
);
const RealisticEquipmentTrialRoute = lazy(() =>
  import("./trials/RealisticEquipmentTrial").then(({ RealisticEquipmentTrial }) => ({
    default: RealisticEquipmentTrial,
  })),
);
const CausalystLibraryRoute = lazy(() =>
  import("./causalyst/author/CausalystRoutes").then(({ CausalystLibraryRoute: route }) => ({ default: route })),
);
const CausalystAuthorRoute = lazy(() =>
  import("./causalyst/author/CausalystRoutes").then(({ CausalystAuthorRoute: route }) => ({ default: route })),
);
const CausalystPreviewRoute = lazy(() =>
  import("./causalyst/author/CausalystRoutes").then(({ CausalystPreviewRoute: route }) => ({ default: route })),
);
const CausalystAttemptRoute = lazy(() =>
  import("./causalyst/author/CausalystRoutes").then(({ CausalystAttemptRoute: route }) => ({ default: route })),
);
const CausalystReviewRoute = lazy(() =>
  import("./causalyst/author/CausalystRoutes").then(({ CausalystReviewRoute: route }) => ({ default: route })),
);
const CausalystLtiRoute = lazy(() =>
  import("./causalyst/lti/CausalystLtiRoute").then(({ CausalystLtiRoute: route }) => ({ default: route })),
);

const useHashRoute = () => {
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
};

const Nav = ({ route }: { route: AppRoute }) => {
  const flags = getStudioFeatureFlags();
  const navItems = [
    {
      href: "#/",
      label: "Lab Studio",
      icon: <FlaskConical size={18} aria-hidden="true" />,
      active: route.name === "home",
    },
    {
      href: "#/studio",
      label: "Studio",
      icon: <Workflow size={16} aria-hidden="true" />,
      active: route.name === "studio",
    },
    {
      href: "#/labs",
      label: "Labs",
      icon: <FlaskConical size={16} aria-hidden="true" />,
      active: route.name === "labs" || route.name === "play",
    },
    {
      href: "#/techniques",
      label: "Techniques",
      icon: <PanelsTopLeft size={16} aria-hidden="true" />,
      active: route.name === "techniques" || route.name === "technique",
    },
    ...(flags.assayStudioV1 ? [
      {
        href: "#/assays",
        label: "Assays",
        icon: <Grid3X3 size={16} aria-hidden="true" />,
        active: route.name === "assays" || route.name === "assay" || route.name === "assay-results",
      },
      {
        href: "#/assay-studio",
        label: "Assay Studio",
        icon: <Workflow size={16} aria-hidden="true" />,
        active: route.name === "assay-studio",
      },
    ] : []),
    ...(flags.causalystLocalV1 ? [{
      href: "#/causalyst",
      label: "Causalyst",
      icon: <ClipboardCheck size={16} aria-hidden="true" />,
      active: route.name === "causalyst" || route.name === "causalyst-author" || route.name === "causalyst-preview" || route.name === "causalyst-attempt" || route.name === "causalyst-review",
    }] : []),
  ];

  return (
    <nav className="app-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <a aria-current={item.active ? "page" : undefined} href={item.href} key={item.href}>
          {item.icon} {item.label}
        </a>
      ))}
    </nav>
  );
};

const useBundleSummaries = () => {
  const [labs, setLabs] = useState<BundleSummary[]>(() => bundledLabSummaries());
  const [techniques, setTechniques] = useState<BundleSummary[]>(() => bundledTechniqueSummaries());

  useEffect(() => {
    let active = true;
    void Promise.all([loadBundledLabSummaries(), loadBundledTechniqueSummaries()])
      .then(([loadedLabs, loadedTechniques]) => {
        if (!active) return;
        setLabs(loadedLabs);
        setTechniques(loadedTechniques);
      })
      .catch(() => {
        if (!active) return;
        setLabs(bundledLabSummaries());
        setTechniques(bundledTechniqueSummaries());
      });
    return () => {
      active = false;
    };
  }, []);

  return { labs, techniques };
};

const publicAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path}`;
};

const homeEquipmentPreview = [
  {
    src: publicAssetPath("assets/equipment-realistic/v1/graduated-cylinder-100ml.png"),
    alt: "Graduated cylinder with measured sample",
    className: "cylinder",
  },
  {
    src: publicAssetPath("assets/equipment-realistic/v1/beaker-250ml.png"),
    alt: "Beaker containing hard-water sample",
    className: "beaker",
  },
  {
    src: publicAssetPath("assets/equipment-realistic/v1/funnel-filter-paper.png"),
    alt: "Funnel with seated filter paper",
    className: "funnel",
  },
  {
    src: publicAssetPath("assets/equipment-realistic/v1/analytical-balance.png"),
    alt: "Analytical balance for precipitate mass",
    className: "balance",
  },
];

const homeWorkflowPreview = [
  {
    label: "Measure",
    detail: "20 mL sample volume",
  },
  {
    label: "Filter",
    detail: "Calcium carbonate precipitate",
  },
  {
    label: "Calculate",
    detail: "375.00 mg/L as CaCO3",
  },
];

const homeAssetTrialLinks = [
  {
    description: "Review realistic SVG cutouts against the legacy equipment assets.",
    href: "#/trial/realistic-equipment",
    title: "Realistic equipment shelf",
  },
  {
    description: "Honest synthetic 4DGS feasibility route with SVG fallback until training passes QA.",
    href: "#/trial/future-splat-bench",
    title: "Bunsen Burner 4DGS trial",
  },
];

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const sortByTitle = <T extends { title: string }>(
  items: T[],
  direction: SortDirection = "asc",
): T[] =>
  [...items].sort((first, second) => {
    const titleComparison = titleCollator.compare(first.title, second.title);
    return direction === "asc" ? titleComparison : -titleComparison;
  });

const CatalogRows = ({
  hrefFor,
  summaries,
}: {
  hrefFor: (summary: BundleSummary) => string;
  summaries: BundleSummary[];
}) => (
  <>
    {summaries.map((summary) => (
      <a className="example-row" href={hrefFor(summary)} key={summary.id}>
        <strong>{summary.title}</strong>
        <span className="example-description">{summary.description}</span>
        {summary.tags.length > 0 && (
          <span className="example-tags">{summary.tags.slice(0, 2).join(" / ")}</span>
        )}
      </a>
    ))}
  </>
);

const CatalogSection = ({
  countLabel,
  hrefFor,
  summaries,
  title,
}: {
  countLabel: string;
  hrefFor: (summary: BundleSummary) => string;
  summaries: BundleSummary[];
  title: string;
}) => (
  <section className="example-browser">
    <div className="panel-heading">
      <h2>{title}</h2>
      <span>
        {summaries.length} {countLabel}
      </span>
    </div>
    <CatalogRows hrefFor={hrefFor} summaries={summaries} />
  </section>
);

const HomeTabPanel = ({
  children,
  count,
  countLabel,
  onSortDirectionChange,
  sortDirection,
  title,
}: {
  children: ReactNode;
  count: number;
  countLabel: string;
  onSortDirectionChange: (direction: SortDirection) => void;
  sortDirection: SortDirection;
  title: string;
}) => (
  <>
    <div className="panel-heading">
      <h2>{title}</h2>
      <div className="panel-heading-meta">
        <span>
          {count} {countLabel}
        </span>
        <SortToggle
          ariaLabel={`Sort ${title}`}
          direction={sortDirection}
          onDirectionChange={onSortDirectionChange}
        />
      </div>
    </div>
    <div className="home-library-list">{children}</div>
  </>
);

const AssetTrialRows = ({ trials }: { trials: typeof homeAssetTrialLinks }) => (
  <>
    {trials.map((trial) => (
      <a className="example-row" href={trial.href} key={trial.href}>
        <strong>{trial.title}</strong>
        <span className="example-description">{trial.description}</span>
      </a>
    ))}
  </>
);

const HomeLibraryTabs = ({ labs, techniques }: { labs: BundleSummary[]; techniques: BundleSummary[] }) => {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const sortedLabs = sortByTitle(labs, sortDirection);
  const sortedTechniques = sortByTitle(techniques, sortDirection);
  const sortedAssetTrials = sortByTitle(homeAssetTrialLinks, sortDirection);

  const tabs: ContentTab[] = [
    {
      content: (
        <HomeTabPanel
          count={labs.length}
          countLabel="labs"
          onSortDirectionChange={setSortDirection}
          sortDirection={sortDirection}
          title="Bundled labs"
        >
          <CatalogRows hrefFor={(summary) => `#/play/${summary.id}`} summaries={sortedLabs} />
        </HomeTabPanel>
      ),
      detail: `${labs.length} labs`,
      id: "labs",
      label: "Labs",
    },
    {
      content: (
        <HomeTabPanel
          count={techniques.length}
          countLabel="techniques"
          onSortDirectionChange={setSortDirection}
          sortDirection={sortDirection}
          title="Standalone techniques"
        >
          <CatalogRows
            hrefFor={(summary) => `#/technique/${summary.id}`}
            summaries={sortedTechniques}
          />
        </HomeTabPanel>
      ),
      detail: `${techniques.length} techniques`,
      id: "techniques",
      label: "Techniques",
    },
    {
      content: (
        <HomeTabPanel
          count={homeAssetTrialLinks.length}
          countLabel="trials"
          onSortDirectionChange={setSortDirection}
          sortDirection={sortDirection}
          title="Asset trials"
        >
          <AssetTrialRows trials={sortedAssetTrials} />
        </HomeTabPanel>
      ),
      detail: `${homeAssetTrialLinks.length} trials`,
      id: "assets",
      label: "Assets",
    },
  ];

  return <ContentTabs ariaLabel="Home content browser" className="home-library-tabs" tabs={tabs} />;
};

const RouteLoading = ({ label = "Loading route" }: { label?: string }) => (
  <main className="route-status" aria-live="polite">
    <h1>{label}</h1>
  </main>
);

const Home = () => {
  const { labs, techniques } = useBundleSummaries();
  const featuredLab = labs.find((summary) => summary.id === "hard-water-demo") ?? labs[0];
  const introRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;

    const updateStickyTop = () => {
      const home = intro.closest<HTMLElement>(".home-screen");
      const nav = document.querySelector<HTMLElement>(".app-nav");
      const pageGap = home ? Number.parseFloat(getComputedStyle(home).paddingTop) || 12 : 12;
      const navHeight = nav?.getBoundingClientRect().height ?? 56;
      const normalTop = navHeight + pageGap;
      const bottomAlignedTop = window.innerHeight - intro.scrollHeight - pageGap;
      intro.style.setProperty(
        "--home-intro-sticky-top",
        `${Math.min(normalTop, bottomAlignedTop)}px`,
      );
    };

    updateStickyTop();
    const resizeObserver = new ResizeObserver(updateStickyTop);
    resizeObserver.observe(intro);
    window.addEventListener("resize", updateStickyTop);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateStickyTop);
    };
  }, []);

  return (
    <main className="home-screen">
      <section className="home-intro" aria-labelledby="home-title" ref={introRef}>
        <div className="home-hero-copy">
          <span className="home-kicker">Schema-authored lab runtime</span>
          <h1 id="home-title">Lab Studio</h1>
          <p>
            Build chemistry techniques as structured process maps, then run the same
            definitions in a static, student-facing simulator.
          </p>
        </div>
        <div className="home-stat-grid" aria-label="Lab Studio capabilities and bundled content summary">
          <div>
            <strong>{labs.length}</strong>
            <span>ready-to-run labs</span>
          </div>
          <div>
            <strong>{techniques.length}</strong>
            <span>reusable techniques</span>
          </div>
          <div>
            <strong>MCP Server</strong>
            <span>Use AI to build experiments</span>
          </div>
        </div>
        <div className="home-demo-preview">
          <div className="home-preview-stage" aria-label="Hard-water filtration equipment preview">
            <div className="home-preview-grid" aria-hidden="true" />
            <div className="home-preview-bench" aria-hidden="true" />
            {homeEquipmentPreview.map((item) => (
              <img
                alt={item.alt}
                className={`home-preview-equipment is-${item.className}`}
                key={item.className}
                src={item.src}
              />
            ))}
            <div className="home-preview-note">
              <strong>Current demo</strong>
              <span>Hard-water gravimetry</span>
            </div>
          </div>
          <div className="home-preview-detail">
            <span className="home-kicker">Featured run</span>
            <h2>{featuredLab?.title ?? "Hard-Water Reference Demo"}</h2>
            <p>
              The first bundled workflow exercises measuring, precipitating, filtering,
              weighing, notebook evidence, and final hardness calculation.
            </p>
            <ol className="home-workflow-preview">
              {homeWorkflowPreview.map((step) => (
                <li key={step.label}>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </li>
              ))}
            </ol>
            <a className="home-preview-link" href="#/play/hard-water-demo">
              Open hard-water demo
            </a>
          </div>
        </div>
        <div className="home-capability-grid" aria-label="Primary Lab Studio surfaces">
          <a href="#/studio">
            <Workflow size={18} aria-hidden="true" />
            <strong>Author</strong>
            <span>Compose nodes, equipment, validation, and preview state.</span>
          </a>
          <a href="#/labs">
            <FlaskConical size={18} aria-hidden="true" />
            <strong>Labs</strong>
            <span>Choose a schema-authored lab, including titration and hard water.</span>
          </a>
          <a href="#/techniques">
            <PanelsTopLeft size={18} aria-hidden="true" />
            <strong>Techniques</strong>
            <span>Practice reusable skills before running a full lab workflow.</span>
          </a>
        </div>
      </section>
      <HomeLibraryTabs labs={labs} techniques={techniques} />
    </main>
  );
};

const CatalogRoute = ({ kind }: { kind: "labs" | "techniques" }) => {
  const { labs, techniques } = useBundleSummaries();
  const isLabs = kind === "labs";
  const summaries = isLabs ? labs : techniques;
  return (
    <main className="catalog-screen">
      <header className="surface-header catalog-header">
        <div className="surface-header-copy">
          <h1>{isLabs ? "Labs" : "Techniques"}</h1>
          <p>
            {isLabs
              ? "Choose a bundled lab to run in Student Player."
              : "Choose a standalone technique to practice in Student Player."}
          </p>
        </div>
      </header>
      <CatalogSection
        countLabel={isLabs ? "labs" : "techniques"}
        hrefFor={(summary) => (isLabs ? `#/play/${summary.id}` : `#/technique/${summary.id}`)}
        summaries={summaries}
        title={isLabs ? "Bundled labs" : "Standalone techniques"}
      />
    </main>
  );
};

const DefinitionRoute = ({
  id,
  kind,
}: {
  id: string;
  kind: "lab" | "technique";
}) => {
  const [definition, setDefinition] = useState<RuntimeDefinition>();
  const [error, setError] = useState<string>();
  const [setup, setSetup] = useState<import("./data/labSetup").LabSetup>();
  // Supplied by a teacher on the standalone technique route; a composed lab needs none.
  const [techniqueConfiguration, setTechniqueConfiguration] = useState<Record<string, string>>();
  const [configurationError, setConfigurationError] = useState<string>();

  useEffect(() => {
    let active = true;
    setDefinition(undefined);
    setError(undefined);
    if (kind === "lab" && ["paper-chromatography", "bonding-unknown-solids", "hard-water-analysis", "quick-ache-relief-separation"].includes(id) && !setup) return;
    const loader = kind === "lab" ? loadBundledLab(id, setup) : loadBundledTechnique(id);
    void loader
      .then((loaded) => {
        if (active) setDefinition(loaded);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load definition.");
      });
    return () => {
      active = false;
    };
  }, [id, kind, setup]);

  if (kind === "lab" && ["acid-base-titration", "beverage-acidity", "hydrogen-peroxide-redox-titration"].includes(id) && (!setup || error)) return <TitrationSetupForm labId={id} onStart={setSetup} error={error} />;

  if (kind === "lab" && id === "paper-chromatography" && (!setup || error)) {
    return <PaperSetupForm onStart={setSetup} error={error} />;
  }
  if (kind === "lab" && id === "bonding-unknown-solids" && (!setup || error)) {
    return <BondingSetupForm onStart={setSetup} error={error} />;
  }
  if (kind === "lab" && id === "hard-water-analysis" && (!setup || error)) return <HardWaterSetupForm onStart={setSetup} error={error} />;
  if (kind === "lab" && id === "quick-ache-relief-separation" && (!setup || error)) return <QuickAcheSetupForm onStart={setSetup} error={error} />;

  if (error) {
    return (
      <main className="route-status" role="alert">
        <h1>Definition unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!definition) {
    return (
      <main className="route-status" aria-live="polite">
        <h1>Loading definition</h1>
      </main>
    );
  }

  // A composed lab resolves its technique configuration while it compiles. This route does not:
  // `loadBundledTechnique` returns the published technique as authored, so a technique written
  // against teacher configuration arrives with `{{config.*}}` templates still sitting in the
  // parameters that are supposed to hold numbers.
  //
  // Reporting that was better than starting an activity that refuses partway through, but it was
  // not a route: six indexed techniques are composed by no lab, so the host a teacher was sent to
  // does not exist. Collect the values here instead — the same values a host lab's compilation
  // would bind, supplied by a teacher rather than defaulted — and name the host lab when there is
  // one, because its already-approved configuration is the better way in.
  if (kind === "technique") {
    const missing = unresolvedConfigurationSlots(definition);
    if (missing.length > 0) {
      const setupForm = (message?: string) => (
        <TechniqueSetupForm
          definition={definition as TechniqueDefinition}
          onStart={(supplied) => {
            setConfigurationError(undefined);
            setTechniqueConfiguration(supplied);
          }}
          error={message}
        />
      );
      if (!techniqueConfiguration) return setupForm(configurationError);
      try {
        const configured = applyTechniqueConfiguration(
          definition as TechniqueDefinition,
          techniqueConfiguration,
        );
        // Nothing is substituted on a guess, so a slot that stayed unbound sends the teacher back
        // to the form naming it, rather than starting an activity that would refuse later.
        const stillMissing = unresolvedConfigurationSlots(configured);
        if (stillMissing.length > 0) return setupForm(unresolvedConfigurationMessage(stillMissing));
        return <StudentPlayerRoute definition={configured} />;
      } catch (failure) {
        return setupForm(failure instanceof Error ? failure.message : String(failure));
      }
    }
  }

  return <StudentPlayerRoute definition={definition} />;
};

/** Labs whose specialized route owns its own composition resolution and needs no shared loader. */
const customPlayerRoutes: Record<string, ReactElement | undefined> = {
  "acid-base-titration-curves": <AcidBaseTitrationCurvesInvestigationRoute />,
  "green-chemistry-mixture-purification": <PurifyMixtureGreenChemistryRoute />,
};

export const App = () => {
  const route = useHashRoute();
  let content = <Home />;

  if (route.name === "studio") {
    content = <TeacherStudioRoute />;
  }

  if (route.name === "labs") {
    content = <CatalogRoute kind="labs" />;
  }

  if (route.name === "techniques") {
    content = <CatalogRoute kind="techniques" />;
  }

  if (route.name === "play") {
    // Both custom-route labs resolve their own compiled composition, so they mount directly rather
    // than waiting on the generic loader. Routing green chemistry only after `DefinitionRoute`
    // had already resolved it meant the shared loader compiled the lab's placeholder
    // configuration on every visit, purely to be discarded.
    const customRoute = customPlayerRoutes[route.labId ?? ""];
    content = customRoute ?? <DefinitionRoute id={route.labId} kind="lab" />;
  }

  if (route.name === "technique") {
    content = <DefinitionRoute id={route.techniqueId} kind="technique" />;
  }

  if (route.name === "assays") {
    content = <AssayLibraryRoute />;
  }

  if (route.name === "assay-studio") {
    content = <AssayStudioRoute />;
  }

  if (route.name === "assay") {
    content = <AssayStudioRoute assayId={route.assayId} />;
  }

  if (route.name === "assay-results") {
    content = <AssayResultsRoute assayId={route.assayId} />;
  }

  if (route.name === "causalyst") {
    content = <CausalystLibraryRoute />;
  }

  if (route.name === "causalyst-author") {
    content = <CausalystAuthorRoute assessmentId={route.assessmentId} />;
  }

  if (route.name === "causalyst-preview") {
    content = <CausalystPreviewRoute assessmentId={route.assessmentId} />;
  }
  if (route.name === "causalyst-attempt") {
    content = <CausalystAttemptRoute assessmentId={route.assessmentId} />;
  }
  if (route.name === "causalyst-review") {
    content = <CausalystReviewRoute />;
  }
  if (route.name === "causalyst-lti") {
    content = <CausalystLtiRoute />;
  }

  if (route.name === "case" && route.caseId === "acid-base-titration") {
    return (
      <Suspense fallback={<RouteLoading label="Loading titration case" />}>
        <AcidBaseTitrationCaseRoute />
      </Suspense>
    );
  }

  if (route.name === "trial" && route.trialId === "realistic-equipment") {
    content = <RealisticEquipmentTrialRoute />;
  }

  if (route.name === "trial" && route.trialId === "goblin-animation") {
    content = <GoblinAnimationTrialRoute />;
  }

  if (route.name === "trial" && route.trialId === "goblin-threejs") {
    content = <GoblinThreeJsTrialRoute />;
  }

  if (
    route.name === "trial" &&
    (route.trialId === "future-splat-bench" || route.trialId === "bunsen-burner-4dgs")
  ) {
    content = <BunsenBurner4dgsTrialRoute />;
  }

  return (
    <div className="app-shell">
      <Nav route={route} />
      <Suspense fallback={<RouteLoading />}>{content}</Suspense>
    </div>
  );
};
