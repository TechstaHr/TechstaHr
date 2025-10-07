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

## Dev setup locally
- create account on [cloudinary.com](https://cloudinary.com) to get the api key and secrets
- create account on [https://cloud.mongodb.com](https://cloud.mongodb.com) to get database connection url
- Create a .env file, copy the one in .env.example. Replace the value.
- Run it `npm start`. It's avaibale at: `http://0.0.0.0:3001/api/v1/`
- create an account `http://0.0.0.0:3001/api/v1/signup`.
Sample payload:
```
{
	"email": "me@gmail.com",
	"password": "hshs123",
	"full_name": "John Doe ",
	"team_name": "My Team"
}
```


### Same screenshot upload from the frontend
```
// Example frontend function
async function uploadScreenshotToServer(screenshotFile, taskId) {
  try {
    // Step 1: Get the signature from your backend
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
    const cloudinaryCloudName = 'your-cloud-name'; // Replace with your Cloudinary cloud name
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
