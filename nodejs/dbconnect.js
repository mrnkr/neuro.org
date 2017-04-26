const mysql     =     require('mysql')
const forge     =     require('node-forge')
const fs        =     require('fs')
const vigenere  =     require('../libs/vigenere.js')

/* Make MySQL Connection Pool */

let jsonServerInfo = fs.readFileSync(process.resourcesPath + '/data/server-info.json', {encoding: 'utf8'})
let serverInfo = JSON.parse(jsonServerInfo)

let pool    =    mysql.createPool({
  host              :   serverInfo.host,
  user              :   vigenere(true, serverInfo.user, 'yU1dz63BcQ'),
  password          :   vigenere(true, serverInfo.password, 'JPEBAT0Qt3'),
  database          :   'neuro',
  dateStrings       :   false,
  debug             :   false
})

/*let pool    =    mysql.createPool({
  host              :   '192.168.56.101',
  user              :   'mrnkr',
  password          :   'patata2',
  database          :   'neuro',
  dateStrings       :   false,
  debug             :   false
})*/

let runQuery = function (query, args, callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.log(err)
            console.log('fuck the pool')
            if (callback !== undefined && callback !== null)
              callback(null)
            return
        }

        connection.query(query, args, function(err, rows) {
            if (!err)
              if (callback !== undefined && callback !== null)
                callback(rows)
        })

        connection.on('error', function(err) {
            console.log(err)
            if (callback !== undefined && callback !== null)
              callback(null)
            return
        })

        connection.release()
    })
}

