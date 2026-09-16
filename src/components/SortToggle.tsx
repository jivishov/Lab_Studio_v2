export type SortDirection = "asc" | "desc";

type SortToggleProps = {
  ariaLabel: string;
  direction: SortDirection;
  onDirectionChange: (direction: SortDirection) => void;
};

const sortOptions: Array<{ direction: SortDirection; label: string }> = [
  { direction: "asc", label: "A-Z" },
  { direction: "desc", label: "Z-A" },
];

export const SortToggle = ({ ariaLabel, direction, onDirectionChange }: SortToggleProps) => (
  <div className="sort-toggle" role="group" aria-label={ariaLabel}>
    {sortOptions.map((option) => (
      <button
        aria-pressed={direction === option.direction}
        key={option.direction}
        onClick={() => onDirectionChange(option.direction)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);
