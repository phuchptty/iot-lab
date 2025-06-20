const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'iot_auth.db');

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database schema
const initializeDatabase = () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createUsersTable, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('✅ Users table ready');
      // Create default admin user if not exists
      createDefaultUsers();
    }
  });
};

// Create default users
const createDefaultUsers = () => {
  const defaultUsers = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'user', password: 'user123', role: 'user' }
  ];

  defaultUsers.forEach(userData => {
    getUserByUsername(userData.username, (err, user) => {
      if (err) {
        console.error('Error checking user:', err);
        return;
      }
      
      if (!user) {
        createUser(userData.username, userData.password, userData.role, (err, result) => {
          if (err) {
            console.error(`Error creating default user ${userData.username}:`, err);
          } else {
            console.log(`✅ Default user '${userData.username}' created`);
          }
        });
      }
    });
  });
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Create new user
const createUser = (username, password, role = 'user', callback) => {
  hashPassword(password)
    .then(hashedPassword => {
      const sql = `
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, ?)
      `;
      
      db.run(sql, [username, hashedPassword, role], function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, {
            id: this.lastID,
            username,
            role
          });
        }
      });
    })
    .catch(err => {
      callback(err, null);
    });
};

// Get user by username
const getUserByUsername = (username, callback) => {
  const sql = `SELECT * FROM users WHERE username = ?`;
  
  db.get(sql, [username], (err, row) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, row);
    }
  });
};

// Authenticate user
const authenticateUser = (username, password, callback) => {
  getUserByUsername(username, (err, user) => {
    if (err) {
      callback(err, null);
      return;
    }
    
    if (!user) {
      callback(null, false); // User not found
      return;
    }
    
    verifyPassword(password, user.password_hash)
      .then(isValid => {
        if (isValid) {
          callback(null, {
            id: user.id,
            username: user.username,
            role: user.role
          });
        } else {
          callback(null, false); // Invalid password
        }
      })
      .catch(err => {
        callback(err, null);
      });
  });
};

// Get all users (for admin purposes)
const getAllUsers = (callback) => {
  const sql = `SELECT id, username, role, created_at, updated_at FROM users`;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
};

// Update user password
const updateUserPassword = (username, newPassword, callback) => {
  hashPassword(newPassword)
    .then(hashedPassword => {
      const sql = `
        UPDATE users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE username = ?
      `;
      
      db.run(sql, [hashedPassword, username], function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { changes: this.changes });
        }
      });
    })
    .catch(err => {
      callback(err, null);
    });
};

// Delete user
const deleteUser = (username, callback) => {
  const sql = `DELETE FROM users WHERE username = ?`;
  
  db.run(sql, [username], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, { changes: this.changes });
    }
  });
};

// Close database connection
const closeDatabase = () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
  });
};

module.exports = {
  createUser,
  getUserByUsername,
  authenticateUser,
  getAllUsers,
  updateUserPassword,
  deleteUser,
  hashPassword,
  verifyPassword,
  closeDatabase
};