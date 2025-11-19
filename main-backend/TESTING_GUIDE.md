# Testing Guide - Attendance System V2

## Prerequisites

1. **Install node-cron**
   ```bash
   npm install node-cron
   ```

2. **Update the jobs file to use V2 service**
   
   Edit `src/jobs/attendanceJobs.js` line 2:
   ```javascript
   const AttendanceService = require('../services/attendance-service-v2');
   ```

3. **Setup routes**
   
   Edit `src/routes/v1/index.js`:
   ```javascript
   const attendanceRoutes = require('./attendance-route-v2');
   router.use('/attendance', attendanceRoutes);
   ```

4. **Start server with cron jobs** (optional for manual testing)
   
   Edit `src/index.js`:
   ```javascript
   const { startAttendanceJobs } = require('./jobs/attendanceJobs');
   
   app.listen(ServerConfig.PORT, async() => {
       await connectDB();
       // startAttendanceJobs(); // Comment out for manual testing
   });
   ```

## Testing Steps

### Step 1: Verify Database Setup

**Check if subjects have college field:**
```bash
# MongoDB shell
use test
db.subjects.findOne()
```

Should have `college` field. If missing, re-run OCR to create subjects.

### Step 2: Manual Session Creation

**Create today's sessions:**
```http
POST http://localhost:3000/api/v1/attendance/admin/create-sessions
Authorization: Bearer <your-admin-token>
```

**Expected Response:**
```json
{
  "success": true,
  "message": "8 sessions created successfully",
  "data": [
    {
      "_id": "session_id",
      "subject": "subject_id",
      "date": "2025-11-19T00:00:00.000Z",
      "startTime": "09:00",
      "endTime": "10:00",
      "status": "scheduled"
    }
  ]
}
```

**Verify in database:**
```bash
db.attendancesessions.find({ date: ISODate("2025-11-19") }).pretty()
```

### Step 3: Test Student Queries

**Get today's classes (as student):**
```http
GET http://localhost:3000/api/v1/attendance/today
Authorization: Bearer <student-token>
```

**Expected Response:**
```json
{
  "data": [
    {
      "_id": "session_id",
      "subject": {
        "name": "Mathematics",
        "code": "MATH101"
      },
      "startTime": "09:00",
      "endTime": "10:00",
      "room": "Virtual Class",
      "status": "scheduled",
      "isMarkingOpen": false,
      "attendanceMarked": false,
      "canMark": false
    }
  ]
}
```

### Step 4: Activate Sessions

**Manually activate sessions:**
```http
POST http://localhost:3000/api/v1/attendance/admin/activate-sessions
Authorization: Bearer <admin-token>
```

**Expected Response:**
```json
{
  "success": true,
  "message": "3 sessions activated",
  "data": [...]
}
```

**Verify session is active:**
```bash
db.attendancesessions.find({ status: "active" }).pretty()
```

### Step 5: Check Active Class

**Get currently active class:**
```http
GET http://localhost:3000/api/v1/attendance/active
Authorization: Bearer <student-token>
```

**Expected Response:**
```json
{
  "data": {
    "_id": "session_id",
    "subject": {
      "name": "Mathematics",
      "code": "MATH101"
    },
    "startTime": "09:00",
    "endTime": "10:00",
    "status": "active",
    "isMarkingOpen": true,
    "attendanceMarked": false,
    "canMark": true
  }
}
```

### Step 6: Mark Attendance

**Mark self-attendance:**
```http
POST http://localhost:3000/api/v1/attendance/mark/:sessionId
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "method": "manual"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "attendance": {
      "_id": "attendance_id",
      "student": "student_id",
      "subject": "subject_id",
      "status": "present",
      "markedAt": "2025-11-19T09:15:00.000Z"
    },
    "stats": {
      "total": 1,
      "present": 1,
      "absent": 0,
      "percentage": "100.00"
    },
    "streak": {
      "currentStreak": 1,
      "longestStreak": 1,
      "totalPresent": 1,
      "totalAbsent": 0,
      "percentage": 100,
      "badges": [],
      "milestones": []
    }
  }
}
```

**Verify in database:**
```bash
db.attendances.find({ student: ObjectId("student_id") }).pretty()
db.attendancestreaks.find({ student: ObjectId("student_id") }).pretty()
```

### Step 7: Test Multiple Attendance

**Mark attendance for multiple sessions to test streaks:**

1. Create another session for tomorrow
2. Activate it manually
3. Mark attendance
4. Check streak increments

**After 5 consecutive classes:**
```json
{
  "streak": {
    "currentStreak": 5,
    "longestStreak": 5,
    "milestones": [
      { "type": "streak_5", "achievedAt": "2025-11-20T10:00:00Z" }
    ]
  }
}
```

### Step 8: Test Absence & Streak Break

**Close sessions to auto-mark absent:**
```http
POST http://localhost:3000/api/v1/attendance/admin/close-sessions
Authorization: Bearer <admin-token>
```

**Check if students who didn't mark are absent:**
```bash
db.attendances.find({ status: "absent" }).pretty()
```

**Verify streak broke:**
```bash
db.attendancestreaks.find({ student: ObjectId("student_id") }).pretty()
# Should show currentStreak: 0
```

