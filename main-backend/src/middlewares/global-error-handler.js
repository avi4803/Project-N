const { StatusCodes } = require('http-status-codes');
const { ErrorResponse } = require('../utils');

/**
 * Global Error Handling Middleware
 * Captures all errors forwarded by next(err) and sends a consistent JSON response.
 */
const globalErrorHandler = (err, req, res, next) => {
    // Log the error for debugging
    console.error('❌ Global Error Handler:', err);

    // Use the existing ErrorResponse structure pattern
    ErrorResponse.message = err.message || 'Something went wrong';
    ErrorResponse.error = err; // Include stack/details if needed, or sanitise for prod

    const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

    return res.status(statusCode).json(ErrorResponse);
};

module.exports = globalErrorHandler;
