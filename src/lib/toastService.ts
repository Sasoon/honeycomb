import toast, { ToastOptions } from 'react-hot-toast';

// Variable to store the current active toast ID
let currentToastId: string | null = null;

/**
 * A service to manage toasts and ensure only one is displayed at a time
 */
const toastService = {
    /**
     * Show a success toast, dismissing any existing toasts first
     */
    success: (message: string, options?: ToastOptions) => {
        if (currentToastId) {
            toast.dismiss(currentToastId);
        }
        currentToastId = toast.success(message, options);
        return currentToastId;
    },

    /**
     * Show an error toast, dismissing any existing toasts first
     */
    error: (message: string, options?: ToastOptions) => {
        if (currentToastId) {
            toast.dismiss(currentToastId);
        }
        currentToastId = toast.error(message, options);
        return currentToastId;
    },

    /**
     * Show a loading toast, dismissing any existing toasts first
     */
    loading: (message: string, options?: ToastOptions) => {
        if (currentToastId) {
            toast.dismiss(currentToastId);
        }
        currentToastId = toast.loading(message, options);
        return currentToastId;
    },

    /**
     * Dismiss all toasts
     */
    dismiss: () => {
        if (currentToastId) {
            toast.dismiss(currentToastId);
            currentToastId = null;
        }
    }
};

export default toastService; 