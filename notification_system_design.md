# Notification System Design - Campus Placement Platform

## Stage 1: REST API Design

Main endpoints I'd design:
- GET /notifications - get list, can paginate & filter by type
- PUT /notifications/{id}/read - mark it read
- DELETE /notifications/{id} - remove one
- GET /notifications/{id} - get details
- POST /notifications/bulk - send to many students (admin only)

Pretty standard REST stuff. Auth via Bearer token. Return JSON with success flag, data, pagination. Responses on different status codes - 200 for success, 202 for bulk (async job), 401 for auth fail, 404 for not found etc.

---

## Stage 2: Database Design

Going with PostgreSQL. Reasons:
- ACID transactions - super important for notifications
- Can partition by date when it gets huge
- JSONB for storing flexible stuff
- Good replication support

Need these tables:
- students: id, studentId, email
- notifications: id, studentId, type, message, isRead, createdAt, deletedAt, metadata
- notification_delivery: track if email/sms/push worked or failed
- notification_jobs: track bulk job status

Indexes: definitely on (studentId, isRead), (studentId, createdAt DESC), (type, createdAt DESC)

Scalability stuff:
- At 5M rows, queries get slow = partition tables by month
- 50k students checking notifications constantly = need Redis cache, like 5 min TTL
- OFFSET pagination is trash when you have millions = switch to cursor-based

---

## Stage 3: Query Performance Analysis

Original query is kinda broken:

SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt DESC;

Problems:
- No index, so full scan of all 5M rows (takes 2-5 sec)
- Fetching ALL columns including JSON metadata = wasting memory
- No LIMIT = could return 50k+ rows
- Column name typo probably (studentID vs studentId)

Why it's slow = literally scanning every row.

Fix it:
- Add index on (studentId, isRead, createdAt DESC)
- Only select needed columns
- Add LIMIT 20 OFFSET 0
- Now ~5ms instead of 2-5 sec (500x faster!)
- Goes from O(n) to O(log n + k)

About adding indexes on every column - NO that's dumb:
- Every INSERT/UPDATE has to update ALL those indexes
- Storage multiplies (takes N × table size)
- Query planner gets confused
- Just a maintenance nightmare

Smart approach: composite indexes for queries you actually run, partial indexes for active stuff only. That's it.

Placement notifications last 7 days = join with students table, filter where type='Placement' AND createdAt >= NOW - 7 days. Easy.

---

## Stage 4: Caching Strategy

Problem: 50k students × multiple page loads per day = DB gets hammered

Solution 1 - Redis Cache:
- Check Redis first (1ms) before DB (50ms)
- Miss? Query DB, store in Redis with 5 min timeout
- ~60-70% hit rate = huge DB load drop
- Tradeoff: data might be 5 mins old (acceptable)

Solution 2 - Cursor Pagination:
- Instead of OFFSET, use timestamp as cursor
- Like "give me 20 notifications after 2026-04-22T15:00:00"
- No skipping rows = O(1) vs O(n)
- Can't jump to page 50 directly tho

Solution 3 - Read Replicas:
- Master takes writes, 3 replicas take reads
- Spread load across replicas
- Tradeoff: costs 3x infrastructure, replication lag 2-5 sec

I'd layer them:
1. Redis (5 min cache)
2. Cursor pagination
3. Read replicas
4. Archive old notifications (>3 months)

Should cut DB load 90%, keep response <100ms.

---

## Stage 5: Bulk Notification Reliability

Current approach is terrible:

for each of 50k students:
  send_email (1-5 sec per student!)
  save to db (10ms)
  push in-app (500ms)

Math: 50k × 2 sec = 28+ HOURS. Ridiculous.

Problems:
- Sequential = slow af
- One failure = stops entire thing
- No consistency = DB might have record but no email, or email sent but DB failed
- No retry
- No tracking

If email fails for 200 students midway? Complete disaster:
- 24,800 have DB records but no emails
- 200 got emails but no DB records
- 25k+ never got anything
- Can't restart, would duplicate

Better way - Message Queue:
- Admin clicks "send" → create job in DB → enqueue to queue (RabbitMQ/SQS)
- Workers pick up batches (500 at a time) in parallel
- Each worker: atomic DB save → enqueue delivery tasks
- Delivery workers handle email/SMS/push separately in parallel
- If something fails, retry with backoff (1s, 2s, 4s, 8s)

Way better:
- 28+ hours → 5-10 min (parallelized)
- Keeps going even if some fail
- Each student saved atomically
- Can track by jobId
- Won't duplicate

DB save & email together? NO way.
- Different failure modes
- Different speeds
- Each needs own retry logic
- Save DB first (atomic), then queue async delivery. Separates concerns.

---

## Stage 6: Priority Inbox

Goal: show top 10 important notifications (by importance + how recent)

Weight: Placement=3, Result=2, Event=1 (higher = more important)

How to do it:
- Score = (weight × 1,000,000) + timestamp
- Use min-heap size 10
- New notification comes in: if score > heap's worst item, swap it in, re-organize heap
- Each operation: O(log 10) = super fast

Why min-heap works:
- keeps constant memory (only 10 items)
- heap's root = lowest priority of top 10
- new arrival: compare with root, replace if better
- add 50k notifications = 50k × log10 = 165k ops = instant

Implementation: priority_notifications.js fetches from the API, applies weights, shows top 10 sorted

Output: Placements first (newest first), then Results, then Events
--- TOP 10 PRIORITY NOTIFICATIONS ---
1. [Placement] CSX Corporation hiring (2026-04-22 17:51:18)
2. [Placement] AMD Hiring for Interns (2026-04-22 17:49:42)
3. [Result] mid-sem results out (2026-04-22 17:51:30)
4. [Result] mid-sem results out (2026-04-22 17:50:54)
5. [Result] Project review feedback (2026-04-22 17:50:42)
6. [Result] external results (2026-04-22 17:50:30)
7. [Result] project-review (2026-04-22 17:50:18)
8. [Result] project-review (2026-04-22 17:49:54)
9. [Event] farewell ceremony (2026-04-22 17:51:06)
10. [Event] Tech-fest registrations (2026-04-22 17:50:06)
