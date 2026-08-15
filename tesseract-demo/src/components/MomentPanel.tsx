import { momentMap, getConnectedMoments } from "../data/moments";
import type { Moment, ViewMode } from "../types";

interface MomentPanelProps {
  selectedId: string | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (id: string) => void;
}

export function MomentPanel({
  selectedId,
  viewMode,
  onViewModeChange,
  onNavigate,
}: MomentPanelProps) {
  const moment = selectedId ? momentMap.get(selectedId) : null;

  return (
    <aside className="panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Personal Tesseract · Raw Demo</p>
          <h1>Moments as space</h1>
        </div>
        <div className="mode-toggle">
          <button
            type="button"
            className={viewMode === "reality" ? "active" : ""}
            onClick={() => onViewModeChange("reality")}
          >
            What happened
          </button>
          <button
            type="button"
            className={viewMode === "what-if" ? "active" : ""}
            onClick={() => onViewModeChange("what-if")}
          >
            What if
          </button>
        </div>
      </header>

      {!moment ? (
        <div className="panel-empty">
          <p className="hint-title">How to explore</p>
          <ul>
            <li>Drag to orbit · scroll to zoom</li>
            <li>Click a glowing frame to enter a moment</li>
            <li>Toggle <strong>What if</strong> to reveal branches</li>
            <li>Deeper on the grid = further in the past</li>
            <li>Side corridors = paths you didn&apos;t take</li>
          </ul>
          <p className="philosophy">
            This is not prediction. It&apos;s a map of possibility — so you can
            feel the weight of coordinates you collapsed when you chose.
          </p>
        </div>
      ) : (
        <MomentDetail
          moment={moment}
          viewMode={viewMode}
          onNavigate={onNavigate}
        />
      )}
    </aside>
  );
}

function MomentDetail({
  moment,
  viewMode,
  onNavigate,
}: {
  moment: Moment;
  viewMode: ViewMode;
  onNavigate: (id: string) => void;
}) {
  const connected = getConnectedMoments(moment.id);
  const isBranch = moment.id.startsWith("branch-");

  return (
    <div className="panel-body">
      <p className="when">{moment.when}</p>
      <h2>{moment.title}</h2>

      {moment.isPresent && <span className="badge present">You are here</span>}
      {moment.isFork && <span className="badge fork">Fork point</span>}
      {isBranch && <span className="badge branch">Alternate path</span>}

      <p className="reality">{moment.reality}</p>

      {moment.forkQuestion && viewMode === "what-if" && (
        <div className="fork-section">
          <h3>{moment.forkQuestion}</h3>
          {moment.alternates?.map((alt) => (
            <div key={alt.id} className="alternate-card">
              <h4>{alt.label}</h4>
              <p>{alt.summary}</p>
              <p className="feeling">{alt.feeling}</p>
            </div>
          ))}
        </div>
      )}

      {connected.length > 0 && (
        <div className="nav-section">
          <h3>Walk the corridor</h3>
          <div className="nav-buttons">
            {connected.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate(m.id)}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="disclaimer">
        Simulated branch — one plausible reading, not truth.
      </p>
    </div>
  );
}
