// Type declarations for JSON imports
declare module '*.json' {
    const value: Record<string, number>;
    export default value;
} 