# Quick Setup Guide - Attendance System V2

## Step 1: Install Dependencies

```bash
cd main-backend
npm install node-cron
```

## Step 2: Export New Models

Update `src/models/index.js`:

```javascript
module.exports = {
  // ... existing exports
  AttendanceStreak: require('./AttendanceStreak')
};
```

## Step 3: Export New Controllers & Services

Update `src/controllers/index.js`:

```javascript
module.exports = {
  // ... existing
  AttendanceControllerV2: require('./attendance-controller-v2')
};
```

Update `src/services/index.js`:

```javascript
module.exports = {
  // ... existing
  AttendanceServiceV2: require('./attendance-service-v2')
};
```

## Step 4: Update Routes

Update `src/routes/v1/index.js`:

```javascript
const attendanceRoutesV2 = require('./attendance-route-v2');

// Replace or add alongside old route
router.use('/attendance', attendanceRoutesV2);
```

## Step 5: Start Cron Jobs

Update `src/index.js`:

```javascript
const { startAttendanceJobs } = require('./jobs/attendanceJobs');

app.listen(ServerConfig.PORT, async() => {
    console.log(`Successfully started the server on PORT : ${ServerConfig.PORT}`);
    await connectDB();
    console.log('📦 MongoDB connected successfully');
    
    // Start attendance automation
    startAttendanceJobs();
    console.log('🤖 Attendance automation enabled');
});
```

## Step 6: Test the System

### 1. Create Today's Sessions
```bash
POST http://localhost:3000/api/v1/attendance/admin/create-sessions
Headers: { Authorization: Bearer <token> }
```

### 2. Check Today's Classes (as student)
```bash
GET http://localhost:3000/api/v1/attendance/today
Headers: { Authorization: Bearer <student-token> }
```

### 3. Activate Sessions Manually
```bash
POST http://localhost:3000/api/v1/attendance/admin/activate-sessions
Headers: { Authorization: Bearer <token> }
```

### 4. Mark Attendance
```bash
POST http://localhost:3000/api/v1/attendance/mark/:sessionId
Headers: { Authorization: Bearer <student-token> }
Body: {
  "method": "manual"
}
```

### 5. Check Stats
```bash
GET http://localhost:3000/api/v1/attendance/stats?timeRange=week
Headers: { Authorization: Bearer <student-token> }
```

## Step 7: Remove Debug Logs (Optional)

Once tested, remove debug logs from `subject-service.js`:

```javascript
// Remove these lines:
console.log(`📝 Subject: ${subjectName}`);
console.log(`   Schedule type: ${typeof subjectData.schedule}, isArray: ${Array.isArray(subjectData.schedule)}`);
console.log(`   Schedule items: ${subjectData.schedule.length}`);
```

## Verification Checklist

- [ ] Subjects have `college` field populated
- [ ] Timetable has `college` field
- [ ] Sessions auto-create daily at midnight
- [ ] Sessions auto-activate when time comes
- [ ] Students can mark attendance
- [ ] Absent students auto-marked after deadline
- [ ] Streaks are being tracked
- [ ] Notifications are being sent
- [ ] Correction requests work

## Troubleshooting

### Sessions not creating?
- Check timetable has `college` field
- Check subjects exist for timetable entries
- Check cron job is running: logs should show "Running daily session creation job"

### Sessions not activating?
- Check system time matches cron timezone
- Check session `startTime` format is "HH:MM"
- Manually test: `POST /api/v1/attendance/admin/activate-sessions`

### Can't mark attendance?
- Check session `isMarkingOpen` is true
- Check `lateMarkingDeadline` hasn't passed
- Check student belongs to batch/section

### Streaks not updating?
- Check `AttendanceStreak` model is imported
- Check `updateStreak` is called after marking
- Manually query: `db.attendancestreaks.find({ student: ObjectId(...) })`

## Next Steps

1. **Test with real timetable data**
2. **Configure notification service** (Novu)
3. **Add role-based access** (admin endpoints)
4. **Monitor cron job logs**
5. **Set up error alerting**
6. **Deploy to production**

## Production Checklist

- [ ] Set proper timezone in cron jobs
- [ ] Configure Novu API keys
- [ ] Add rate limiting on mark attendance
- [ ] Set up database backups
- [ ] Monitor cron job execution
- [ ] Add logging/monitoring (e.g., Winston, Sentry)
- [ ] Test with load (multiple students marking simultaneously)
- [ ] Add retry logic for failed notifications

---

**Need Help?** Check ATTENDANCE_SYSTEM_V2.md for full documentation.
