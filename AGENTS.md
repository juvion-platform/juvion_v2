# Juvion v2 — Indian College ERP Platform

## Project Overview

Multi-tenant college ERP built as a MERN monorepo (MongoDB, Express, React 19, Node.js, TypeScript strict). Every data model and query is scoped by `collegeId` for multi-tenancy.

## Quick Start

```bash
# Prerequisites: Node >= 20, MongoDB 7 running on 27017, Redis 7 on 6379
# Or: docker compose up mongodb redis

npm install                     # installs all workspaces
npm run dev:backend             # backend on :3001
npm run dev:portal              # admin portal on :5173
npm run seed -w backend         # seed dev data
npm run typecheck               # check both workspaces
```

## Architecture

```
juvion_v2/
  backend/           Express API (port 3001)
  admin-portal/      React 19 + Vite (port 5173, proxies /api -> :3001)
  tsconfig.base.json Shared TS config (strict, noUnusedLocals, noUncheckedIndexedAccess)
  docker-compose.yml MongoDB 7, Redis 7, backend, admin-portal
```

### Backend Modules (M01-M12 + Juvi)

Each module under `backend/src/modules/<name>/` has: `models.ts`, `service.ts`, `routes.ts`, `controller.ts`, `validation.ts`

| Route prefix    | Module        | Code |
|-----------------|---------------|------|
| /api/admissions | Admissions    | M01  |
| /api/people     | People        | M02  |
| /api/academics  | Academics     | M03  |
| /api/finance    | Finance       | M04  |
| /api/hr         | HR            | M05  |
| /api/welfare    | Welfare       | M06  |
| /api/placement  | Placement     | M07  |
| /api/campus     | Campus Ops    | M08  |
| /api/student-dev| Student Dev   | M09  |
| /api/compliance | Compliance    | M10  |
| /api/governance | Governance    | M11  |
| /api/platform   | Platform      | M12  |
| /api/juvi       | Juvi AI       | -    |

### Frontend Pages

Each module has a hub page (`src/pages/<Module>.tsx`) and sub-pages (`src/pages/<module>/*.tsx`). Services live in `src/services/<module>.ts`.

## Critical Conventions

### Multi-tenancy
- **Every** Mongoose model must have `collegeId: { type: Schema.Types.ObjectId, required: true, index: true }`
- **Every** query must filter by `collegeId` — never query without it
- `authenticate` middleware extracts `collegeId` from JWT or `x-college-id` header
- Dev bypass: when `NODE_ENV=development` and no token, uses `collegeId = '000000000000000000000001'`

### AppError
```typescript
// Constructor: statusCode FIRST, then message
throw new AppError(404, 'Resource not found');  // CORRECT
throw new AppError('Not found', 404);           // WRONG — will not work
```

### Service Layer Pattern
```typescript
export async function getWidget(collegeId: string, id: string) {
  const doc = await Widget.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Widget not found');
  return doc;
}

export async function createWidget(collegeId: string, data: CreateWidgetInput, performedBy: string) {
  const doc = await Widget.create({ ...data, collegeId });
  await createAuditLog({
    collegeId, entityType: 'Widget', entityId: String(doc._id),
    entityName: doc.name, action: 'create', changes: [], performedBy,
  });
  return doc;
}
```

- All CRUD functions take `collegeId` as first param
- CUD functions take `performedBy` as last param and call `createAuditLog()`
- Use `String(doc._id)` to convert ObjectId to string (not `doc._id as string`)
- Prefix unused params with underscore: `_performedBy` if audit not needed

### Controller Pattern
```typescript
export async function listWidgets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query;
    const result = await widgetService.listWidgets(req.collegeId!, +page, +limit);
    res.json(result);
  } catch (e) { next(e); }
}
```

### Route Pattern
```typescript
router.get('/', authenticate, listWidgets);
router.post('/', authenticate, validate(createWidgetSchema), createWidget);
```

### Pagination
`paginate(Model, filter, page, limit)` returns `{ items, total, page, pages }`

### Validation
Zod schemas in `validation.ts`, applied via `validate(schema)` middleware.

### TypeScript Strictness
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noUncheckedIndexedAccess: true`
- Prefix unused params with `_` (e.g., `_performedBy`, `_req`)
- Run `npm run typecheck` to verify zero errors

## Frontend Conventions

### State Management
- **Server state**: React Query v5 (`@tanstack/react-query`)
- **Auth state**: Zustand store (`src/stores/authStore.ts`) — persists token + collegeId to localStorage
- **HTTP**: Axios with interceptors that attach `Authorization` and `x-college-id` headers; 401 responses clear token and redirect to `/login`

### Form Pages
- Dropdowns for any field referencing another entity (never raw ObjectId text inputs)
- Required dropdown fields get a `+ Manage` link (opens the entity's CRUD page in new tab)
- Shared CSS constants: `inp` for inputs, `lbl` for labels, `manageLink` for manage links
- Modal-based create/edit forms with `react-query` mutations

### Styling
Tailwind CSS with a custom color palette (`primary-*`, `navy`). Icons from `lucide-react`.

## Environment Variables

```
NODE_ENV=development
PORT=3001
MONGO_URI=mongodb://localhost:27017/juvion_v2
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret
DEV_COLLEGE_ID=000000000000000000000001
```

## Key Dependencies

| Backend           | Frontend              |
|-------------------|-----------------------|
| Express 4         | React 19              |
| Mongoose 8        | React Router 7        |
| Zod 3             | React Query 5         |
| BullMQ 5          | Zustand 5             |
| jsonwebtoken 9    | Axios 1.7             |
| ioredis 5         | Tailwind CSS 3        |
| ts-node-dev       | Vite 6                |