### Step 9: Get Attendance Stats

**Get overall stats:**
```http
GET http://localhost:3000/api/v1/attendance/stats?timeRange=week
Authorization: Bearer <student-token>
```

**Get attendance history:**
```http
GET http://localhost:3000/api/v1/attendance/history/:subjectId
Authorization: Bearer <student-token>
```

**Get streak:**
```http
GET http://localhost:3000/api/v1/attendance/streak?subjectId=:subjectId
Authorization: Bearer <student-token>
```

### Step 10: Test Admin Update

**Update attendance (admin):**
```http
PUT http://localhost:3000/api/v1/attendance/:attendanceId/update
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "present",
  "reason": "Student provided valid proof"
}
```

**Verify modification history:**
```bash
db.attendances.findOne({ _id: ObjectId("attendance_id") }).modificationHistory
```

## Testing Cron Jobs

### Option 1: Manual Testing (Recommended)

Use the admin endpoints to trigger actions manually without waiting for cron:

```bash
# Create sessions
POST /api/v1/attendance/admin/create-sessions

# Activate sessions
POST /api/v1/attendance/admin/activate-sessions

# Close sessions
POST /api/v1/attendance/admin/close-sessions
```

### Option 2: Test Cron Locally

**Modify cron schedule for testing:**

Edit `src/jobs/attendanceJobs.js`:

```javascript
// Run every minute for testing
const createDailySessions = cron.schedule('* * * * *', async () => {
  // ... existing code
});

// Run every 2 minutes
const activateSessionsJob = cron.schedule('*/2 * * * *', async () => {
  // ... existing code
});
```

**Enable cron in index.js:**
```javascript
startAttendanceJobs();
```

**Watch the logs:**
```bash
npm run dev
# Watch for cron execution logs
```

**Revert to production schedule after testing!**

## Common Issues & Solutions

### Issue: "Session not found"
**Solution:** Run create-sessions first

### Issue: "Attendance marking is not open"
**Solution:** Run activate-sessions to open marking window

### Issue: "You are not enrolled in this class"
**Solution:** Verify student's batch/section matches session's batch/section

### Issue: "Attendance already marked"
**Solution:** This is expected - can only mark once per session

### Issue: Sessions not creating
**Solution:** 
- Check timetable exists and is active
- Check subjects exist for timetable entries
- Check timetable has `college` field

### Issue: Streak not updating
**Solution:**
- Check AttendanceStreak model exists
- Check updateStreak is being called
- Verify no errors in service logs

## Quick Test Script

Create `test-attendance.http` file:

```http
### Variables
@baseUrl = http://localhost:3000/api/v1
@adminToken = your_admin_token_here
@studentToken = your_student_token_here

### 1. Create Sessions
POST {{baseUrl}}/attendance/admin/create-sessions
Authorization: Bearer {{adminToken}}

### 2. Get Today's Classes
GET {{baseUrl}}/attendance/today
Authorization: Bearer {{studentToken}}

### 3. Activate Sessions
POST {{baseUrl}}/attendance/admin/activate-sessions
Authorization: Bearer {{adminToken}}

### 4. Get Active Class
GET {{baseUrl}}/attendance/active
Authorization: Bearer {{studentToken}}

### 5. Mark Attendance
POST {{baseUrl}}/attendance/mark/{{sessionId}}
Authorization: Bearer {{studentToken}}
Content-Type: application/json

{
  "method": "manual"
}

### 6. Get Stats
GET {{baseUrl}}/attendance/stats?timeRange=all
Authorization: Bearer {{studentToken}}

### 7. Get Streak
GET {{baseUrl}}/attendance/streak
Authorization: Bearer {{studentToken}}

### 8. Close Sessions
POST {{baseUrl}}/attendance/admin/close-sessions
Authorization: Bearer {{adminToken}}
```

## Database Verification Queries

```javascript
// Check sessions
db.attendancesessions.find().sort({ date: -1, startTime: 1 })

// Check attendance records
db.attendances.find().sort({ date: -1 })

// Check streaks
db.attendancestreaks.find().pretty()

// Check specific student's attendance
db.attendances.find({ 
  student: ObjectId("student_id") 
}).sort({ date: -1 })

// Check session statistics
db.attendancesessions.aggregate([
  {
    $lookup: {
      from: "attendances",
      localField: "_id",
      foreignField: "session",
      as: "attendances"
    }
  },
  {
    $project: {
      subject: 1,
      date: 1,
      startTime: 1,
      totalAttendances: { $size: "$attendances" }
    }
  }
])
```

## Production Checklist

Before deploying:

- [ ] Change cron service to use `attendance-service-v2`
- [ ] Set correct timezone in cron jobs
- [ ] Test with multiple students simultaneously
- [ ] Verify notifications are being sent (if Novu configured)
- [ ] Test edge cases (late marking, duplicate marking)
- [ ] Monitor cron job execution logs
- [ ] Set up database backups
- [ ] Add error alerting (Sentry, etc.)
- [ ] Load test the mark attendance endpoint
- [ ] Document any custom configurations

---

**Happy Testing! 🚀**

For detailed API documentation, see `ATTENDANCE_SYSTEM_V2.md`
