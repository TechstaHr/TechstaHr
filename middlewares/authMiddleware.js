const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    next();
};

const authorizeAgent = (req, res, next) => {
    if (req.user.role !== 'agent') {
        return res.status(403).json({ error: 'Access denied. Agents only.' });
    }
    next();
};

module.exports = {
    authenticateToken,
    authorizeAdmin,
    authorizeAgent
};
