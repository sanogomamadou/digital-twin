import { create } from 'zustand';

const useToastStore = create((set) => ({
    toasts: [],
    addToast: (message, type = 'info') => {
        const id = Date.now().toString();
        set((state) => ({
            toasts: [...state.toasts, { id, message, type }]
        }));
        
        // Auto remove after 3s
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter(t => t.id !== id)
            }));
        }, 3000);
    },
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    }))
}));

export default useToastStore;
