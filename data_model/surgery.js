/**
* Surgery class
* @class
*/
let Surgery = class Surgery extends Base {
  /**
  * Creates an independent instance of the Surgery class
  * @param {Surgery} item - Object to copy
  * @return {Surgery} - Independent instance
  */
  static copy (item) {
    if (item == null) return null

    let ret_val = new Surgery()

    ret_val.id = item.id
    ret_val.scheduled = item.scheduled != null ? new Date(item.scheduled) : null
    ret_val.type = item.type
    ret_val.pathology = item.pathology
    ret_val.preop_valid = item.preop_valid != null ? new Date(item.preop_valid) : null
    ret_val.meds_to_drop = prepareMedsToDrop(item.meds_to_drop)
    ret_val.gos = item.gos
    ret_val.cod = item.cod
    ret_val.done = item.done
    ret_val.patient = Patient.copy(item.patient)
    ret_val.surgeon = User.copy(item.surgeon)
    ret_val.anesthetist = User.copy(item.anesthetist)

    return ret_val
  }

  /**
  * Extracts the parameters corresponding to the surgeon in the object as it comes from the db query
  * @param {object} item - Surgery object as it came from the database
  * @return {User} - The data model compliant surgeon
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
  * Extracts the parameters corresponding to the patient in the object as it comes from the db query
  * @param {object} item - Surgery object as it came from the database
  * @return {Patient} - The data model compliant patient
  */
  static extractPatient (item) {
    let ret_val = new Patient({
      id: item.patient_id,
      name: item.patient_name,
      last: item.patient_last,
      birthdate: new Date(item.patient_birthdate),
      first: new Date(item.patient_first),
      date_of_death: item.patient_date_of_death != null ? new Date(item.patient_date_of_death) : null,
      last_op_date: item.patient_last_op_date != null ? new Date(item.patient_last_op_date) : null,
      last_op_done: item.patient_last_op_done === 1 ? true : false,
      background: item.patient_background
    })

    ret_val.surgeon = Surgery.extractPatientSurgeon(item)

    return ret_val
  }

  /**
  * Extracts the parameters corresponding to the patient's surgeon in the object as it comes from the db query
  * @param {object} item - Surgery object as it came from the database
  * @return {User} - The data model compliant patient's surgeon
  */
  static extractPatientSurgeon (item) {
    return new User({
      id: item.patient_srg_id,
      name: item.patient_srg_name,
      last: item.patient_srg_last,
      email: item.patient_srg_email,
      type: item.patient_srg_type,
      admin: item.patient_srg_admin,
      active: item.patient_srg_active
    })
  }

  /**
  * Extracts the parameters corresponding to the anesthetist in the object as it comes from the db query
  * @param {object} item - Surgery as it came from the database
  * @return {User} - The anesthetist who validated the surgery
  */
  static extractAnesthetist (item) {
    if (item.anesthetist_id == null) return null

    return new User({
      id: item.anesthetist_id,
      name: item.anesthetist_name,
      last: item.anesthetist_last,
      email: item.anesthetist_email,
      type: item.anesthetist_type,
      admin: item.anesthetist_admin === 1 ? true : false,
      active: item.anesthetist_active === 1 ? true : false
    })
  }
  /**
  * Fixes surgery objects coming back from the db - makes attrs that have to be boolean boolean (they come as ints) and stuff
  * @param {array} surgeries - Array of surgeries as it comes from the db
  * @param {string} msg - Variable to store error messages at - Error messages are like when a surgery is scheduled to be performed on a corpse... (nullable)
  * @param {object} socket - socket.io factory reference
  * @return {array} - List of surgeries adapted to the data model
  */
  static prepareSurgeryList (surgeries, msg, socket) {
    let ret_val = []

    for (let i = 0; i < surgeries.length; i++) {
      let surgery = new Surgery(surgeries[i])
      surgery.patient = Surgery.extractPatient(surgeries[i])
      surgery.surgeon = Surgery.extractSurgeon(surgeries[i])
      surgery.anesthetist = Surgery.extractAnesthetist(surgeries[i])

      if (surgery.is_surgery_valid) {
        ret_val.push(surgery)
      } else {
        if (msg != null) {
          msg.text += 'Se eliminaron cirugias a ' + surgery.patient.last + ', ' + surgery.patient.name + ' que estaban agendadas para luego de su muerte\n'
          socket.emit('remove surgery', surgery.jsonForDatabase)
        }
      }
    }

    return ret_val
  }

  /**
  * Builds a new instance of the surgery class - previously recovered data
  * @constructor
  * @param {object} db_object - json object as it came from the db
  */
  constructor (db_object) {
    super()

    if (db_object == null) {
      this.id = ''
      this.scheduled = null
      this.type = ''
      this.pathology = ''
      this.preop_valid = null
      this.meds_to_drop = []
      this.gos = null
      this.cod = null
      this.done = false
    } else {
      this.id = db_object.id
      this.scheduled = db_object.scheduled != null ? new Date(db_object.scheduled) : null
      this.type = db_object.type
      this.pathology = db_object.pathology
      this.preop_valid = db_object.preop_valid != null ? new Date(db_object.preop_valid) : null
      this.meds_to_drop = prepareMedsToDrop(db_object.meds_to_drop)
      this.gos = db_object.gos
      this.cod = determineCod(db_object.cod)
      this.done = db_object.done === 1 ? true : false
    }

    this.patient = null
    this.surgeon = null
    this.anesthetist = null
  }

  /**
  * @return {boolean} - Whether the surgery is late (three months past preop_valid or the dat >= today)
  */
  get alert () {
    if (!this.done) {
      if (this.scheduled !== null) {
        if (datediff('h', this.scheduled, new Date()) > 0) return true
      } else {
        if (datediff('m', this.preop_valid, new Date()) >= 3) return true
      }
    }

    return false
  }

  /**
  * @return {boolean} - Whether the surgery is registered to a living patient...
  */
  get is_surgery_valid () {
    if (this.scheduled !== null && this.patient.date_of_death !== null) {
      if (datediff('d', this.scheduled, this.patient.date_of_death) < 0) return false
    }

    return true
  }

  /**
  * Will determine whether the surgery needs its date to be changed and will return an error message
  * @return {object} - The object containing the error details and suggested response
  */
  get error () {
    let ret_val = {
      date_needed: false,
      msg: ''
    }

    if (this.scheduled == null) {
      ret_val.date_needed = true
      ret_val.msg += 'No hay fecha para la cirugía - '
    } else if (datediff('h', this.scheduled, new Date()) < 0) {
      ret_val.date_needed = true
      ret_val.msg += 'La cirugía está programada para una fecha futura - '
    }

    if (this.anesthetist == null)
      ret_val.msg += 'Ningún anestesista validó la cirugía'

    return ret_val
  }

  /**
  * @return {object} - json object compliant with the db structure
  */
  get jsonForDatabase () {
    return {
      id: this.id,
      scheduled: this.scheduled === null ? null : this.scheduled.getFullYear() + '-' + (this.scheduled.getMonth() + 1) + '-' + this.scheduled.getDate(),
      type: this.type,
      pathology: this.pathology,
      preop_valid: this.preop_valid === null ? null : this.preop_valid.getFullYear() + '-' + (this.preop_valid.getMonth() + 1) + '-' + this.preop_valid.getDate(),
      meds_to_drop: this.meds_to_drop.length > 0 ? this.meds_to_drop.toString() : null,
      gos: this.gos,
      cod: this.cod,
      done: this.done,
      patient_id: this.patient.id,
      surgeon_id: this.surgeon.id,
      anesthetist_id: this.anesthetist != null ? this.anesthetist.id : null
    }
  }
}

/**
* Changes the input to a valid meds_to_drop in the model - makes an array with all the meds
* @param {array|string} meds_to_drop - The information as it was
* @return {array} - A string array with all the meds
*/
let prepareMedsToDrop = function (meds_to_drop) {
  if (typeof meds_to_drop === 'string') {
    return meds_to_drop.split(',')
  } else {
    let ret_val = []
    try {
      for (let med of meds_to_drop) {
        ret_val.push(med)
      }
    } catch (e) {
    }

    return ret_val
  }
}

/**
* Returns the cause of death as it should be stored (null if alive, true if neurological cod, false if non neurological cod)
* @param {int} cod - Object as it was coming from the database
* @return {boolean} - cod as the data model expects it
*/
let determineCod = function (cod) {
  if (cod == null)
    return null
  else
    return cod === 1 ? true : false
}
