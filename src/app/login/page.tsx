'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';
import { CheckCircle2, Workflow, Shield, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

const FEATURES = [
  {
    icon: Workflow,
    title: 'Custom Workflows',
    description: 'Create multi-step approval flows tailored to your needs',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description: 'Control who can approve at each step with role requirements',
  },
  {
    icon: CheckCircle2,
    title: 'Tamper-Evident Audit Trail',
    description: 'Complete, hash-chained history of every action, with timestamps and comments',
  },
];

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
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 font-display text-4xl sm:text-5xl font-bold text-navy-900">
            <ShieldCheck className="w-10 h-10 text-brand-600" />
            Proof<span className="text-brand-600">Loop</span>
          </div>
          <p className="text-lg text-navy-500 mt-3">
            Verifiable infrastructure for approvals & handoffs
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-8 lg:pt-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-navy-900">
              From request to resolution, in one loop.
            </h2>

            <div className="space-y-5">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900">{title}</h3>
                    <p className="text-navy-500 text-sm mt-0.5">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white p-5 rounded-lg border border-surface-200 shadow-sm">
              <h4 className="font-semibold text-sm text-navy-900 mb-2">Demo credentials</h4>
              <div className="space-y-1 text-sm text-navy-600 font-mono">
                <p>admin@proofloop.com / admin123</p>
                <p>reviewer@proofloop.com / reviewer123</p>
                <p>user@proofloop.com / user123</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-surface-200">
            <h2 className="font-display text-xl font-bold mb-6 text-center text-navy-900">
              {isLogin ? 'Sign in to ProofLoop' : 'Create your account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <Input
                  label="Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              )}

              <Input
                label="Email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <Input
                label="Password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />

              {!isLogin && (
                <Select
                  label="Role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  <option value={Role.USER}>User</option>
                  <option value={Role.REVIEWER}>Reviewer</option>
                  <option value={Role.ADMIN}>Admin</option>
                </Select>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <p className="text-center mt-4 text-sm text-navy-500">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-brand-600 hover:text-brand-700 hover:underline font-medium"
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
