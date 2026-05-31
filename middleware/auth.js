function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    res.redirect('/login');
  }
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { requireAuth, redirectIfAuth };
