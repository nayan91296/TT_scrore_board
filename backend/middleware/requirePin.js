const requirePin = (req, res, next) => {
  const configuredPin = process.env.ADMIN_PIN || process.env.PIN_CODE;

  if (!configuredPin) {
    return res.status(500).json({ error: 'Admin PIN is not configured on the server' });
  }

  const headerPin = req.headers['x-admin-pin'] || req.headers['x-admin-pin'.toLowerCase()];
  const bodyPin = req.body && req.body.pin;
  const providedPin = headerPin || bodyPin;

  if (!providedPin) {
    return res.status(401).json({ error: 'Admin PIN is required' });
  }

  if (providedPin !== configuredPin) {
    return res.status(401).json({ error: 'Invalid admin PIN' });
  }

  return next();
};

module.exports = requirePin;


