myApp.controller('newUserDialogCtrl', function ($scope, socket, ipcRenderer) {
  $scope.user = new User()

  /**
  * Checks that all mandatory fields have been completed
  */
  let isFormValid = function () {
    let valid = true
    try {
      if ($scope.user.name.length === 0)
        valid = false

      if ($scope.user.last.length === 0)
        valid = false

      if ($scope.user.email.length === 0)
        valid = false

      if ($scope.user.type.length === 0)
        valid = false
    } catch (e) {
      valid = false
    }
    return valid
  }

  /**
  * Save the new user
  */
  $scope.saveClick = function () {
    if (!isFormValid()) return

    $scope.user.id = Surgery.makeid(ids) // Creates an id to it and stores it in the user object
    if ($scope.user.type === 'anesthetist') // Make sure anesthetists don't get admin privileges
      $scope.user.admin = false

    socket.emit('new user', $scope.user.jsonForDatabase) // Send the object to the db to be stored

    ipcRenderer.emit('deliver-data-to-papa', $scope.user)
    ipcRenderer.emit('close-modal')
  }

  /**
  * Cancel without saving
  */
  $scope.cancelClick = function () {
    ipcRenderer.emit('close-modal')
  }

  /**
  * ID gen and validation
  */

  let ids = [] // To store all ids in use in the db

  socket.emit('request ids')
  socket.on('user ids', function (res) {
    ids = res // Load up the array with all those ids
  })
})
