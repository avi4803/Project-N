const { StatusCodes } = require('http-status-codes');
const { ErrorResponse } = require('../utils/');
const AppError = require('../utils/errors/app-error');
const {UserService} = require('../services/');
const { response } = require('express');
const { message } = require('../utils/error-response');

function validateAuthRequest(req, res, next) {
    console.log(req.body)
    
    if(!req.body.email) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['email not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.password) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['password not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.name) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['name not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.batch) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['Batch not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
    

    if(!req.body.college) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['College not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }

    
    
    next();
}

function validateLoginRequest(req, res, next) {
    if(!req.body.email) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['email not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.password) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['password not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   
    next();
}


async function checkAuth(req, res, next){
    try {
        const response = await UserService.isAuthenticated(req.headers['x-access-token']);
        if(response){
            req.user = response;
            next();

        }   
    } catch (error) {
        console.log('Issue in checkAuth in middleware')
        return res
                  .status(error.statusCode)
                  .json(error)  
    }

}

function validateAddRoleRequest(req, res, next) {
    if(!req.body.role) {
        ErrorResponse.message = 'Something went wrong while adding user';
        ErrorResponse.error = new AppError(['Role not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }

    if(!req.body.id) {
        ErrorResponse.message = 'Something went wrong while adding user';
        ErrorResponse.error = new AppError(['User Id not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
    
    next();
}

async function isAdmin(req , res, next) {
    try {
        console.log(req.user)
        const response = await UserService.isAdmin(req.user)   //after sign in req.user = reeponse(authentication using token)
        if(!response){
            return res
                      .status(StatusCodes.UNAUTHORIZED)
                      .json({message:'user not authorized for the action'});
    }
        next();
        
    } catch (error) {
        ErrorResponse.message = 'Something went wrong while authenticating isAdmin';
        ErrorResponse.error = error;
        return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .json(ErrorResponse);
       
        
    }
    
}


module.exports = {
    validateAuthRequest,
    checkAuth,
    validateAddRoleRequest,
    isAdmin,
    validateLoginRequest
}
