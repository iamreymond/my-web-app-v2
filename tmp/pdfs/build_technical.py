from pathlib import Path
import subprocess, hashlib, io, zipfile, textwrap, json
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[2]
base=(ROOT/'tmp/pdfs/build_documentation.py').read_text(encoding='utf-8').split('\ndoc=Doc(')[0]
base=base.replace("PDF=OUT/'my-web-app-v2-stages-1-to-5.pdf'", "PDF=OUT/'my-web-app-v2-technical-manual-stages-1-to-5.pdf'")
base=base.replace('Complete Build, Architecture, Testing & Learning Documentation - Stages 1-5','Technical Build Manual & Source Code - Stages 1-5')
base=base.replace('This manual combines a source-backed reconstruction of the early build with the project\'s detailed setup, API, security, and verification records.', 'This expanded edition combines the build history with implementation walkthroughs, workflow diagrams, full numbered source listings, and an extractable source archive.')
base=base.replace('The PDF is a documentation artifact, not a backup of source code or database data.', 'The first part records project history; the technical chapters and source appendix that follow document the implementation. The included source snapshot is not a database backup.')
exec(compile(base,str(ROOT/'tmp/pdfs/build_documentation.py'),'exec'))
pdfmetrics.registerFont(TTFont('CodeMono','C:/Windows/Fonts/consola.ttf'))
REF='8dea970ba22de0b3c79fe2301a515ab780138815'
GIT=['git','-c',f'safe.directory={ROOT.as_posix()}']
def git(*args): return subprocess.check_output(GIT+list(args),cwd=ROOT)
paths=git('ls-tree','-r','--name-only',REF).decode().splitlines()
snapshot={p:git('show',REF+':'+p) for p in paths}
codepaths=[p for p in paths if p=='.gitignore' or p.startswith(('backend/','frontend/')) and not p.endswith('package-lock.json')]
assert not any(p.endswith('/.env') or 'node_modules/' in p for p in snapshot)
ZIP=OUT/'my-web-app-v2-stage5-source.zip'
with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED) as z:
    for p,b in snapshot.items(): z.writestr('my-web-app-v2/'+p,b)
    manifest={'commit':REF,'files':{p:hashlib.sha256(b).hexdigest() for p,b in snapshot.items()}}
    z.writestr('SNAPSHOT-MANIFEST.json',json.dumps(manifest,indent=2))

chapter('19. Technical edition: scope & navigation','immutable Git snapshot '+REF)
md(f'''This edition extends the build manual with the technical details needed to trace, maintain, and reconstruct the application. The following chapters explain runtime boundaries, React state, middleware ordering, SQL ownership, transaction locks, authentication races, database evolution, and test design. Full source listings follow the explanations.

## What is included
The appendix prints **{len(codepaths)} files**: every tracked first-party backend/frontend source file, SQL schema and migrations, maintenance scripts, test files, CSS, HTML, package manifests, Vite configuration, example environment files, and .gitignore at commit 8dea970. Listings retain source line numbers. Long lines wrap visually; a dot in the line-number gutter marks a continuation of the previous source line.

The companion source ZIP contains **{len(snapshot)} tracked files**, including both package-lock.json files and original project documentation. The same ZIP is embedded as an attachment inside this PDF; a PDF reader with an Attachments panel can extract it. Lockfiles are included in the archive rather than printed because they are generated dependency resolution records. No node_modules, dist, .git history, private .env, real database records, or runtime sessions are included.

## Exactness and safe examples
All archived file bytes come directly from the named Git commit. SNAPSHOT-MANIFEST.json provides the full commit ID and SHA-256 digest for each file. The ZIP is a source distribution, not an installed environment: npm ci and private database configuration are still required.

Test-only passwords, dummy email addresses, and example placeholders remain in the source because they are part of the executable fixtures and validation tests. They are explicitly synthetic, not real account credentials. Unsupported display glyphs in printed code are shown as Unicode escapes; the embedded source remains byte-for-byte unchanged.

## Reading routes through the code
For login, start at Login.jsx, then App.signIn, services/api.js, server.js, middleware/auth.js, routes/auth.js, and config/session.js. For a task status change, start at Tasks.changeStatus, App.changeTaskStatus, updateTaskStatus, then the PATCH handler in routes/tasks.js. For password changes, follow Profile.changePassword through changePassword to routes/profile.js and managementTransaction.

The original test counts remain historical Stage 5 evidence. This edition documents the implementation; it does not rerun the live data-mutating verifier or assert that previously tested deployments exist.
''')

