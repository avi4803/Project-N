const Holiday = require('../models/Holiday');
const User = require('../models/User');
const CacheService = require('./cache-service');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const WeeklySessionService = require('./weekly-session-service');

class HolidayService {

  // Get a structured YYYY-MM-DD string that represents IST bounds
  _getISTDateString(date) {
    const istStr = new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' });
    const [m, d, y] = istStr.split('/').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  async addHoliday(collegeId, startDate, endDate, reason) {
    if (!collegeId || !startDate || !endDate || !reason) {
      throw new AppError('Missing required fields for holiday', StatusCodes.BAD_REQUEST);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new AppError('Start date cannot be after end date', StatusCodes.BAD_REQUEST);
    }

    const currDate = new Date(start);
    currDate.setHours(0, 0, 0, 0);
    const limit = new Date(end);
    limit.setHours(23, 59, 59, 999);

    const holidaysToInsert = [];

    while (currDate <= limit) {
      holidaysToInsert.push({
        college: collegeId,
        dateString: this._getISTDateString(currDate),
        reason
      });
      currDate.setDate(currDate.getDate() + 1);
    }

    // Insert ignoring duplicates
    try {
      const bulkOps = holidaysToInsert.map(h => ({
         updateOne: {
           filter: { college: h.college, dateString: h.dateString },
           update: { $set: h },
           upsert: true
         }
      }));
      await Holiday.bulkWrite(bulkOps);
    } catch (err) {
      throw new AppError('Failed to save holidays to database', StatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Clear college holiday cache
    await CacheService.del(`holidays:${collegeId.toString()}`);

    // Invalidate dashboard and stats for ALL students in this college
    try {
        const students = await User.find({ college: collegeId }, '_id');
        const deletePromises = students.map(student => {
            const id = student._id.toString();
            return [
                CacheService.delByPattern(`user:${id}:dashboard:*`),
                CacheService.delByPattern(`user:${id}:next-class:*`),
                CacheService.delByPattern(`user:${id}:overall-stats:*`),
                CacheService.del(`user:${id}:active-class`),
                CacheService.del(`user:${id}:full-dashboard`)
            ];
        }).flat();
        await Promise.all(deletePromises);
    } catch (e) {
        console.error('Failed to clear cache after adding holiday:', e);
    }

    return { message: 'Holidays added successfully' };
  }

  async getHolidaysForCollege(collegeId) {
    const cacheKey = `holidays:${collegeId.toString()}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    // Fetch future or recent holidays (e.g., past 30 days and all future)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thresholdDateString = this._getISTDateString(thirtyDaysAgo);

    const holidays = await Holiday.find({
        college: collegeId,
        dateString: { $gte: thresholdDateString }
    }).select('dateString reason -_id');

    // Convert to a dictionary for O(1) lookups
    const holidayMap = {};
    for (const h of holidays) {
      holidayMap[h.dateString] = h.reason;
    }

    // Cache for 24 hours
    await CacheService.set(cacheKey, holidayMap, 86400);

    return holidayMap;
  }

  async isHoliday(collegeId, dateString) {
      const holidays = await this.getHolidaysForCollege(collegeId);
      return holidays[dateString] || null; // Returns the reason string if holiday, else null
  }

  async removeHoliday(collegeId, dateString) {
    if (!collegeId || !dateString) {
      throw new AppError('College ID and date string are required', StatusCodes.BAD_REQUEST);
    }

    try {
      await Holiday.deleteOne({ college: collegeId, dateString: dateString });
    } catch (err) {
      throw new AppError('Failed to delete holiday from database', StatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Clear college holiday cache
    await CacheService.del(`holidays:${collegeId.toString()}`);

    // Invalidate dashboard and stats for ALL students in this college
    try {
        const students = await User.find({ college: collegeId }, '_id');
        const deletePromises = students.map(student => {
            const id = student._id.toString();
            return [
                CacheService.delByPattern(`user:${id}:dashboard:*`),
                CacheService.delByPattern(`user:${id}:next-class:*`),
                CacheService.delByPattern(`user:${id}:overall-stats:*`),
                CacheService.del(`user:${id}:active-class`),
                CacheService.del(`user:${id}:full-dashboard`)
            ];
        }).flat();
        await Promise.all(deletePromises);
    } catch (e) {
        console.error('Failed to clear cache after removing holiday:', e);
    }

    return { message: 'Holiday removed successfully' };
  }

}

module.exports = new HolidayService();
