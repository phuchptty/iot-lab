const jwt = require('jsonwebtoken');
const database = require('./database');

// Simple JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET;

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }

  req.user = decoded;
  next();
};

// Login function
const login = (username, password, callback) => {
  database.authenticateUser(username, password, (err, user) => {
    if (err) {
      return callback({ success: false, message: 'Database error occurred' });
    }
    
    if (!user) {
      return callback({ success: false, message: 'Invalid username or password' });
    }
    
    const token = generateToken(user);
    callback({ 
      success: true, 
      token, 
      user: { 
        username: user.username, 
        role: user.role 
      } 
    });
  });
};

// Socket authentication middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;

  console.log('Socket authentication token:', token);
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Authentication error: Invalid token'));
  }
  
  socket.user = decoded;
  next();
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  login,
  generateToken,
  verifyToken,
  database
};
