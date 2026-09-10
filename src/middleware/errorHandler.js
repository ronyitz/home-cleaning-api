function errorHandler(err, req, res, next) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ message: `duplicated, already exists` });
  }
  res.status(err.status || 500).json({ message: 'שגיאה בשרת' });
}

module.exports = errorHandler;
