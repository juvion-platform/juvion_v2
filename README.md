# Juvion v2

A comprehensive **Indian College ERP** built as a MERN + TypeScript monorepo. Covers the full lifecycle of engineering college operations — admissions, academics, finance, HR, placements, compliance, and AI-assisted decision-making.

- **Target**: Indian engineering colleges (AICTE-approved, university-affiliated)
- **Stack**: MongoDB, Express, React 19, Node.js, TypeScript (strict mode)
- **Multi-tenancy**: Every entity scoped by `collegeId`

## Modules

| Code | Module | Description |
|------|--------|-------------|
| M01 | Admissions | Inquiries, applications, entrance exams, counseling, offers, enrollments |
| M02 | People | Students, faculty, staff, parents, external contacts |
| M03 | Academics | Programmes, courses, timetables, attendance, assessments, exams, results |
| M04 | Finance | Fee structures, payments, scholarships, concessions, budgets, expenses |
| M05 | HR | Employees, leave, payroll, appraisals, training, recruitment |
| M06 | Welfare | Hostel, mess, transport, health, counseling, grievances |
| M07 | Placement | Seasons, companies, job postings, rounds, offers, internships, alumni |
| M08 | Campus Ops | Buildings, rooms, labs, security, vehicles, gate passes |
| M09 | Student Dev | Clubs, events, sports, NSS, certifications, mentoring |
| M10 | Compliance | NAAC/NBA accreditation, AICTE, regulatory filings, IQAC |
| M11 | Governance | Committees, meetings, policies, strategic goals |
| M12 | Platform | Settings, users, roles, audit logs, integrations |
| M13 | Juvi AI | Persona-based AI assistant for all stakeholders |

## Quick Start

```bash
# Prerequisites: Node >= 20, MongoDB 7, Redis 7
# Or use Docker:
docker compose up mongodb redis

npm install
npm run dev:backend     # Express API on :3001
npm run dev:portal      # React admin portal on :5173
npm run seed -w backend # Seed development data
```

## Project Structure

```
juvion_v2/
  backend/              Express API
    src/
      modules/          M01-M12 + Juvi (service, controller, routes, validation per module)
      models/           193 Mongoose models across 15 entity groups
      middleware/       authenticate, authorize, validate, errorHandler
      shared/           pagination, audit logging, events, types
  admin-portal/         React 19 + Vite
    src/
      pages/            Module hub pages + sub-pages
      services/         API client functions per module
      stores/           Zustand auth store
      components/ui/    Shared UI components (DataTable, Modal, Badge, etc.)
  docs/                 Architecture spec, entity model reference
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | MongoDB 7 (Mongoose 8) |
| Cache/Queue | Redis 7 (ioredis, BullMQ) |
| Backend | Express 4, Zod validation, JWT auth |
| Frontend | React 19, React Router 7, React Query 5, Zustand 5 |
| Styling | Tailwind CSS 3, Lucide icons |
| Build | Vite 6, TypeScript 5.6 (strict) |
| Infra | Docker Compose |

## Scripts

```bash
npm run dev             # Start all workspaces
npm run dev:backend     # Backend only
npm run dev:portal      # Admin portal only
npm run build           # Build all workspaces
npm run typecheck       # TypeScript check (zero errors required)
npm run lint            # Lint all workspaces
```

## License

Proprietary
