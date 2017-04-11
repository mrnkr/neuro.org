const app       =     require('express')()
const http      =     require('http').Server(app)
const io        =     require('socket.io')(http)
const ping      =     require('ping')
const mailer    =     require('nodemailer')
const fs        =     require('fs')
const vigenere  =     require('../libs/vigenere.js')

const db        =     require('./dbconnect.js')

let lastLoggedUser

io.on('connection', function (socket) {
  //console.log('A user connected')
  socket.removeAllListeners() // This should not allow the program to create listeners every time the site gets reloaded

  /**
  * Controls that the db is up
  */
  let jsonServerInfo = fs.readFileSync(process.resourcesPath + '/data/server-info.json', {encoding: 'utf8'})
  let serverInfo = JSON.parse(jsonServerInfo)

  let previousState = true
  setInterval(function() {
    ping.sys.probe(serverInfo.host, function (isAlive) {
      if (!isAlive && previousState != isAlive) socket.emit('server is dead')
      previousState = isAlive
    })
  }, 5000)

  // Users

  socket.on('request login', function (user) {
    db.login(user, function (res) {
      lastLoggedUser = res[0]
      socket.emit('login response', res[0])
    })
  })

  socket.on('request user salt', function (user) {
    db.getSalt(user, function (res) {
      try {
        socket.emit('salty response', res[0].salt)
      } catch (err) {
        socket.emit('salty response', null)
      }
    })
  })

  socket.on('new user', function (user) {
    db.registerUser(user)
  })

  socket.on('change user email', function (data) {
    db.changeUserEmail(data)
  })

  socket.on('change user pass', function (data) {
    db.changeUserPass(data.user, data.pass)
  })

  socket.on('request user list', function () {
    db.getUserList(function (res) {
      socket.emit('user list', res)
    })
  })

  socket.on('request surgeon list', function () {
    db.getSurgeonList(function (res) {
      socket.emit('surgeon list', res)
    })
  })

  socket.on('request anesthetist list', function () {
    db.getAnesthetistList(function (res) {
      socket.emit('anesthetist list', res)
    })
  })

  socket.on('request doctor', function (doctor) {
    db.getDoctor(doctor, function (res) {
      socket.emit('doctor', res)
    })
  })

  socket.on('request ids', function () {
    db.getIds(function (res) {
      socket.emit('user ids', res)
    })
  })

  socket.on('reactivate user', function (user) {
    db.reactivateUser(user)
  })

  socket.on('deactivate user', function (user) {
    db.deactivateUser(user)
  })

  socket.on('remove user', function (user) {
    db.removeUser(user)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha eliminado el usuario de ID: ' + user.id + ' Nombre: ' + user.last + ', ' + user.name
    log(msg)
  })

  // End users

  // Patients

  socket.on('new patient', function (patient) {
    db.registerPatient(patient)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha ingresado el paciente de CI: ' + patient.id + ' Nombre: ' + patient.last + ', ' + patient.name
    log(msg)
  })

  socket.on('update patient', function (patient) {
    db.updatePatient(patient)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha actualizado el paciente de CI: ' + patient.id + ' Nombre: ' + patient.last + ', ' + patient.name
    log(msg)
  })

  socket.on('remove patient', function (patient) {
    db.removePatient(patient)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha eliminado el paciente de CI: ' + patient.id + ' Nombre: ' + patient.last + ', ' + patient.name
    log(msg)
  })

  socket.on('request patient list', function () {
    db.getPatientList(function (res) {
      socket.emit('patient list', res)
    })
  })

  // End patients

  // Surgeries

  socket.on('new surgery', function (surgery) {
    db.registerSurgery(surgery)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha registrado una cirugia al paciente de CI: ' + surgery.patient_id + ' con ID: ' + surgery.id
    log(msg)
  })

  socket.on('update surgery', function (surgery) {
    db.updateSurgery(surgery)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha actualizado una cirugia al paciente de CI: ' + surgery.patient_id + ' con ID: ' + surgery.id
    log(msg)
  })

  socket.on('remove surgery', function (surgery) {
    db.removeSurgery(surgery)

    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha eliminado una cirugia al paciente de CI: ' + surgery.patient_id + ' con ID: ' + surgery.id
    log(msg)
  })

  socket.on('request surgery list', function (patient) {
    db.getSurgeryList(patient, function (res) {
      socket.emit('surgery list', res)
    })
  })

  socket.on('request surgery ids', function () {
    db.getSurgeryIds(function (res) {
      socket.emit('surgery ids', res)
    })
  })

  socket.on('request surgery type list', function () {
    db.getSurgeryTypes(function (res) {
      let retVal = []

      for (let i = 0; i < res.length; i++) {
        retVal.push(res[i].type)
      }

      socket.emit('surgery type list', retVal)
    })
  })

  socket.on('request pathology list', function () {
    db.getPathologies(function (res) {
      let retVal = []

      for (let i = 0; i < res.length; i++) {
        retVal.push(res[i].pathology)
      }

      socket.emit('pathology list', retVal)
    })
  })

  // End surgeries

  // Comments

  socket.on('new comment', function (comment) {
    db.registerComment(comment, function (res) {
      let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha comentado en la cirugia de ID: ' + comment.surgery_id + ' Comentario con ID: ' + res.insertId
      log(msg)

      socket.emit('new comment id', res)
    })
  })

  socket.on('remove comment', function (comment) {
    let msg = lastLoggedUser.id + ' | ' + lastLoggedUser.last + ', ' + lastLoggedUser.name + ' | ' + 'Ha eliminado el comentario de ID: ' + comment.id + ' de la cirugia con ID: ' + comment.surgery_id
    log(msg)

    db.removeComment(comment)
  })

  socket.on('request comments', function (surgery) {
    db.getComments(surgery, function (res) {
      socket.emit('comments', res)
    })
  })

  // End comments

  // Statistics

  socket.on('request workload data', function () {
    db.getWorkload(function (res) {
      socket.emit('workload data', res)
    })
  })

  socket.on('request success rate', function () {
    db.getSuccess(function (res) {
      socket.emit('success rate', res)
    })
  })

  socket.on('request pathology data', function () {
    db.getPathologyData(function (res) {
      socket.emit('pathology data', res)
    })
  })

  // End Statistics

  // Recovery

  socket.on('request recovery code', function (user) {
    /**
    * User has to be an object with at least the user email
    */

    db.getSalt(user.email, function (res) {
      if (res[0].salt !== null) { // User exists
        let code = Math.floor(Math.random()*89999+10000)

        sendCode(user.email, code)
        db.setRecoveryCode(user, code)
        socket.emit('code ready')
      }
    })
  })

  socket.on('request user for recovery', function (user) {
    db.getUserRecovery(user, function (res) {
      socket.emit('recovery user', res)
    })
  })

})

