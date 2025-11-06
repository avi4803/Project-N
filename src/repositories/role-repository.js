const CrudRepository = require('./crud-repository');
const Role = require('../models/Role'); 

class RoleRepository extends CrudRepository {
  constructor() {
    super(Role);
  }

  // Find role document by name using Mongoose syntax
  async getRoleByName(name) {
    const role = await Role.findOne({ name: name });
    return role;
  }
}

module.exports = RoleRepository;
