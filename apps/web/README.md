# ProofLoop Frontend 🔄

> A modern, responsive web application for managing multi-step approval workflows with real-time tracking and audit trails.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat&logo=tailwind-css)

---

## What is ProofLoop?

ProofLoop is a **workflow approval system** that helps organizations manage complex, multi-step approval processes. Think of it as a digital signature system, but more powerful — tracking who approved what, when, and why, with complete audit trails.

### Real-World Use Cases

#### 🏢 Corporate Environment

- **Budget Approvals**: Finance team submits budget → Manager reviews → Department head approves → CFO signs off
- **Purchase Orders**: Employee requests → Supervisor approves → Procurement reviews → Finance authorizes
- **Leave Requests**: Employee applies → Manager approves → HR records → Auto-approved or escalated

#### 🎓 Academic Institutions

- **Research Proposals**: Student submits → Advisor reviews → Ethics committee approves → Dean authorizes
- **Thesis Submissions**: Student uploads → Advisor checks → Committee reviews → Registrar approves
- **Grant Applications**: Faculty proposes → Department reviews → Research office approves

#### 🏥 Healthcare

- **Treatment Authorization**: Doctor requests → Insurance reviews → Medical director approves
- **Equipment Purchase**: Department needs → Admin reviews → Finance approves → Procurement orders
- **Policy Changes**: Staff proposes → Committee reviews → Compliance checks → Board approves

#### 💼 HR & Operations

- **Hiring Approvals**: Recruiter finds candidate → Hiring manager interviews → Department head approves → HR processes
- **Expense Claims**: Employee submits → Manager reviews → Finance approves → Accounting pays
- **Document Reviews**: Author drafts → Editor reviews → Legal checks → Publisher approves

---

## Why ProofLoop?

### The Problem We Solve

**Before ProofLoop:**

- ❌ Approval requests lost in email chains
- ❌ No visibility into approval status
- ❌ Manual follow-ups waste time
- ❌ No audit trail for compliance
- ❌ People forget to approve
- ❌ No accountability

**After ProofLoop:**

- ✅ Structured, visible approval flows
- ✅ Real-time status tracking
- ✅ Automatic routing to right people
- ✅ Complete audit history
- ✅ SLA-based escalation
- ✅ Full transparency

---

## Key Features

### 1. **Custom Workflow Builder**

Create approval flows tailored to your organization:

- Define sequential steps
- Assign roles to each step (USER, REVIEWER, ADMIN)
- Set approval requirements (1 person or multiple)
- Add SLA deadlines with auto-escalation

**Example Workflow:**

```
Step 1: Team Lead Review      (REVIEWER, 1 approval, 24h SLA)
Step 2: Department Approval    (ADMIN, 2 approvals, 48h SLA)
Step 3: Finance Sign-off       (ADMIN, 1 approval, 72h SLA)
```

### 2. **Parallel Approvals (Quorum-Based)**

Require consensus from multiple people at the same step:

- Set "2 out of 5 reviewers must approve"
- Prevents single point of failure
- Democratic decision-making
- Visual progress tracking (e.g., "3/5 approved")

### 3. **SLA-Based Auto-Escalation**

Never let requests stall:

- Set hourly deadlines per step
- Automatic escalation to ADMIN if breached
- "Escalated" badge for visibility
- Scheduled checks every hour

### 4. **Tamper-Evident Audit Trail**

Cryptographic proof of all actions:

- SHA-256 hash chain (blockchain-style)
- Every action links to previous action
- Immutable history
- Compliance-ready (SOC2, ISO 27001)

### 5. **Role-Based Access Control**

Secure, granular permissions:

- Only authorized roles see pending approvals
- Can't approve your own requests
- Can't approve same step twice
- Complete separation of duties

### 6. **Intuitive Dashboard**

At-a-glance visibility:

- My Requests (status tracking)
- Pending My Approval (action needed)
- Request history with timeline
- Admin analytics (system-wide stats)

---

## Industry Relevance

### Why This Matters in 2026

**1. Remote Work Revolution**

- Distributed teams need digital approval systems
- Email doesn't scale for complex workflows
- ProofLoop provides structure + transparency

**2. Compliance Requirements**

- SOX, GDPR, HIPAA require audit trails
- ProofLoop's hash chain provides cryptographic proof
- Every action is logged with timestamp + actor

**3. Operational Efficiency**

- Manual approval tracking costs companies millions
- ProofLoop automates routing and notifications
- SLA escalation prevents bottlenecks

**4. Enterprise Adoption**

- Companies moving from email → structured workflows
- Startups need approval systems from day one
- ProofLoop is lightweight, modern alternative to Jira/ServiceNow

