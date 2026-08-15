import { useMemo, useState } from "react";
import { momentMap } from "./data/moments";
import { TesseractScene } from "./components/TesseractScene";
import { MomentPanel } from "./components/MomentPanel";
import type { ViewMode } from "./types";
import "./App.css";

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("reality");

  const focusPosition = useMemo(() => {
    if (!selectedId) return null;
    const moment = momentMap.get(selectedId);
    return moment ? moment.position : null;
  }, [selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id || null);
  };

  return (
    <div className="app">
      <div className="scene-container">
        <TesseractScene
          selectedId={selectedId}
          viewMode={viewMode}
          onSelect={handleSelect}
          focusPosition={focusPosition}
        />
        <div className="axis-legend">
          <span>← past</span>
          <span>branches →</span>
        </div>
      </div>
      <MomentPanel
        selectedId={selectedId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNavigate={setSelectedId}
      />
    </div>
  );
}

export default App;
