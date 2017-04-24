/**
* User class
* @class
*/
let User = class User extends Base {
  /**
  * Creates an independent instance of the User class
  */
  static copy (item) {
    if (item == null) return null

    let ret_val = new User()

    ret_val.id = item.id
    ret_val.name = item.name
    ret_val.last = item.last
    ret_val.email = item.email
    ret_val.type = item.type
    ret_val.admin = item.admin
    ret_val.active = item.active

    return ret_val
  }

  /**
  * Fixes user objects coming from the database to comply with the data model
  * @param {array} users - User list as it was returned by the database
  * @return {array} - User list compliant with the data model
  */
  static prepareUserList (users) {
    let ret_val = []

    for (let i = 0; i < users.length; i++) {
      ret_val.push(new User(users[i]))
    }

    return ret_val
  }

  /**
  * Makes an instance of the User class - data recovered from db
  * @constructor
  * @param {object} db_object - json object as it came from the db
  */
  constructor (db_object) {
    super()

    if (db_object == null) {
      this.id = ''
      this.name = ''
      this.last = ''
      this.email = ''
      this.type = ''
      this.admin = false
      this.active = true
    } else {
      this.id = db_object.id
      this.name = db_object.name
      this.last = db_object.last
      this.email = db_object.email
      this.type = db_object.type
      this.admin = db_object.admin === 1 ? true : false
      this.active = db_object.active === 1 ? true : false
    }
  }

  /**
  * Returns a json object compliant with the database structure
  */
  get jsonForDatabase () {
    return this
  }
}