class Sequence(Flowable):
    def __init__(self,actors,events):
        Flowable.__init__(self); self.actors=actors; self.events=events; self.width=475; self.height=70+len(events)*43
    def draw(self):
        c=self.canv; count=len(self.actors); xs=[35+i*405/(count-1) for i in range(count)]
        c.setFont('Helvetica-Bold',9)
        for x,name in zip(xs,self.actors):
            c.setFillColor(navy); c.drawCentredString(x,self.height-15,name)
            c.setStrokeColor(colors.HexColor('#BDD1DB')); c.line(x,15,x,self.height-25)
        for i,(a,b,label) in enumerate(self.events):
            y=self.height-53-i*43; x1,x2=xs[a],xs[b]; c.setStrokeColor(teal); c.setFillColor(navy)
            c.line(x1,y,x2,y); direction=1 if x2>x1 else -1
            c.line(x2,y,x2-direction*5,y+3); c.line(x2,y,x2-direction*5,y-3)
            c.setFont('Helvetica',8)
            for j,s in enumerate(textwrap.wrap(label,62)):
                c.drawCentredString((x1+x2)/2,y+7+j*10,s)

chapter('20. Runtime architecture & trust boundaries','server.js; vite.config.js; config/database.js; middleware/auth.js')
story.append(Diagram([('Browser process: React','Untrusted inputs; safe account and task data; no DB credentials'),('Vite development server :5173','Same-origin /api forwarding to Express :3000'),('Express process :3000','Cookie/session lookup -> account -> permission -> route'),('PostgreSQL :5432','pg.Pool: users, tasks, sessions; constraints and transactions')]))
md('''## The boundary between UI state and authority
The browser can be modified by its user. React role-based rendering is a usability feature; Express decides whether an operation is allowed. An account ID supplied in a JSON body is not the identity of the caller. loadAccount derives identity from req.session.userId and rereads a usable active account from PostgreSQL.

There is no separate service process, ORM, Redis cache, message queue, or client-side persistence layer. Express routes call pg directly. Helpers centralize connection pooling, safe selected columns, validation, password hashing, and management transactions. Understanding this direct structure is necessary before adding abstraction or infrastructure.

## Runtime configuration and process lifetime
Backend startup loads .env using Node's --env-file flag in the npm script. DB_* values configure one shared Pool. max is 10; connectionTimeoutMillis is 5000; statement_timeout is 10000; idleTimeoutMillis is 30000. Idle connection failures log a code and do not become unhandled pool errors.

createSessionMiddleware runs during application construction and validates SESSION_SECRET. The normal entry point validates the database environment and starts listening. Importing server.js exports the app for tests without calling listen. Session configuration still needs valid test environment values during imports.

PORT defaults to 3000. A listen callback error records only its code, sets process.exitCode to 1, and does not print a success message. Health executes SELECT NOW(); it tests database reachability, not the full application schema.

## Same-origin writes and cookie security
Every non-GET/HEAD/OPTIONS API operation requires X-Requested-With: WorkTracker and rejects Sec-Fetch-Site: cross-site. No permissive CORS layer is configured. Cookies add HttpOnly and SameSite=Lax, with Secure enabled when NODE_ENV is production. These controls assume the documented same-origin arrangement; this source snapshot does not configure a production reverse proxy or trust proxy setting.

The browser receives a signed opaque session ID, not a JSON Web Token. The server-side session contains userId plus cookie metadata. It does not cache the role as the authority. A role or active-status change therefore affects subsequent account lookups, and relevant mutations delete stored sessions.
''')

