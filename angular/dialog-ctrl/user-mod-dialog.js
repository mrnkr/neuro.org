myApp.controller('userModDialogCtrl', function ($scope, $cookies, socket, forge, ipcRenderer) {
  ipcRenderer.on('data-to-show', function (ev, email) {
    if (email) {
      changeMailDialogCtrl($scope, ipcRenderer)
    } else {
      changePassDialogCtrl($scope, $cookies, socket, forge, ipcRenderer)
    }
  })
})

let changeMailDialogCtrl = function (scope, ipcRenderer) {
  scope.email = true

  // Object containing all user input
  scope.input = {
    mail: ''
  }

  /**
  * Save changes
  */
  scope.saveClick = function () {
    if (scope.input.mail.length === 0) return

    ipcRenderer.emit('deliver-data-to-papa', scope.input.mail)
    ipcRenderer.emit('close-modal') // Hide the dialog and return new email - will send it to the server from the main controller
  }

  /**
  * Cancel without saving
  */
  scope.cancelClick = function () {
    ipcRenderer.emit('close-modal')
  }
}

let changePassDialogCtrl = function (scope, cookies, socket, forge, ipcRenderer) {
  let salt
  scope.email = false

  socket.emit('request user salt', cookies.getObject('logged user').email)
  socket.on('salty response', function (res) {
    salt = res // Saves the user salt in RAM
  })

  // Object that contains all user input
  scope.input = {
    oldPass: '',
    passOne: '',
    passTwo: ''
  }

  /**
  * Save changes
  */
  scope.saveClick = function () {
    // Make an object with current user data
    let user = {
      email: cookies.getObject('logged user').email,
      pass: null
    }

    if (scope.input.oldPass.length > 0) // If the user inputted a pass in the old pass field - encrypt it and add it to suck object
      user.pass = forge.hmac(scope.input.oldPass, salt)

    socket.emit('request login', user) // Try to log the user in
  }

  socket.on('login response', function (res) {
    if (res !== undefined && res !== null) { // If the login attempt succeeded
      let newPassEncrypted = forge.hmac(scope.input.passOne, salt) // Encrypt the new pass

      // Make a new object with new user data - using id instead of email
      let data = {
        user: cookies.getObject('logged user').id,
        pass: newPassEncrypted
      }

      ipcRenderer.emit('deliver-data-to-papa', data)
      ipcRenderer.emit('close-modal')
    }
  })

  scope.entropy = 0 // Password strength level

  /**
  * Update entropy level as user inputs their pass
  */
  scope.$watch('input.passOne', function () {
    scope.entropy = entropy(scope.input.passOne)
  }, true)

  scope.entropyLevelClass = 'md-warn' // Class that determines the color of the progress bar that depicts the pass strength

  /**
  * Change progress bar color according to entropy level
  */
  scope.$watch('entropy', function () {
    if (scope.entropy <= 35) {
      scope.entropyLevelClass = 'md-warn'
    } else if (scope.entropy > 35 && scope.entropy < 75) {
      scope.entropyLevelClass = ''
    } else {
      scope.entropyLevelClass = 'md-accent'
    }
  })

  /**
  * Cancel without saving
  */
  scope.cancelClick = function () {
    ipcRenderer.emit('close-modal')
  }
}
