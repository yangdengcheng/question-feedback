function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message || err);

  if (err.name === "SequelizeValidationError") {
    const messages = err.errors.map((e) => e.message);
    return res.status(400).json({ message: messages.join("; ") });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    const messages = err.errors.map((e) => e.message);
    return res.status(409).json({ message: messages.join("; ") });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "服务器内部错误",
  });
}

module.exports = errorHandler;
