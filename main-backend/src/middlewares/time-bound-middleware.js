const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');

/**
 * Middleware to enforce date limits on request bodies.
 * Prevents scheduling too far into the future.
 * 
 * @param {string} dateField - The field name in req.body containing the date (e.g., 'date', 'newDate')
 * @param {number} daysLimit - Maximum days allowed in the future (default: 7)
 */
const validateFutureDateLimit = (dateField, daysLimit = 7) => {
    return (req, res, next) => {
        try {
            const dateValue = req.body[dateField];

            if (!dateValue) {
                // If the field is optional and missing, we might skip validation or fail.
                // Assuming required for operations that use this middleware.
                // If it's truly optional, we can check logic. But for reschedule/extra class it's required.
                return next(); 
            }

            const targetDate = new Date(dateValue);
            
            // Check if valid date
            if (isNaN(targetDate.getTime())) {
                 throw new AppError(`Invalid date format for field '${dateField}'`, StatusCodes.BAD_REQUEST);
            }

            // Reset time to midnight for fair day-based comparison
            targetDate.setHours(0, 0, 0, 0);

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const maxDate = new Date(now);
            maxDate.setDate(now.getDate() + daysLimit);

            // Allow past dates? User only asked to limit "1 week in advance".
            // Typically allow present and near future.
            
            if (targetDate > maxDate) {
                throw new AppError(
                    `Date limit exceeded. Cannot schedule more than ${daysLimit} days in the future (Max allowed: ${maxDate.toDateString()}).`, 
                    StatusCodes.BAD_REQUEST
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    validateFutureDateLimit
};
