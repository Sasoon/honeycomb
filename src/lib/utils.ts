import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Design system utilities for consistent styling
export const designTokens = {
  // Spacing scale following shadcn patterns
  spacing: {
    xs: "space-y-2",
    sm: "space-y-3", 
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  },
  
  // Border radius scale
  radius: {
    sm: "rounded-lg",
    md: "rounded-xl", 
    lg: "rounded-2xl",
    xl: "rounded-3xl",
    full: "rounded-full",
  },
  
  // Shadow system
  shadows: {
    sm: "shadow-sm",
    md: "shadow-lg shadow-secondary/10",
    lg: "shadow-2xl shadow-secondary/20",
    glow: "shadow-lg shadow-amber/20",
  },
  
  // Typography hierarchy
  typography: {
    h1: "text-3xl font-bold text-text-primary",
    h2: "text-2xl font-semibold text-text-primary", 
    h3: "text-xl font-semibold text-text-primary",
    h4: "text-lg font-medium text-text-primary",
    body: "text-base text-text-primary",
    caption: "text-sm text-text-secondary",
    muted: "text-xs text-text-muted",
  },
  
  // Interactive states
  interactive: {
    hover: "transition-all duration-200 hover:shadow-lg",
    focus: "focus:outline-none focus:ring-2 focus:ring-amber/50",
    disabled: "disabled:opacity-50 disabled:cursor-not-allowed",
  }
}

// Animation utilities
export const animations = {
  fadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 }
  },
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: "spring", damping: 15 }
  }
}