import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/api';
import useAuthStore from '../store/useAuthStore';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
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
      if (isLogin) {
        const data = await loginUser(username, password);
        login({ username }, data.access_token);
      } else {
        await registerUser(username, password);
        const data = await loginUser(username, password);
        login({ username }, data.access_token);
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Dynamic Background Elements */}
      <div className="auth-bg-shape shape-1" />
      <div className="auth-bg-shape shape-2" />
      <div className="auth-bg-shape shape-3" />

      <motion.div 
        className="auth-card-wrapper"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-card">
          <div className="auth-header">
            <motion.div 
              className="auth-logo"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <div className="auth-logo-inner" />
            </motion.div>
            <h2>{isLogin ? 'Bienvenue' : 'Créer un compte'}</h2>
            <p>{isLogin ? 'Connectez-vous pour accéder à vos jumeaux numériques' : 'Rejoignez-nous pour modéliser vos systèmes'}</p>
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
                  {isLogin ? 'Se connecter' : "S'inscrire"}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          <div className="auth-footer">
            <p>
              {isLogin ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
              <button 
                className="auth-switch-btn" 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
              >
                {isLogin ? "S'inscrire" : "Se connecter"}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
