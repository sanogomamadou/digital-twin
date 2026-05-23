import './index.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import useTwinStore from './store/useTwinStore';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import FormStep from './pages/FormStep';
import GridStep from './pages/GridStep';
import ConnectionsStep from './pages/ConnectionsStep';
import KpiStep from './pages/KpiStep';
import TwinView from './pages/TwinView';
import SharedTwinView from './pages/SharedTwinView';
import AuthPage from './pages/AuthPage';
import useAuthStore from './store/useAuthStore';

export default function App() {
  const { currentStep } = useTwinStore();
  const { user } = useAuthStore();

  const path = window.location.pathname;
  if (path.startsWith('/live/')) {
    const shareId = path.split('/')[2];
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-0)',
      }}>
        <SharedTwinView shareId={shareId} />
      </div>
    );
  }

  const renderPage = () => {
    switch (currentStep) {
      case 0: return <HomePage />;
      case 1: return <FormStep />;
      case 2: return <GridStep />;
      case 3: return <ConnectionsStep />;
      case 4: return <KpiStep />;
      case 5: return <TwinView />;
      default: return <HomePage />;
    }
  };

  // If not live view and not authenticated, show Auth Page
  if (!user && !path.startsWith('/live/')) {
    return <AuthPage />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-0)',
    }}>
      {/* Hide navbar only in full live view */}
      {currentStep !== 5 && <Navbar />}
      {currentStep === 5 && <Navbar />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderPage()}
      </div>
    </div>
  );
}
