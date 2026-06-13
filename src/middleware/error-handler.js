const { ZodError } = require("zod");

function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      message: "Validasi data gagal.",
      errors: error.flatten()
    });
  }

  const status = error.status || 500;
  const message = status === 500 ? "Terjadi kesalahan pada server." : error.message;

  if (status === 500) {
    console.error(error);
  }

  return res.status(status).json({
    message,
    details: error.details
  });
}

module.exports = errorHandler;
