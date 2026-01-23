const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');

class SubjectService {
  
  /**
   * Create subjects automatically from timetable
   * @param {ObjectId} timetableId - Timetable ID
   * @returns {Array} Created/Updated subjects
   */
  async createSubjectsFromTimetable(timetableId) {
    try {
      console.log(`📋 Processing timetable for Subjects creation: ${timetableId}`);
      const timetable = await Timetable.findById(timetableId)
        .populate('batch')
        .populate('section');
        

      if (!timetable) {
        throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
      }

      console.log(`✅ Timetable found for ${timetable.batch?.program || 'Unknown'} - ${timetable.section?.name || 'Unknown'}`);

      // Extract unique subjects from schedule
      const subjectMap = new Map();

      timetable.schedule.forEach(classItem => {
        const subjectName = classItem.subject.trim();
        
        if (!subjectMap.has(subjectName)) {
          subjectMap.set(subjectName, {
            name: subjectName,
            faculty: classItem.teacher || null,
            type: classItem.type,
            rooms: [classItem.room].filter(Boolean),
            schedule: []
          });
        }

        const subject = subjectMap.get(subjectName);
        
        // Add room if not already present
        if (classItem.room && !subject.rooms.includes(classItem.room)) {
          subject.rooms.push(classItem.room);
        }

        // Add schedule entry
        subject.schedule.push({
          day: classItem.day,
          startTime: classItem.startTime,
          endTime: classItem.endTime,
          room: classItem.room,
          type: classItem.type
        });
      });

      // Create/Update subjects in database
      const createdSubjects = [];
      const updatedSubjects = [];
      const errors = [];
      
      // Get college ID from the batch
      const collegeId = timetable.batch.college;

      for (const [subjectName, subjectData] of subjectMap) {
        try {
          // Check if subject already exists
          let subject = await Subject.findOne({
            name: subjectName,
            batch: timetable.batch._id,
            section: timetable.section._id
          });

          const subjectPayload = {
            name: subjectName,
            batch: timetable.batch._id,
            section: timetable.section._id,
            college: collegeId,
            facultyName: subjectData.faculty,
            type: subjectData.type,
            rooms: subjectData.rooms,
            schedule: subjectData.schedule,
            classesPerWeek: subjectData.schedule.length,
            source: 'ocr',
            timetableRef: timetableId,
            isActive: true
          };

          // Debug: Check schedule data type
          console.log(`📝 Subject: ${subjectName}`);
          console.log(`   Schedule type: ${typeof subjectData.schedule}, isArray: ${Array.isArray(subjectData.schedule)}`);
          console.log(`   Schedule items: ${subjectData.schedule.length}`);

          if (subject) {
            // Update existing subject
            subject.name = subjectName;
            subject.batch = timetable.batch._id;
            subject.section = timetable.section._id;
            subject.college = collegeId;
            subject.facultyName = subjectData.faculty;
            subject.type = subjectData.type;
            subject.rooms = subjectData.rooms;
            subject.schedule = subjectData.schedule;
            subject.classesPerWeek = subjectData.schedule.length;
            subject.source = 'ocr';
            subject.timetableRef = timetableId;
            subject.isActive = true;
            
            await subject.save();
            updatedSubjects.push(subject);
            console.log(`✅ Updated subject: ${subjectName}`);
          } else {
            // Create new subject
            subject = await Subject.create(subjectPayload);
            createdSubjects.push(subject);
            console.log(`✅ Created subject: ${subjectName}`);
          }

        } catch (error) {
          console.error(`❌ Error processing subject ${subjectName}:`, error.message);
          errors.push({
            subject: subjectName,
            error: error.message
          });
        }
      }

      return {
        created: createdSubjects,
        updated: updatedSubjects,
        errors,
        summary: {
          totalSubjects: subjectMap.size,
          created: createdSubjects.length,
          updated: updatedSubjects.length,
          failed: errors.length
        }
      };

    } catch (error) {
      console.error('Error creating subjects from timetable:', error);
      throw error;
    }
  }

  /**
   * Generate subject code automatically
   * @param {String} subjectName - Subject name
   * @param {ObjectId} batchId - Batch ID
   * @returns {String} Generated subject code
   */
  async generateSubjectCode(subjectName, batchId) {
    try {
      // Extract acronym from subject name
      const words = subjectName.trim().split(/\s+/);
      let acronym = words
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 4);

      // Add batch year/number
      const batch = await require('../models/Batch').findById(batchId);
      const batchYear = batch?.year || '';
      
      let code = `${acronym}${batchYear}`;
      let counter = 1;

      // Ensure unique code
      while (await Subject.findOne({ code })) {
        code = `${acronym}${batchYear}${counter}`;
        counter++;
      }

      return code;
    } catch (error) {
      console.error('Error generating subject code:', error);
      return null;
    }
  }

  /**
   * Get all subjects for batch/section
   * @param {ObjectId} batchId - Batch ID
   * @param {ObjectId} sectionId - Section ID
   * @returns {Array} Subjects
   */
  async getSubjectsByBatchSection(batchId, sectionId) {
    try {
      const subjects = await Subject.find({
        batch: batchId,
        section: sectionId,
        isActive: true
      })
        .select('name facultyName type _id') // Select only required fields
        .populate('faculty', 'name email') // Keep faculty population if facultyName is just a string fallback
        .sort({ name: 1 });

      return subjects;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sync subjects when timetable is updated
   * @param {ObjectId} timetableId - Timetable ID
   */
  async syncSubjectsWithTimetable(timetableId) {
    try {
      const result = await this.createSubjectsFromTimetable(timetableId);
      
      // Mark subjects as inactive if they're not in the new timetable
      const timetable = await Timetable.findById(timetableId);
      const currentSubjectNames = timetable.schedule.map(c => c.subject.trim());
      
      await Subject.updateMany(
        {
          batch: timetable.batch,
          section: timetable.section,
          name: { $nin: currentSubjectNames },
          timetableRef: timetableId
        },
        {
          isActive: false
        }
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subject by ID
   * @param {ObjectId} subjectId - Subject ID
   */
  async getSubjectById(subjectId) {
    try {
      const subject = await Subject.findById(subjectId)
        .populate('batch', 'program year')
        .populate('section', 'name')
        .populate('faculty', 'name email');

      if (!subject) {
        throw new AppError('Subject not found', StatusCodes.NOT_FOUND);
      }

      return subject;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update subject
   * @param {ObjectId} subjectId - Subject ID
   * @param {Object} updateData - Update data
   */
  async updateSubject(subjectId, updateData) {
    try {
      const subject = await Subject.findByIdAndUpdate(
        subjectId,
        { ...updateData, source: 'manual' },
        { new: true, runValidators: true }
      );

      if (!subject) {
        throw new AppError('Subject not found', StatusCodes.NOT_FOUND);
      }

      return subject;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete subject
   * @param {ObjectId} subjectId - Subject ID
   */
  async deleteSubject(subjectId) {
    try {
      const subject = await Subject.findByIdAndDelete(subjectId);

      if (!subject) {
        throw new AppError('Subject not found', StatusCodes.NOT_FOUND);
      }

      return subject;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate total classes for a subject based on semester duration
   * @param {Number} classesPerWeek - Classes per week
   * @param {Number} semesterWeeks - Number of weeks in semester (default 16)
   */
  calculateTotalClasses(classesPerWeek, semesterWeeks = 16) {
    return classesPerWeek * semesterWeeks;
  }
}

module.exports = new SubjectService();