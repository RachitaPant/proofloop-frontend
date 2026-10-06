import ProtectedRoute from '@/components/ProtectedRoute';

// Auth guard + app shell for every page in this segment, so the pages' data
// hooks only mount once a signed-in user is known.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
