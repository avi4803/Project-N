const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const mongoose = require('mongoose');

class CrudRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    try {
      const response = await this.model.create(data);
      return response;
    } catch (error) {
      console.log("Error in CrudRepository create:", error.message);
      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new AppError(`Duplicate value for field: ${field}`, StatusCodes.CONFLICT);
      }
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        throw new AppError(messages.join(', '), StatusCodes.BAD_REQUEST);
      }
      throw new AppError('Error creating resource', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async destroy(id) {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid ID format', StatusCodes.BAD_REQUEST);
      }

      const response = await this.model.findByIdAndDelete(id);
      if (!response) {
        throw new AppError('Resource not found', StatusCodes.NOT_FOUND);
      }
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error deleting resource', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async get(id, populateOptions = null) {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid ID format', StatusCodes.BAD_REQUEST);
      }

      let query = this.model.findById(id);
      
      // Add population if specified
      if (populateOptions) {
        if (Array.isArray(populateOptions)) {
          populateOptions.forEach(option => {
            query = query.populate(option);
          });
        } else {
          query = query.populate(populateOptions);
        }
      }

      const response = await query;
      if (!response) {
        throw new AppError('Resource not found', StatusCodes.NOT_FOUND);
      }
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error fetching resource', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getAll(filter = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        populate = null,
        select = null
      } = options;

      // Build query
      let query = this.model.find(filter);

      // Add population
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach(option => {
            query = query.populate(option);
          });
        } else {
          query = query.populate(populate);
        }
      }

      // Add field selection
      if (select) {
        query = query.select(select);
      }

      // Add sorting
      query = query.sort(sort);

      // Add pagination
      if (limit > 0) {
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
      }

      const response = await query;
      
      // Get total count for pagination
      const totalDocuments = await this.model.countDocuments(filter);

      return {
        data: response,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalDocuments,
          totalPages: limit > 0 ? Math.ceil(totalDocuments / limit) : 1,
          hasNextPage: page * limit < totalDocuments,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.log("Error in CrudRepository getAll:", error.message);
      throw new AppError('Error fetching resources', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async update(id, data, options = {}) {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid ID format', StatusCodes.BAD_REQUEST);
      }

      const {
        new: returnNew = true,
        runValidators = true,
        populate = null
      } = options;

      let query = this.model.findByIdAndUpdate(
        id,
        { $set: data },
        { new: returnNew, runValidators }
      );

      // Add population if specified
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach(option => {
            query = query.populate(option);
          });
        } else {
          query = query.populate(populate);
        }
      }

      const response = await query;

      if (!response) {
        throw new AppError('Resource not found', StatusCodes.NOT_FOUND);
      }
      return response;
    } catch (error) {
      console.log("Error in CrudRepository update:", error.message);
      
      // Handle duplicate key error
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new AppError(`Duplicate value for field: ${field}`, StatusCodes.CONFLICT);
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        throw new AppError(messages.join(', '), StatusCodes.BAD_REQUEST);
      }
      
      if (error instanceof AppError) throw error;
      throw new AppError('Error updating resource', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Additional MongoDB-specific methods

  async findOne(filter, populateOptions = null) {
    try {
      let query = this.model.findOne(filter);
      
      if (populateOptions) {
        if (Array.isArray(populateOptions)) {
          populateOptions.forEach(option => {
            query = query.populate(option);
          });
        } else {
          query = query.populate(populateOptions);
        }
      }

      const response = await query;
      return response;
    } catch (error) {
      throw new AppError('Error finding resource', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkCreate(dataArray) {
    try {
      const response = await this.model.insertMany(dataArray, { 
        ordered: false, // Continue on error
        rawResult: true 
      });
      return response;
    } catch (error) {
      console.log("Error in bulk create:", error.message);
      if (error.code === 11000) {
        throw new AppError('Duplicate entries found in bulk data', StatusCodes.CONFLICT);
      }
      throw new AppError('Error in bulk creation', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkUpdate(filter, update) {
    try {
      const response = await this.model.updateMany(filter, { $set: update });
      return {
        matchedCount: response.matchedCount,
        modifiedCount: response.modifiedCount,
        acknowledged: response.acknowledged
      };
    } catch (error) {
      throw new AppError('Error in bulk update', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkDelete(filter) {
    try {
      const response = await this.model.deleteMany(filter);
      return {
        deletedCount: response.deletedCount,
        acknowledged: response.acknowledged
      };
    } catch (error) {
      throw new AppError('Error in bulk delete', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async count(filter = {}) {
    try {
      const count = await this.model.countDocuments(filter);
      return count;
    } catch (error) {
      throw new AppError('Error counting documents', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async exists(filter) {
    try {
      const exists = await this.model.exists(filter);
      return !!exists;
    } catch (error) {
      throw new AppError('Error checking existence', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Soft delete (set isActive: false instead of deleting)
  async softDelete(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid ID format', StatusCodes.BAD_REQUEST);
      }

      const response = await this.model.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true, runValidators: true }
      );

      if (!response) {
        throw new AppError('Resource not found', StatusCodes.NOT_FOUND);
      }
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error in soft delete', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Restore soft-deleted document
  async restore(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError('Invalid ID format', StatusCodes.BAD_REQUEST);
      }

      const response = await this.model.findByIdAndUpdate(
        id,
        { $set: { isActive: true } },
        { new: true, runValidators: true }
      );

      if (!response) {
        throw new AppError('Resource not found', StatusCodes.NOT_FOUND);
      }
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error restoring resource', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Aggregation pipeline
  async aggregate(pipeline) {
    try {
      const response = await this.model.aggregate(pipeline);
      return response;
    } catch (error) {
      console.log("Error in aggregation:", error.message);
      throw new AppError('Error in aggregation query', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = CrudRepository;