'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  ArrowRight,
  PlayCircle,
  Check,
  X,
  Sliders,
  Users,
  Zap,
  Lock,
  ShieldAlert,
  LayoutDashboard,
  Building2,
  GraduationCap,
  Stethoscope,
  Briefcase,
  Search,
  Bell,
  Plus,
  Home,
  FileText,
  ClipboardCheck,
  GitBranch,
  History,
  BarChart3,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import Button from '@/components/ui/Button';

const NAV_LINKS = ['Product', 'Use Cases', 'Features', 'Pricing', 'Docs'];

const TRUSTED_LOGOS = ['Google', 'Microsoft', 'Notion', 'Slack', 'GitHub', 'Vercel'];

const OLD_WAY = [
  'Requests get lost in inboxes',
  'No visibility into status',
  'Manual follow-ups waste time',
  'No audit trail for compliance',
  'People forget to approve',
  'No accountability',
];

const NEW_WAY = [
  'Clear, structured approval flows',
  'Real-time status tracking',
  'Automatic routing to the right people',
  'Complete, tamper-evident audit history',
  'SLA-based escalation',
  'Full transparency and accountability',
];

const FEATURES = [
  {
    icon: Sliders,
    title: 'Custom Workflow Builder',
    description: 'Create multi-step approval flows tailored to your organization with flexible roles and SLAs.',
  },
  {
    icon: Users,
    title: 'Parallel Approvals',
    description: 'Require consensus with quorum-based approvals (e.g., 2 out of 5) and track progress visually.',
  },
  {
    icon: Zap,
    title: 'SLA-Based Escalation',
    description: 'Set deadlines and automatically escalate when approvals are delayed.',
  },
  {
    icon: Lock,
    title: 'Tamper-Evident Audit Trail',
    description: 'Every action is cryptographically linked using SHA-256 hash chain for immutable records.',
  },
  {
    icon: ShieldAlert,
    title: 'Role-Based Access Control',
    description: 'Granular permissions ensure the right people see and approve the right requests.',
  },
  {
    icon: LayoutDashboard,
    title: 'Intuitive Dashboard',
    description: 'Get complete visibility with real-time analytics, status tracking, and history.',
  },
];

const INDUSTRIES = [
  { icon: Building2, title: 'Corporate', description: 'Budget approvals, purchase orders, leave requests' },
  { icon: GraduationCap, title: 'Academic', description: 'Research proposals, thesis submissions, grant applications' },
  { icon: Stethoscope, title: 'Healthcare', description: 'Treatment authorizations, equipment purchases, policy changes' },
  { icon: Briefcase, title: 'HR & Operations', description: 'Hiring approvals, expense claims, document reviews' },
];