chapter('21. React component tree & state transitions','frontend/src/App.jsx; pages; components; services')
md('''```text
main.jsx -> StrictMode -> App
  header + role-aware navigation
  DataState(checkingSession, sessionError)
    signed out -> Login
    signed in -> DataState(isLoading, loadError)
      Admin -> Dashboard | Users | AdminTasks
      User  -> Dashboard | Tasks | Profile
  shared forms: UserForm, TaskForm
  display helpers: StatusBadge, PriorityBadge, ConfirmDelete
```

## State ownership
App owns account, users, tasks, currentPage, session restoration state, workload loading state, and logout feedback. Individual pages own transient filters, selected details, pending-operation flags, and messages. Forms own their input values. Page navigation unmounts those page-level values; saved records survive because they are loaded from the API.

accountId is a ref updated from the active account. Each mutation captures its initiating account ID before awaiting the HTTP call. A late response is applied only if the ref still matches. This guards against rendering one account's late mutation response after logout or a switch to another account.

## Session and workload effects
The first effect calls getSession with an AbortController. A successful /auth/me result is either an account or null; an unavailable backend is an error with a retry path, not proof that the user is signed out. The cleanup aborts old work.

After authentication, another effect loads users and tasks with Promise.all. Admins request /users; ordinary Users use [account] locally and never request the Admin list. Express already scopes the tasks. The effect depends on account ID, role, and loadAttempt rather than the whole account object. A successful name/email edit can update the header without remounting the form and discarding its success message.

The session-expired event clears the account and workload. password-changed performs the same clearing and adds a re-login message. Login resets old arrays and selects the dashboard before setting the returned account. Logout clears the UI only after its API call succeeds; a failed logout leaves readable feedback.

## Mutation contract
Forms await callbacks; App awaits API responses; only then does it append, replace, or remove a record using functional state updates. There is no optimistic database write simulation. Task status returns the saved record so a currently open details panel can also update. React renders text content normally, rather than inserting user content as raw HTML.

## Lists and derived values
management.js filters Admin users by name/email, role, active state and sort; Admin tasks by title, status, priority, assignee and sort. personal.js searches title/description and orders by time, priority, or status. Each filters into a new array before sorting, preserving shared state order. Dashboard totals use the full authorized task array, not the filtered visible subset.

No pagination, subscription, polling, or real-time transport exists. Changes made in another session are reflected on a later load/refresh. This is an explicit property of the current implementation, not a synchronization guarantee.
''')

