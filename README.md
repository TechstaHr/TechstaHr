# TechStarHR

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


### Sample screenshot upload from the frontend
```
// Example frontend function
async function uploadScreenshotToServer(screenshotFile, taskId) {
  try {
    // Step 1: Get the signature from the backend
    const signatureResponse = await fetch('/screenshot/${taskId}/generate-upload-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${your_auth_token}` },
      body: JSON.stringify({ taskId }),
    });
    const { uploadSignature } = await signatureResponse.json();
	const { timestamp, signature, folder, apiKey } = uploadSignature;

    // Step 2: Prepare form data for Cloudinary
    const formData = new FormData();
    formData.append('file', screenshotFile); // The actual file object, not base64!
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);

    // Step 3: Upload DIRECTLY to Cloudinary
    const cloudinaryCloudName = 'Techstahr'; // Replace with Techstahr cloud name
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
    
    const cloudinaryResponse = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });
    const uploadResult = await cloudinaryResponse.json();

    if (!uploadResult.secure_url) {
      throw new Error('Upload to Cloudinary failed.');
    }

    // Step 4: Notify backend that the upload is complete
    await fetch('/screenshot/${taskId}/notify-upload-completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${your_auth_token}` },
      body: JSON.stringify({
        taskId: taskId,
        imageUrl: uploadResult.secure_url,
      }),
    });
    
    console.log('Screenshot successfully uploaded and saved!');

  } catch (error) {
    console.error('Screenshot upload process failed:', error);
  }
}
```
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
