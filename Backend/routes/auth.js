// ./routes/auth.js

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Unauthorized - Please log in' });
    }
    if (req.session.user.role === 'admin') {
      return next();
    }
    const userPermissions = req.session.user.permissions || [];
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
    }
    return next();
  };
};

const checkAdmin = (req, res, next) => {
  if (!req.session.user) {
    console.warn('[AUTH.JS] Admin Check Failed: No user in session for path:', req.path);
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
  if (req.session.user.role !== 'admin') {
    console.warn(`[AUTH.JS] Admin Check Failed: User ${req.session.user.username} (role: ${req.session.user.role}) is not an admin for path: ${req.path}`);
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  return next();
};

const checkAdminOrStaff = (req, res, next) => {
  if (!req.session.user) {
    console.warn('[AUTH.JS] Admin/Staff Check Failed: No user in session for path:', req.path);
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
  if (req.session.user.role === 'admin' || req.session.user.role === 'staff') {
    return next();
  }
  console.warn(`[AUTH.JS] Admin/Staff Check Failed: User ${req.session.user.username} (role: ${req.session.user.role}) is not admin/staff for path: ${req.path}`);
  return res.status(403).json({ message: 'Forbidden: Admin or Staff access required' });
};

const authenticateUser = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) {
    return next();
  } else {
    console.warn('[AUTH.JS] User not authenticated for path:', req.path);
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
};

const authRouter = (pool) => {
  const router = require('express').Router();

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      const result = await pool.query(
        'SELECT id, username, password, role FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const isPasswordValid = password === user.password; // Removed bcrypt.compare

      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      console.log(`[AUTH.JS] User ${user.username} logged in successfully`);
      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (err) {
      console.error('[AUTH.JS] Login error:', err.stack);
      if (err.code === 'ECONNRESET' || err.code === 'connection terminated unexpectedly') {
        return res.status(503).json({ message: 'Database connection error. Please try again.', error: 'Connection terminated unexpectedly' });
      }
      return res.status(500).json({ message: 'Server error during login', error: err.message });
    }
  });

  router.get('/logout', (req, res) => {
    const username = req.session?.user?.username || 'Unknown';
    req.session.destroy((err) => {
      if (err) {
        console.error('[AUTH.JS] Logout error for user:', username, err.stack);
        return res.status(500).json({ message: 'Could not log out, please try again.' });
      }
      res.clearCookie('connect.sid');
      console.log(`[AUTH.JS] User ${username} logged out successfully.`);
      return res.json({ message: 'Logout successful' });
    });
  });

  router.get('/status', (req, res) => {
    try {
      if (req.session && req.session.user) {
        return res.json({
          isAuthenticated: true,
          user: {
            id: req.session.user.id,
            username: req.session.user.username,
            role: req.session.user.role
          }
        });
      }
      return res.json({ isAuthenticated: false, user: null });
    } catch (error) {
      console.error('[AUTH.JS] Error in /api/auth/status:', error);
      if (error.code === 'ECONNRESET' || error.code === 'connection terminated unexpectedly') {
        return res.status(503).json({ message: 'Database connection error. Please try again.', error: 'Connection terminated unexpectedly' });
      }
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  return router;
};

module.exports = {
  checkPermission,
  checkAdmin,
  checkAdminOrStaff,
  authenticateUser,
  authRouter
};