chapter('22. HTTP pipeline & task workflow','api.js; server.js; tasks.js')
story.append(Sequence(['React','API service','Express','PostgreSQL'],[(0,1,'updateTaskStatus(id, status)'),(1,2,'PATCH /api/tasks/:id/status + cookie + JSON'),(2,3,'Load active account from session userId'),(3,2,'Account role and ID'),(2,3,'UPDATE ... WHERE id AND (admin OR owner)'),(3,2,'RETURNING saved task, or zero rows'),(2,1,'JSON saved task or safe error status'),(1,0,'Validate record; update shared state after success')]))
md('''## Exact middleware order
1. express.json({ limit: '100kb' }) parses JSON; parser failures go to the final error handler.
2. GET /api/health executes outside session/account middleware.
3. /api responses receive Cache-Control: no-store.
4. Session middleware reads the cookie and loads server-side state.
5. protectWrites verifies state-changing requests; loadAccount rereads an active login-enabled account.
6. /auth routes handle session discovery/login/logout. /profile requires an account. /users requires an account and Admin. /tasks requires an account and performs per-operation role/ownership checks.
7. Route-level jsonBody requires application/json and a non-array object where used. Unknown routes return 404; errors finish in middleware/errors.js.

## SQL authorization is part of the write
The task status query includes WHERE id = $2 AND ($3::boolean OR user_id = $4). The boolean is derived from req.account.role, and the owner ID from req.account.id. Neither comes from a request query parameter. The same atomic UPDATE both checks assignment and writes status, avoiding a separate read-then-write ownership gap.

For a User, extra payload fields are rejected even if status is valid. Zero matching rows return 403 without revealing whether the target exists. Admins receive 404 for a nonexistent target. Task detail instead uses an ownership-filtered SELECT and returns 404 when no authorized row is found.

## Frontend transport behavior
request composes a caller abort signal with a 15-second timeout. It sends credentials: same-origin, Accept: application/json, and the write-verification header. JSON helpers add Content-Type for body requests. Responses are parsed only when their content type indicates JSON.

After body parsing, signal.throwIfAborted runs before any session-expired event. This ordering is the Stage 5 cancellation fix. A legitimate protected 401 dispatches the event; login 401 remains a login error. Server 5xx responses are converted to a generic service-unavailable message. Network errors, malformed JSON, incompatible record shapes, and timeouts have separate readable feedback.

## Task creation and full editing
saveTask validates and normalizes fields, then uses managementTransaction. It rechecks the acting Admin under the users-table lock. An edit locks the existing task with FOR UPDATE; an assignment requires a real active user, except the existing inactive assignment may be retained. INSERT/UPDATE returns taskFields, including camelCase aliases for userId and timestamps.

PUT uses defaults for omitted editable fields. It is not a partial patch: omitted assignment becomes null, for example. The UI sends a complete form. The dedicated PATCH endpoint is the narrow status operation.
''')

chapter('23. Authentication & revocation sequences','routes/auth.js; routes/profile.js; config/session.js')
story.append(Sequence(['Browser','Express','bcrypt','Database'],[(0,1,'POST /auth/login: email and password'),(1,3,'Read account by normalized email'),(3,1,'Account + password hash (server only)'),(1,2,'compare(password, stored hash or dummy hash)'),(2,1,'Match / no match'),(1,3,'Regenerate session, set userId, save'),(1,3,'Recheck password_hash and active FOR SHARE'),(1,0,'Safe account JSON + signed session cookie')]))
md('''## Login branches and failure cleanup
Malformed email/password fields return the same generic 401 as a bad credential. bcrypt.compare also runs with a random dummy hash for unknown or legacy accounts, reducing an obvious timing difference; this is not a claim of perfect timing indistinguishability. Login is limited to 20 attempts per IP per 15 minutes by an in-process limiter.

After password verification, regenerate replaces any old session ID to prevent fixation. userId is then saved. The final database check detects changed credentials or deactivation; FOR SHARE coordinates with concurrent password updates. If the check fails or its query errors, the regenerated session is destroyed rather than left valid. The Stage 5 failure regression covers that error path.

GET /auth/me returns safe account data or user:null. Logout deletes server-side state and clears worktracker.sid with the configured cookie attributes. Replaying a copied old cookie cannot revive a deleted session.

## Password-change transaction
The profile password endpoint requires authentication and limits attempts to 10 per account per 15 minutes. It allows exactly currentPassword, newPassword, and confirmPassword. The new password must differ, confirm correctly, be at least 12 JavaScript string units, and remain within bcrypt's 72 UTF-8 byte limit. The UI and normal project wording call this a 12-character minimum; the source uses .length, which is UTF-16 code-unit length for non-ASCII strings.

Within managementTransaction, the handler rereads the active account hash FOR UPDATE, checks the current password, hashes the new value with cost 12, updates the hash/timestamp, and deletes all matching session rows. The database commit couples credential replacement and stored-session revocation. Then it destroys the request session and clears the cookie; the frontend emits password-changed only after success.

## Race cases to understand
If a password change commits before a racing old-password login saves, the final login check sees the different hash and deletes the new session. If login completes first, the later password transaction deletes its session. If the final login query itself errors after session save, Stage 5 cleanup destroys that session before forwarding the failure.

After the password transaction commits, a later failure destroying the request session could still return an error although the new password is already stored. Database commit and HTTP delivery are different events. This is why response failure cannot universally imply that no state changed.

## Storage and authorization limits
The default session lifetime is eight hours. Production uses PostgreSQL session storage; NODE_ENV=test switches to MemoryStore for isolated automated checks. This is not a production memory-store fallback. Rate limits remain process-local and reset on restart; there is no shared distributed store or deployed HTTPS proof in this checkpoint.
''')

