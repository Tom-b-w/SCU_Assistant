# Development Environment Setup

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- Git

## Quick Start (Docker)

```bash
# Clone the repo
git clone https://github.com/Tom-b-w/SCU_Assistant.git
cd SCU_Assistant

# Copy env files
cp backend/.env.example backend/.env

# Start all services
docker compose up -d

# Access
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# Health check: http://localhost:8000/health
```

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Start PostgreSQL and Redis (via Docker or locally)
docker compose up -d postgres redis

# Run migrations
cp .env.example .env  # Edit DATABASE_URL if needed
alembic upgrade head

# Start server
uvicorn gateway.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Running Tests

```bash
# Backend
cd backend
pytest -v --cov

# Frontend
cd frontend
npm test
```

## Code Quality

```bash
# Backend linting
cd backend
ruff check .
ruff format .

# Frontend linting
cd frontend
npm run lint
```
