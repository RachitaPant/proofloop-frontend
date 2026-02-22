'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';
import { CheckCircle2, Workflow, Shield } from 'lucide-react';

export default function Home() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: Role.USER,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.name, formData.email, formData.password, formData.role);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Proof<span className="text-primary-600">Loop</span>
          </h1>
          <p className="text-xl text-gray-600">
            Verifiable workflow system for approvals & handoffs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Features */}
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-900">
              Streamline Your Approval Process
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Workflow className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Custom Workflows</h3>
                  <p className="text-gray-600">
                    Create multi-step approval flows tailored to your needs
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Role-Based Access</h3>
                  <p className="text-gray-600">
                    Control who can approve at each step with role requirements
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-primary-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Audit Trail</h3>
                  <p className="text-gray-600">
                    Complete history of all actions with timestamps and comments
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
              <h4 className="font-semibold mb-2">Demo Credentials</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Admin:</strong> admin@proofloop.com / admin123</p>
                <p><strong>Reviewer:</strong> reviewer@proofloop.com / reviewer123</p>
                <p><strong>User:</strong> user@proofloop.com / user123</p>
              </div>
            </div>
          </div>

          {/* Auth Form */}
          <div className="bg-white p-8 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-center">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  >
                    <option value={Role.USER}>User</option>
                    <option value={Role.REVIEWER}>Reviewer</option>
                    <option value={Role.ADMIN}>Admin</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center mt-4 text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary-600 hover:underline font-medium"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
