myApp.controller('patientDialogCtrl', function ($scope, $mdToast, $cookies, $timeout, socket, ipcRenderer) {
  let preEditionPatient = null // Used to store the patient object before editing so as to recover it in case changes are undone

  $scope.me = $cookies.getObject('logged user')
  $scope.answer = false // whether the dialog should return a value to the parent controller

  ipcRenderer.on('data-to-show', function (ev, data) {
    if (data == null) {
      $scope.patient = new Patient()
      $scope.editing = true // Define the initial editing state
    } else {
      $scope.patient = Patient.copy(data)
      $scope.editing = false // Define the initial editing state
    }

    $scope.canGoBackToNotEditing = !$scope.editing // Defines whether the user is already in te db, if it is clicking cancel will take you to the non editing dialog - else it will close itself
    prepare()
  })

  /**
  * Gets the necessary data from the database in order to complete the interface
  */
  let prepare = function () {
    // Get surgery list for the current patient
    if ($scope.patient.id !== '')
      socket.emit('request surgery list', $scope.patient)

    socket.on('surgery list', function (res) {
      $scope.surgeries = Surgery.prepareSurgeryList(res)
    })

    // Request list of surgeons to let the user choose one from the corresponding combo box
    socket.emit('request surgeon list')
    socket.on('surgeon list', function (res) {
      $scope.surgeons = User.prepareUserList(res)

      // The surgeon in the patient object is not recognized as equal to the one in the combobox - this is the workaround
      if ($scope.patient != null) {
        let index = $scope.surgeons.map(function(x) {return x.id}).indexOf($scope.patient.surgeon.id)
        $scope.patient.surgeon = $scope.surgeons[index]
      }
    })
  }

  /**
  * Checks that all mandatory fields have been completed
  */
  let isFormValid = function () {
    let valid = true
    try {
      if ($scope.patient.id.length === 0)
        valid = false

      if ($scope.patient.name.length === 0)
        valid = false

      if ($scope.patient.last.length === 0)
        valid = false

      if ($scope.patient.birthdate == null)
        valid = false

      if ($scope.patient.first == null)
        valid = false

      if ($scope.patient.surgeon == null)
        valid = false
    } catch (e) {
      valid = false
    }
    return valid
  }

  /**
  * Used to trigger a change of state in the dialog
  */
  $scope.editClick = function () {
    // Change the state of the dialog - defines the elements that are being shown
    $scope.editing = !$scope.editing

    // if the mode being triggered is editing then store the current state of the patient object
    if ($scope.editing)
      preEditionPatient = Patient.copy($scope.patient)
  }

  /**
  * Triggered when a surgery is clicked - shows a child dialog with surgery data
  * @param {object} item - Clicked surgery
  */
  $scope.surgeryClick = function (item) {
    let index = $scope.surgeries.indexOf(item)
    ipcRenderer.emit('open-modal', 1, item)
    ipcRenderer.on('send-data-to-daddy', function (ev, data) {
      if (index != -1) $scope.surgeries[index] = Surgery.copy(data)
    })
  }

  /**
  * Used to save changes to the database - saves instantly if the patient is new - else shows changes to the list but allows to undo it via the toast, saves to db when toast is gone
  */
  $scope.saveClick = function () {
    if (!isFormValid()) return

    if ($scope.canGoBackToNotEditing) { //Update patient
      var toast = $mdToast.simple()
        .textContent('Has editado a ' + $scope.patient.last + ', ' + $scope.patient.name)
        .action('DESHACER')
        .highlightAction(true)
        .position('bottom right')

      $mdToast.active = true

      $mdToast.show(toast).then(function(response) {
        if ( response === 'ok' ) {
          $scope.patient = Patient.copy(preEditionPatient)
        } else {
          socket.emit('update patient', $scope.patient.jsonForDatabase)

          $scope.answer = true
        }

        $mdToast.active = false
      })
    } else {
      socket.emit('new patient', $scope.patient.jsonForDatabase)

      $scope.answer = true
      $scope.canGoBackToNotEditing = !$scope.canGoBackToNotEditing
    }

    $scope.editClick()
  }

  /**
  * Cancel the dialog input - if it has data goes back to a non editing state - else closes the dialog
  */
  $scope.cancelClick = function() {
    if ($scope.canGoBackToNotEditing) {
      if (preEditionPatient !== null)
        $scope.patient = Patient.copy(preEditionPatient)

      $scope.editClick()
    } else {
      ipcRenderer.emit('close-modal')
    }
  }

  /**
  * Closes the dialog when not editng - if it is defined that it should return data then it so does
  */
  $scope.closeClick = function () {
    let delay = $mdToast.active ? 800 : 0
    $mdToast.hide()

    $timeout(function () {
      $scope.surgeries = []
      if ($scope.answer)
        ipcRenderer.emit('deliver-data-to-papa', $scope.patient)

      ipcRenderer.emit('close-modal')
    }, delay)
  }
})
