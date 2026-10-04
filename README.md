# ProofLoop - Verifiable Workflow Approval System

A production-ready full-stack application for managing multi-step approval workflows with role-based access control and complete audit trails.

## 🚀 Features

- **JWT Authentication** with role-based access control (USER, REVIEWER, ADMIN)
- **Custom Workflow Builder** - Create multi-step approval flows
- **Request Management** - Submit and track requests through workflows
- **Role-Based Approvals** - Only authorized roles can approve specific steps
- **Complete Audit Trail** - Immutable history of all actions
- **Real-time Analytics** - Admin dashboard with system insights
- **Production-Ready** - Dockerized backend, optimized for free-tier deployment

## 🏗️ Tech Stack

### Backend
- Spring Boot 3.2.1
- Spring Security with JWT
- MongoDB Atlas
- Maven

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Axios

## 📋 Prerequisites

- Java 17+
- Node.js 18+
- MongoDB Atlas account (free tier)
- Git

## 🛠️ Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd proofloop
```

### 2. Backend Setup

```bash
cd backend

# Create .env file from example
cp .env.example .env

# Edit .env with your MongoDB URI and JWT secret
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
# JWT_SECRET=your-very-long-secret-key-at-least-256-bits

# Build and run
./mvnw clean install
./mvnw spring-boot:run
```

The backend will start on `http://localhost:8080`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Edit .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8080

# Run development server
npm run dev
```

The frontend will start on `http://localhost:3000`

### 4. Access the Application

Visit `http://localhost:3000` and use these demo credentials:

- **Admin**: admin@proofloop.com / admin123
- **Reviewer**: reviewer@proofloop.com / reviewer123
- **User**: user@proofloop.com / user123

## 🌐 MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Create a database user
4. Whitelist your IP (or use 0.0.0.0/0 for development)
5. Get your connection string from "Connect" → "Connect your application"
6. Replace `<password>` with your database user password

## 🚢 Deployment

### Backend Deployment (Railway/Render)

#### Option 1: Railway

1. Create account at [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory to `/backend`
5. Add environment variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DATABASE=proofloop
   JWT_SECRET=your_secure_jwt_secret_key
   CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ```
6. Railway will auto-detect the Dockerfile and deploy

#### Option 2: Render

1. Create account at [Render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: proofloop-backend
   - **Root Directory**: backend
   - **Environment**: Docker
   - **Instance Type**: Free
5. Add environment variables (same as Railway)
6. Click "Create Web Service"

### Frontend Deployment (Vercel)

1. Create account at [Vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: frontend
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```
6. Click "Deploy"

### Post-Deployment

1. Update backend CORS_ALLOWED_ORIGINS with your Vercel domain
2. Test the deployed application
3. Demo data will be seeded automatically on first backend startup

## 📁 Project Structure

```
proofloop/
├── backend/
│   ├── src/main/java/com/proofloop/
│   │   ├── config/          # Security, CORS, Data seeding
│   │   ├── controller/      # REST endpoints
│   │   ├── dto/             # Data transfer objects
│   │   ├── entity/          # MongoDB entities
│   │   ├── exception/       # Error handling
│   │   ├── repository/      # Data access layer
│   │   ├── security/        # JWT filters, UserDetails
│   │   ├── service/         # Business logic
│   │   └── util/            # JWT utilities
│   ├── Dockerfile
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   ├── components/      # React components
│   │   ├── lib/             # API client, auth context
│   │   └── types/           # TypeScript definitions
│   ├── package.json
│   └── next.config.js
└── README.md
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Workflows
- `GET /api/workflows` - Get all workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/{id}` - Get workflow by ID
- `DELETE /api/workflows/{id}` - Delete workflow

### Requests
- `POST /api/requests` - Create request
- `GET /api/requests/mine` - Get my requests
- `GET /api/requests/pending` - Get requests pending my approval
- `GET /api/requests/{id}` - Get request details
- `POST /api/requests/{id}/approve` - Approve request
- `POST /api/requests/{id}/reject` - Reject request

### Admin (Admin role only)
- `GET /api/admin/analytics` - Get system analytics
- `GET /api/admin/requests` - Get all requests

## 🧪 Testing with Postman

Import the `ProofLoop_Postman_Collection.json` file into Postman.

The collection includes:
1. Register and login endpoints
2. Workflow CRUD operations
3. Request creation and approval flow
4. Admin analytics

Update the `{{baseUrl}}` variable to your deployed backend URL.

## 🎯 Key Features Explained

### Workflow Builder
- Create workflows with multiple steps
- Each step requires a specific role (USER, REVIEWER, ADMIN)
- Steps execute sequentially

### Request Lifecycle
1. User creates a request against a workflow
2. Request enters PENDING status
3. As each step is approved, it moves to IN_REVIEW and advances
4. If all steps approve → APPROVED
5. If any step rejects → REJECTED

### Audit Trail
- Every action is recorded with timestamp
- Includes actor name, comment, and action type
- Immutable history for compliance

## 🔧 Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=proofloop
JWT_SECRET=your-secret-key
CORS_ALLOWED_ORIGINS=http://localhost:3000
PORT=8080
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 🐳 Docker Commands

```bash
# Build backend image
cd backend
docker build -t proofloop-backend .

# Run backend container
docker run -p 8080:8080 \
  -e MONGODB_URI="your_uri" \
  -e JWT_SECRET="your_secret" \
  proofloop-backend
```

## 📊 Database Schema

### Collections
- **users**: User accounts with roles
- **workflows**: Workflow templates
- **requests**: Approval requests with audit history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📝 License

MIT License - feel free to use this project for learning or production

## 🙋 Support

For issues or questions:
1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include error logs if applicable

## 🎓 Resume Highlights

This project demonstrates:
- ✅ Full-stack development (Java + React)
- ✅ RESTful API design
- ✅ JWT authentication & authorization
- ✅ State machine implementation (workflow engine)
- ✅ MongoDB/NoSQL database design
- ✅ Docker containerization
- ✅ Cloud deployment (Railway/Render + Vercel)
- ✅ Modern frontend with Next.js
- ✅ Production-ready error handling
- ✅ Clean architecture patterns

---

**Built with ❤️ for demonstrating enterprise-grade workflow systems**
