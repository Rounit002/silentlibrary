# Codebase audit report

**Date:** 12 October 2026  
**Scope:** Static review of the frontend, Express routes, database query flows, authentication/session setup, scheduled jobs, and destructive operations. No database or live deployment was accessed. No application code was changed for this audit.

## Summary

The codebase has multiple material risks for data consistency and account security. The most urgent are plaintext passwords with a predictable default admin credential, transaction blocks implemented through `pool.query()` (which does not pin statements to one database connection), and deletion/update logic that identifies linked staff expenses by matching mutable field values instead of a stable foreign key. Hostel seat state also has paths that can leave `room_id` and `room_number` disagreeing.

## Findings

### Critical — Passwords are stored and compared as plaintext; default credentials are predictable

`Backend/routes/auth.js:72` compares the submitted password directly to the database value. `Backend/server.js:364-367` inserts the default admin with password `admin` whenever no admin exists and `DEFAULT_ADMIN_PASSWORD` is unset. A database leak exposes every password, and a deployment missing the environment variable can create a known administrator login. The session secret also falls back to a literal value at `Backend/server.js:101`.

**Impact:** Account takeover, including administrator access, if defaults are active or user-table data is exposed.  
**Priority:** Critical.

### High — Multi-statement hostel transactions are not pinned to one PostgreSQL connection

Several flows issue `BEGIN`, writes, and `COMMIT`/`ROLLBACK` using `pool.query()` instead of a checked-out `client`. Examples include creating/updating/renewing/deleting hostel students (`Backend/routes/hostelStudents.js:230-275`, `335-550`, `578-621`, `660-675`), hostel seat deletion (`Backend/routes/hostelSeats.js:108-119`), and hostel collection payment updates (`Backend/routes/hostelCollections.js:196-305`). A pool may run each call on a different connection, so these statements are not guaranteed to share one transaction. Partial writes can persist after an error, or the `COMMIT`/`ROLLBACK` may apply to a different connection.

**Impact:** Orphaned history rows, partial student edits, incorrect payments, or room assignment changes surviving failed operations.  
**Priority:** High.

### High — Staff payment CRUD can update/delete unrelated expenses

Creating a staff payment also creates an expense. Later, update and delete locate that expense by comparing title, date, cash, online, amount, and branch rather than storing the expense ID (`Backend/routes/staffPayments.js:443-454`, `503-505`; same pattern in `Backend/routes/hostelStaffPayments.js:427-452`, `503-505`). If two payments or manually entered expenses have the same values, one update can update multiple rows and one delete can delete multiple rows. If a staff member is renamed, matching against the current name can fail to find the expense created under the old name, leaving an orphaned expense. The update queries also do not constrain `remark` or an origin marker.

**Impact:** Expense records can be silently overwritten or deleted, or become detached from their payment.  
**Priority:** High.

### High — Hostel collections can leave negative dues and erase the original due allocation

`Backend/routes/hostelCollections.js:226-299` totals outstanding dues across history rows, then applies a collected payment to a current-month history row. If no row exists, it creates one with `total_fee = 0` and `due_amount = 0`; applying a payment makes that row’s due negative. It then sets every previously outstanding history row’s due to zero. This does not allocate payment amounts against the actual older dues, and it makes the history’s due figures inconsistent with the original stay records.

**Impact:** Due reports can show negative balances or lose which stay/month the payment settled.  
**Priority:** High.

### High — Hostel seat vacancy can leave stale or duplicate occupancy state

Hostel occupancy is determined from `hostel_students.room_id` (`Backend/routes/hostelSeats.js:17`). Deleting the final hostel history row clears `room_number` but leaves `room_id` set (`Backend/routes/hostelCollections.js:354-363`), so the seat can still appear occupied. Deleting a seat clears `room_id` but leaves `room_number` stale (`Backend/routes/hostelSeats.js:108-110`). Student creation and renewal require a room ID but do not check that it belongs to the selected branch or is not already occupied (`Backend/routes/hostelStudents.js:189-271`, `557-617`). No occupancy uniqueness constraint/schema was available in the reviewed source to establish whether the database prevents duplicate assignment.

