import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from './store';
import { TokenSetup } from './components/TokenSetup';
import { Dashboard } from './components/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export function App() {
  const token = useUIStore((s) => s.token);

  return (
    <QueryClientProvider client={queryClient}>
      {token ? <Dashboard /> : <TokenSetup />}
    </QueryClientProvider>
  );
}
