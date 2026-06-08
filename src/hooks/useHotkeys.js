import { useEffect } from 'react';

export default function useHotkeys(keyCombination, callback) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            const keys = keyCombination.toLowerCase().split('+');
            const requiresCtrl = keys.includes('ctrl');
            const requiresAlt = keys.includes('alt');
            const requiresShift = keys.includes('shift');
            const targetKey = keys[keys.length - 1];

            if (
                (requiresCtrl === (e.ctrlKey || e.metaKey)) &&
                (requiresAlt === e.altKey) &&
                (requiresShift === e.shiftKey) &&
                (e.key.toLowerCase() === targetKey || e.code.toLowerCase() === targetKey)
            ) {
                e.preventDefault();
                callback(e);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keyCombination, callback]);
}
