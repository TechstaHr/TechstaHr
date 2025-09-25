# TechStarHQ

TechStarHQ is an HR management system designed to simplify employee tracking and payroll management.  
This repository contains my implementation of the three assigned features.  

 Assigned Tasks

1. Timesheet
- Clock-in and clock-out functionality.  
- Track employee working hours.  
- Generate reports of attendance and time logs.  

 2. Screenshot
- Capture employee screenshots at intervals(when team members clock in, clock out).  
- Store screenshots for attendance verification.  
- Integrate with timesheet records for monitoring.  

 3. Payroll
- Automate salary calculation based on timesheet data.  
- Handle overtime, deductions, and bonuses.  
- Generate payslips and payroll reports.  

API Endpoints (Timesheet & Screenshots)

- POST `/api/v1/time/clock-in` : `{ projectId }` — create a TimeEntry (requires auth).
- POST `/api/v1/time/clock-out` : `{ entryId? }` — close the active TimeEntry or specified entry.
- GET `/api/v1/time/active` : returns current open TimeEntry for the user.
- POST `/api/v1/time/attach-screenshots` : `{ entryId, screenshots: [url,...] }` — attach screenshots to a TimeEntry.
- POST `/api/v1/time/submit` : `{ entryId }` — submit timesheet for approval (owner only, must be clocked out).
- POST `/api/v1/time/approve` : `{ entryId }` — admin approves a timesheet.
- GET `/api/v1/time/my` : list user's timesheets.
- GET `/api/v1/time/all` : admin-only list of all timesheets.
- PUT `/api/v1/screenshot/:taskId/screenshot-settings` : enable/disable screenshots for a task.
- GET `/api/v1/screenshot/:taskId/screenshots` : get task screenshot history (task owner/admin).
- GET `/api/v1/screenshot/timesheet/:entryId/screenshots` : get screenshots attached to a timesheet (owner/admin).
