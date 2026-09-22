import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Info,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

export const TeacherSetupPage = ({
  title,
  description,
  children,
  backHref = "#/labs",
  backLabel = "Back to labs",
  context,
  showWorkflow = true,
  guideLabel = "Before students begin",
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  context?: ReactNode;
  showWorkflow?: boolean;
  guideLabel?: string;
}) => (
  <main className="teacher-setup-page">
    <div className="teacher-setup-shell">
      <a className="teacher-setup-back" href={backHref}>
        <ArrowLeft aria-hidden="true" size={16} />
        {backLabel}
      </a>

      <header className="teacher-setup-hero">
        <span className="teacher-setup-eyebrow">
          <ClipboardCheck aria-hidden="true" size={16} />
          Pre-lab configuration
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <div className="teacher-setup-layout">
        <aside className="teacher-setup-guide" aria-label={showWorkflow ? "Setup workflow" : "Route guidance"}>
          <span className="teacher-setup-guide__label">{guideLabel}</span>
          {showWorkflow ? (
            <>
              <ol className="teacher-setup-steps">
                <li className="is-current">
                  <span>1</span>
                  <div><strong>Configure</strong><small>Enter the approved classroom values.</small></div>
                </li>
                <li>
                  <span>2</span>
                  <div><strong>Approve</strong><small>Confirm the model, safety and handling plan.</small></div>
                </li>
                <li>
                  <span>3</span>
                  <div><strong>Launch</strong><small>Start a fresh activity with these settings.</small></div>
                </li>
              </ol>

              <div className="teacher-setup-lock-note">
                <LockKeyhole aria-hidden="true" size={17} />
                <p><strong>Fixed for this run</strong><span>Changing the plan starts a new activity and does not carry evidence forward.</span></p>
              </div>
            </>
          ) : null}

          {context ? <div className="teacher-setup-context">{context}</div> : null}
        </aside>

        <section className="teacher-setup-panel" aria-label="Approved setup form">
          {children}
        </section>
      </div>
    </div>
  </main>
);

export const SetupSection = ({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <fieldset className="teacher-setup-section">
    <legend>
      <span className="teacher-setup-section__number">{number}</span>
      <span className="teacher-setup-section__heading">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </legend>
    <div className="teacher-setup-fields">{children}</div>
  </fieldset>
);

export const SetupField = ({
  label,
  hint,
  optional = false,
  wide = false,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  wide?: boolean;
  children: ReactNode;
}) => (
  <label className={`teacher-setup-field${wide ? " teacher-setup-field--wide" : ""}`}>
    <span className="teacher-setup-field__label">
      <span>{label}</span>
      <small>{optional ? "Optional" : "Required"}</small>
    </span>
    {children}
    {hint ? <span className="teacher-setup-field__hint">{hint}</span> : null}
  </label>
);

export const SetupCallout = ({ children }: { children: ReactNode }) => (
  <div className="teacher-setup-callout">
    <Info aria-hidden="true" size={18} />
    <div>{children}</div>
  </div>
);

export const SetupApproval = ({ children }: { children: ReactNode }) => (
  <label className="teacher-setup-approval">
    <input required type="checkbox" />
    <span>
      <ShieldCheck aria-hidden="true" size={20} />
      <span><strong>Instructor approval</strong><small>{children}</small></span>
    </span>
  </label>
);

export const SetupError = ({ message }: { message?: string }) => (
  message ? <p className="teacher-setup-error" role="alert">{message}</p> : null
);

export const SetupSubmit = ({ label }: { label: string }) => (
  <div className="teacher-setup-actions">
    <p><CheckCircle2 aria-hidden="true" size={17} /> Review every required field and the approval statement.</p>
    <button className="teacher-setup-submit" type="submit">
      {label}
      <ArrowRight aria-hidden="true" size={17} />
    </button>
  </div>
);
