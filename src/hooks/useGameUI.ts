import { useState, useEffect, useRef } from 'react';

export interface GameUIProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    openMenu: () => void;
    closeMenu: () => void;
}

export function useGameUI(): GameUIProps {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const openMenu = () => setIsSidebarOpen(true);
    const closeMenu = () => setIsSidebarOpen(false);

    // Automatically close sidebar on mobile when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Only do this on mobile screens
            if (window.innerWidth < 768) {
                // Get the header element
                const headerElement = document.querySelector('header');

                // Skip if click is in the header (where the X button is)
                if (headerElement && headerElement.contains(event.target as Node)) {
                    return;
                }

                if (isSidebarOpen && !(event.target as HTMLElement).closest('.game-sidebar')) {
                    closeMenu();
                }
            }
        }

        // Attach the event listener
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            // Clean up the event listener
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    // Implement swipe detection for mobile
    useEffect(() => {
        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
        };

        const handleTouchMove = (e: TouchEvent) => {
            touchEndX = e.touches[0].clientX;
        };

        const handleTouchEnd = () => {
            // Swipe right to open sidebar
            if (touchEndX - touchStartX > 100 && !isSidebarOpen) {
                openMenu();
            }
            // Swipe left to close sidebar
            else if (touchStartX - touchEndX > 100 && isSidebarOpen) {
                closeMenu();
            }
        };

        if (window.innerWidth < 768) {
            document.addEventListener('touchstart', handleTouchStart);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);

            return () => {
                document.removeEventListener('touchstart', handleTouchStart);
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [isSidebarOpen]);

    return {
        isSidebarOpen,
        setIsSidebarOpen,
        openMenu,
        closeMenu
    };
} 