/**
* Controls the main login form
*/
myApp.controller('loginCtrl', function ($scope, $timeout, $cookies, $mdDialog, socket, forge, windowCtrl) {
  $scope.cardContentClass = '' // The class applied to the regular content of the form - input fields and stuff
  $scope.cardLoadingClass = '' // The class applied to the loading animation

  // Object that stores the input field contents
  $scope.input = {
    email: undefined,
    pass: undefined
  }

  /**
  * Window control - close
  */
  $scope.closeClick = function () {
    windowCtrl.close()
  }

  /**
  * Login button click
  */
  $scope.loginClick = function () {
    if ($scope.input.email === undefined || $scope.input.email === null) return

    socket.emit('request user salt', $scope.input.email)
  }

  socket.on('salty response', function (salt) {
    if (salt === null) { // If salt is found and comes back from the db
      showErrorAlert() // Tell the user they made a mistake
      return
    }

    // Make an object with user data - no pass yet
    let user = {
      email: $scope.input.email,
      pass: null
    }

    if ($scope.input.pass !== undefined && $scope.input.pass !== null) { // If the pass is defined
      if ($scope.input.pass.length > 0) { // If the pass was inputted indeed
        user.pass = forge.hmac($scope.input.pass, salt) // Encrypt it and add it to the user object
      }
    }

    socket.emit('request login', user) // Log the user in...
  })

  socket.on('login response', function (user) {
    if (user !== undefined && user !== null) { // If a user comes back from the db
      $cookies.putObject('logged user', user, null) // Store the logged in user in cookies

      // Animate the screen as if something was loading
      $scope.cardContentClass = 'animated fadeOutUp'
      $scope.loading = true
      $scope.cardLoadingClass = 'animated fadeInUp'

      $timeout(function () {
        windowCtrl.login() // Open the main window
      }, 1000)
    } else {
      showErrorAlert() // Tell the user they made a mistake
    }
  })

  /**
  * Alert dialog telling the user they made a mistake when logging in
  */
  let showErrorAlert = function () {
    $mdDialog.show(
      $mdDialog.alert()
        .parent(angular.element(document.body))
        .clickOutsideToClose(true)
        .title('Error')
        .textContent('Email o contraseña incorrectos')
        .ariaLabel('Credenciales incorrectas')
        .ok('OK')
    )
  }
})

/**
* Controls the form to request recovery code
*/
myApp.controller('recoCtrl', function ($scope, $timeout, $window, $cookies, socket, windowCtrl) {
  $scope.cardContentClass = '' // The class applied to the regular content of the form - input fields and stuff
  $scope.cardLoadingClass = '' // The class applied to the loading animation

  /**
  * Window control - close
  */
  $scope.closeClick = function () {
    windowCtrl.close()
  }

  /**
  * Request recovery code click - sends an email to you with a code to recover your account
  */
  $scope.requestClick = function () {
    if ($scope.username === undefined || $scope.username === null) return

    $cookies.put('user to recover', $scope.username) // Store the email of the user to recover in cookies

    socket.emit('request recovery code', {email: $scope.username}) // Request the code
  }

  socket.on('code ready', function () {
    // Animate window closing
    $scope.cardContentClass = 'animated fadeOutUp'
    $scope.loading = true
    $scope.cardLoadingClass = 'animated fadeInUp'

    $timeout(function () {
      $window.location.href = 'reset.html'
    }, 1000)
  })
})

/**
* Controls the reset form
*/
myApp.controller('resetCtrl', function ($scope, $timeout, $window, $cookies, forge, socket, windowCtrl) {
  let user // Will contain the user to recover

  $scope.showHints = true
  $scope.entropy = 0 // Strength of the password
  $scope.entropyLevelClass = 'md-warn' // Class that determines the color of the progress bar that shows the entropy of the password
  $scope.cardContentClass = '' // The class applied to the regular content of the form - input fields and stuff
  $scope.cardLoadingClass = '' // The class applied to the loading animation

  // Object containing user input
  $scope.input = {
    code: null,
    passOne: null,
    passTwo: null
  }

  /**
  * Window control - close
  */
  $scope.closeClick = function () {
    windowCtrl.close()
  }

  /**
  * Get the user to recover from the database
  */
  socket.emit('request user for recovery', $cookies.get('user to recover'))
  socket.on('recovery user', function (res) {
    user = res // Leve the complete user object in memory
  })

  /**
  * Save changes
  */
  $scope.saveClick = function () {
    if (($scope.input.code === null || $scope.input.passOne === null || $scope.input.passTwo === null) || $scope.input.passOne !== $scope.input.passTwo) return

    if ($scope.input.code === user.recovery_code) { // If the code is right
      socket.emit('change user pass', {user: user.id, pass: forge.hmac($scope.input.passOne, user.salt)}) // Change pass
    } else {
      return
    }

    // Animate window close
    $scope.cardContentClass = 'animated fadeOutUp'
    $scope.loading = true
    $scope.cardLoadingClass = 'animated fadeInUp'

    $timeout(function () {
      $window.location.href = 'login.html'
    }, 1000)
  }

  // Depending on whether an error message is being shown determine whether the hints should be shown
  $scope.$watch('resetForm.code.$viewValue', function() {
    if (($scope.resetForm.code.$error.required || $scope.resetForm.code.$error.pattern) && !$scope.resetForm.code.$pristine) {
      if ($scope.showHints)
        $scope.showHints = false
    }
  }, true)

  /**
  * Update entropy as user updates their pass
  */
  $scope.$watch('input.passOne', function () {
    $scope.entropy = entropy($scope.input.passOne)
  }, true)

  /**
  * Change progress bar color according to the entropy level of the password
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

})