chapter('24. Database design, locks & migrations','database/*.sql; config/management.js; routes/users.js')
md('''```text
users                          tasks
  id SERIAL PK  <-------------  user_id INTEGER NULL FK
  name VARCHAR(100)             id SERIAL PK
  email VARCHAR(255) UNIQUE     title VARCHAR(200)
  password_hash TEXT NULL       description TEXT
  role admin | user             status Open | In Progress | Completed
  active BOOLEAN                priority Low | Medium | High
  created_at / updated_at       created_at / updated_at

sessions
  sid VARCHAR PK
  sess JSON -> userId (logical association; no declared FK)
  expire TIMESTAMP(6) + expiry index
```

## Mapping SQL to JSON
The backend selects explicit fields instead of SELECT *. userFields computes canLogin from password_hash IS NOT NULL without exposing the hash. taskFields aliases user_id to userId and timestamps to createdAt/updatedAt. A safe API response contract should not change merely because a private database column is added.

The schema keeps both the original email UNIQUE constraint and a unique lower(email) index. API inputs normalize email to lowercase, while the index protects case-insensitive uniqueness at the database boundary. Task status/priority CHECK constraints reject invalid stored values even outside React.

## Management transaction boundaries
managementTransaction checks out one pool client, begins, sets a five-second local lock timeout, and locks users IN SHARE ROW EXCLUSIVE MODE. All callback queries run on that same client. Success commits; failure rolls back; finally releases the client. Mixing pool.query inside that callback would use another connection and lose the intended transaction boundary, so the mutation helpers use client.query.

The shared helper serializes participating account safeguards and task assignment operations. It is a coarse lock that favors reasoning about correctness over high write throughput. It does not mean every API request uses a transaction: reads, user creation, profile name/email edits, task deletion, and the atomic status UPDATE have their own simpler paths in the source.

changeUser rechecks the acting Admin, reads the target, applies self/last-usable-Admin/legacy-promotion guards, checks assigned tasks for deletion, performs the mutation, and deletes sessions where access was revoked. A lock timeout code 55P03 becomes a safe 409 asking the user to retry. It is not retried automatically.

## Migration ordering
schema.sql describes the final empty-database shape. accounts.sql adds password_hash and role, ensures the role constraint and lower(email) index, and creates sessions. admin-management.sql adds active and updated_at. The migration runners wrap SQL in transactions and bound lock waits. They preserve IDs, tasks, assignments, and sequences.

IF NOT EXISTS avoids recreating existing objects; it does not validate arbitrary preexisting definitions. A legacy duplicate email can block the new unique index and roll back the migration. Resolving that data conflict is a separate deliberate decision, not an automatic merge or delete.

## Bootstrap and legacy activation
bootstrap-admin validates private inputs, hashes the password, locks users, and creates an Admin only when no active login-enabled Admin exists. It never silently overwrites an existing account. activate-legacy-user is a narrow tool for an existing ordinary account with no password; it is not a password-reset or role-escalation interface. Enabling a password and setting active are separate account properties.

## Timestamp and deletion behavior
created_at and updated_at use TIMESTAMP without time zone; mutation SQL explicitly refreshes updated_at. No automatic update trigger exists. The tasks FK uses ON DELETE SET NULL for external SQL deletion, while Admin API deletion rejects assigned users. Those two policies operate at different boundaries and should not be confused during maintenance.
''')

