from pathlib import Path
import re, html, subprocess
from reportlab.platypus import SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, Flowable
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'
OUT.mkdir(parents=True,exist_ok=True)
PDF=OUT/'my-web-app-v2-stages-1-to-5.pdf'
styles=getSampleStyleSheet()
navy=colors.HexColor('#152E45'); teal=colors.HexColor('#087F8C')
styles.add(ParagraphStyle(name='BodyDoc',fontName='Helvetica',fontSize=10,leading=14,spaceAfter=7,textColor=navy))
styles.add(ParagraphStyle(name='TitleDoc',fontName='Helvetica-Bold',fontSize=32,leading=38,spaceAfter=20,textColor=navy))
styles.add(ParagraphStyle(name='Chapter',fontName='Helvetica-Bold',fontSize=23,leading=29,spaceAfter=18,textColor=navy))
styles.add(ParagraphStyle(name='Sub',fontName='Helvetica-Bold',fontSize=13,leading=17,spaceBefore=10,spaceAfter=7,textColor=teal,keepWithNext=True))
styles.add(ParagraphStyle(name='SmallDoc',fontName='Helvetica',fontSize=8,leading=11,spaceAfter=6,textColor=navy))
styles.add(ParagraphStyle(name='CodeDoc',fontName='Courier',fontSize=8,leading=11,backColor=colors.HexColor('#EEF3F6'),borderPadding=9,spaceBefore=5,spaceAfter=12))
styles.add(ParagraphStyle(name='CellDoc',fontName='Helvetica',fontSize=8,leading=11,textColor=navy))
styles.add(ParagraphStyle(name='CellHead',fontName='Helvetica-Bold',fontSize=8,leading=11,textColor=colors.white))

def clean(s):
    for a,b in {'—':' - ','–':'-','‑':'-','→':' -> ','↔':' <-> ','↓':'v','×':'x','’':"'",'‘':"'",'“':'"','”':'"','≥':'>='}.items(): s=s.replace(a,b)
    return s
def inline(s):
    s=html.escape(clean(s))
    s=re.sub(r'\[([^]]+)\]\(([^)]+)\)',r'\1',s)
    s=re.sub(r'`([^`]+)`',r'<font name="Courier">\1</font>',s)
    return re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
story=[]
def para(s,style='BodyDoc'): return Paragraph(inline(s),styles[style])
def table(rows,widths=None):
    n=len(rows[0]); widths=widths or [475/n]*n
    if rows[0]==['Method','Path','Success','Purpose']: widths=[60,160,50,205]
    data=[[para(v,'CellHead' if i==0 else 'CellDoc') for v in row] for i,row in enumerate(rows)]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F0F5F7')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),1,teal)]))
    story.extend([t,Spacer(1,12)])
