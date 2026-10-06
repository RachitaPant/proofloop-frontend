import ProtectedRoute from '@/components/ProtectedRoute';

// Auth guard + app shell for the admin area: pages (and their data hooks) only
// mount for signed-in admins.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireRole="ADMIN">{children}</ProtectedRoute>;
}