**Impact:** A room can look vacant in one view and occupied in another, be assigned twice, or retain a misleading room number after vacancy.  
**Priority:** High.

### High — Student status is calculated differently on writes and reads

Create and update set `status` using `new Date(membership_end) < new Date()` (`Backend/routes/students.js:506`, `643`). A date-only membership end is parsed at midnight, so a membership ending today can be written as `expired` during that day. Read endpoints calculate status with `membership_end < CURRENT_DATE` (`Backend/routes/students.js:14-23`, `51-54`), which treats today as active. This makes API responses and stored data disagree. In addition, inactive students are tracked separately with `is_active`, but the reminder job filters only `status = 'active'` (`Backend/utils/cronJobs.js:39`), so manually deactivated students may still receive reminders.

**Impact:** Different pages/jobs can classify the same student differently; inactive students can receive unwanted reminders.  
**Priority:** High.

### Medium — Student payment totals are not validated against their payment split or fee

Student create accepts `amount_paid` separately from `cash + online` and computes due from `amount_paid` (`Backend/routes/students.js:460-474`). The history stores all three values. Update also accepts all three without validating the relationship (`Backend/routes/students.js:609-661`). A malformed or stale client payload can make displayed total paid disagree with the sum of payment methods. Paid amounts greater than fee are accepted, producing negative due. Hostel student create/renew has the same overpayment behavior (`Backend/routes/hostelStudents.js:217-266`, `574-611`).

**Impact:** Collections, payment-method totals, and due totals can disagree if clients send inconsistent values; overpayments appear as negative dues.  
**Priority:** Medium.

### Medium — The unauthenticated email test endpoint can trigger outbound mail

`Backend/server.js:251-275` exposes `/api/test-email` without authentication or rate limiting. It reads the configured template and initiates an external email to a hardcoded test address. It does not expose the settings value directly, but anyone who can reach the endpoint can repeatedly trigger the action.

**Impact:** Unwanted outbound requests and service abuse.  
**Priority:** Medium.

### Medium — Logs contain personal data and request payloads

Hostel student create/update log full request bodies (`Backend/routes/hostelStudents.js:192`, `288`), which can include phone and Aadhaar information. Student create logs request contents (`Backend/routes/students.js:430`). The logger writes to `Backend/combined.log` and `Backend/error.log` (`Backend/server.js:17-19`). Logs may therefore retain sensitive personal data beyond the intended database lifecycle.

**Impact:** Unnecessary exposure and retention of personal identifiers in log files.  
**Priority:** Medium.

### Medium — Deleting collection records removes membership/payment history

The collection delete routes delete rows from the membership-history tables (`Backend/routes/collections.js:409-432`, `Backend/routes/hostelCollections.js:312-342`). Those rows contain membership snapshots and payment totals, not just a separate payment event. The code then recalculates only selected current fields. This is a hard deletion of financial history; for hostel records, deleting the last row also interacts with the stale `room_id` issue above.

**Impact:** Historical payment and membership evidence can be permanently removed through an ordinary delete action.  
**Priority:** Medium; confirm this is intended business behavior.

## Additional observations

- Staff users have broad create/update/delete access across most operational and financial routes because those routes use `checkAdminOrStaff`. If staff should have read-only or narrower capabilities, route-level authorization is currently too broad.
- `checkPermission` exists in `Backend/routes/auth.js`, but login stores no permissions in the session and the middleware is not applied in the reviewed route setup. It should not be assumed to provide granular authorization.
- Date handling mixes JavaScript local dates, UTC `toISOString()`, and PostgreSQL `CURRENT_DATE`. Cron dates are built with UTC conversion while the schedule uses `Asia/Kolkata` (`Backend/utils/cronJobs.js:12, 33-42`), creating edge cases around midnight.
- The repository does not include a canonical schema snapshot for all tables/constraints, so this review could not confirm database-level foreign keys, uniqueness rules, numeric checks, or cascade behavior. Findings about absent application-level checks should be checked against the deployed schema before remediation.

## Audit limits

This was a static review of repository code. I did not connect to the production database, inspect live environment variables, execute destructive flows, or confirm whether the deployed database has additional constraints. Dependency advisory scanning did not return usable output in this environment, so dependency vulnerabilities are not assessed here.
