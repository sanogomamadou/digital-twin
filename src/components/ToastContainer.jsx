import useToastStore from '../store/useToastStore';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            {toasts.map((toast) => {
                const isError = toast.type === 'error';
                const isSuccess = toast.type === 'success';
                
                return (
                    <div 
                        key={toast.id}
                        className="animate-slide"
                        style={{
                            background: 'var(--bg-1)',
                            border: `1px solid ${isError ? 'var(--red)' : isSuccess ? 'var(--green)' : 'var(--border)'}`,
                            boxShadow: 'var(--shadow-lg)',
                            borderRadius: 'var(--r-md)',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            pointerEvents: 'auto',
                            minWidth: '280px',
                            maxWidth: '400px'
                        }}
                    >
                        <div style={{ 
                            color: isError ? 'var(--red)' : isSuccess ? 'var(--green)' : 'var(--text-1)',
                            display: 'flex'
                        }}>
                            {isError ? <AlertCircle size={20} /> : isSuccess ? <CheckCircle2 size={20} /> : <Info size={20} />}
                        </div>
                        <div style={{ flex: 1, fontSize: '14px', color: 'var(--text-0)', fontWeight: 500 }}>
                            {toast.message}
                        </div>
                        <button 
                            onClick={() => removeToast(toast.id)}
                            style={{ 
                                background: 'none', border: 'none', color: 'var(--text-2)', 
                                cursor: 'pointer', display: 'flex', padding: '4px' 
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
