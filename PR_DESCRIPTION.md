PR Title example
type(scope): short description
e.g. feat(projects): populate teamMembers.user on project endpoints

Summary
- Brief one-line summary of the change.
- Why this change was made (bugfix / feature / refactor).

Branch naming examples
- feat/short-description
- fix/short-description
- chore/docs-update

Commit message examples
- feat(projects): populate teamMembers.user for getProjectById
- fix(projects): avoid early response inside loop when notifying members

Testing steps
1. Checkout branch: git checkout -b feat/your-change
2. Install dependencies: npm ci
3. Run server: npm start
4. Execute requests:
   - POST /api/v1/projects with payload to create a project and verify teamMembers.user is populated
   - Assign members: POST /api/v1/project/:projectId/assign and verify notifications

Quick reviewer checklist
- [ ] Code is clear and small focused changes
- [ ] No sensitive data or credentials
- [ ] Error handling present for all new code paths
- [ ] Tests (unit/integration) added where appropriate

Notes
- Keep sendEmail() commented while SMTP creds are not configured (ETIMEDOUT 587).
- If tests will trigger email logic, mock sendEmail or set env to disable it.
