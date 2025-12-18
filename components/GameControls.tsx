import React, { useRef, useEffect, useCallback } from 'react';
import { Joystick } from './Joystick';

interface GameControlsProps {
    onMove: (angle: number, force: number) => void;
    onMoveEnd: () => void;
    onSplit: () => void;
    onEject: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({ onMove, onMoveEnd, onSplit, onEject }) => {
    const ejectIntervalRef = useRef<number | null>(null);
    const isEjectingRef = useRef(false);

    const startEject = useCallback(() => {
        if (isEjectingRef.current) return;
        isEjectingRef.current = true;
        onEject(); // 立即触发一次
        // 每 100ms 触发一次（受冷却时间限制）
        ejectIntervalRef.current = window.setInterval(() => {
            onEject();
        }, 50);
    }, [onEject]);

    const stopEject = useCallback(() => {
        isEjectingRef.current = false;
        if (ejectIntervalRef.current !== null) {
            clearInterval(ejectIntervalRef.current);
            ejectIntervalRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (ejectIntervalRef.current !== null) {
                clearInterval(ejectIntervalRef.current);
            }
        };
    }, []);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-end p-8 pb-12">
            <div className="flex justify-between items-end w-full">
                {/* Left: Joystick */}
                <div className="pointer-events-auto">
                    <Joystick onMove={onMove} onEnd={onMoveEnd} />
                </div>

                {/* Right: Action Buttons */}
                <div className="flex gap-4 pointer-events-auto">
                    <button
                        className="w-24 h-24 rounded-full bg-rose-500/80 border-4 border-rose-400/50 shadow-lg shadow-rose-500/30 active:scale-95 transition-transform flex flex-col items-center justify-center -mt-4"
                        onTouchStart={(e) => { e.preventDefault(); startEject(); }}
                        onTouchEnd={stopEject}
                        onTouchCancel={stopEject}
                        onMouseDown={startEject}
                        onMouseUp={stopEject}
                        onMouseLeave={stopEject}
                    >
                        <span className="text-3xl">🖐️</span>
                        <span className="text-xs font-bold text-white uppercase mt-1">Eject</span>
                    </button>

                    <button
                        className="w-28 h-28 rounded-full bg-yellow-500/80 border-4 border-yellow-400/50 shadow-lg shadow-yellow-500/30 active:scale-95 transition-transform flex flex-col items-center justify-center -mt-8"
                        onTouchStart={(e) => { e.preventDefault(); onSplit(); }}
                        onClick={onSplit}
                    >
                        <span className="text-3xl">✌️</span>
                        <span className="text-xs font-bold text-white uppercase mt-1">Split</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
