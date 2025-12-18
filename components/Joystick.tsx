import React, { useEffect, useRef, useState } from 'react';

interface JoystickProps {
    onMove: (angle: number, force: number) => void;
    onEnd: () => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, onEnd }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stickRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const touchIdRef = useRef<number | null>(null);

    const RADIUS = 50; // Joystick radius

    const handleStart = (clientX: number, clientY: number, touchId: number | null) => {
        if (active) return;
        setActive(true);
        touchIdRef.current = touchId;
        updatePosition(clientX, clientY);
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!active || !containerRef.current) return;
        updatePosition(clientX, clientY);
    };

    const handleEnd = () => {
        setActive(false);
        setPosition({ x: 0, y: 0 });
        touchIdRef.current = null;
        onEnd();
    };

    const updatePosition = (clientX: number, clientY: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        const force = Math.min(distance / RADIUS, 1);
        const moveDist = Math.min(distance, RADIUS);

        const x = Math.cos(angle) * moveDist;
        const y = Math.sin(angle) * moveDist;

        setPosition({ x, y });
        onMove(angle, force);
    };

    // Touch Events
    const onTouchStart = (e: React.TouchEvent) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.changedTouches[0];
        handleStart(touch.clientX, touch.clientY, touch.identifier);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        if (touchIdRef.current === null) return;
        const touch = Array.from(e.changedTouches).find((t: any) => t.identifier === touchIdRef.current) as any;
        if (touch) handleMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        if (touchIdRef.current === null) return;
        const touch = Array.from(e.changedTouches).find((t: any) => t.identifier === touchIdRef.current);
        if (touch) handleEnd();
    };

    // Mouse Events (for testing on PC)
    const onMouseDown = (e: React.MouseEvent) => {
        handleStart(e.clientX, e.clientY, null);
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (touchIdRef.current === null && active) handleMove(e.clientX, e.clientY);
        };
        const onMouseUp = () => {
            if (touchIdRef.current === null && active) handleEnd();
        };

        if (active) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [active]);

    return (
        <div
            ref={containerRef}
            className="relative w-32 h-32 bg-slate-800/50 rounded-full border-2 border-slate-600/50 touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
        >
            <div
                ref={stickRef}
                className="absolute w-12 h-12 bg-cyan-500/80 rounded-full shadow-lg shadow-cyan-500/50"
                style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
                }}
            />
        </div>
    );
};