def md(text):
    lines=clean(text).splitlines(); i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line: i+=1; continue
        if line.startswith('```'):
            i+=1; code=[]
            while i<len(lines) and not lines[i].startswith('```'): code.append(lines[i]); i+=1
            import textwrap
            code='\n'.join('\n'.join(textwrap.wrap(x,90,replace_whitespace=False,drop_whitespace=False)) if len(x)>90 else x for x in code)
            story.append(Preformatted(code,styles['CodeDoc'])); i+=1; continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[v.strip() for v in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[: -]+',v) for v in row): rows.append(row)
                i+=1
            table(rows); continue
        if line.startswith('#'):
            story.append(para(line.lstrip('# ').strip(),'Sub')); i+=1; continue
        parts=[line]; i+=1
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','```','|','- ')) and not re.match(r'^\d+\. ',lines[i]): parts.append(lines[i].strip()); i+=1
        story.append(para(' '.join(parts)))
def chapter(title,source=None):
    story.append(PageBreak()); story.append(para(title,'Chapter'))
    if source: story.append(para('Evidence: '+source,'SmallDoc'))

class Diagram(Flowable):
    def __init__(self,labels): super().__init__(); self.labels=labels; self.width=475; self.height=len(labels)*58
    def draw(self):
        c=self.canv
        for i,(title,detail) in enumerate(self.labels):
            y=self.height-(i+1)*58+12
            c.setFillColor(colors.HexColor('#EEF5F7')); c.setStrokeColor(teal); c.roundRect(35,y,405,43,6,fill=1,stroke=1)
            c.setFillColor(navy); c.setFont('Helvetica-Bold',11); c.drawCentredString(237,y+26,title)
            c.setFont('Helvetica',9); c.drawCentredString(237,y+11,detail)
            if i<len(self.labels)-1:
                c.line(237,y,237,y-12); c.line(237,y-12,233,y-8); c.line(237,y-12,241,y-8)

class Doc(BaseDocTemplate):
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and f.style.name=='Chapter':
            name='chapter-'+str(self.page); self.canv.bookmarkPage(name); self.canv.addOutlineEntry(f.getPlainText(),name,0)
            self.notify('TOCEntry',(0,f.getPlainText(),self.page,name))
def page(c,d):
    w,h=A4
    c.setStrokeColor(teal); c.setLineWidth(1); c.line(60,h-43,w-60,h-43)
    c.setFillColor(navy); c.setFont('Helvetica',8)
    c.drawString(60,h-34,'MY WEB APP V2  /  BUILD & LEARNING DOCUMENTATION')
    c.drawString(60,31,'Stages 1-5 | Source checkpoint 8dea970 | 30 September 2026')
    c.drawRightString(w-60,31,str(d.page))

story += [Spacer(1,70),para('PROJECT BUILD MANUAL','Sub'),para('My Web App V2','TitleDoc'),para('Full-Stack Work Tracker','Chapter'),para('Complete Build, Architecture, Testing & Learning Documentation - Stages 1-5','Sub'),Spacer(1,25)]
md('''From the first browser page to a persistent, authenticated application with Admin management, a personal User workspace, and Stage 5 regression coverage.

Prepared 30 September 2026. Repository checkpoint: **main / 8dea970**.

This manual combines a source-backed reconstruction of the early build with the project's detailed setup, API, security, and verification records. It serves as a study guide, a rebuild reference, and evidence of the completed application scope.

**Stage 6 is a future step. It is not documented as completed.**
''')
story.append(Spacer(1,25))
table([['Backend tests*','Frontend tests*','Live API checks*'],['56 passing','20 passing','89 requests passed']])
story.append(para('*Historical Stage 5 results recorded in docs/stage-5-testing.md; these counts are not a new live certification.','SmallDoc'))

chapter('Reading guide & evidence')
md('''## How to use this manual
Read chapters 1-4 for the architecture and startup sequence. Chapters 5-11 explain the staged build. Chapters 12-15 connect Git history, testing, defects, and verification. Chapters 16-18 provide troubleshooting, the Stage 6 boundary, and a practical API reference.

The stage headings follow the requested learning sequence. Actual commits interleave the work: the backend and PostgreSQL foundations landed on September 11, before the larger frontend implementation on September 14. Stage numbers are a learning map, not a claim that commits followed an uninterrupted numerical order.

## What the evidence can establish
The current README, six project guides, database schema, selected implementation files, package manifests, and Git history are the primary sources. Early work is reconstructed from commits, not a complete transcript of earlier conversations. Unrecorded commands, decisions, or test sessions are not invented.

The Stage 4.6A, Stage 4.6B, and Stage 5 verification sections below retain historical results. Their references to work being uncommitted describe the time of those checks. Current Git history supersedes those status notes: Admin management is 1295fd4, User experience is 2198120, and stabilization is 8dea970 on main.

This documentation task reads source and history and validates the generated PDF. It does not rerun the 89-request live verifier, repeat browser testing, re-audit dependencies, or modify production/application data. Recorded zero-vulnerability results describe the earlier audit, not a permanent security guarantee.

Private environment files and historical secret values are excluded. Examples use placeholders or fictional accounts. The historical credential issue mentioned by the Stage 5 record is not reproduced or remediated by this document.
''')
story.append(para('Contents','Sub'))
toc=TableOfContents(); toc.levelStyles=[ParagraphStyle(name='TOC',fontName='Helvetica',fontSize=9,leading=14,spaceBefore=4,textColor=navy)]
story.append(toc)

chapter('1. Project overview','README.md; Git history')
md('''The Work Tracker is a focused full-stack application for assigning work and tracking progress. Admins manage accounts and tasks. Regular Users see their own workload, update task status, and maintain their own profile and password.

The project is a structured rebuild of the earlier my-web-app project. The README explicitly keeps that earlier project unchanged as a learning reference. The new repository separates frontend, backend, database, and documentation so each layer can be understood and verified independently.

## Learning objectives
- Understand how HTML, CSS, JavaScript, and React produce an interactive browser experience.
- Trace an HTTP request from a React form through Express validation and authorization to PostgreSQL.
- Distinguish temporary component state from persisted database records.
- Enforce identity, roles, ownership, and business rules on the server.
- Use Git checkpoints, isolated tests, live database checks, and browser verification together.

## Deliberately focused scope
The application uses simple page selection and shared React state, inline details and confirmations, and local filtering. It does not add a routing framework, charting package, real-time transport, public registration, email delivery, or password-reset service. The documented implementation keeps each new technology tied to a concrete requirement.

At Stage 5 the result is a verified local application and a useful future DevOps workload. Hosting, deployment automation, monitoring, backup operations, and scaling are not established by the completed application work.
''')

chapter('2. Technology stack & architecture','package manifests; backend/server.js; frontend/vite.config.js')
story.append(Diagram([('Browser + React','Forms, navigation, feedback and role-aware views'),('HTTP / JSON REST API','Relative /api requests; cookie carries an opaque session ID'),('Node.js + Express','Authentication, authorization, validation and business rules'),('PostgreSQL','Users, tasks and server-side sessions')]))
md('''## Local ports and responsibilities
| Component | Local port | Role |
| React / Vite development | 5173 | Serves the frontend and proxies /api |
| Express API | 3000 | Handles requests and accesses PostgreSQL |
| PostgreSQL | 5432 | Stores durable records and sessions |
| Vite preview | 4173 | Locally verifies the built frontend with API proxy |

The browser calls /api on its own origin. Vite forwards those requests to Express, by default at http://127.0.0.1:3000. This local arrangement needs no additional CORS middleware. The production static bundle does not contain a working reverse proxy; a future host must route /api separately.

## Libraries at the documented checkpoint
Package manifests declare React/React DOM ^19.3.0, Vite ^8.3.0, @vitejs/plugin-react ^6.1.1, Express ^5.2.1, pg ^8.23.0, bcryptjs ^3.0.3, express-session ^1.19.0, connect-pg-simple ^10.0.0, and express-rate-limit ^8.7.0. These are declared ranges; npm ci installs the lockfile resolutions rather than choosing arbitrary latest versions.

Frontend source uses ES modules; backend source uses CommonJS. Node's built-in test runner provides automated tests. Postman supports manual API inspection. Git records local history; GitHub is part of the intended stack, but a remote publication or merge mechanism is not proven by the inspected local history.
''')

chapter('3. Project structure & data model','backend/database/schema.sql; source tree')
md('''```text
my-web-app-v2/
  frontend/
    src/App.jsx          shared state, session and page coordination
    src/pages/           Dashboard, Users, AdminTasks, Tasks, Profile, Login
    src/components/      forms, badges, confirmation and data states
    src/services/        HTTP service and filtering/count helpers
    test/                API service and management/personal helpers
    vite.config.js       development and preview proxy
  backend/
    server.js            middleware, routes, health and startup
    config/              database, environment, passwords, sessions, locks
    middleware/          authentication, request bodies and errors
    routes/              auth, users, tasks and profile
    database/            final schema and additive migrations
    scripts/             setup, checks, bootstrap and live verification
    test/                route, security, environment and failure tests
  docs/                  setup, API, account and stage verification guides
```

## Entity relationships
One user can have many assigned tasks. Each task has at most one assignee and may be unassigned. The nullable tasks.user_id foreign key references users.id. Sessions identify users through their stored JSON payload; the sessions table has no declared user foreign key in this schema.

| Table | Key fields | Rules |
| users | id, name, email, password_hash, active, role, created_at, updated_at | Serial primary key; case-insensitive unique email; admin/user role; legacy password hash may be null |
| tasks | id, title, description, status, priority, user_id, created_at, updated_at | Status and priority checks; optional user foreign key |
| sessions | sid, sess, expire | Opaque ID primary key; JSON session data; expiry index |

The foreign key uses ON DELETE SET NULL to preserve tasks if users are deleted externally. The application API is stricter: it blocks deletion while a user has assigned tasks, including completed work. Database constraints and application business rules therefore complement each other.

Timestamps are stored without time zone. API mutations explicitly update updated_at; external SQL does not trigger an automatic refresh. Keep local application/database timezone assumptions consistent until a deliberate migration addresses them.
''')

chapter('4. Setup & reproducible local startup','README.md; docs/database.md; docs/accounts.md')
md('''## Prerequisites and repository
The README calls for Node.js 22.12+ and recommends Node 24. Stage 5 recorded Windows/PowerShell, Node 24.21.0, and PostgreSQL 18. These are project-recorded requirements and environment details, not a new recommendation about the latest releases.

Start from the existing checkout, or clone your own repository URL into a new directory. The exact original clone URL and shell commands were not preserved in the inspected evidence. For a new empty repository, git init establishes history; do not run project-creation scaffolding over this existing app.

## New database only
Create my_web_app_v2 once using an authorized PostgreSQL administrator. Enter the password at the prompt. Do not recreate an existing database.
```text
createdb -U postgres my_web_app_v2
```
In backend, copy .env.example to .env only if the private file is absent. Configure DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, and PORT. Set a privately generated SESSION_SECRET of at least 32 characters and private BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD for first-Admin setup. Never paste real values into this document.

For an empty database, run the following from backend after configuration:
```text
npm ci
npm run db:init
npm run admin:bootstrap
npm run db:check
npm start
```

## Existing Stage 4 database
Use additive migrations to preserve records and sequences. db:init creates missing tables; it does not upgrade existing definitions.
```text
cd backend
npm ci
npm run db:migrate:accounts
npm run db:migrate:management
npm run admin:bootstrap
npm run db:check
npm start
```
Bootstrap is safe to repeat: it does not reset passwords or duplicate the first active Admin. Remove its private password input afterward if no longer needed. Existing legacy users remain separate from newly bootstrapped accounts.

## Frontend in another terminal
```text
cd frontend
npm ci
npm run dev
```
Open http://localhost:5173. Keep both application servers and PostgreSQL running. If the backend port changes, set API_PROXY_TARGET in the frontend's private environment configuration and restart Vite. Never expose database settings through VITE_ variables or frontend code.

## Verification commands
Run npm test separately in backend and frontend. Run npm run build in frontend; npm run preview then serves the production build locally on 4173. GET http://localhost:3000/api/health confirms a successful database query. db:check does not certify every schema column, and health does not certify application-table structure.
''')

chapter('5. Stage 1 - Frontend foundations','f622594; 12567bd; 2e0c062; 637bb26')
md('''The first browser foundation used an HTML page, a stylesheet, and a small JavaScript file. Commit 12567bd corrected the stylesheet filename from stylesc.ss to styles.css. This is a useful early example of checking asset paths before assuming the styling logic is wrong.

The React foundation introduced Vite, main.jsx, App.jsx, and useState. Its initial Test React button changed a message in component state, proving that an event could update the rendered page without a full reload.

The Work Tracker frontend then added Dashboard, Users, and Tasks pages; reusable UserForm and TaskForm components; status badges; styling; and mock records. This created a visible workflow before connecting it to a server. Mock data was a development stepping stone, not persistence.

## Core code concepts
Props pass data and callbacks into components. State stores the current UI values and selected page. A controlled form keeps its inputs in state, validates them, and calls an action when submitted. Reused forms and badges keep behavior consistent across views.

The current App coordinates the account, shared records, and page selection. Later stages added loading/error states and authenticated views to this foundation rather than introducing an unrelated UI framework.

## Learning checkpoint
Explain which values disappear on refresh when they exist only in React state. Identify the event handler that changes a task and trace the callback to shared state. Confirm that a visual change alone does not demonstrate a database write.

The early commits prove the implementation milestones, but no separate comprehensive Stage 1 test report is available. Later Stage 5 browser evidence verifies the final combined application, not every intermediate historical screen.
''')

chapter('6. Stage 2 - Backend & REST API','3a2b8fb; e48322b; backend/server.js; docs/api.md')
md('''The initial Express backend exposed GET /api/health on port 3000 and returned JSON showing that the backend was running. It established a process outside the browser and a URL that could be checked independently of the React UI.

The fuller user/task routes, environment validation, safe errors, and API tests arrived with the full-stack integration commit e48322b. The repository does not show a separate earlier commit containing the entire mature REST API. This manual groups these concepts under Stage 2 while preserving that historical distinction.

## Request lifecycle
Express parses JSON with a 100 KB limit. Health is handled independently of session lookup. Other API requests receive no-store cache behavior, then session middleware, write-request verification, account loading, route-specific access checks, and route logic. Unknown routes return safe 404 JSON; final error middleware handles failures.

Route code validates body shape, strings, IDs, enumerations, and references. Parameterized queries separate submitted values from SQL text. Expected conflicts return meaningful status codes instead of exposing database errors or stack traces.

## REST conventions used here
GET reads. POST creates or performs login/logout actions. PUT submits complete editable fields. PATCH changes a narrow field such as task status or account active state. DELETE removes a resource subject to safeguards. A task PUT applies defaults to omitted fields, so clients should send the complete form.

## Testing from the outside
Postman can call the API without React, making it possible to isolate backend behavior. For authenticated writes, retain the login cookie, use JSON where required, and send X-Requested-With: WorkTracker. Test both success and rejection paths: malformed input, duplicate email, missing records, unauthorized roles, and unowned tasks.

Node tests import the application without starting the normal server, use an ephemeral port, and mostly substitute database queries and session storage. This makes failures repeatable, but those tests cannot alone prove the real database schema or persistence.
''')

chapter('7. Stage 3 - PostgreSQL integration','f825961; docs/database.md; backend/config/database.js')
md('''The PostgreSQL foundation introduced pg, a database configuration module, schema SQL, and a health check that queried the database. The later integration work strengthened environment validation, initialization, timeouts, constraints, and connectivity checks.

The browser never connects to PostgreSQL. Express owns a shared pg.Pool and uses it to execute queries. A pool reuses connections; pool.query borrows and returns one automatically. Successful writes are committed before the API responds, so a later GET or browser refresh reads saved records.

## Transactions and migrations
Schema initialization runs in a transaction and creates missing tables without resetting data. Account and management migrations are separate additive upgrades. A transaction commits all its changes together or rolls them back, preventing a partly upgraded account schema or partly applied account-management operation.

Database constraints enforce primary keys, unique email, valid task status/priority, and assignment references. Application rules add requirements such as preventing inactive assignments and preserving an active usable Admin.

## Diagnose one layer at a time
First verify the PostgreSQL service, host, port, database, and role. Then run db:check and inspect health. A 28P01 code means authentication failed; check private configuration and shell overrides. Do not disable authentication or reset the database as a troubleshooting shortcut.

Connections time out after five seconds and SQL statements after ten seconds. Idle pool errors are handled. A database outage should produce safe errors while Express remains available to answer requests that do not require a successful database lookup.

## Persistence checkpoint
Create uniquely named temporary records through the API, retrieve them, reload the UI, and compare the database independently. Delete only those records afterward. Do not reset sequences: gaps after legitimate testing are normal.
''')

chapter('8. Stage 4 - Full-stack integration','e48322b; frontend/src/services/api.js; README.md')
md('''Commit e48322b removed mockData.js and connected the Work Tracker to real API records. The frontend API service centralizes fetch calls, JSON handling, readable errors, record-shape checks, cancellation, and timeouts. Components deal with records and user feedback rather than repeating transport logic.

## Example: saving a task
1. A form collects a title, description, priority, status, and optional assignee.
2. The service sends a JSON request to /api through Vite's proxy.
3. Express verifies the account and permission, validates the fields, and writes PostgreSQL.
4. The API returns the saved record with ID and timestamps.
5. React updates shared state only after success; the dashboard and list reflect the saved record.
6. Refresh reloads the same persisted record from the API.

## Loading and failure behavior
Initial failures show a readable error and Retry. Submitted forms preserve input when a request fails and disable pending actions. A 15-second frontend timeout bounds waiting. The timeout message tells the user to reload and check whether a write completed before retrying, because an interrupted response does not prove that the database write failed.

The service avoids showing raw HTML from proxy errors. It validates returned records before components consume them, and treats unexpected JSON or data shapes as readable failures. Cancelled page loads are handled without unnecessary UI changes.

## Integration checkpoint
Verify an Admin-created task in the database, refresh the UI, update its status from its assigned account, and confirm the Admin sees the result. Stop and restart the backend during a controlled local check; Retry should recover while preserving saved state. Stage 5 contains the recorded evidence for the final implementation.
''')

def source_chapter(title,file,stop=None,omit=()):
    chapter(title,file+' at 8dea970')
    text=(ROOT/file).read_text(encoding='utf-8')
    text=re.sub(r'^# .*\n','',text,count=1)
    if stop: text=text.split(stop)[0]
    for heading in omit:
        text=re.sub(r'## '+re.escape(heading)+r'\n.*?(?=\n## |\Z)','',text,flags=re.S)
    md(text)

source_chapter('9. Stage 4.5 - Authentication & RBAC','docs/accounts.md')
source_chapter('10. Stage 4.6A - Admin management','docs/admin-management.md',stop='## Changed files')
source_chapter('11. Stage 4.6B - User experience','docs/user-experience.md',stop='## Changed files')

chapter('12. Git workflow & project chronology','local Git history and branches inspected 30 September 2026')
md('''The inspected checkout is on main at 8dea970. Local branches also include feature/admin-management, feature/user-experience, and testing/stage-5-stabilization. The visible history is linear; it does not prove whether integration used a fast-forward, another local workflow, or a hosted pull request.

| Date | Commit | Milestone |
| Sep 11 | c22e3e0 | Initialize project foundation |
| Sep 11 | f622594 | Browser frontend foundation |
| Sep 11 | 12567bd | Correct stylesheet filename |
| Sep 11 | 2e0c062 | React frontend foundation |
| Sep 11 | 3a2b8fb | Express backend foundation |
| Sep 11 | f825961 | PostgreSQL connection |
| Sep 14 | 637bb26 | Work Tracker frontend with mock data |
| Sep 28 | e48322b | Complete full-stack integration |
| Sep 29 | a987d78 | Authentication and role-based access |
| Sep 29 | 1295fd4 | Admin user and task management |
| Sep 29 | 2198120 | Regular User experience |
| Sep 30 | 8dea970 | Stabilization and regression testing |

## Repeatable working discipline
Inspect status and the diff before editing. Work on a focused branch, preserve unrelated changes, run checks appropriate to the change, review the result, then commit and integrate deliberately. The commands below are a suggested future workflow, not a transcript of the original build:
```text
git status --short
git switch -c codex/descriptive-change
git diff
git diff --check
# Run relevant package tests and frontend build.
# Stage only the reviewed files, then commit.
git log --oneline -12
```

Keep .env ignored and secrets out of commits. A code rollback does not reverse a database migration; coordinate schema compatibility and preserve data. Do not rewrite historical commits or drop tables merely to return to an earlier UI checkpoint.

Earlier stage documents identify their starting HEAD and say the working changes were not yet committed. Those are valid snapshots of the testing sessions. The table above records the later completed commits and resolves the apparent conflict with the current main branch.
''')

source_chapter('13. Stage 5 - Testing & stabilization','docs/stage-5-testing.md',omit=('Defects reproduced and fixed','Files changed','Readiness'))

chapter('14. The four Stage 5 defects','docs/stage-5-testing.md; changes in 8dea970')
md('''Each regression was observed failing before its fix and passing afterward. These are narrowly scoped behavioral fixes, with no schema or dependency change.

## 1. The example session secret was accepted
The validator rejected a differently spelled placeholder but allowed the actual example value. A user could therefore believe a copied example was valid private configuration. The fix rejects both spellings while preserving the minimum length requirement. The regression reads the actual example file and asserts rejection, preventing example/configuration drift.

Files: backend/config/session.js and backend/test/environment.test.js.

## 2. A canceled response could expire a valid UI session
A request could be canceled while its response body was being read. If the delayed result was a 401, the service still dispatched session-expired because cancellation was only handled later in the catch path. The fix checks the combined abort signal after body parsing and before authentication side effects.

The regression verifies that a canceled response emits no session-expiry event while ordinary 401 behavior remains supported. This distinguishes expected React development cancellation from a real session-state bug.

Files: frontend/src/services/api.js and frontend/test/api.test.js.

## 3. A failed final login check left a saved session
Login saved a regenerated session before a final password/active-state database check. If that query failed, the response returned 500 but the saved session survived. The fix tracks whether regeneration occurred and destroys the new session on the error path before forwarding the failure.

The regression verifies the 500 response, absence of a new authenticated session, and rejection of a later protected request. An already existing independent session is not accidentally counted as the failed login's session.

Files: backend/routes/auth.js and backend/test/profile.test.js.

## 4. An occupied port reported successful startup
Express passed a listen error to the callback, but the callback ignored it and printed success. The fix checks the error, logs its code, sets exit status 1, and suppresses the success message.

The regression starts a child process against an occupied port and expects EADDRINUSE, exit 1, and no running-server message. Honest startup signals matter because later operational tooling will need to distinguish healthy processes from failed launches.

Files: backend/server.js and backend/test/startup.test.js.

## Additional failure coverage
An isolated refused database connection test checks health 503, login 500, no login cookie, safe responses/logs, and continued unauthenticated service. It targets an unused local port without stopping the real PostgreSQL server.
''')

chapter('15. Final verification & capability matrix','historical Stage 5 report; current Git checkpoint')
md('''| Evidence | Recorded Stage 5 result | Interpretation |
| Backend automated tests | 56 passed; none failed/skipped | Repeatable route/config/security regressions, mostly using doubles |
| Frontend automated tests | 20 passed; none failed/skipped | Service and helper coverage; not full browser automation |
| Production frontend build | Passed, 32 modules transformed | Build artifact generated successfully |
| Live API verification | 89 checked requests passed, plus cleanup | Real backend/database checks, separate from unit tests |
| Dependency audits | Backend and frontend reported zero known vulnerabilities | Audit-time result only |
| Data preservation | Three users and two tasks remained unchanged | Compared legitimate rows, not just counts |
| Browser review | Desktop, tablet and mobile workflows passed | In-app Chromium evidence, not cross-browser certification |

## Current application capabilities
Admins can manage users, active status, and tasks with safeguards; inspect dashboards; assign, unassign, and reassign work; and search/filter/sort their lists. Users can view only their assigned workload, update task status, inspect details, edit their name/email, and change their password with session revocation.

Authentication uses hashed passwords and PostgreSQL-backed sessions. Server checks enforce roles and task ownership. The UI provides loading/retry states, preserved failed form input, confirmation before deletion, and persisted data after refresh.

## What these results do not claim
The completed work is not a penetration test, a load test, a cross-browser certification, or a production deployment review. Historical zero-vulnerability and secret-scan results are not re-certified by generating this PDF. Distributed rate limiting, HTTPS reverse-proxy behavior, backups, and operational resilience remain future work.
''')

chapter('16. Troubleshooting & lessons learned','database, account, experience and Stage 5 guides')
md('''| Symptom | Likely check | Practical response |
| Styles absent in early frontend | Stylesheet name/path | The early stylesc.ss typo was fixed to styles.css; inspect requested assets |
| Database authentication rejected | PostgreSQL 28P01; environment overrides | Verify host/role and private .env values; quote a password containing # |
| Health succeeds but application query fails | Missing table/column or old schema | Health checks connectivity; inspect migration state separately |
| Backend cannot start | EADDRINUSE | Identify the intended process/port; do not assume startup succeeded |
| Browser cannot reach API | Backend process or proxy target | Start the backend, confirm target port, restart Vite after configuration changes |
| Request timed out | Response may be lost after a write | Reload and inspect saved state before submitting again |
| User cannot be deleted | Assigned tasks, including completed work | Reassign or deliberately delete the tasks first |
| Legacy account cannot log in | Null password hash or inactive state | Enable legacy login deliberately; active status is a separate setting |
| Old session fails after password change | Intended revocation | Sign in again with the new password |
| PowerShell npm launcher fails | Shell launcher issue | Use the installed npm CLI through Node, as recorded in Stage 5 |

## Lessons that transfer to future projects
A successful UI click is not proof of persistence; verify after reload and independently in the database. Hiding a button is not authorization; test the endpoint directly as another role. Tests with query doubles are valuable but need live integration evidence. A failed operation must clean up security state, not merely return an error.

Treat business-rule races as part of correctness: account updates and assignments coordinate through short locks, password changes revoke sessions atomically, and login rechecks credentials before leaving a usable session. These choices favor understandable correctness for the current small application.

Keep tests representative of reality. During Stage 4.6B a mock returned a freshly generated password hash on each read; correcting it to a stable stored hash fixed the fixture, rather than weakening the production login check.

Build verification must also preserve user data. Create uniquely labeled disposable records, remove only those records, and compare original rows. Avoid database and sequence resets as a testing convenience.
''')

chapter('17. Current state & Stage 6 boundary','README.md; docs/stage-5-testing.md; main at 8dea970')
md('''The source checkpoint is a complete local full-stack Work Tracker through Stage 5. The application has a clear browser/API/database boundary, a health endpoint, environment-based configuration, repeatable tests, and a build command. These provide concrete inputs for the next learning stage.

Stage 6 has not been started by this documentation task. The inspected records place deployment and operational concerns in future-stage work but do not define a final Stage 6 platform or implementation plan. No cloud account, hosting provider, container setup, pipeline, DNS change, or infrastructure deployment is assumed here.

## Suggested entry criteria for the next stage
- Preserve 8dea970 as the Stage 5 reference and make future changes reviewable.
- Agree on the deployment target and the learning goal before selecting tools.
- Plan frontend hosting and /api routing together, including HTTPS and cookie behavior.
- Separate development, testing, and deployed configuration; store real secrets privately.
- Define database persistence, migration, backup, restore, logging, and health-check expectations.
- Carry forward the existing tests and add checks for the actual deployed environment.

## Study exercises
Trace a task-status change from the component to the API and SQL ownership condition. Explain why the same User gets 404 for another task's details but 403 for its status update. Describe why a password change revokes all sessions and why reactivation does not revive old cookies. Explain the difference between a successful build, a successful health check, and production readiness.

## Small glossary
REST API: an HTTP interface for resources and actions. RBAC: permissions based on account roles. Ownership: permission tied to the assigned account. Session: server-side login state referenced by a cookie. Migration: a controlled schema upgrade. Regression test: a check that a fixed defect does not return. Transaction: changes committed or rolled back together. Proxy: a server that forwards requests to another server.
''')

source_chapter('18. API reference & request examples','docs/api.md')
md('''## Clarifications for interpreting the reference
POST /api/auth/login and POST /api/auth/logout are also supported. Login uses email/password JSON; both require the write-verification header. Preserve cookies between requests.

The general missing-status-target 404 applies to Admins. Users receive 403 for missing/unowned status targets and 404 for unowned task details.

Example IDs are illustrative; choose an existing active assignee or null. Password placeholders are not credentials.
''')

chapter('Source register','repository-local evidence')
table([['Source','What it supports'],['README.md','Purpose, stack, startup, proxy behavior and project layout'],['docs/database.md','Environment, initialization, persistence and database troubleshooting'],['docs/accounts.md','Authentication, migrations, sessions, password policy and RBAC'],['docs/admin-management.md','Stage 4.6A features, safeguards and historical verification'],['docs/user-experience.md','Stage 4.6B features, ownership, profile/password behavior and checks'],['docs/stage-5-testing.md','Historical final results, four fixes, 89-request verification and limitations'],['docs/api.md','Routes, request bodies, validation and response contracts'],['backend/database/schema.sql','Tables, columns, indexes, constraints and relationships'],['backend/server.js; frontend/src/services/api.js','Request flow, startup behavior and frontend transport handling'],['frontend/vite.config.js; package manifests','Proxy settings, commands and declared dependencies'],['Local Git history through 8dea970','Chronology, source milestones, current branch and completed checkpoint']],[180,295])
md('''Compiled from the local repository on 30 September 2026. The detailed account, Admin, User, Stage 5, and API chapters adapt the project's own guides, with editorial explanations and status clarifications. No external sources are needed to substantiate this repository-specific build history.

The PDF is a documentation artifact, not a backup of source code or database data. Keep the repository, lockfiles, migration scripts, and private operational backups separately. No real credentials, session IDs, password hashes, or private environment values are included.
''')

doc=Doc(str(PDF),pagesize=A4,rightMargin=60,leftMargin=60,topMargin=64,bottomMargin=55,title='My Web App V2 - Full-Stack Work Tracker: Stages 1-5',author='Project Documentation',subject='Build, architecture, testing and learning manual')
doc.addPageTemplates(PageTemplate(id='main',frames=[Frame(60,55,475,A4[1]-119,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=page))
doc.multiBuild(story)
reader=PdfReader(PDF)
print(f'Created {PDF}; pages={len(reader.pages)}')
for i,p in enumerate(reader.pages):
    text=p.extract_text() or ''
    if len(text)<100: print('CHECK SHORT PAGE',i+1,len(text))
(ROOT/'tmp/pdfs/extracted.txt').write_text('\n\n'.join(p.extract_text() for p in reader.pages),encoding='utf-8')
