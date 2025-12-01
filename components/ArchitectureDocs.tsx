
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureDocs: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <h2 className="text-2xl font-bold text-white">System Architecture: Gesture Agar</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-slate-300 space-y-6 leading-relaxed">
          
          <section>
            <h3 className="text-xl font-semibold text-sky-400 mb-3">1. Core Concept</h3>
            <p className="mb-2">
              **Gesture Agar** is a computer vision-based "io" style game. The user controls a biological cell (Blob) that consumes smaller cells to grow in size.
              The core challenge is managing inertia and speed, which decrease as mass increases.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-emerald-400 mb-3">2. Gesture Control System</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-white mb-2">Vector Control</h4>
                <p className="text-sm">
                  We use a <strong>Directional Vector</strong> approach from the <em>Screen Center</em> to the <strong>Palm Center (Middle MCP)</strong>.
                  This ensures stable, jitter-free control compared to fingertip tracking.
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-white mb-2">Smoothing & Sensitivity</h4>
                <p className="text-sm">
                  Since palm tracking is stable, we use high <strong>Exponential Moving Average (EMA)</strong> factors for near-instant responsiveness, with high sensitivity to allow full speed with minimal hand movement.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-purple-400 mb-3">3. Physics Engine</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="font-mono text-xs bg-slate-700 px-2 py-1 rounded h-fit">MASS</span>
                <span>
                  Movement speed is inversely proportional to radius: <code>Speed = BaseSpeed * (Radius ^ -0.4)</code>.
                  This simulates the physics of heavy objects moving slower.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs bg-slate-700 px-2 py-1 rounded h-fit">EAT</span>
                <span>
                  <strong>Collision Detection:</strong> Checks if <code>Distance(Player, Food) &lt; PlayerRadius</code>.
                  <strong>Growth:</strong> Area-based growth. <code>NewRadius = sqrt(OldRadius^2 + FoodArea)</code>. This ensures realistic mass conservation.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-orange-400 mb-3">4. Rendering & Effects</h3>
            <p>
              The player cell is rendered with a <strong>dynamic sine-wave distortion</strong> on its circumference to mimic a breathing, wobbling biological organism.
              The background grid moves via parallax scrolling to convey speed and scale in the infinite world.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};
