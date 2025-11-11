const Timetable = require("../models/Timetable");
const CrudRepository = require("./crud-repository");

class TimetableRepository extends CrudRepository{
    constructor(){
        super(Timetable);
    }

    async getTimetableByDay(day){
        const table = await this.model.findOne({
            day: day   
        })
        return table;

    }

}


module.exports = TimetableRepository;