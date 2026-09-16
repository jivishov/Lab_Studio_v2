interface BuretteReadoutProps {
  label: string;
  volumeMl: number;
}

const BURETTE_CAPACITY_ML = 50;
const BURETTE_GRADUATION_ML = 0.1;
const SCALE_WINDOW_ML = 1.4;
const SCALE_WINDOW_TENTHS = 14;

export interface BuretteScaleTick {
  valueMl: number;
  positionPercent: number;
  isLabeled: boolean;
  isWholeMilliliter: boolean;
}

export interface BuretteScale {
  endMl: number;
  meniscusPositionPercent: number;
  startMl: number;
  ticks: BuretteScaleTick[];
}

const clampReading = (volumeMl: number): number =>
  Math.min(BURETTE_CAPACITY_ML, Math.max(0, Number.isFinite(volumeMl) ? volumeMl : 0));

const roundToTenth = (valueMl: number): number => Math.round(valueMl * 10) / 10;

/**
 * Builds the locally magnified portion of a 50 mL burette scale. The 0.1 mL
 * graduations are a physical-scale convention; the simulator's 0.05 mL
 * reading resolution remains separate and may place the meniscus between ticks.
 */
export const createBuretteScale = (volumeMl: number): BuretteScale => {
  const reading = clampReading(volumeMl);
  const maxStartMl = BURETTE_CAPACITY_ML - SCALE_WINDOW_ML;
  const centeredStartMl = roundToTenth(Math.floor((reading - SCALE_WINDOW_ML / 2) * 10) / 10);
  const startMl = Math.min(maxStartMl, Math.max(0, centeredStartMl));
  const endMl = roundToTenth(startMl + SCALE_WINDOW_ML);
  const ticks = Array.from({ length: SCALE_WINDOW_TENTHS + 1 }, (_, index) => {
    const valueMl = roundToTenth(startMl + index * BURETTE_GRADUATION_ML);
    return {
      valueMl,
      positionPercent: (index / SCALE_WINDOW_TENTHS) * 100,
      isLabeled: Math.round(valueMl * 10) % 5 === 0,
      isWholeMilliliter: Math.round(valueMl * 10) % 10 === 0,
    };
  });

  return {
    startMl,
    endMl,
    ticks,
    meniscusPositionPercent: ((reading - startMl) / SCALE_WINDOW_ML) * 100,
  };
};

export const BuretteReadout = ({ label, volumeMl }: BuretteReadoutProps) => {
  const reading = clampReading(volumeMl);
  const scale = createBuretteScale(reading);
  return (
    <div
      className="burette-readout"
      aria-label={`${label}: ${reading.toFixed(2)} mL. 50 mL burette with 0.1 mL divisions; scale values increase downward.`}
    >
      <div className="burette-readout__label">{label}</div>
      <div className="burette-readout__body">
        <div
          className="burette-readout__scale"
          aria-hidden="true"
          data-scale-end={scale.endMl.toFixed(1)}
          data-scale-start={scale.startMl.toFixed(1)}
          data-testid="burette-scale"
        >
          <span className="burette-readout__spine" />
          {scale.ticks.map((tick) => (
            <div
              className={`burette-readout__tick${tick.isLabeled ? " is-labeled" : ""}${tick.isWholeMilliliter ? " is-whole" : ""}`}
              data-scale-value={tick.valueMl.toFixed(1)}
              key={tick.valueMl.toFixed(1)}
              style={{ top: `${tick.positionPercent}%` }}
            >
              {tick.isLabeled ? <span className="burette-readout__tick-label">{tick.valueMl.toFixed(1)}</span> : null}
              <span className="burette-readout__tick-mark" />
            </div>
          ))}
          <div
            className="burette-readout__meniscus"
            data-testid="burette-meniscus"
            style={{ top: `${scale.meniscusPositionPercent}%` }}
          />
        </div>
        <div className="burette-readout__reading">
          <div className="burette-readout__value">{reading.toFixed(2)} mL</div>
          <div className="burette-readout__meta">50 mL capacity · 0.1 mL divisions · values increase downward</div>
        </div>
      </div>
    </div>
  );
};
