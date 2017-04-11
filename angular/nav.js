myApp.controller('navCtrl', function ($scope, $window, $location, $mdDialog, $mdToast, $cookies, socket, windowCtrl) {
  $scope.user = $cookies.getObject('logged user')

  $scope.userMenu         =   'arrow_drop_down' // Icon name - determines whether the arrow to show next to user name points up or down
  $scope.menuExpanded     =   false // Whether the menu to show is the actual nav or the user options instead

  /**
  * Change nav state - toggle between user menu and regular nav
  */
  $scope.toggleUserMenu   =   function () {
    if ($scope.userMenu === 'arrow_drop_down') {
      $scope.userMenu = 'arrow_drop_up'
      $scope.menuExpanded = true
    } else {
      $scope.userMenu = 'arrow_drop_down'
      $scope.menuExpanded = false
    }
  }

  /**
  * Depending on the mail var it shows dialogs for users to change their mails or passwords
  * @param {event} ev - Event that triggered the execution
  * @param {boolean} mail - If true the user is changing their mail - else they change their pass
  */
  $scope.editUser = function (ev, mail) {
    if (mail) {
      $mdDialog.show({
        controller: changeMailDialogCtrl,
        templateUrl: 'dialogs/user-edit.html',
        parent: angular.element(document.body),
        targetEvent: ev,
        clickOutsideToClose:true,
        fullscreen: true
      }).then(function (answer) {
        var toast = $mdToast.simple()
          .textContent('Has cambiado tu email a ' + answer)
          .action('DESHACER')
          .highlightAction(true)
          .position('bottom right')

        $mdToast.show(toast).then(function(response) {
          if ( response !== 'ok' ) {
            $scope.user.email = answer
            $cookies.putObject('logged user', $scope.user, null)

            socket.emit('change user email', {id: $cookies.getObject('logged user').id, email: answer})
          }
        })
      })
    } else {
      $mdDialog.show({
        controller: changePassDialogCtrl,
        templateUrl: 'dialogs/user-edit.html',
        parent: angular.element(document.body),
        targetEvent: ev,
        clickOutsideToClose:true,
        fullscreen: true
      }).then(function (answer) {
        var toast = $mdToast.simple()
          .textContent('Has cambiado tu contraseña')
          .action('DESHACER')
          .highlightAction(true)
          .position('bottom right')

        $mdToast.show(toast).then(function(response) {
          if ( response !== 'ok' ) {
            socket.emit('change user pass', answer)
          }
        })
      })
    }
  }

  /**
  * Logs the current user out and takes them back to the login screen
  * @param {event} ev - Event that triggered the execution
  */
  $scope.logOut = function (ev) {
    let confirm = $mdDialog.confirm()
          .title('¿Seguro que desea cerrar sesión?')
          .textContent('Retornará a la pantalla de inicio de sesión')
          .ariaLabel('Logout')
          .targetEvent(ev)
          .ok('OK')
          .cancel('Cancelar')

    $mdDialog.show(confirm).then(function() {
      windowCtrl.logout()
    })
  }
})

let changeMailDialogCtrl = function ($scope, $mdDialog) {
  $scope.email = true

  // Object containing all user input
  $scope.input = {
    mail: ''
  }

  /**
  * Save changes
  */
  $scope.saveClick = function () {
    if ($scope.input.mail.length === 0) return

    $mdDialog.hide($scope.input.mail) // Hide the dialog and return new email - will send it to the server from the main controller
  }

  /**
  * Cancel without saving
  */
  $scope.cancelClick = function () {
    $mdDialog.cancel()
  }
}

let changePassDialogCtrl = function ($scope, $mdDialog, $cookies, socket, forge) {
  let salt
  $scope.email = false

  socket.emit('request user salt', $cookies.getObject('logged user').email)
  socket.on('salty response', function (res) {
    salt = res // Saves the user salt in RAM
  })

  // Object that contains all user input
  $scope.input = {
    oldPass: '',
    passOne: '',
    passTwo: ''
  }

  /**
  * Save changes
  */
  $scope.saveClick = function () {
    // Make an object with current user data
    let user = {
      email: $cookies.getObject('logged user').email,
      pass: null
    }

    if ($scope.input.oldPass.length > 0) // If the user inputted a pass in the old pass field - encrypt it and add it to suck object
      user.pass = forge.hmac($scope.input.oldPass, salt)

    socket.emit('request login', user) // Try to log the user in
  }

  socket.on('login response', function (res) {
    if (res !== undefined && res !== null) { // If the login attempt succeeded
      let newPassEncrypted = forge.hmac($scope.input.passOne, salt) // Encrypt the new pass

      // Make a new object with new user data - using id instead of email
      let data = {
        user: $cookies.getObject('logged user').id,
        pass: newPassEncrypted
      }

      $mdDialog.hide(data) // Hide the dialog and return the new data - will be sent to the db from the nav controller
    }
  })

  $scope.entropy = 0 // Password strength level

  /**
  * Update entropy level as user inputs their pass
  */
  $scope.$watch('input.passOne', function () {
    $scope.entropy = entropy($scope.input.passOne)
  }, true)

  $scope.entropyLevelClass = 'md-warn' // Class that determines the color of the progress bar that depicts the pass strength

  /**
  * Change progress bar color according to entropy level
  */
  $scope.$watch('entropy', function () {
    if ($scope.entropy <= 35) {
      $scope.entropyLevelClass = 'md-warn'
    } else if ($scope.entropy > 35 && $scope.entropy < 75) {
      $scope.entropyLevelClass = ''
    } else {
      $scope.entropyLevelClass = 'md-accent'
    }
  })

  /**
  * Cancel without saving
  */
  $scope.cancelClick = function () {
    $mdDialog.cancel()
  }
}
