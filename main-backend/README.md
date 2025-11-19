# Project-N - Node.js Backend API

This is a comprehensive Node.js backend project template built with **MongoDB** and **Express.js**. It follows best practices for project structure, error handling, authentication, and authorization. Feel free to customize it according to your needs.

## 📁 Project Structure

`src` → Contains all the source code for the project (excluding tests)

### Inside the `src` folder:

- **`config`** → Configuration and setup for libraries and modules
  - `server-config.js` - Environment variables setup using `dotenv`
  - `database.js` - MongoDB connection configuration
  
- **`routes`** → Route definitions with their corresponding middleware and controllers

- **`middlewares`** → Request interceptors for validation, authentication, and authorization

- **`controllers`** → Handle incoming requests, pass data to services, and structure API responses

- **`repositories`** → Database interaction layer (not used in current MongoDB implementation as services interact directly with models)

- **`services`** → Business logic layer that interacts with MongoDB models

- **`models`** → MongoDB/Mongoose schema definitions

- **`utils`** → Helper methods, custom error classes, and utility functions

---

## 🚀 Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone or download this repository
cd Project-N

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=3000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRY=24h
```

**Important Notes:**
- Replace `username`, `password`, `cluster`, and `database-name` with your actual MongoDB credentials
- Generate a strong `JWT_SECRET` using: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- Never commit `.env` to version control (already in `.gitignore`)

### 3. MongoDB Setup

**Option A: MongoDB Atlas (Cloud - Recommended)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist your IP address (or use `0.0.0.0/0` for development)
5. Get your connection string and add it to `.env` as `MONGO_URI`

**Option B: Local MongoDB**
```env
MONGO_URI=mongodb://localhost:27017/project-n
```

### 4. Start the Server

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:3000` (or your configured PORT)

---

## 📮 API Documentation - Postman Guide

### Base URL
```
http://localhost:3000/api/v1
```

---

## 🔐 Authentication & Authorization

### 1. User Signup (Registration)

**Endpoint:** `POST /api/v1/signup`

**Headers:**
```
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123",
  "batch": "2024",
  "college": "MIT"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "roles": ["student"],
    "batch": "2024",
    "college": "MIT"
  },
  "error": {}
}
```

---

### 2. User Login (Sign In)

**Endpoint:** `POST /api/v1/signin`

**Headers:**
```
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJpYXQiOjE2MzU0MjU2MDAsImV4cCI6MTYzNTUxMjAwMH0.xyz..."
  },
  "error": {}
}
```

**⚠️ Important:** Copy the `token` value - you'll need it for all protected routes!

---

### 3. Access Protected Routes (Authentication)

For any protected endpoint, you must include the JWT token in the request headers.

**Method 1: Custom Header (Current Implementation)**

**Headers:**
```
Content-Type: application/json
x-access-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Method 2: Standard Authorization Header (Recommended)**

If you modify the middleware to use standard Bearer tokens:

**Headers:**
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 4. Add Role to User (Admin Only)

**Endpoint:** `POST /api/v1/user/role`

**Headers:**
```
Content-Type: application/json
x-access-token: <admin-user-jwt-token>
```

**Request Body (JSON):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "role": "admin"
}
```

**Available Roles:**
- `student` (default)
- `admin`
- `local-admin`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Role added successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "roles": ["student", "admin"]
  },
  "error": {}
}
```

---

## 🎯 Postman Tips & Tricks

### Using Environment Variables

1. **Create a Postman Environment** (top-right corner → Environments → Create)
2. **Add variables:**
   ```
   base_url: http://localhost:3000/api/v1
   auth_token: (leave empty initially)
   ```

3. **Auto-save token after login:**
   - Go to your `/signin` request
   - Click on the **Tests** tab
   - Add this script:
   ```javascript
   if (pm.response.code === 200) {
       const response = pm.response.json();
       pm.environment.set("auth_token", response.data.token);
   }
   ```

4. **Use variables in requests:**
   - URL: `{{base_url}}/signin`
   - Headers: `x-access-token: {{auth_token}}`

### Creating a Collection

1. **Create a new Collection** named "Project-N API"
2. **Add folders:**
   - Authentication (signup, signin)
   - User Management (add role, etc.)
   - Protected Routes

3. **Set collection-level headers:**
   - Right-click collection → Edit
   - Go to **Headers** tab
   - Add: `Content-Type: application/json`

---

## 🛡️ Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid Password",
  "data": {},
  "error": {
    "statusCode": 400,
    "explanation": "Invalid Password"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Missing JWT token",
  "error": {
    "statusCode": 400,
    "explanation": "missing JWT token"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "No user found for given email",
  "error": {
    "statusCode": 404,
    "explanation": "No user found for given email"
  }
}
```

### 409 Conflict (Duplicate Email)
```json
{
  "success": false,
  "message": "Email must be unique",
  "error": {
    "statusCode": 409,
    "explanation": "Email must be unique"
  }
}
```

---

## 🔧 Development Workflow

1. **Start MongoDB** (if using local)
2. **Run the server:** `npm run dev`
3. **Test authentication flow in Postman:**
   - Signup → Get token
   - Signin → Save token to environment
   - Access protected routes using saved token

---

## 📝 Additional Notes

- **Password Security:** Passwords are hashed using bcrypt before storing
- **Token Expiry:** JWT tokens expire based on `JWT_EXPIRY` setting
- **Role-Based Access:** Check user roles using middleware before allowing certain operations
- **Error Handling:** All errors are caught and returned in a consistent format

---

## 🤝 Contributing

Feel free to fork this project and customize it according to your needs. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

This project is open source and available under the MIT License.