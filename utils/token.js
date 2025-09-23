const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRATION;

const generateAccessToken = (user, expiresIn = JWT_EXPIRES_IN) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
            team: user.team
        },
        JWT_SECRET,
        { expiresIn }
    );
};

module.exports = { generateAccessToken };
