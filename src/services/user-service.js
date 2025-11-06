const { StatusCodes } = require('http-status-codes');
const { ErrorResponse } = require('../utils/error-response');
const { SuccessResponse } = require('../utils/success-response');
const AppError = require('../utils/errors/app-error');
const User = require('../models/Users'); // Mongoose model
const { Auth, Enums } = require('../utils/index');

async function createUser(data) {
  try {
    const user = new User(data);
    await user.save();
    return user;
    
  } catch (error) {
    console.log("error creating the user",error.message)
    if (error.code === 11000) { // Mongo duplicate key error
      throw new AppError('Email must be unique', StatusCodes.CONFLICT);
    }
    throw new AppError('Error creating the User', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function userSignIn(data) {
  try {
    const user = await User.findOne({ email: data.email });
    if (!user) {
      throw new AppError('No user found for given email', StatusCodes.NOT_FOUND);
    }
    const passwordMatch = await Auth.checkPassword(data.password, user.password); // assuming async check
    if (!passwordMatch) {
      throw new AppError('Invalid Password', StatusCodes.BAD_REQUEST);
    }
    const jwt = Auth.createToken({ id: user._id, email: user.email });
    return jwt;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Something went wrong', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function isAuthenticated(token) {
  try {
    if (!token) {
      throw new AppError('missing JWT token', StatusCodes.BAD_REQUEST);
    }
    const response = await Auth.verifyToken(token);
    const user = await User.findById(response.id);
    if (!user) {
      throw new AppError('User not found', StatusCodes.BAD_REQUEST);
    }
    return user._id;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid JWT token', StatusCodes.BAD_REQUEST);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('JWT Token expired', StatusCodes.BAD_REQUEST);
    }
    console.log('log from user-service isAuthenticated:', error);
    throw new AppError('Something went wrong', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function addRoleToUser(data) {
  try {
    const user = await User.findById(data.id);
    if (!user) throw new AppError('No user found for given ID', StatusCodes.NOT_FOUND);
    const role = data.role;
    if (!role) throw new AppError('No Role found', StatusCodes.NOT_FOUND);
    if (!user.roles.includes(role)) {
      user.roles.push(role);
      await user.save();
    }
    return user;
  } catch (error) {
    console.log(error);
    if (error instanceof AppError) throw error;
    throw new AppError('Something went wrong', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function isAdmin(id) {
  try {
    const user = await User.findById(id).populate('roles');
    if (!user) throw new AppError('No user found for given ID', StatusCodes.NOT_FOUND);
    const adminRole = 'admin';
    if (!adminRole) throw new AppError('No Role found', StatusCodes.NOT_FOUND);
    return user.roles.some(role => role === (adminRole));
  } catch (error) {
    console.log(error);
    if (error instanceof AppError) throw error;
    throw new AppError('Something went wrong', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  createUser,
  userSignIn,
  isAuthenticated,
  addRoleToUser,
  isAdmin
};
