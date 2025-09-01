import { useEffect, useRef } from 'react';

interface AnimatedLockBorderProps {
  isLocking: boolean;
  isUnlocking: boolean;
  isLocked: boolean;
}

const AnimatedLockBorder = ({ isLocking, isUnlocking, isLocked }: AnimatedLockBorderProps) => {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    // Calculate the total path length for the hexagon
    const pathLength = path.getTotalLength();
    
    // Set up the stroke-dasharray to be the full length
    path.style.strokeDasharray = `${pathLength}`;

    if (isLocking) {
      // Start fully dashed (invisible) and animate to visible
      path.style.strokeDashoffset = `${pathLength}`;
      path.animate([
        { strokeDashoffset: `${pathLength}` },
        { strokeDashoffset: '0' }
      ], {
        duration: 400,
        easing: 'ease-in-out',
        fill: 'forwards'
      });
    } else if (isUnlocking) {
      // Start visible and animate to invisible
      path.style.strokeDashoffset = '0';
      path.animate([
        { strokeDashoffset: '0' },
        { strokeDashoffset: `${pathLength}` }
      ], {
        duration: 400,
        easing: 'ease-in-out',
        fill: 'forwards'
      });
    } else if (isLocked) {
      // Show full border immediately
      path.style.strokeDashoffset = '0';
    } else {
      // Hide border immediately
      path.style.strokeDashoffset = `${pathLength}`;
    }
  }, [isLocking, isUnlocking, isLocked]);

  // Only render if we need to show the border
  if (!isLocking && !isUnlocking && !isLocked) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
      viewBox="0 0 100 115.47"
      preserveAspectRatio="none"
    >
      <path
        ref={pathRef}
        d="M 50 0 L 100 28.87 L 100 86.60 L 50 115.47 L 0 86.60 L 0 28.87 Z"
        fill="none"
        stroke="var(--primary)" /* CSS variable */
        strokeWidth="2"
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
        }}
      />
    </svg>
  );
};

export default AnimatedLockBorder;