const {StatusCodes} = require('http-status-codes');
const {UserService} = require('../services');
const { ErrorResponse} = require('../utils/');
const { SuccessResponse } = require('../utils/');
const bcrypt = require("bcrypt")


async function signup(req, res) {
    try {
       
        const user = await UserService.createUser({
            email:req.body.email,
            password:req.body.password,
            name:req.body.name,
            batch:req.body.batch,
            section:req.body.section,   
        })
        
    SuccessResponse.message = 'Successfully added the user';
    SuccessResponse.data = user;
        return res
                  .status(StatusCodes.CREATED)
                  .json(SuccessResponse);
    } catch (error) {
        console.log("error in signup controller", error.message)
        ErrorResponse.error = error;
        return res
                 .status(error.StatusCode)
                 .json(ErrorResponse)
        
    }
    
}

async function signin(req, res){

    try {
        const user = await UserService.userSignIn({
            email : req.body.email,
            password : req.body.password

        })

        SuccessResponse.message = 'Successfully logged in';
        SuccessResponse.data = user ;
        return res
                  .status(StatusCodes.OK)
                  .json(SuccessResponse)


        
    } catch (error) {
        ErrorResponse.error = error;
        return res
                  .status(error.statusCode)
                  .json(ErrorResponse)
        
    }
}

async function addRoleToUser(req, res){

    try {
        const user = await UserService.addRoleToUser({
            role : req.body.role,
            id : req.body.id,

        })
        SuccessResponse.message = 'Role added successfully';
        SuccessResponse.data = user ;
        return res
                  .status(StatusCodes.OK)
                  .json(SuccessResponse)


        
    } catch (error) {
        ErrorResponse.error = error;
        return res
                  .status(error.statusCode)
                  .json(ErrorResponse)
        
    }
}

module.exports = {
    signup,
    signin,
    addRoleToUser

}