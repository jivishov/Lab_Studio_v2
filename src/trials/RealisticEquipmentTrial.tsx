import { useState, type ReactNode } from "react";
import { ArrowLeft, GalleryHorizontalEnd, Images, SplitSquareHorizontal } from "lucide-react";
import { ContentTabs, type ContentTab } from "../components/ContentTabs";
import { SortToggle, type SortDirection } from "../components/SortToggle";
import { realisticEquipmentAssets } from "./realisticEquipmentAssets";

const equipmentLabelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const sortEquipmentAssets = <T extends { label: string; sublabel: string }>(
  assets: T[],
  direction: SortDirection,
): T[] =>
  [...assets].sort((first, second) => {
    const labelComparison = equipmentLabelCollator.compare(first.label, second.label);
    const assetComparison =
      labelComparison === 0
        ? equipmentLabelCollator.compare(first.sublabel, second.sublabel)
        : labelComparison;
    return direction === "asc" ? assetComparison : -assetComparison;
  });

const TrialSectionTitle = ({
  children,
  detail,
  headingId,
  onSortDirectionChange,
  sortDirection,
}: {
  children: ReactNode;
  detail: string;
  headingId: string;
  onSortDirectionChange: (direction: SortDirection) => void;
  sortDirection: SortDirection;
}) => (
  <div className="trial-section-title">
    <h2 id={headingId}>{children}</h2>
    <div className="trial-section-title__meta">
      <span>{detail}</span>
      <SortToggle
        ariaLabel={`Sort ${detail}`}
        direction={sortDirection}
        onDirectionChange={onSortDirectionChange}
      />
    </div>
  </div>
);

export const RealisticEquipmentTrial = () => {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const sortedRealisticEquipmentAssets = sortEquipmentAssets(realisticEquipmentAssets, sortDirection);
  const catalogBackedAssets = sortedRealisticEquipmentAssets.filter((asset) => asset.legacySvgPath);

  const realisticTrialTabs: ContentTab[] = [
    {
      content: (
        <section className="trial-section" aria-labelledby="trial-gallery-title">
          <TrialSectionTitle
            detail="Transparent SVG cutouts"
            headingId="trial-gallery-title"
            onSortDirectionChange={setSortDirection}
            sortDirection={sortDirection}
          >
            <Images size={18} aria-hidden="true" /> Asset Gallery
          </TrialSectionTitle>
          <div className="trial-gallery-grid">
            {sortedRealisticEquipmentAssets.map((asset) => (
              <article className="trial-gallery-card" key={asset.id}>
                <div className="trial-transparent-stage">
                  <img src={asset.svgPath} alt={`${asset.label} realistic trial asset`} />
                </div>
                <strong>{asset.label}</strong>
                <span>{asset.sublabel}</span>
              </article>
            ))}
          </div>
        </section>
      ),
      detail: `${sortedRealisticEquipmentAssets.length} cutouts`,
      id: "asset-gallery",
      label: "Asset Gallery",
    },
    {
      content: (
        <section className="trial-section" aria-labelledby="trial-shelf-title">
          <TrialSectionTitle
            detail="Reference card layout"
            headingId="trial-shelf-title"
            onSortDirectionChange={setSortDirection}
            sortDirection={sortDirection}
          >
            <GalleryHorizontalEnd size={18} aria-hidden="true" /> Shelf Preview
          </TrialSectionTitle>
          <div className="trial-shelf-preview" aria-label="Equipment shelf preview">
            <div className="trial-shelf-bar">
              <strong>Equipment Shelf</strong>
              <div aria-hidden="true" />
            </div>
            <div className="trial-shelf-row">
              {sortedRealisticEquipmentAssets.map((asset) => (
                <article className="trial-shelf-card" key={asset.id}>
                  <img src={asset.svgPath} alt="" />
                  <strong>{asset.label}</strong>
                  <span>{asset.sublabel}</span>
                </article>
              ))}
            </div>
          </div>
        </section>
      ),
      detail: "Reference layout",
      id: "shelf-preview",
      label: "Shelf Preview",
    },
    {
      content: (
        <section className="trial-section" aria-labelledby="trial-comparison-title">
          <TrialSectionTitle
            detail="Legacy SVG vs realistic SVG"
            headingId="trial-comparison-title"
            onSortDirectionChange={setSortDirection}
            sortDirection={sortDirection}
          >
            <SplitSquareHorizontal size={18} aria-hidden="true" /> SVG Comparison
          </TrialSectionTitle>
          <div className="trial-comparison-grid">
            {catalogBackedAssets.map((asset) => (
              <article className="trial-comparison-card" key={asset.id}>
                <header>
                  <strong>{asset.label}</strong>
                  <span>{asset.sublabel}</span>
                </header>
                <div className="trial-comparison-pair">
                  <div>
                    <span>Legacy SVG</span>
                    <div className="trial-comparison-art current">
                      <img src={asset.legacySvgPath} alt={`${asset.label} legacy SVG asset`} />
                    </div>
                  </div>
                  <div>
                    <span>Realistic SVG</span>
                    <div className="trial-comparison-art realistic">
                      <img src={asset.svgPath} alt={`${asset.label} realistic SVG asset`} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ),
      detail: `${catalogBackedAssets.length} mapped`,
      id: "svg-comparison",
      label: "SVG Comparison",
    },
  ];

  return (
    <main className="realistic-trial" aria-labelledby="realistic-trial-title">
      <header className="surface-header realistic-trial-header">
        <div>
          <a className="trial-back-link" href="#/">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </a>
          <h1 id="realistic-trial-title">Realistic Equipment Asset Trial</h1>
          <p>Standalone review pass for realistic equipment shelf SVG cutouts.</p>
        </div>
        <p className="trial-note">
          These realistic SVG assets are used where catalog mappings exist. This page remains a
          visual QA gallery for the full asset set.
        </p>
      </header>

      <ContentTabs
        ariaLabel="Realistic equipment review sections"
        className="realistic-trial-tabs"
        tabs={realisticTrialTabs}
      />
    </main>
  );
};
