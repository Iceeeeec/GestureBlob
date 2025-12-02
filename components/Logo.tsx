
import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-4 select-none ${className}`}>
      {/* Icon Container */}
      <div className="relative w-12 h-12 flex-shrink-0">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-lg animate-pulse"></div>
        
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mainGradient" x1="10" y1="10" x2="90" y2="90">
              <stop offset="0%" stopColor="#22d3ee" /> {/* Cyan 400 */}
              <stop offset="100%" stopColor="#3b82f6" /> {/* Blue 500 */}
            </linearGradient>
            <linearGradient id="splitGradient" x1="20" y1="20" x2="80" y2="80">
              <stop offset="0%" stopColor="#facc15" /> {/* Yellow 400 */}
              <stop offset="100%" stopColor="#f59e0b" /> {/* Amber 500 */}
            </linearGradient>
          </defs>
          
          {/* Group for main blob animation */}
          <g>
            {/* Main Player Cell */}
            <circle cx="45" cy="55" r="35" fill="url(#mainGradient)" stroke="white" strokeWidth="2" strokeOpacity="0.5">
               <animate attributeName="r" values="35;36;35" dur="3s" repeatCount="indefinite" />
            </circle>

            {/* Splitting/Ejecting Cell (The mechanics representation) */}
            <circle cx="75" cy="25" r="15" fill="url(#splitGradient)" stroke="white" strokeWidth="2" strokeOpacity="0.5">
               <animate attributeName="cy" values="25;28;25" dur="2s" repeatCount="indefinite" />
               <animate attributeName="cx" values="75;72;75" dur="2s" repeatCount="indefinite" begin="0.5s" />
            </circle>
            
            {/* Connection/Membrane strand (Implicit visual connection) */}
            <path d="M65 40 Q 70 35 70 35" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />

            {/* Hand Cursor Icon inside Main Cell */}
            <path 
              fill="white" 
              fillOpacity="0.9"
              d="M45 35 C43 35 41 37 41 39 V50 H39 C37 50 35 52 35 54 V65 C35 70 39 74 44 74 C49 74 53 70 53 65 V46 C53 44 51 42 49 42 V39 C49 37 47 35 45 35 Z"
            />
          </g>

          {/* Orbiting Particle */}
          <circle cx="50" cy="50" r="3" fill="#ec4899">
             <animateTransform 
                attributeName="transform" 
                type="rotate" 
                from="0 50 50" 
                to="360 50 50" 
                dur="4s" 
                repeatCount="indefinite" 
             />
          </circle>
        </svg>
      </div>

      {/* Text Typography */}
      <div className="flex flex-col justify-center">
        {/* Added pr-2 to prevent italic clipping */}
        <h1 className="text-2xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 whitespace-nowrap pb-1 pr-2 leading-none">
          GESTURE
        </h1>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase leading-none">
            AGAR.IO
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
        </div>
      </div>
    </div>
  );
};