chapter('25. Validation, errors & security contracts','middleware; routes; password and frontend helpers')
md('''| Input or boundary | Source-level contract | Observable outcome |
| JSON body | application/json and object, not array | 415 unsupported type; 400 invalid body |
| Payload size | express.json limit 100kb | 413 before route mutation |
| User name | Nonblank trimmed string; up to 100 code points in shared validation | 400 on invalid input |
| Email | Basic non-whitespace address shape, length <=255, trim/lowercase | 400 malformed; 409 duplicate |
| Task title/description | Title 1-200 code points; description <=10000, explicit null rejected | 400 invalid; stored strings trimmed |
| Task assignee | Integer or null; positive, <=2147483647; existing account | 400 invalid/missing/inactive assignment |
| Profile fields | Exactly name and email | 400 rejects role, active, ID and password fields |
| User status patch | Only status key for regular User | 403 on extra fields or unowned target |
| Admin edit | Explicit name/email/role validation; password/hash/active rejected | Dedicated status action required |

## Errors are contracts, not debug output
fail throws an Error with publicStatus for intentional business-rule responses. The final handler respects that public status, maps uniqueness 23505 to 409, lock timeout 55P03 to 409, parser failures to 400, large entities to 413, and encoding errors to 415. Unexpected errors log method/path and a code, then return generic 500 JSON.

Request-verification rejection occurs before route access checks, so an unauthenticated malformed write without the required header may return 403 rather than 401. The authorization matrix assumes a correctly formed request that reaches the account/role check.

## What is and is not protected by each layer
React escaping prevents ordinary rendered strings from becoming HTML markup. Parameterized SQL prevents those values from becoming query syntax. Neither replaces field validation or authorization. Custom-header verification and cookie settings address cross-site writes under the documented origin setup; they do not prevent a legitimate authenticated caller from directly exercising the API, which is why ownership and role rules remain server-side.

Sessions and hashes are not returned in record JSON. A signed session cookie is intentionally returned through HTTP cookie handling. Test assertions therefore distinguish forbidden secret leakage in bodies/logs from the required authentication cookie.

Unknown-field handling is endpoint-specific: profile and User status requests reject extras; some other routes ignore them. Check the route before extending a payload.
''')

chapter('26. Test architecture & engineering workflow','backend/test; frontend/test; verify-stage5.cjs')
md('''## Backend automated tests
api.test.js exercises response contracts, field validation, IDs and failure mapping. auth.test.js exercises session lifecycle, roles, ownership, request verification and rate limits. management.test.js covers account/task management and safeguards. profile.test.js covers profile allowlists, password changes, revocation and the failed-final-login regression.

environment.test.js validates configuration, including the actual example-secret placeholder. startup.test.js uses a child process and an occupied port to test honest startup failure. database-outage.test.js points an isolated child process at a refused connection and checks safe health/login failures without stopping the real database.

Most route tests replace pool methods and use MemoryStore. Some fixtures use lower-cost bcrypt hashing for test speed; production hashPassword uses cost 12. SQL-string-aware mocks test route orchestration but cannot prove PostgreSQL parsing, real lock behavior, indexes, or durable session deletion. Those need the separate live checks.

## Frontend automated tests
api.test.js mocks fetch and verifies URL/method/header behavior, record validation, error mapping, legitimate 401 events, and canceled-body behavior. management.test.js checks Admin filters and sorting. personal.test.js checks workload ordering/summary, password validation, and success-only password-change events. These are service/helper tests, not mounted React interaction tests.

## Live verification workflow
verify-stage5.cjs is deliberately outside node --test. Against a running local backend, it reads the configured private bootstrap login, generates disposable credentials, creates temporary records, checks API outcomes and PostgreSQL state, compares original-row digests, and cleans up its records and sessions. The earlier 89 checked requests are recorded evidence, not an execution count created by reading the script.

Run it only in a coordinated local verification session without concurrent legitimate edits. An interruption may require inspection and cleanup of precisely its own records. The source listing is provided for study; this documentation run does not execute it.

## Rebuild from the archive
1. Extract the ZIP to a new directory; preserve its frontend/backend layout.
2. Install the project-compatible Node/PostgreSQL versions and use npm ci separately in each package. The original lockfiles are in the archive.
3. Create a new database only when needed. Copy the example environment file only when a private .env does not exist; replace placeholders privately.
4. For a fresh database run db:init. For an older Stage 4 database use the account then management migrations. Bootstrap the first Admin and run db:check.
5. Start Express and Vite in separate terminals, open 5173, and verify the complete browser/API/database flow.
6. Run package tests and the frontend build. Schedule live and browser checks separately with disposable records.

## Change-review workflow
Begin from a recorded source baseline and inspect Git status. Make a focused branch, implement the smallest coherent change, add a regression when correcting behavior, and run the relevant tests. Compare the API contract, schema compatibility, session behavior and UI states before committing. A passing unit test does not remove the need for persistence checks when SQL changes.

Use the full listings below to locate the exact implementation, rather than reconstructing modules from abbreviated snippets. Stage 6 remains outside this snapshot and requires its own infrastructure and operational verification.
''')

