/**
* Patient class
* @class
*/
let Patient = class Patient extends Base {
  /**
  * returns a fully independent copy of a Patient object
  * @param {Patient} item - Patient to copy
  */
  static copy (item) {
    if (item == null) return null

    let ret_val = new Patient()

    ret_val.id = item.id
    ret_val.name = item.name
    ret_val.last = item.last
    ret_val.birthdate = new Date(item.birthdate)
    ret_val.first = new Date(item.first)
    ret_val.date_of_death = item.date_of_death != null ? new Date(item.date_of_death) : null
    ret_val.last_op_date = item.last_op_date != null ? new Date(item.last_op_date) : null
    ret_val.last_op_done = item.last_op_done
    ret_val.background = item.background
    ret_val.surgeon = User.copy(item.surgeon)

    return ret_val
  }

  /**
  * Patients coming from the db have their surgeon's data - this returns the surgeon data as it came directly from the database
  * @param {object} item - Patient as it came from the database
  */
  static extractSurgeon (item) {
    return new User({
      id: item.surgeon_id,
      name: item.surgeon_name,
      last: item.surgeon_last,
      email: item.surgeon_email,
      type: item.surgeon_type,
      admin: item.surgeon_admin,
      active: item.surgeon_active
    })
  }

  /**
  * Fixes patient objects coming back from the db - makes attrs that have to be boolean boolean (they come as ints) and stuff
  * @param {array} patients - Array of patients as it comes from the db
  * @return {array} - List of patients compliant with the data model
  */
  static preparePatientList (patients) {
    let ret_val = []

    for (let i = 0; i < patients.length; i++) {
      let patient = new Patient(patients[i])
      patient.surgeon = Patient.extractSurgeon(patients[i])
      ret_val.push(patient)
    }

    return ret_val
  }

  /**
  * Makes a patient class instance from a set of database data
  * @constructor
  * @param {object} db_object - Data recovered from the database
  */
  constructor (db_object) {
    super()

    if (db_object == null) {
      this.id = ''
      this.name = ''
      this.last = ''
      this.birthdate = null
      this.first = null
      this.date_of_death = null
      this.last_op_date = null
      this.last_op_done = false
      this.background = null
    } else {
      this.id = db_object.id
      this.name = db_object.name
      this.last = db_object.last
      this.birthdate = new Date(db_object.birthdate)
      this.first = new Date(db_object.first)
      this.date_of_death = db_object.date_of_death != null ? new Date(db_object.date_of_death) : null
      this.last_op_date = db_object.last_op_date != null ? new Date(db_object.last_op_date) : null
      this.last_op_done = db_object.last_op_done === 1 ? true : false
      this.background = db_object.background
    }

    this.surgeon = null
  }

  /**
  * Function that returns the patient's age without storing it per se
  */
  get age () {
    return datediff('yyyy', this.birthdate, new Date())
  }

  /**
  * Function that returns a boolean indicating whether the patient died
  */
  get is_dead () {
    return this.date_of_death != null ? true : false
  }

  /**
  * Returns a json object compliant with the database structure
  */
  get jsonForDatabase () {
    return {
      id: this.id,
      name: this.name,
      last: this.last,
      birthdate: this.birthdate.getFullYear() + '-' + (this.birthdate.getMonth() + 1) + '-' + this.birthdate.getDate(),
      first: this.first.getFullYear() + '-' + (this.first.getMonth() + 1) + '-' + this.first.getDate(),
      background: this.background,
      surgeon_id: this.surgeon.id
    }
  }
}