---

## Tech Stack

### Frontend Technologies

| Technology          | Purpose         | Why We Use It                                            |
| ------------------- | --------------- | -------------------------------------------------------- |
| **Next.js 14**      | React Framework | Server-side rendering, App Router, optimized performance |
| **React 18**        | UI Library      | Component-based, hooks, modern patterns                  |
| **TypeScript**      | Type Safety     | Catch errors at compile-time, better IDE support         |
| **Tailwind CSS**    | Styling         | Utility-first, responsive, consistent design             |
| **Axios**           | HTTP Client     | Clean API calls with interceptors                        |
| **React Hot Toast** | Notifications   | User-friendly success/error messages                     |
| **Lucide React**    | Icons           | Modern, lightweight icon library                         |

### Architecture Highlights

- **App Router**: Next.js 14's new routing system
- **Client Components**: Interactive UI with `'use client'`
- **Protected Routes**: Authentication wrapper
- **Context API**: Global auth state management
- **Type-Safe API**: TypeScript interfaces for all data

---

## Getting Started

### Prerequisites

```bash
Node.js 18+ installed
Backend API running on http://localhost:8080
```

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd proofloop/frontend
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

```bash
# Create .env.local file
cp .env.example .env.local

# Edit .env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
```

4. **Run development server**

```bash
npm run dev
```

5. **Open in browser**

```
http://localhost:3000
```

---

## Demo Credentials

```
👤 Admin User
   Email: admin@proofloop.com
   Password: admin123
   Can: Create workflows, view analytics, approve admin steps

👤 Reviewer User
   Email: reviewer@proofloop.com
   Password: reviewer123
   Can: Approve reviewer steps, create requests

👤 Regular User
   Email: user@proofloop.com
   Password: user123
   Can: Create requests, track own submissions
```

---

## User Interface

### Landing Page

- Clean, professional design
- Feature highlights with icons
- Login/Register forms
- Demo credentials displayed

### Dashboard

- **My Requests**: Track your submissions
- **Pending My Approval**: Action items
- **Status Cards**: Quick metrics
- **Recent Activity**: Timeline view

### Workflow Builder

- Multi-step form
- Role selection dropdown
- Parallel approval input (1-10 approvers)
- Optional SLA hours
- Visual step preview

### Request Details

- Full workflow progress visualization
- Colored step indicators (gray → blue → green)
- Approval progress bars ("2/3 approved")
- Complete audit history with hashes
- Action buttons (Approve/Reject)
- Escalation badge if SLA breached

### Admin Analytics

- Total users, workflows, requests
- Status breakdown (Pending, In Review, Approved, Rejected)
- Approval rate percentage
- Visual charts and progress bars

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx             # Landing page (/)
│   │   ├── layout.tsx           # Root layout
│   │   ├── globals.css          # Global styles
│   │   ├── dashboard/           # Protected routes
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── workflows/
│   │   │   │   └── page.tsx    # Workflow management
│   │   │   └── requests/
│   │   │       ├── page.tsx    # Request list
│   │   │       └── [id]/
│   │   │           └── page.tsx # Request detail
│   │   └── admin/
│   │       └── page.tsx        # Admin analytics
│   │
│   ├── components/              # React components
│   │   ├── Navbar.tsx          # Top navigation
│   │   └── ProtectedRoute.tsx  # Auth wrapper
│   │
│   ├── lib/                     # Utilities
│   │   ├── api.ts              # Axios API client
│   │   └── auth-context.tsx   # Auth state management
│   │
│   └── types/                   # TypeScript definitions
│       └── index.ts            # All interfaces
│
├── public/                      # Static assets
├── .env.example                # Environment template
├── package.json                # Dependencies
├── tailwind.config.js          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── next.config.js              # Next.js configuration
```

---

## Key Components Explained

### Authentication Flow

1. User logs in → Backend returns JWT token
2. Token stored in `localStorage`
3. `AuthContext` provides global auth state
4. `ProtectedRoute` checks auth before rendering
5. API client adds token to all requests

### API Integration

```typescript
// Centralized API client with interceptors
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Auto-attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### State Management

- **Auth**: Context API for global user state
- **Forms**: Local component state with `useState`
- **API Data**: Fetch on mount with `useEffect`
- **Toasts**: `react-hot-toast` for notifications

---

## Design Principles

### 1. **Clean & Professional**

