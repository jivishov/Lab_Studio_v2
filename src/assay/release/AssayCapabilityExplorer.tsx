import { useMemo, useState } from "react";
import { assayReleaseServices } from "../../domain-packs/assay/services";
import type { FidelityLevel } from "../../platform/fidelity/types";

export const AssayCapabilityExplorer = () => {
  const [query, setQuery] = useState("");
  const [minimumFidelity, setMinimumFidelity] = useState<FidelityLevel>("F0");
  const result = useMemo(() => assayReleaseServices.searchCapabilities({
    query,
    minimumFidelity,
    limit: 50,
  }), [minimumFidelity, query]);

  return (
    <section aria-labelledby="assay-capability-title" className="assay-library__section assay-capability-explorer">
      <div className="assay-library__section-heading">
        <div>
          <span className="assay-eyebrow">Proof-backed release boundary</span>
          <h2 id="assay-capability-title">Capability explorer</h2>
        </div>
        <span>{result.totalMatched} matches</span>
      </div>
      <div className="assay-capability-explorer__filters">
        <label>
          Search capabilities
          <input onChange={(event) => setQuery(event.currentTarget.value)} type="search" value={query} />
        </label>
        <label>
          Minimum fidelity
          <select
            onChange={(event) => setMinimumFidelity(event.currentTarget.value as FidelityLevel)}
            value={minimumFidelity}
          >
            {(["F0", "F1", "F2", "F3", "F4"] as const).map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
      </div>
      {result.entries.length === 0 ? (
        <p role="status">No registered assay capability matches these filters.</p>
      ) : (
        <div className="assay-capability-explorer__table">
          <table>
            <caption>Registered assay capabilities and honest fidelity ceilings</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Kind</th>
                <th scope="col">Fidelity</th>
                <th scope="col">Accessible paths</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={`${entry.ref.kind}:${entry.ref.id}@${entry.ref.version}`}>
                  <th scope="row">
                    {entry.title}
                    <small>{entry.summary}</small>
                  </th>
                  <td>{entry.ref.kind}</td>
                  <td>{entry.maximumFidelity}</td>
                  <td>{entry.accessiblePathIds.join(", ") || "None registered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