http.listen(3000, function() {
  console.log('Listening on port 3000')
})

let log = function (msg) {
  if (!fs.existsSync('log.txt'))
    fs.writeFile('log.txt', 'Logs del sistema\n', {flag: 'wx'}, function (err) {
      if (err)
        console.log(err)
      else
        console.log('iupi!')
    })

  fs.appendFile('log.txt', msg + '\n', function (err) {
    if (err)
      console.log(err)
    else
      console.log(msg)
  })
}

/**
* Mail code
*/

let jsonAuthInfo = fs.readFileSync(process.resourcesPath + '/data/auth-info.json', {encoding: 'utf8'})
let authInfoNkrypted = JSON.parse(jsonAuthInfo)

// create reusable transporter object using the default SMTP transport
let transporter = mailer.createTransport({
    service: vigenere(true, authInfoNkrypted.service, 'gzT9pXAM7M'),
    auth: {
        user: vigenere(true, authInfoNkrypted.user, 'B60zIiX3ZC'),
        pass: vigenere(true, authInfoNkrypted.pass, 'RKy9eE8qnf')
    }
})

let sendCode = function (mail, code) {
  // setup email data with unicode symbols
  let mailOptions = {
      from: '"Servicio Neuro Maciel" <neuro@maciel.com>', // sender address
      to: mail, // list of receivers
      subject: 'Recuperacion de cuenta', // Subject line
      text: 'Su codigo de recuperacion es: ' + code, // plain text body
      html: '<p>Su codigo de recuperacion es: <span>' + code + '</span></p>' // html body
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          return console.log(error);
      }
      console.log('Message %s sent: %s', info.messageId, info.response);
  })
}