- Minimal clutter, focus on content
- Consistent spacing (Tailwind's spacing scale)
- Professional color palette (blues, grays)

### 2. **Responsive Design**

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Grid layouts adapt to screen size

### 3. **User-Friendly**

- Clear labels and instructions
- Immediate feedback (toasts)
- Loading states (spinners)
- Error handling

### 4. **Visual Hierarchy**

- Bold headings for sections
- Color-coded status badges
- Icon-enhanced navigation
- Progress indicators

---

## Development Scripts

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**

```bash
git add .
git commit -m "ProofLoop frontend"
git push origin main
```

2. **Deploy to Vercel**

- Visit [vercel.com](https://vercel.com)
- Import your GitHub repository
- Framework: Next.js (auto-detected)
- Root Directory: `frontend`
- Environment Variable: `NEXT_PUBLIC_API_URL=https://your-backend-url.com`
- Click Deploy

3. **Access Your App**

- Vercel provides: `https://proofloop.vercel.app`
- Custom domain: Configure in Vercel settings

### Manual Deployment

```bash
# Build for production
npm run build

# Test production build locally
npm start

# Deploy to any Node.js host
# Upload: .next/, public/, package.json, next.config.js
# Run: npm install && npm start
```

---

## Testing the Application

### User Flow Test

**Scenario: Budget Approval**

1. **As Admin** - Create Workflow
   - Name: "Budget Approval"
   - Step 1: Manager Review (REVIEWER, 1 approval, 24h SLA)
   - Step 2: Finance Approval (ADMIN, 2 approvals, 48h SLA)

2. **As User** - Submit Request
   - Title: "Q1 Marketing Budget"
   - Description: "$50,000 for campaigns"
   - Select workflow: "Budget Approval"

3. **As Reviewer** - First Approval
   - Go to "Pending My Approval"
   - Click on request
   - Add comment: "Budget looks reasonable"
   - Click Approve
   - ✅ Request moves to Step 2

4. **As Admin** - Second Approval (1/2)
   - Login as admin@proofloop.com
   - Approve with comment
   - ⏳ Status: "1/2 approvals" shown

5. **As Another Admin** - Final Approval (2/2)
   - Second admin approves
   - ✅ Request status: APPROVED
   - Complete history visible

---

## 🔐 Security Features

### Frontend Security

- **JWT Authentication**: Token-based, stateless
- **Protected Routes**: Auth checks before rendering
- **Role-Based UI**: Hide actions for unauthorized users
- **XSS Prevention**: React's built-in escaping
- **HTTPS Only**: Enforced in production

### Backend Integration

- All sensitive operations happen server-side
- Frontend validates, backend enforces
- Tokens expire after 24 hours
- CORS configured for specific origins

---

## 🐛 Troubleshooting

### Common Issues

**"Network Error" on login**

- ✅ Check backend is running on port 8080
- ✅ Verify `NEXT_PUBLIC_API_URL` in `.env.local`
- ✅ Check browser console for CORS errors

**"Token expired" errors**

- ✅ Tokens expire after 24 hours
- ✅ Logout and login again
- ✅ Check backend JWT_SECRET is set

**UI not updating after action**

- ✅ Check browser console for errors
- ✅ Verify API response is 200 OK
- ✅ Ensure `loadData()` is called after actions

**Blank page after deploy**

- ✅ Check Vercel build logs
- ✅ Verify environment variables are set
- ✅ Ensure `NEXT_PUBLIC_` prefix on env vars

---

## Performance Optimizations

- **Server-Side Rendering**: Fast initial page load
- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js Image component
- **Lazy Loading**: Components load on-demand
- **Caching**: API responses cached where appropriate

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new files
- Follow existing naming conventions
- Add comments for complex logic
- Test your changes thoroughly

---

## Future Enhancements

### Planned Features

- 📧 Email notifications on approval needed
- 📱 Mobile app (React Native)
- 🔔 Real-time updates (WebSocket)
- 📊 Advanced analytics dashboard
- 🌍 Multi-language support
- 🎨 Custom branding/themes
- 📤 File attachments to requests
- 🔄 Workflow templates library

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Team & Support

**Built with ❤️ for modern approval workflows**

- 🐛 **Report Issues**: [GitHub Issues](your-repo/issues)
- 💬 **Discussions**: [GitHub Discussions](your-repo/discussions)
- 📧 **Email**: support@proofloop.com

---

## 🎓 Learn More

### Related Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Backend Repository

The backend API is built with Spring Boot. See the [backend README](../backend/README.md) for setup instructions.

---

## 🌟 Acknowledgments

- Next.js team for the amazing framework
- Tailwind CSS for beautiful utilities
- Vercel for hosting platform
- Open source community

---

**⭐ Star this repo if you find it helpful!**

---

_Last Updated: February 2026_