function Nav() {
  return (
    <nav className="bg-white/90 backdrop-blur-sm border-b border-surface-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          ProofLoop
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-navy-600">
          {NAV_LINKS.map((l) => (
            <a key={l} href="#" className="hover:text-navy-900">
              {l}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-5">
          <Link href="/login" className="hidden sm:inline text-sm font-medium text-navy-700 hover:text-navy-900">
            Sign In
          </Link>
          <Link href="/login">
            <Button size="sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

const SIDEBAR_ITEMS = [
  { icon: Home, label: 'Dashboard', active: true },
  { icon: FileText, label: 'My Requests' },
  { icon: ClipboardCheck, label: 'Pending Approvals' },
  { icon: GitBranch, label: 'Workflows' },
  { icon: History, label: 'Audit Trail' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
];

const RECENT_REQUESTS = [
  { title: 'Q3 Marketing Budget Approval', id: '#REQ-001 · Finance', status: 'Approved', tone: 'success' as const },
  { title: 'New Laptop Purchase', id: '#REQ-002 · IT', status: 'In Review', tone: 'brand' as const },
  { title: 'Conference Travel Request', id: '#REQ-003 · HR', status: 'Pending', tone: 'warning' as const },
  { title: 'Hiring Approval - Frontend Dev', id: '#REQ-004 · Engineering', status: 'Escalated', tone: 'danger' as const },
];

const STAT_TILES = [
  { icon: FileText, value: 12, label: 'My Requests', tone: 'text-brand-600 bg-brand-50' },
  { icon: ClipboardCheck, value: 5, label: 'Pending Approval', tone: 'text-warning-600 bg-warning-50' },
  { icon: Users, value: 3, label: 'Awaiting Others', tone: 'text-accent-600 bg-accent-50' },
  { icon: Zap, value: 2, label: 'Overdue', tone: 'text-danger-600 bg-danger-50' },
];

const PROGRESS_STEPS = [
  { name: 'Team Lead', sub: 'Approved · 4h ago', state: 'done' as const },
  { name: 'Department Head', sub: 'Approved · 1d ago', state: 'done' as const },
  { name: 'Finance', sub: 'In Review', state: 'current' as const },
  { name: 'CFO', sub: 'Pending', state: 'pending' as const },
  { name: 'Complete', sub: '', state: 'pending' as const },
];

const toneDot: Record<string, string> = {
  success: 'bg-success-500 text-white',
  brand: 'bg-brand-500 text-white',
  warning: 'bg-warning-500 text-white',
  danger: 'bg-danger-500 text-white',
};

const toneBadge: Record<string, string> = {
  success: 'bg-success-50 text-success-700',
  brand: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
};

function DashboardMock() {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-lg overflow-hidden flex text-sm">
      {/* Sidebar */}
      <div className="w-40 flex-shrink-0 border-r border-surface-200 bg-surface-50 py-4 px-3 hidden sm:block">
        <div className="flex items-center gap-1.5 px-1 mb-5 font-display font-bold text-navy-900 text-sm">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          ProofLoop
        </div>
        <div className="space-y-0.5">
          {SIDEBAR_ITEMS.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium ${
                active ? 'bg-brand-50 text-brand-700' : 'text-navy-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200">
          <div className="flex items-center gap-2 text-navy-400 text-xs bg-surface-50 border border-surface-200 rounded-md px-2.5 py-1.5 w-40">
            <Search className="w-3.5 h-3.5" />
            Search requests…
          </div>
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-navy-400" />
            <div className="w-6 h-6 rounded-full bg-accent-500 text-white flex items-center justify-center text-[10px] font-semibold">
              R
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display font-bold text-navy-900">Welcome back, Rachita 👋</div>
              <div className="text-xs text-navy-400 mt-0.5">Here&rsquo;s what&rsquo;s happening with your approvals today.</div>
            </div>
            <div className="hidden md:flex items-center gap-1.5 bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-md flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
              Create Request
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {STAT_TILES.map(({ icon: Icon, value, label, tone }) => (
              <div key={label} className="rounded-lg border border-surface-200 p-2.5">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center mb-2 ${tone}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="font-display font-bold text-navy-900 text-base leading-none">{value}</div>
                <div className="text-[10px] text-navy-400 mt-1 leading-tight">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3 rounded-lg border border-surface-200 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-navy-800">Recent Requests</span>
                <span className="text-[10px] text-brand-600 font-medium">View all →</span>
              </div>
              <div className="space-y-2">
                {RECENT_REQUESTS.map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-navy-900 truncate">{r.title}</div>
                      <div className="text-[10px] text-navy-400">{r.id}</div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${toneBadge[r.tone]}`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 rounded-lg border border-surface-200 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-navy-800">Workflow Progress</span>
                <span className="text-[10px] text-navy-400">3/5</span>
              </div>
              <div className="space-y-2.5">
                {PROGRESS_STEPS.map((s, i) => (
                  <div key={s.name} className="flex items-start gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        s.state === 'done'
                          ? 'bg-success-500'
                          : s.state === 'current'
                            ? 'bg-brand-500'
                            : 'bg-surface-200'
                      }`}
                    >
                      {s.state === 'done' && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="leading-tight">
                      <div className="text-[11px] font-medium text-navy-800">{s.name}</div>
                      {s.sub && <div className="text-[10px] text-navy-400">{s.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50/70 via-white to-accent-50/60" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-24 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-surface-200 text-xs font-medium text-navy-600 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
              Modern approvals for modern teams
            </span>
            <h1 className="font-display text-5xl lg:text-[64px] font-bold text-navy-900 mt-6 leading-[1.05] tracking-tight">
              From request
              <br />
              to resolution,
              <br />
              <span className="text-brand-600">in one loop.</span>
            </h1>
            <p className="text-lg text-navy-500 mt-6 max-w-md">
              ProofLoop helps organizations manage multi-step approval workflows with real-time
              tracking, audit trails, and complete transparency.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <Link href="/login">
                <Button size="lg">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline">
                <PlayCircle className="w-4 h-4" />
                View Demo
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm text-navy-500">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-success-600" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-success-600" /> Setup in minutes
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-success-600" /> Open source friendly
              </span>
            </div>
          </div>
          <DashboardMock />
        </div>
      </section>

      {/* Trusted by */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-12 border-b border-surface-200">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-xs font-semibold tracking-widest text-navy-400 mb-4">
              TRUSTED BY FORWARD-THINKING TEAMS
            </div>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4 text-navy-400 font-semibold text-lg">
              {TRUSTED_LOGOS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display text-lg font-semibold text-navy-800">&ldquo;Simple, powerful, transparent.&rdquo;</p>
            <p className="text-sm text-navy-400 mt-1">— Teams love ProofLoop</p>
          </div>
        </div>
      </section>

      {/* Old way vs new way */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-danger-100 bg-danger-50/40 p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-block px-2.5 py-1 rounded-full bg-white text-danger-600 text-xs font-semibold">
                THE OLD WAY
              </span>
              <span className="text-2xl">🙁</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-navy-900 mb-5">
              Approvals shouldn&rsquo;t live in email chains.
            </h3>
            <ul className="space-y-3">
              {OLD_WAY.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-navy-600">
                  <X className="w-4 h-4 text-danger-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-success-100 bg-success-50/40 p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-block px-2.5 py-1 rounded-full bg-white text-success-700 text-xs font-semibold">
                THE PROOFLOOP WAY
              </span>
              <span className="text-2xl">🙂</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-navy-900 mb-5">
              Structured. Transparent. Effortless.
            </h3>
            <ul className="space-y-3">
              {NEW_WAY.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-navy-600">
                  <Check className="w-4 h-4 text-success-600 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900">
            Powerful features for <span className="text-brand-600">real-world workflows</span>
          </h2>
          <p className="text-navy-500 mt-3">Everything you need to design, track, and scale approval processes.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group bg-white rounded-lg border border-surface-200 p-6 hover:shadow-md hover:border-brand-200 transition-all duration-150"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-brand-600" />
              </div>
              <h3 className="font-semibold text-navy-900">{title}</h3>
              <p className="text-sm text-navy-500 mt-1.5">{description}</p>
              <ArrowRight className="w-4 h-4 text-navy-300 mt-3 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="bg-surface-50 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="font-display text-3xl font-bold text-navy-900">Built for every industry</h2>
              <p className="text-navy-500 mt-2">From startups to enterprises, ProofLoop adapts to your workflow.</p>
            </div>
            <Button variant="outline" size="sm">
              Explore all use cases <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {INDUSTRIES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white rounded-lg border border-surface-200 p-6">
                <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-accent-600" />
                </div>
                <h3 className="font-semibold text-navy-900">{title}</h3>
                <p className="text-sm text-navy-500 mt-1.5">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-900 py-20">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Ready to close the loop on approvals?
          </h2>
          <p className="text-navy-300 mt-3">Set up your first workflow in minutes — no credit card required.</p>
          <Link href="/login" className="inline-block mt-8">
            <Button size="lg">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-surface-200 py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-navy-400">
          <span className="flex items-center gap-2 font-display font-semibold text-navy-700">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            ProofLoop
          </span>
          <span>&copy; {new Date().getFullYear()} ProofLoop. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
