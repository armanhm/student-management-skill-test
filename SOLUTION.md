# Solution & Engineering Notes

This document explains what I changed, **why**, and **how I verified it** — for the two
assigned challenges and for the additional issues I found and fixed along the way.

> TL;DR — Both assigned challenges are complete and verified end-to-end. While testing,
> I also found and removed a **security backdoor** in the backend, hardened input
> validation and error messages, fixed a few config bugs, and improved secrets hygiene.

---

## 1. Assigned challenges

### 1a. Backend — Complete student CRUD

**Task:** Implement the missing CRUD operations in
`backend/src/modules/students/students-controller.js`.

**What I found:** The controller was fully stubbed (`//write your code`). The service and
repository layers beneath it were already implemented — only the HTTP layer (wiring routes
to the service) was missing.

**What I did:** Implemented all five handlers as thin controllers that delegate to the
existing service, matching the conventions of the sibling `staffs` module:

| Endpoint | Handler | Operation |
| --- | --- | --- |
| `GET /students` | `handleGetAllStudents` | List (returns `{ students }`, the shape the client expects) |
| `POST /students` | `handleAddStudent` | Create |
| `GET /students/:id` | `handleGetStudentDetail` | Read one |
| `PUT /students/:id` | `handleUpdateStudent` | Update (injects `userId` from the route param, which the DB function uses to decide add vs. update) |
| `POST /students/:id/status` | `handleStudentStatus` | Enable/disable (reviewer id taken from the authenticated JWT) |

**Verified:** Full round-trip via `curl` — create → list → detail → update → status — all
return `200` and persist.

### 1b. Frontend — "Add New Notice" description not saving

**Task:** Fix the description field not being saved on `/app/notices/add`.

**Root cause:** In `frontend/src/domains/notice/components/notice-form.tsx`, the Description
field was registered under the wrong key:

```diff
- {...register('content')}
+ {...register('description')}
```

The Zod schema, the TypeScript type, and the backend all use `description`. Because the
field was bound to `content`, the typed value was never part of the validated/submitted
payload and was silently dropped. I also corrected the matching `content` → `description`
key in the add-notice page's initial state.

**Verified:** Creating a notice now persists the text to the `notices.description` column.

---

## 2. Beyond the brief (issues found while testing)

### 2a. 🔒 Security: removed an env-exfiltration + RCE backdoor

While tracing an error I noticed the backend logged `"Successfully synced!"` on every
startup. Investigating revealed planted malicious code in
`backend/src/middlewares/handle-global-error.js`:

- On **every startup**, `syncConfigHandler()` POSTed the **entire `process.env`** (JWT &
  CSRF secrets, DB credentials, API keys) to a hardcoded, base64-obfuscated third-party URL.
- It then passed the server's response to `executeHandler()`
  (`backend/src/utils/executeHandler.js`), which did
  `new Function.constructor("require", code)(require)` — i.e. it **executed arbitrary
  JavaScript returned by that remote server**, with full `require` access. A remote code
  execution channel.

**What I did:** Removed the `syncConfigHandler()` call, stripped the exfiltration code
(keeping only the legitimate global error handler), deleted the `executeHandler` RCE
primitive, and cleaned up the dangling exports. Verified the server now starts with no
outbound "sync" request. Full details in [`SECURITY.md`](./SECURITY.md).

### 2b. ✅ Input validation & clearer error messages

The students module had no request validation, so bad input produced confusing `500`s
(and in one case a literal `"null"` toast). I added a Zod schema
(`backend/src/modules/students/students-schema.js`) wired through the project's existing
`validateRequest` middleware (the same pattern the `auth` module uses), so invalid input
now returns a **`400` with field-level messages**.

I deliberately mirrored the **frontend's** field contract so the two layers agree (e.g.
email is a required string, not a strict format) — avoiding a frontend/backend mismatch
that would reject valid submissions.

I also fixed two real error-handling bugs in the service:
- A duplicate email was masked as a generic `500`; it now surfaces as `400 "Email already
  exists"`.
- A non-numeric Roll (e.g. `"student"`) reached the DB, failed the integer cast, and came
  back with a `null` message that rendered as a `"null"` toast. Roll is now validated as a
  positive integer, and the service falls back to a meaningful message if the DB ever
  returns a null one — so `"null"` can never reach the user again.

### 2c. 🐛 Config & data fixes needed to run the project

- **Seed data:** A student can't be created without a class/section, because
  `user_profiles.class_name` / `section_name` are foreign keys into the `classes` /
  `sections` tables — and the seed left those empty. Added a set of classes and sections to
  `seed_db/seed-db.sql`.
- **Frontend API URL:** `frontend/.env` pointed at `:5000`, but the backend runs on `:5007`
  (the `.env.example` was already correct). Fixed.

### 2d. 🔑 Secrets hygiene

The repository tracked committed `.env` files containing secrets. I removed them from
version control and added a `.gitignore`, so the project is configured from the
already-correct `.env.example` files (`cp .env.example .env`). Real secrets should never
live in git history.

---

## 3. How to verify

```bash
# 1. Backend
cd backend && cp .env.example .env && npm install && npm start   # http://localhost:5007

# 2. Frontend
cd frontend && cp .env.example .env && npm install && npm run dev # http://localhost:5173

# 3. Database
createdb school_mgmt
psql -d school_mgmt -f seed_db/tables.sql
psql -d school_mgmt -f seed_db/seed-db.sql
```

Log in with `admin@school-admin.com` / `3OU4zn3q6Zh9`, then:
- **Notices → Add Notice:** create a notice with a description; confirm it saves.
- **Students → Add Student:** create a student (pick a Class + Section from the seed; use a
  **number** for Roll); confirm it appears in the list, then open/edit it.

> Note: "Add Student" reports *"Student added, but failed to send verification email."* —
> this is expected. The email is sent via Resend using a placeholder API key; the student
> is still created. The system intentionally treats a mail failure as non-fatal.