module.exports = {
  // Users
  registerUser: function (user) {
    /**
    * User has to come ONLY with the following structure:
    * {id, name, last, email, type, admin}
    * Type HAS to be either 'surgeon' or 'anesthetist'
    */

    let query = 'insert into user set ?'
    let args = {
      id: user.id,
      name: user.name,
      last: user.last,
      email: user.email,
      salt: forge.util.bytesToHex(forge.random.getBytesSync(32))
    }
    runQuery(query, args, function () {
      let query = 'insert into ' + user.type + ' set ?'
      let args = {id: user.id}
      if (user.admin)
        args.admin = true
      runQuery(query, args)
    })
  },
  changeUserPass: function (user, pass) {
    /**
    * User HAS to come only with its id
    * PASS HAS TO COME ENCRYPTED
    */

    let query = 'update user set ? where ?'
    let args = [
      {pass: pass},
      {id: user}
    ]
    runQuery(query, args)
  },
  changeUserEmail: function (data) {
    /**
    * data has two properties: id and email
    */

    let query = 'update user set ? where ?'
    let args = [
      {email: data.email},
      {id: data.id}
    ]
    runQuery(query, args)
  },
  getSalt: function (user, callback) {
    /**
    * Pass ONLY email for user
    */

    let query = 'select salt from user where ?'
    let args = {email: user}
    runQuery(query, args, function (res) {
      callback(res)
    })
  },
  login: function (user, callback) {
    /**
    * user includes email & pass
    */

    let query = 'select id, name, last, email, ' +
                'if((select count(*) from surgeon as srg where srg.id=usr.id) > 0, "surgeon", "anesthetist") as type, ' +
                'ifnull((select admin from surgeon as srg where srg.id=usr.id), false) as admin from user as usr where active = true and email = ? and pass '

    if (user.pass === null)
      query = query.concat('is ?')
    else
      query = query.concat('= ?')

    let args = [user.email, user.pass]

    runQuery(query, args, function (res) {
      try {
        res[0].admin = res[0].admin === 1 ? true : false
      } catch (err) {
        console.log(err)
      }

      callback(res)
    })
  },
  getUserList: function (callback) {
    let query = 'select * from user_list'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },
  getSurgeonList: function (callback) {
    let query = 'select * from user_list as usr where (select count(*) from surgeon as srg where srg.id = usr.id) > 0'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },
  getAnesthetistList: function (callback) {
    let query = 'select usr.id, usr.name, usr.last from user as usr where (select count(*) from anesthetist as ans where ans.id = usr.id) > 0'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },
  getDoctor: function (doctor, callback) {
    /**
    * doctor has to be an object containing at least the id
    */

    try {
      let query = 'select id, name, last from user where id = ?'
      let args = [doctor.id]

      runQuery(query, args, function (res) {
        callback(res)
      })
    } catch (err) {
      console.log('Yeah, doctor.id does not exist, check it out...')
    }
  },
  getIds: function (callback) {
    let query = 'select id from user'

    runQuery(query, null, function (res) {
      for (let i = 0; i < res.length; i++) {
        res[i] = res[i].id
      }

      callback(res)
    })
  },
  reactivateUser: function (user) {
    /**
    * user has to be an object with at least the user id
    */

    let query = 'update user set active = true where id = ?'
    let args = [user.id]

    runQuery(query, args)
  },
  deactivateUser: function (user) {
    /**
    * user has to be an object with at least the user id
    */

    let query = 'update user set active = false where id = ?'
    let args = [user.id]

    runQuery(query, args)
  },
  removeUser: function (user) {
    /**
    * user includes at least id and type here
    */

    let query = 'delete from comment where user_id = ? or surgery_id in (select id from surgery where patient_id in (select id from patient where surgeon_id = ?) or surgeon_id = ? or anesthetist_id = ?)'
    let args = [user.id, user.id, user.id, user.id] // Sucks to do it this way, but it works :)

    runQuery(query, args, function () {
      query = 'delete from surgery where surgeon_id = ? or anesthetist_id = ? or patient_id in (select id from patient where surgeon_id = ?)'

      runQuery(query, args, function () {
        query = 'delete from patient where surgeon_id = ?'

        runQuery(query, args, function () {
          query = 'delete from ' + user.type + ' where id = ?'

          runQuery(query, args, function () {
            query = 'delete from user where id = ?'
            runQuery(query, args)
          })
        })
      })
    })
  },

  // Patients
  registerPatient: function (patient) {
    /**
    * patient HAS to come with all the database attributes
    * {id, name, last, birthdate, first, background, surgeon_id}
    */

    let query = 'insert into patient set ?'
    let args = {
      id: patient.id,
      name: patient.name,
      last: patient.last,
      birthdate: patient.birthdate,
      first: patient.first,
      background: patient.background,
      surgeon_id: patient.surgeon_id
    }

    runQuery(query, args)
  },
  updatePatient: function (patient) {
    /**
    * patient HAS to include at least all the database attributes
    */

    let query = 'update patient set ? where ?'
    let args = [
      {name: patient.name,
       last: patient.last,
       birthdate: patient.birthdate,
       first: patient.first,
       background: patient.background,
       surgeon_id: patient.surgeon_id},
       {id: patient.id}
    ]

    runQuery(query, args)
  },
  removePatient: function (patient) {
    /**
    * patient HAS to come as an object with the id as a property
    */

    let query = 'delete from comment where surgery_id in (select id from surgery where patient_id = ?)'
    let args = [patient.id]

    runQuery(query, args, function () {
      query = 'delete from surgery where patient_id = ?'

      runQuery(query, args, function () {
        query = 'delete from patient where id = ?'

        runQuery(query, args)
      })
    })
  },
  getPatientList: function (callback) {
    let query = 'select * from patient_list'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },

  // Surgeries
  registerSurgery: function (surgery) {
    /**
    * Surgery is to come at least with the following structure
    * {id, scheduled, type, pathology, preop_valid, meds_to_drop, gos, cod, patient_id, surgeon_id, anesthetist_id}
    */

    let query = 'insert into surgery set ?'
    let args = {
      id: surgery.id,
      scheduled: surgery.scheduled,
      type: surgery.type,
      pathology: surgery.pathology,
      preop_valid: surgery.preop_valid,
      meds_to_drop: surgery.meds_to_drop,
      gos: surgery.gos,
      cod: surgery.cod,
      done: surgery.done,
      patient_id: surgery.patient_id,
      surgeon_id: surgery.surgeon_id,
      anesthetist_id: surgery.anesthetist_id
    }

    runQuery(query, args)
  },
  updateSurgery: function (surgery) {
    /**
    * Surgery is to come at least with the following structure
    * {id, scheduled, type, pathology, preop_valid, meds_to_drop, gos, cod, patient_id, surgeon_id, anesthetist_id}
    */

    let query = 'update surgery set ? where ?'
    let args = [
      {
        scheduled: surgery.scheduled,
        type: surgery.type,
        pathology: surgery.pathology,
        preop_valid: surgery.preop_valid,
        meds_to_drop: surgery.meds_to_drop,
        gos: surgery.gos,
        cod: surgery.cod,
        done: surgery.done,
        patient_id: surgery.patient_id,
        surgeon_id: surgery.surgeon_id,
        anesthetist_id: surgery.anesthetist_id
      },
      {id: surgery.id}
    ]

    runQuery(query, args)
  },
  removeSurgery: function (surgery) {
    /**
    * surgery has to be an object with at least the id as an attribute
    */

    let query = 'delete from comment where surgery_id = ?'
    let args = [surgery.id]

    runQuery(query, args, function () {
      query = 'delete from surgery where id = ?'

      runQuery(query, args)
    })
  },
  getSurgeryList: function (patient, callback) {
    /**
    * patient is nullable and has to contain at least their id as an attribute
    * if not null then the list will only include the patient's surgeries
    * use following query to sort out those that already took place from those that havent
    * select scheduled from surgery where patient_id = '51157761' order by isnull(scheduled), scheduled limit 1
    */

    let query, args

    if (patient !== null) {
      query = 'select * from surgery_list where ?'
      args = {patient_id: patient.id}
    } else {
      query = 'select * from surgery_list'
    }

    runQuery(query, args, function (res) {
      callback(res)
    })
  },
  getSurgeryIds: function (callback) {
    let query = 'select id from surgery'

    runQuery(query, null, function (res) {
      for (let i = 0; i < res.length; i++) {
        res[i] = res[i].id
      }

      callback(res)
    })
  },
  getSurgeryTypes: function (callback) {
    let query = 'select distinct type from surgery order by type'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },
  getPathologies: function (callback) {
    let query = 'select distinct pathology from surgery order by pathology'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },

  // Comments
  registerComment: function (comment, callback) {
    /**
    * comment has to come with at least all the db attributes
    * {moment, content, surgery_id, user_id}
    * moment has to come as a string compatible with mysql date formatting
    * -----
    * callback has to be there because res will include the id of the comment
    * to get it use res.insertId
    */

    let query = 'insert into comment set ?'
    let args = {
      moment: comment.moment,
      content: comment.content,
      surgery_id: comment.surgery_id,
      user_id: comment.user_id
    }

    runQuery(query, args, function (res) {
      callback(res)
    })
  },
  removeComment: function (comment) {
    /**
    * comment has to be an object with AT LEAST id as an attribute
    */

    let query = 'delete from comment where id = ?'
    let args = [comment.id]

    runQuery(query, args)
  },
  getComments: function (surgery, callback) {
    /**
    * surgery has to be an object with AT LEAST surgery_id
    */

    let query = 'select * from comment_list where ?'
    let args = {surgery_id: surgery.id}

    runQuery(query, args, function (res) {
      callback(res)
    })
  },

  // Statistics
  getWorkload: function (callback) {
    let query = 'select month(scheduled) as month, count(*) as workload from surgery where done and scheduled between date_sub(curdate(), interval 6 month) and curdate() group by month'

    runQuery(query, null, function (res) {
      let retVal = [res]

      query = 'select month(scheduled) as month, count(*) as workload from surgery where done and scheduled between date_sub(date_sub(curdate(), interval 1 year), interval 6 month) and date_sub(curdate(), interval 1 year) group by month'

      runQuery(query, null, function (nextRes) {
        retVal.push(nextRes)
        callback(retVal)
      })
    })
  },
  getSuccess: function (callback) {
    let query = "select if(isnull(cod), 'Éxito', 'Fracaso') as title, count(*) as qty from surgery where done and scheduled between date_sub(curdate(), interval 6 month) and curdate() group by title"

    runQuery(query, null, function (res) {
      callback(res)
    })
  },
  getPathologyData: function (callback) {
    let query = 'select pathology, count(*) as qty from surgery where done and scheduled between date_sub(curdate(), interval 6 month) and curdate() group by pathology order by pathology'

    runQuery(query, null, function (res) {
      callback(res)
    })
  },

  // Recovery
  setRecoveryCode: function (user, code, callback) {
    /**
    * Encryption of the code is done here
    */

    let query = 'update user set ? where ?'
    let args = [{
      recovery_code: code
    }, {
      email: user.email
    }]

    runQuery(query, args)
  },
  getUserRecovery: function (user, callback) {
    /**
    * User has to be a string - user email
    */

    let query = 'select id, name, last, salt, recovery_code from user where ?'
    let args = {email: user}

    runQuery(query, args, function (res) {
      query = 'update user set recovery_code = null where ?'
      runQuery(query, args)

      callback(res[0])
    })
  }
}
