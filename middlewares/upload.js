const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'Techstahr',
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'webm'],
    resource_type: 'auto',
  },
});

const upload = multer({ storage });

module.exports = upload;