styles.add(ParagraphStyle(name='SourceTitle',fontName='Helvetica-Bold',fontSize=15,leading=19,spaceAfter=8,textColor=navy))
styles.add(ParagraphStyle(name='SourceTOC',fontName='Helvetica',fontSize=8,leading=11,leftIndent=12,spaceBefore=2,textColor=navy))
toc.levelStyles.append(styles['SourceTOC'])

class TechnicalDoc(Doc):
    def afterFlowable(self,f):
        super().afterFlowable(f)
        if isinstance(f,Paragraph) and f.style.name=='SourceTitle':
            key='source-'+hashlib.sha256(f.getPlainText().encode()).hexdigest()[:12]
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f.getPlainText(),key,1)
            self.notify('TOCEntry',(1,f.getPlainText(),self.page,key))

class CodeBlock(Flowable):
    def __init__(self,rows):
        Flowable.__init__(self); self.rows=rows; self.width=475; self.height=len(rows)*10.1+12
    def draw(self):
        c=self.canv; c.setFillColor(colors.HexColor('#F2F5F7')); c.rect(0,0,475,self.height,stroke=0,fill=1)
        c.setStrokeColor(colors.HexColor('#D8E2E8')); c.line(34,0,34,self.height)
        for i,(num,line) in enumerate(self.rows):
            y=self.height-13-i*10.1; c.setFont('CodeMono',7.7)
            c.setFillColor(colors.HexColor('#627D8C')); c.drawRightString(29,y,str(num))
            c.setFillColor(navy); c.drawString(41,y,line)

def display_line(s):
    # Escape non-BMP characters for portable printed listings; archive bytes stay exact.
    return ''.join(ch if ord(ch)<0x10000 else '\\U'+format(ord(ch),'08x') for ch in s).expandtabs(4)

