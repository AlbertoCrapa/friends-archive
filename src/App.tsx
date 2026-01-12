import { useAuthStore } from '@/stores/auth-store';
import { LoginForm } from '@/features/auth';
import { Dashboard } from '@/pages';

function App() {
  const session = useAuthStore((state) => state.session);

  if (!session?.isAuthenticated) {
    return <LoginForm />;
  }

  return <Dashboard />;
}

export default App;
