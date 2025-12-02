
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
            <h3 className="text-xl font-semibold text-sky-400 mb-3">1. Multi-Blob Player Entity</h3>
            <p className="mb-2">
              The player is no longer a single circle but a collection (Array) of <code>BlobEntity</code> objects. 
              This enables the <strong>Mitosis (Splitting)</strong> mechanic.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-400 pl-4">
               <li><strong>Movement:</strong> All blobs follow the user's hand vector.</li>
               <li><strong>Camera:</strong> Tracks the <em>Centroid</em> (weighted center) of all player blobs.</li>
               <li><strong>Self-Collision:</strong> A physics solver iterates through all player blobs and applies a repulsive force if they overlap, creating a realistic "swarm" fluid behavior.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-emerald-400 mb-3">2. Gesture Control System</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-white mb-2">Palm Movement</h4>
                <p className="text-xs">
                   Tracks Landmark 9 (Middle MCP). 
                   Stable base for continuous movement.
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-yellow-400 mb-2">Victory (Split)</h4>
                <p className="text-xs">
                  <strong>Index & Middle Extended</strong>. Ring & Pinky Curled.
                  Triggers cell division with impulse boost.
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-rose-400 mb-2">Open Hand (Eject)</h4>
                <p className="text-xs">
                  <strong>Middle, Ring, Pinky Extended</strong>.
                  Shoots mass to bait enemies or speed up.
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
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs bg-slate-700 px-2 py-1 rounded h-fit">SPLIT</span>
                <span>
                  When splitting, new cells inherit current velocity + a directional impulse vector (Force 18).
                  Mass is conserved: <code>Area_New = Area_Old / 2</code>.
                </span>
              </li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
};
