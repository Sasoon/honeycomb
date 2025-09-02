import { Link, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

type MobileSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(52); // Default fallback
  
  const isActive = (path: string) => location.pathname === path;
  
  // Calculate actual header height on mount
  useEffect(() => {
    const calculateHeaderHeight = () => {
      const headerElement = document.querySelector('header');
      if (headerElement) {
        const height = headerElement.getBoundingClientRect().height;
        setHeaderHeight(Math.round(height));
      }
    };
    
    calculateHeaderHeight();
    window.addEventListener('resize', calculateHeaderHeight);
    return () => window.removeEventListener('resize', calculateHeaderHeight);
  }, []);
  
  // Handle clicking outside the sidebar to close it on mobile
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
        
        if (
          sidebarRef.current && 
          isOpen && 
          !sidebarRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      }
    }

    // Attach the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Clean up the event listener
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle touch swipes for mobile sidebar
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
      // Swipe left to close sidebar
      if (touchStartX - touchEndX > 100 && isOpen) {
        onClose();
      }
    };
    
    if (window.innerWidth < 768) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true } as AddEventListenerOptions);
      document.addEventListener('touchmove', handleTouchMove, { passive: true } as AddEventListenerOptions);
      document.addEventListener('touchend', handleTouchEnd, { passive: true } as AddEventListenerOptions);
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart as any);
        document.removeEventListener('touchmove', handleTouchMove as any);
        document.removeEventListener('touchend', handleTouchEnd as any);
      };
    }
  }, [isOpen, onClose]);
  
  return (
    <>
      {/* Animated backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "fixed inset-0 z-40 md:hidden",
              "backdrop-blur-sm bg-black/20"
            )}
            style={{ top: `${headerHeight}px` }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      
      {/* Animated sliding sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={sidebarRef}
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.3 
            }}
            className={cn(
              "mobile-sidebar bg-bg-primary/95 backdrop-blur-sm", 
              "fixed left-0 w-80 flex flex-col overflow-hidden md:hidden z-50",
              "shadow-2xl shadow-secondary/20",
              "drop-shadow-lg border-r border-secondary/10"
            )}
            style={{
              top: `${headerHeight}px`,
              height: `calc(100vh - ${headerHeight}px)`
            }}
          >
            {/* Sidebar content with staggered animations */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="flex flex-col h-full py-6 px-4 overflow-y-auto"
            >
              {/* Navigation with staggered animations */}
              <nav className="flex flex-col space-y-3">
                {[
                  { to: '/classic', label: 'Classic', isActive: isActive('/classic') || isActive('/') },
                  { to: '/daily', label: 'Daily', isActive: isActive('/daily') },
                  { to: '/leaderboard', label: 'Leaderboard', isActive: isActive('/leaderboard') },
                  { to: '/how-to-play', label: 'Tutorial', isActive: isActive('/how-to-play') }
                ].map((item, index) => (
                  <motion.div
                    key={item.to}
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ 
                      delay: 0.1 + index * 0.05, 
                      duration: 0.2,
                      ease: "easeOut"
                    }}
                  >
                    <Link 
                      to={item.to} 
                      className={cn(
                        "px-4 py-3 rounded-xl font-medium transition-all duration-300",
                        "flex items-center space-x-3 relative group",
                        "border border-transparent",
                        item.isActive
                          ? 'bg-accent-dark text-white shadow-lg shadow-accent/20'
                          : cn(
                              'text-text-primary',
                              'hover:bg-gradient-to-r hover:from-secondary/5 hover:via-secondary/10 hover:to-secondary/5',
                              'hover:border-secondary/20 hover:shadow-lg hover:shadow-secondary/10',
                              'hover:text-text-primary hover:scale-[1.02]',
                              'active:scale-[0.98] active:shadow-sm'
                            )
                      )}
                      onClick={onClose}
                    >
                      <span className={cn(
                        "transition-all duration-300 relative z-10",
                        item.isActive && "drop-shadow-sm font-semibold",
                        !item.isActive && "group-hover:translate-x-0.5"
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </nav>
              
              {/* Bottom spacer */}
              <div className="flex-1" />
              
              {/* Optional footer content */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.2 }}
                className="pt-6 border-t border-secondary/20"
              >
                <p className="text-xs text-text-muted text-center">
                  Swipe left to close
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileSidebar;