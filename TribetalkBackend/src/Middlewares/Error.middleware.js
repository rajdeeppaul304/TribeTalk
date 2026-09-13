export const errorHandler = (err, _req, res, _next) => {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = statusCode >= 500 ? "Internal server error" : err.message;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    statusCode,
    data: null,
    message,
    success: false,
    errors: err.errors || [],
  });
};
