PR: Timesheet & Screenshot Integration Summary

This PR contains the initial implementation and fixes for the Timesheet and Screenshot integration features.

Files changed (high level):

- controllers/timesheetController.js
  - Added robust clock-in/clock-out flows (prevents multiple open entries).
  - Rounds total hours and computes regular/overtime hours.
  - Added submit/approve endpoints and `getActiveEntry`.
  - Normalized token payload handling (`req.user._id || req.user.id`).
  - `attachScreenshots` endpoint to associate screenshot URLs with a TimeEntry.

- controllers/screenshotController.js
  - Endpoints to enable/disable screenshot capture at task level, and fetch task- or timesheet-attached screenshots.
  - `getEntryScreenshots` allows owners or admins to fetch screenshots attached to a TimeEntry.

- models/TimeEntry.js
  - Normalized `day` field and unique index for `{ user, project, day }` to avoid duplicate entries per day.
  - `screenshots` stores objects { url, takenAt }.

- routes/timeRoutes.js and routes/screenshotRoutes.js
  - Expose timesheet and screenshot routes with authentication and admin checks.

- utils/take-screenshot-and-upload.js
  - After uploading to Cloudinary, appends screenshot URL to the related `MyTask` and the open `TimeEntry` if it exists.

What's included:
- Clock-in / Clock-out / Submit / Approve flows for timesheets.
- Worker integration for periodic screenshots that attach to timesheet entries.
- API endpoints for fetching screenshot history per task and per timesheet entry.

Notes / Next steps:
- The repo originally contained large Chrome binaries; this PR excludes those binaries and includes only the code changes.
- Recommend adding the Chrome binaries to `.gitignore` and using git-lfs for any required large artifacts.
- Add tests and an admin Activity endpoint to surface screenshots in the UI.

If you want, I can also:
- Draft the PR description in GitHub and add the checklist/labels/assignees.
- Remove the large binaries from the original branch using `git filter-repo` / `git lfs migrate` (I can outline the safe steps).

---
Created automatically for the PR on branch `timesheet-pr-clean`.
