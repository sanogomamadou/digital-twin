import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { loginUser, getMe } from '../services/api';
import useAuthStore from '../store/useAuthStore';

export default function AuthPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const login = useAuthStore(state => state.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const data = await loginUser(username, password);
      const userData = await getMe(data.access_token);
      login(userData, data.access_token);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left side: Visual / Branding */}
      <div className="auth-split-visual">
        <div className="auth-visual-overlay"></div>
        <div className="auth-visual-content">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1>Plateforme Jumeau Numérique</h1>
            <p>Intelligence et visualisation en temps réel pour vos systèmes complexes.</p>
          </motion.div>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="auth-split-form">
        <motion.div 
          className="auth-card-wrapper"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="auth-card">
            <div className="auth-header">
              <motion.img 
                src="/logo.webp"
                alt="DXC Logo"
                className="auth-logo-img"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              />
              <h2>Bienvenue</h2>
              <p>Connectez-vous pour accéder à vos tableaux de bord</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    className="auth-error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="input-group">
                <User className="input-icon" size={20} />
                <input 
                  type="text" 
                  placeholder="Nom d'utilisateur" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="input-group">
                <Lock className="input-icon" size={20} />
                <input 
                  type="password" 
                  placeholder="Mot de passe" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <motion.button 
                type="submit" 
                className="auth-submit-btn"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? <Loader2 className="spinner" size={20} /> : (
                  <>
                    Se connecter
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