chapter('27. Complete source-code appendix','all listings are from commit 8dea970')
md(f'''There are {len(codepaths)} numbered listings. Each file starts with its path, source size and content fingerprint. The PDF contents and bookmarks link to individual files. Code is selectable text, not a screenshot. Numbered lines correspond to the original source; continuation rows have a dot instead of a new line number.

Copying line-numbered PDF text is convenient for reading but may add line numbers or visual wraps. For execution, use the companion ZIP or the embedded ZIP attachment, which preserves all original bytes and includes lockfiles and source documentation.

The technical chapters describe the application as implemented. The listings are not an idealized rewrite: existing comments, tests, validation choices and limitations remain visible. Source references use repository-relative paths to describe locations inside the extracted archive.
''')
groups=[('Backend configuration and server',lambda p:p=='backend/server.js' or p.startswith('backend/config/')),
('Backend middleware and routes',lambda p:p.startswith(('backend/middleware/','backend/routes/'))),
('Database and maintenance scripts',lambda p:p.startswith(('backend/database/','backend/scripts/'))),
('Frontend application and views',lambda p:p.startswith('frontend/src/') and not p.startswith('frontend/src/services/')),
('Frontend services',lambda p:p.startswith('frontend/src/services/')),
('Automated tests',lambda p:'/test/' in p),
('Package and environment setup',lambda p:True)]
remaining=set(codepaths); inventory=[]
for group,predicate in groups:
    selected=sorted(p for p in remaining if predicate(p))
    if not selected: continue
    for path in selected:
        remaining.remove(path)
        raw=snapshot[path]; source=raw.decode('utf-8-sig'); lines=source.splitlines()
        digest=hashlib.sha256(raw).hexdigest()
        rows=[]
        for n,line in enumerate(lines,1):
            s=display_line(line)
            # 90 columns at 7.7pt Consolas fit inside the 434pt text area.
            chunks=[s[i:i+90] for i in range(0,len(s),90)] or ['']
            rows.extend([(n if j==0 else '.',chunk) for j,chunk in enumerate(chunks)])
        import math
        chunk_size=math.ceil(len(rows)/max(1,math.ceil(len(rows)/59))) or 1
        chunks=[rows[i:i+chunk_size] for i in range(0,len(rows),chunk_size)] or [[]]
        for i,chunk in enumerate(chunks):
            story.append(PageBreak())
            if i==0:
                story.append(para(path,'SourceTitle'))
                story.append(para(f'{group} | {len(lines)} source lines | {len(raw):,} bytes','SmallDoc'))
                story.append(para('SHA-256: '+digest,'SmallDoc'))
            else:
                story.append(para(path+' (continued)','Sub'))
                story.append(para(f'8dea970 | Listing segment {i+1} of {len(chunks)}','SmallDoc'))
            story.append(CodeBlock(chunk))
        inventory.append({'path':path,'lines':len(lines),'sha256':digest,'segments':len(chunks)})

doc=TechnicalDoc(str(PDF),pagesize=A4,rightMargin=60,leftMargin=60,topMargin=64,bottomMargin=55,title='My Web App V2 - Technical Manual and Source Code - Stages 1-5',author='Project Documentation',subject='Full source snapshot, architecture, workflows, SQL, authentication and testing')
doc.addPageTemplates(PageTemplate(id='main',frames=[Frame(60,55,475,A4[1]-119,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=page))
doc.multiBuild(story)
from pypdf import PdfWriter
reader=PdfReader(PDF); writer=PdfWriter(); writer.clone_document_from_reader(reader)
writer.add_attachment(ZIP.name,ZIP.read_bytes())
with PDF.open('wb') as f: writer.write(f)
reader=PdfReader(PDF)
texts=[p.extract_text() or '' for p in reader.pages]
assert len(reader.attachments)==1
assert len(reader.attachments[ZIP.name][0])==ZIP.stat().st_size
for p in codepaths:
    assert any(p in t for t in texts),p
(ROOT/'tmp/pdfs/technical-inventory.json').write_text(json.dumps({'pages':len(texts),'printed_files':len(codepaths),'archive_files':len(snapshot),'source_lines':sum(f['lines'] for f in inventory),'files':inventory},indent=2))
(ROOT/'tmp/pdfs/technical-extracted.txt').write_text('\n\n'.join(texts),encoding='utf-8')
print(json.dumps({'pdf':str(PDF),'pages':len(texts),'printed_files':len(codepaths),'source_lines':sum(f['lines'] for f in inventory),'archive_files':len(snapshot),'zip':str(ZIP)}))
