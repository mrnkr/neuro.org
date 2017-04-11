myApp.directive('list', function () {
  return {
    restrict: 'E',
    scope: {
      content: '=content'
    },
    controller: listCtrl,
    templateUrl: 'list.html'
  }
})

let listCtrl =  function ($scope, $mdDialog, $mdToast, $timeout, $cookies, fabService, print, socket, dialogComm) {
  /**
  * Controller used for all lists
  */

  $scope.me = $cookies.getObject('logged user')

  let prepare = function () {
    fabService.setVisible(false)
    $scope.listKlass = 'main-list-start' // Changes after the list is first loaded so that the animations wont be the same

    /**
    * ctrl = Object used to control the search field
    */

    $scope.ctrl = {searchText: '',
                   searching: false,
                   toggleSearch: function () {
                     this.searching = !this.searching
                     this.searchText = ''
                   }}

    /**
    * Page setup
    */

    $scope.ttl = $scope.content.charAt(0).toUpperCase() + $scope.content.substring(1) // Set the title
    $scope.showHeaders = true // Not showing the headers will also hide the second list

    switch($scope.ttl) { // Depending on the title
      case 'Pacientes':
        /*
        * Try to get display options from cookies, else create new default options
        */

        $scope.options = $cookies.getObject('patient list options') !== undefined ? $cookies.getObject('patient list options') : {
          divideBy: 'operatedOrNot', // Allow mineOrNot
          orderBy: 'last', // Allow by age and by last operation date
          showDead: true
        }

        $scope.$watch('options.divideBy', function () {
          if ($scope.options.divideBy === 'operatedOrNot') {
            $scope.header1 = 'A operar'
            $scope.header2 = 'Operados'
          } else {
            $scope.header1 = 'Mis pacientes'
            $scope.header2 = 'Demás pacientes'
          }
        })

        $scope.$watch('patients.length', function () {
          // Determine if teh list is empty

          try {
            $scope.empty = $scope.patients.length === 0 ? true : false
          } catch (err) {
            console.log('not yet')
          }
        }, true)

        // Fab is to be shown to all surgeons
        if ($cookies.getObject('logged user').type === 'surgeon')
          fabService.setVisible(true)

        socket.emit('request patient list')
        break
      case 'Cirugías':
        $scope.header1 = 'A realizar'
        $scope.header2 = 'Realizadas'

        $scope.options = $cookies.getObject('surgery list options') !== undefined ? $cookies.getObject('surgery list options') : {
          divideBy: 'doneOrNot', // Also allow mineOrNot
          orderBy: '-scheduled', // Also allow pathology and type
          seeFrom: '6m', // First number is the period and the rest is the interval (for the datediff function) Allows empty string for beginning of time
          showUndone: true, // Allows to hide undone surgeries
          showDone: true // Allows to hide past surgeries
        }

        $scope.print = function (what) { // true for page, false for pdf
          if (what) {
            print.printToPage()
          } else {
            print.printToPdf()
          }
        }

        /**
        * Next two functions are to show or hide the list sections corresponding to their headers
        */

        $scope.toggleUnperformedSurgeryList = function () {
          $scope.options.showUndone = !$scope.options.showUndone
        }

        $scope.togglePerformedSurgeryList = function () {
          $scope.options.showDone = !$scope.options.showDone
        }

        $scope.$watch('options.divideBy', function () {
          switch ($scope.options.divideBy) {
            case 'doneOrNot':
              $scope.header1 = 'A realizar'
              $scope.header2 = 'Realizadas'
              break
            case 'mineOrNot':
              $scope.header1 = 'Mis cirugías'
              $scope.header2 = 'Demás cirugías'
              break
          }
        })
        $scope.$watch('surgeries.length', function () {
          try {
            $scope.empty = $scope.surgeries.length === 0 ? true : false
          } catch (err) {
            console.log('not yet')
          }
        }, true)

        // Fab is to be shown to all surgeons
        if ($cookies.getObject('logged user').type === 'surgeon')
          fabService.setVisible(true)

        socket.emit('request patient list')
        break
      case 'Usuarios':
        $scope.showHeaders = false

        //Fab is to be shown to admins only
        if ($scope.me.admin)
          fabService.setVisible(true)

        socket.emit('request user list')
        break
    }
  }

  $timeout(function () {
    /**
    * Prepare when ready
    */

    prepare()
  }, 200)

  /**
  * List dataset recovered from the database
  */

  socket.on('user list', function (res) {
    if ($scope.ttl === 'Usuarios') {
      $scope.ready = true

      $timeout(function () {
        $scope.users = res

        $timeout(function () {
          $scope.listKlass = 'main-list-ready'
        }, $scope.users.length * 350)
      }, 100)
    }
  })

  socket.on('patient list', function (res) {
    preparePatientList(res)

    if ($scope.ttl === 'Pacientes') {
      $scope.ready = true

      $timeout(function () {
        $scope.patients = res

        $timeout(function () {
          $scope.listKlass = 'main-list-ready'
        }, $scope.patients.length * 350)
      }, 100)
    } else if ($scope.ttl === 'Cirugías') {
      $scope.patients = res
      console.log('prior to surgery list request patients length is: ' + $scope.patients.length)
      socket.emit('request surgery list')
    }
  })

  socket.on('surgery list', function (res) {
    let msg = ''

    console.log('patients length is: ' + $scope.patients.length)
    prepareSurgeryList(res, $scope.patients, msg)

    if (msg.length > 0)
      $mdToast.show(
        $mdToast.simple()
          .textContent(msg)
          .position('bottom right')
      )

    $scope.ready = true

    $timeout(function () {
      $scope.surgeries = res

      $timeout(function () {
        $scope.listKlass = 'main-list-ready'
      }, $scope.surgeries.length * 350)
    }, 100)
  })

  /**
  * onClick event listeners
  */

  /**
  * Shows dialogs corresponding to the input or to add new data altogether
  * Used as a wrapper for the function that is not a part of the scope called the same
  * @param {event} ev - Event that triggered the execution
  * @param {boolean} newSignal - If true the dialog shows no data, only input fields
  * @param {object} item - The data to show in the dialog in case it is not a new one
  */
  $scope.showDialog = function (ev, newSignal, item) {
    if (newSignal) {
      dialogComm.sendNewSignal()
    } else {
      switch ($scope.ttl) {
        case 'Pacientes':
          dialogComm.sendObject(copyPatient(item))
          break
        case 'Cirugías':
          dialogComm.sendObject(copySurgery(item))
          break
      }
    }

    let index

    switch ($scope.ttl) {
      case 'Pacientes':
        index = $scope.patients.indexOf(item)
        break
      case 'Cirugías':
        index = $scope.surgeries.indexOf(item)
        break
    }

    showDialog(ev, $scope.ttl, index)
  }

  fabService.setOnClickListener($scope.showDialog)

  /**
  * Deactivates a user - Disalows it to log in in the future
  * @param {object} item - User to deactivate
  */
  $scope.deactivateClick = function (item) {
    item.active = !item.active
    let msg = item.active ? 'activado' : 'desactivado'

    var toast = $mdToast.simple()
      .textContent('Se ha ' + msg + ' a ' + item.last + ', ' + item.name)
      .action('DESHACER')
      .highlightAction(true)
      .position('bottom right')

    $mdToast.active = true

    $mdToast.show(toast).then(function(response) {
      if ( response === 'ok' ) {
        item.active = !item.active
      } else {
        if (item.active)
          socket.emit('reactivate user', item)
        else
          socket.emit('deactivate user', item)
      }

      $mdToast.active = false
    })
  }

  /**
  * Deletes the element it gets as a param
  * @param {object} item - Object to delete from the database - can be a user, a surgery or a patient
  */
  $scope.deleteClick = function (item) {
    let index

    switch($scope.ttl) {
      case 'Pacientes':
        index = $scope.patients.indexOf(item)
        let patient = $scope.patients[index]
        $scope.patients.splice(index, 1)

        var toast = $mdToast.simple()
          .textContent('Se ha eliminado a ' + patient.last + ', ' + patient.name)
          .action('DESHACER')
          .highlightAction(true)
          .position('bottom right')

        $mdToast.active = true

        $mdToast.show(toast).then(function(response) {
          if ( response === 'ok' ) {
            $scope.patients.splice(index, 0, patient)
          } else {
            socket.emit('remove patient', patient)
          }

          $mdToast.active = false
        })
        break
      case 'Cirugías':
        index = $scope.surgeries.indexOf(item)
        let surgery = $scope.surgeries[index]
        $scope.surgeries.splice(index, 1)

        var toast = $mdToast.simple()
          .textContent('Se ha eliminado una cirugía a ' + surgery.patient.last + ', ' + surgery.patient.name)
          .action('DESHACER')
          .highlightAction(true)
          .position('bottom right')

        $mdToast.active = true

        $mdToast.show(toast).then(function(response) {
          if ( response === 'ok' ) {
            $scope.surgeries.splice(index, 0, surgery)
          } else {
            socket.emit('remove surgery', surgery)
          }

          $mdToast.active = false
        })
        break
      case 'Usuarios':
        index = $scope.users.indexOf(item)
        let user = $scope.users[index]
        $scope.users.splice(index, 1)

        var toast = $mdToast.simple()
          .textContent('Se ha eliminado a ' + user.name + ' ' + user.last)
          .action('DESHACER')
          .highlightAction(true)
          .position('bottom right')

        $mdToast.active = true

        $mdToast.show(toast).then(function(response) {
          if ( response === 'ok' ) {
            $scope.users.splice(index, 0, user)
          } else {
            socket.emit('remove user', user)
          }

          $mdToast.active = false
        })
        break
    }
  }

  /**
  * Function that does all the heavylifting when showing dialogs - not the one called from the scope
  * @param {event} ev - Event that triggered the execution
  * @param {string} which - Content of the ttl variable, section name in lowercase
  * @param {int} index - Index of the object in the array
  */
  let showDialog = function (ev, which, index) {
    switch (which) {
      case 'Pacientes':
        $mdDialog.show({
          controller: patientDialogCtrl,
          templateUrl: 'dialogs/patient.html',
          parent: angular.element(document.body),
          targetEvent: ev,
          clickOutsideToClose:false,
          fullscreen: true
        }).then(function (patient) {
          if ($scope.patients === undefined || $scope.patients === null) {
            $scope.patients = []
          }

          if (patient !== undefined && index !== -1) {
            patient.age = datediff('yyyy', patient.birthdate, new Date())
            patient.last_op_date = $scope.patients[index].last_op_date
            patient.date_of_death = $scope.patients[index].date_of_death
            $scope.patients[index] = patient
          } else if (patient !== undefined) {
            patient.last_op_date = null
            patient.age = datediff('yyyy', patient.birthdate, new Date())
            patient.date_of_death = null
            $scope.patients.push(patient)
          }
        })
        break
      case 'Cirugías':
        $mdDialog.show({
          controller: surgeryDialogCtrl,
          templateUrl: 'dialogs/surgery.html',
          parent: angular.element(document.body),
          targetEvent: ev,
          clickOutsideToClose:false,
          fullscreen: true
        }).then(function (surgery) {
          if ($scope.surgeries === undefined || $scope.surgeries === null) {
            $scope.surgeries = []
          }

          if (surgery !== undefined && index !== -1) {
            $scope.surgeries[index] = surgery
          } else if (surgery !== undefined) {
            $scope.surgeries.push(surgery)
          }
        })
        break
      case 'Usuarios':
        $mdDialog.show({
          controller: newUserDialogCtrl,
          templateUrl: 'dialogs/user.html',
          parent: angular.element(document.body),
          targetEvent: ev,
          clickOutsideToClose:false,
          fullscreen: true
        }).then(function (user) {
          user.active = true
          $scope.users.push(user)
        })
        break
    }
  }

  $scope.$on('$destroy', function () {
    let delay = $mdToast.active ? 800 : 0

    // Make sure toast goes away before the controller is changed
    $mdToast.hide()

    $timeout(function () {
      // Save the cookies
      switch ($scope.ttl) {
        case 'Pacientes':
          $cookies.putObject('patient list options', $scope.options, null)
          break
        case 'Cirugías':
          $cookies.putObject('surgery list options', $scope.options, null)
          break
      }

      // Make sure no RAM goes to waste
      delete $scope
    }, delay)
  })
}

let patientDialogCtrl = function ($scope, $mdDialog, $mdToast, $cookies, $timeout, socket, dialogComm) {
  let preEditionPatient = null // Used to store the patient object before editing so as to recover it in case changes are undone

  // Get the patient object from dialogComm in case any was passed, else create a new one
  $scope.patient = dialogComm.getObject() !== undefined ? dialogComm.getObject() : {
    id: '',
    name: '',
    last: '',
    birthdate: null,
    first: null,
    background: null,
    surgeon_id: ''
  }
  $scope.editing = dialogComm.getNewSignal() // Define the initial editing state
  $scope.canGoBackToNotEditing = !$scope.editing // Defines whether the user is already in te db, if it is clicking cancel will take you to the non editing dialog - else it will close itself
  $scope.me = $cookies.getObject('logged user')
  $scope.answer = false // boolean - whether the dialog should return a value to the parent controller
  dialogComm.clean() // Deletes all the info stored in dialogComm

  // Get surgery list for the current patient
  if ($scope.patient.id !== '')
    socket.emit('request surgery list', $scope.patient)

  socket.on('surgery list', function (res) {
    if ($scope.surgeries !== undefined && $scope.surgeries !== null)
      if ($scope.surgeries.length > 0) return

    prepareSurgeryList(res)
    $scope.surgeries = res
  })

  // Request list of surgeons to let the user choose one from the corresponding combo box
  socket.emit('request surgeon list')
  socket.on('surgeon list', function (res) {
    $scope.surgeons = res

    // Watch the surgeon_id associated with the patient, if it is changed the surgeon object that goes as an attrib for the patient gets changed accordingly
    $scope.$watch('patient.surgeon_id', function () {
      for (let i = 0; i < $scope.surgeons.length; i++) {
        if ($scope.patient.surgeon_id === $scope.surgeons[i].id)
          $scope.surgeon = $scope.surgeons[i]
      }
    }, true)
  })

  /**
  * Used to trigger a change of state in the dialog
  */
  $scope.editClick = function () {
    // Change the state of the dialog - defines the elements that are being shown
    $scope.editing = !$scope.editing

    // if the mode being triggered is editing then store the current state of the patient object
    if ($scope.editing)
      preEditionPatient = copyPatient($scope.patient)
  }

  /**
  * Triggered when a surgery is clicked - shows a child dialog with surgery data
  * @param {event} ev - Event that triggers the execution
  * @param {int} index - Position of the surgery on the list
  */
  $scope.surgeryClick = function (ev, index) {
    dialogComm.sendObject($scope.surgeries[index])

    $mdDialog.show({
      controller: surgeryDialogCtrl,
      templateUrl: 'dialogs/surgery.html',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:false,
      multiple: true,
      fullscreen: true
    }).then(function (surgery) {
      if (surgery !== undefined && index !== undefined) {
        $scope.surgeries[index] = surgery
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

      if ($scope.patient.birthdate === null)
        valid = false

      if ($scope.patient.first === null)
        valid = false

      if ($scope.patient.surgeon_id.length === 0)
        valid = false
    } catch (e) {
      valid = false
    }
    return valid
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
          $scope.patient = copyPatient(preEditionPatient)
        } else {
          socket.emit('update patient', {
            id: $scope.patient.id,
            name: $scope.patient.name,
            last: $scope.patient.last,
            birthdate: $scope.patient.birthdate.getFullYear() + '-' + ($scope.patient.birthdate.getMonth() + 1) + '-' + $scope.patient.birthdate.getDate(),
            first: $scope.patient.first.getFullYear() + '-' + ($scope.patient.first.getMonth() + 1) + '-' + $scope.patient.first.getDate(),
            background: $scope.patient.background,
            surgeon_id: $scope.patient.surgeon_id
          })

          $scope.answer = true
        }

        $mdToast.active = false
      })
    } else {
      socket.emit('new patient', {
        id: $scope.patient.id,
        name: $scope.patient.name,
        last: $scope.patient.last,
        birthdate: $scope.patient.birthdate.getFullYear() + '-' + ($scope.patient.birthdate.getMonth() + 1) + '-' + $scope.patient.birthdate.getDate(),
        first: $scope.patient.first.getFullYear() + '-' + ($scope.patient.first.getMonth() + 1) + '-' + $scope.patient.first.getDate(),
        background: $scope.patient.background,
        surgeon_id: $scope.patient.surgeon_id
      })

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
        $scope.patient = copyPatient(preEditionPatient)

      $scope.editClick()
    } else {
      $mdDialog.cancel()
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
        $mdDialog.hide($scope.patient)
      else
        $mdDialog.hide()
    }, delay)
  }
}

let surgeryDialogCtrl = function ($scope, $mdDialog, $mdToast, $timeout, $cookies, socket, dialogComm) {
  let preEditionSurgery // Used to store the surgery object before editing so as to be able to recover it if the edition gets undone

  $scope.surgery = dialogComm.getObject() !== undefined ? dialogComm.getObject() : {
    id: '',
    scheduled: null,
    type: '',
    pathology: '',
    preop_valid: false,
    meds_to_drop: [],
    gos: null,
    cod: null,
    patient_id: '',
    surgeon_id: '',
    anesthetist_id: null,
    done: false
  } // Surgery to show data of - tries to get it from dialogComm service - if it is not there then it creates a new empty object
  $scope.editing = dialogComm.getNewSignal() // Gets the initial editing state from dialogComm service
  $scope.canGoBackToNotEditing = !$scope.editing // Defines whether the user is already in te db, if it is clicking cancel will take you to the non editing dialog - else it will close itself
  $scope.me = $cookies.getObject('logged user')
  $scope.answer = false // boolean - whether the dialog should return a value to the parent controller
  $scope.newComment = '' // comment input content stored here
  $scope.listKlasses = {
    comments: '',
    meds_to_drop: ''
  } // classes to apply to the lists inside the dialog
  dialogComm.clean() // Removing all content from the service

  // Get surgeon list and see who is the one to show - get all so that the autocomplete field is also loaded up
  socket.emit('request surgeon list')
  socket.on('surgeon list', function (res) {
    /**
    * Gets a list of surgeons for the autocomplete field
    */

    $scope.surgeons = res

    $scope.$watch('surgery.surgeon_id', function () {
      /**
      * Every time surgeon_id changes the surgeon object associated with the surgery gets updated accordingly
      */

      for (let i = 0; i < $scope.surgeons.length; i++) {
        if ($scope.surgery.surgeon_id === $scope.surgeons[i].id)
          $scope.surgery.surgeon = $scope.surgeons[i]
      }
    }, true)
  })

  socket.emit('request patient list')
  socket.on('patient list', function (res) {
    /**
    * Gets a patient list to be able to pair them with their surgeries - used to load the autocomplete field
    */

    $scope.patients = res

    $scope.$watch('surgery.patient_id', function () {
      /**
      * As patient_id changes the patient object gets updated as well
      */

      for (let i = 0; i < $scope.patients.length; i++) {
        if ($scope.surgery.patient_id === $scope.patients[i].id)
          $scope.surgery.patient = $scope.patients[i]
      }
    }, true)
  })

  $scope.$watch('surgery.anesthetist_id', function () {
    /**
    * Every time anesthetist_id is changed by the user the system looks for a matching anesthetist in the database
    */

    socket.emit('request doctor', $scope.surgery.anesthetist_id)
  })
  socket.on('doctor', function (res) {
    /**
    * Pairs the anesthetist with the procedure
    */

    $scope.surgery.anesthetist = res
  })

  socket.emit('request surgery type list')
  socket.on('surgery type list', function (res) {
    /**
    * Gets a list of all surgery types for the autocomplete field
    */

    $scope.surgeryTypes = res
  })

  socket.emit('request pathology list')
  socket.on('pathology list', function (res) {
    /**
    * Gets a list of all known pathologies for the autocomplete field
    */

    $scope.pathologies = res
  })

  $scope.$watch('surgery', function () {
    /**
    * Every time the surgery's date is changed the system checks whether it has already been performed or not
    */

    if ($scope.surgery.scheduled !== null) // If there is a date
      $scope.surgery.done = datediff('h', $scope.surgery.scheduled, new Date()) > 0 ? true : false // Decide
    else
      $scope.surgery.done = false // Impose that the surgery is yet to be performed
  }, true)

  /**
  * Function used to validate the surgery from the anesthetist's point of view
  */

  $scope.anesthetistOk = function () {
    if ($scope.surgery.anesthetist_id !== null) return // It cannot be done twice

    // Add data about the current user, which has to be the anesthetist
    $scope.surgery.anesthetist_id = $cookies.getObject('logged user').id
    $scope.surgery.anesthetist = $cookies.getObject('logged user')

    var toast = $mdToast.simple()
      .textContent('Has dado el visto bueno a una cirugía a ' + $scope.surgery.patient.last + ', ' + $scope.surgery.patient.name)
      .action('DESHACER')
      .highlightAction(true)
      .position('bottom right')

    $mdToast.active = true

    $mdToast.show(toast).then(function(response) {
      if ( response === 'ok' ) { // If the user decides it was all a mistake undo
        $scope.surgery.anesthetist_id = null
        $scope.surgery.anesthetist = null
      } else { // update the surgery and add the data necessary for the system to know it has been approved
        socket.emit('update surgery', {
          id: $scope.surgery.id,
          scheduled: $scope.surgery.scheduled.getFullYear() + '-' + ($scope.surgery.scheduled.getMonth() + 1) + '-' + $scope.surgery.scheduled.getDate(),
          type: $scope.surgery.type,
          pathology: $scope.surgery.pathology,
          preop_valid: $scope.surgery.preop_valid,
          meds_to_drop: $scope.surgery.meds_to_drop.length > 0 ? $scope.surgery.meds_to_drop.toString() : null,
          gos: $scope.surgery.gos,
          cod: $scope.surgery.cod,
          patient_id: $scope.surgery.patient_id,
          surgeon_id: $scope.surgery.surgeon_id,
          anesthetist_id: $scope.surgery.anesthetist_id
        })

        $scope.answer = true // Tell the system it needs to update the object outside the dialog
      }

      $mdToast.active = false
    })
  }

  /**
  * Following functions are to control the meds-to-drop list
  * Addition
  */
  $scope.addMedToDrop = function () {
    $scope.listKlasses = {
      comments: 'comment',
      meds_to_drop: 'meds-to-drop'
    }

    if ($scope.surgery.meds_to_drop.length < 8)
      $scope.surgery.meds_to_drop.push('')
  }

  /**
  * Removal
  * @param {int} index - position of the med on the list
  */
  $scope.removeMedToDrop = function (index) {
    $scope.listKlasses = {
      comments: 'comment',
      meds_to_drop: 'meds-to-drop'
    }

    $scope.surgery.meds_to_drop.splice(index, 1)
  }

  /**
  * Made for the autocomplete field corresponding to the patient
  * Every time the user inputs a new patient the id in the surgery object gets updated
  * which, incredibly enough, cannot be done through standard directives
  */
  $scope.patientChange = function () {
    $scope.surgery.patient_id = $scope.surgery.patient.id
  }

  /**
  * Search functions for autocomplete fields in the dialog
  * @param {string} query - text to compare with the patient name
  */
  $scope.patientQuerySearch = function (query) {
    var results = query ? $scope.patients.filter( createFilterFor(query, 'patient') ) : $scope.patients
    return results
  }

  /**
  * Filters surgery types
  * @param {string} query - text to compare with the combo param1-param2-....-paramN - Algo explained in the filter logic
  */
  $scope.surgeryQuerySearch = function (query) {
    $scope.surgery.type = query

    var results = query ? $scope.surgeryTypes.filter( createFilterFor(query, 'surgery') ) : $scope.surgeryTypes
    return results
  }

  /**
  * Filters pathology suggestions
  * @param {string} query - Text to compare with the pathology
  */
  $scope.pathologyQuerySearch = function (query) {
    $scope.surgery.pathology = query

    var results = query ? $scope.pathologies.filter( createFilterFor(query, 'pathology') ) : $scope.pathologies
    return results
  }

  /**
  * Depending on what you are filtering it determines whether each element of the given array comply with the query
  * @param {string} query - Text to filter stuff
  * @param {string} what - String representing the data you are filtering
  */
  let createFilterFor = function (query, what) {
    var lowercaseQuery = angular.lowercase(query)

    switch (what) {
      case 'patient':
        return function filterFn(patient) {
          let name = patient.last.concat(', ').concat(patient.name)
          name = angular.lowercase(name)
          return (name.includes(lowercaseQuery))
        }
        break
      case 'surgery':
        return function filterFn(type) {
          type = angular.lowercase(type)
          return (type.includes(lowercaseQuery))
        }
        break
      case 'pathology':
        return function filterFn(pathology) {
          pathology = angular.lowercase(pathology)
          return (pathology.includes(lowercaseQuery))
        }
        break
    }
  }

  // onClick event handlers

  /**
  * Used to trigger a change of state in the dialog
  */
  $scope.editClick = function () {
    // Change the state - hides and shows elements belonging to the entering state via ng-if
    $scope.editing = !$scope.editing

    // If the entering state is editing then store the object as it was prior to having edited it
    if ($scope.editing)
      preEditionSurgery = copySurgery($scope.surgery)
  }

  /**
  * Checks that all mandatory fields have been completed
  */
  let isFormValid = function () {
    let valid = true
    try {
      if ($scope.surgery.patient_id.length === 0)
        valid = false

      if ($scope.surgery.type.length === 0)
        valid = false

      if ($scope.surgery.pathology.length === 0)
        valid = false

      if ($scope.surgery.surgeon_id.length === 0)
        valid = false
    } catch (e) {
      valid = false
    }
    return valid
  }

  /**
  * Save changes to the object after editing
  */
  $scope.saveClick = function () {
    if (!isFormValid()) return

    // If canGoBackToNotEditing is true then the surgery is being edited from an already existing one - not being generated
    if ($scope.canGoBackToNotEditing) {
      var toast = $mdToast.simple()
        .textContent('Has editado una cirugía a ' + $scope.surgery.patient.last + ', ' + $scope.surgery.patient.name)
        .action('DESHACER')
        .highlightAction(true)
        .position('bottom right')

      $mdToast.active = true

      $mdToast.show(toast).then(function(response) {
        if ( response === 'ok' ) { // Clicked UNDO button in toast
          $scope.surgery = copySurgery(preEditionSurgery)
        } else { // toast went away and UNDO wasnt clicked
          socket.emit('update surgery', {
            id: $scope.surgery.id,
            scheduled: $scope.surgery.scheduled === null ? null : $scope.surgery.scheduled.getFullYear() + '-' + ($scope.surgery.scheduled.getMonth() + 1) + '-' + $scope.surgery.scheduled.getDate(),
            type: $scope.surgery.type,
            pathology: $scope.surgery.pathology,
            preop_valid: $scope.surgery.preop_valid,
            meds_to_drop: $scope.surgery.meds_to_drop.length > 0 ? $scope.surgery.meds_to_drop.toString() : null,
            gos: $scope.surgery.gos,
            cod: $scope.surgery.cod,
            patient_id: $scope.surgery.patient_id,
            surgeon_id: $scope.surgery.surgeon_id,
            anesthetist_id: $scope.surgery.anesthetist_id
          })

          $scope.answer = true
        }

        $mdToast.active = false
      })
    } else { // The surgery is being created from scratch
      $scope.surgery.id = makeid()

      socket.emit('new surgery', {
        id: $scope.surgery.id,
        scheduled: $scope.surgery.scheduled === null ? null : $scope.surgery.scheduled.getFullYear() + '-' + ($scope.surgery.scheduled.getMonth() + 1) + '-' + $scope.surgery.scheduled.getDate(),
        type: $scope.surgery.type,
        pathology: $scope.surgery.pathology,
        preop_valid: $scope.surgery.preop_valid,
        meds_to_drop: $scope.surgery.meds_to_drop.length > 0 ? $scope.surgery.meds_to_drop.toString() : null,
        gos: $scope.surgery.gos,
        cod: $scope.surgery.cod,
        patient_id: $scope.surgery.patient_id,
        surgeon_id: $scope.surgery.surgeon_id,
        anesthetist_id: $scope.surgery.anesthetist_id
      })

      $scope.answer = true
      $scope.canGoBackToNotEditing = !$scope.canGoBackToNotEditing // If the surgery is registered the next time it is edited it will be treated accordingly
    }

    $scope.editClick() // Takes the dialog back to a non editing state after saving
  }

  /**
  * Cancel edition without saving
  */
  $scope.cancelClick = function() {
    if ($scope.canGoBackToNotEditing) { // If the object is not being created and is stored
      if (preEditionSurgery !== null)
        $scope.surgery = copySurgery(preEditionSurgery)

      $scope.editClick()
    } else { // If the dialog was open to create a new object and it has not been created yet
      $mdDialog.cancel()
    }
  }

  /**
  * Close the dialog
  */
  $scope.closeClick = function () {
    let delay = $mdToast.active ? 800 : 0
    $mdToast.hide()

    $timeout(function () {
      if ($scope.answer) // If the object has to be sent over to the main section
        $mdDialog.hide($scope.surgery) // This hides the dialog and sends the object
      else
        $mdDialog.hide() // This just hides the dialog
    }, delay)
  }

  // Comments

  socket.emit('request comments', $scope.surgery)
  socket.on('comments', function (res) { // Recovers all comments corresponding to the surgery straginght from the db
    if (res.length > 0) {
      for (let i = 0; i < res.length; i++) {
        res[i].moment = new Date(res[i].moment)
      }

      $scope.comments = res
      socket.emit('request user list') // Ask for list of users so that they can be paired with their respective comments
    } else {
      $scope.comments = []
    }
  })

  socket.on('user list', function (res) {
    for (let i = 0; i < $scope.comments.length; i++) { // Loop through all comments
      for (let j = 0; j < res.length; j++) { // Loop through all users
        if ($scope.comments[i].user_id === res[j].id) { // If the user made the comment
          $scope.comments[i].user = res[j] // Pair them
        }
      }
    }
  })

  /**
  * This is the function whose execution gets triggered by the comment button's onClick
  */
  $scope.commentClick = function () {
    if ($scope.newComment.length === 0) return

    // Send the to the server without id
    socket.emit('new comment', {
      moment: new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate(),
      content: $scope.newComment,
      user_id: $cookies.getObject('logged user').id,
      surgery_id: $scope.surgery.id
    })
  }

  socket.on('new comment id', function (res) {
    $scope.listKlasses = {
      comments: 'comment',
      meds_to_drop: 'meds-to-drop'
    }

    // Get it back from the server with id
    $scope.comments.push({
      id: res.insertId,
      moment: new Date(),
      content: $scope.newComment,
      user_id: $cookies.getObject('logged user').id,
      surgery_id: $scope.surgery.id,
      user: $cookies.getObject('logged user')
    })

    // Empty the comment field
    $scope.newComment = ''
  })

  /**
  * Delete the comment when the trash can icon is clicked
  * @param {int} index - Comment index in the array
  */
  $scope.deleteComment = function (index) {
    $scope.listKlasses = {
      comments: 'comment',
      meds_to_drop: 'meds-to-drop'
    }

    // Recover the comment from the array and store it elsewhere in memory - Remove it from sight
    let comment = $scope.comments[index]
    $scope.comments.splice(index, 1)

    var toast = $mdToast.simple()
      .textContent('Has eliminado un comentario')
      .action('DESHACER')
      .highlightAction(true)
      .position('bottom right')

    $mdToast.show(toast).then(function(response) {
      if (response === 'ok') { // If the UNDO button gets clicked
        $scope.comments.splice(index, 0, comment)
      } else { // If the toast disappears and the UNDO button never got clicked
        socket.emit('remove comment', comment)
      }
    })
  }

  /**
  * ID gen and validation
  */

  let ids = [] // To store all previously used ids

  socket.emit('request surgery ids')
  socket.on('surgery ids', function (res) {
    ids = res // Loads the array up with ids from the database
  })

  let makeid = function () {
    let text = '' // Will contain the new id
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' // Set of possible chars

    for( let i = 0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length)) // Make a 5 char long string - new id

    if (ids.indexOf(text) !== -1) // If it was already in use
      return makeid() // Repeat

    return text
  }
}

let newUserDialogCtrl = function ($scope, $mdDialog, socket) {
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

    $scope.user.id = makeid() // Creates an id to it and stores it in the user object
    if ($scope.user.type === 'anesthetist') // Make sure anesthetists don't get admin privileges
      $scope.user.admin = false

    socket.emit('new user', $scope.user) // Send the object to the db to be stored

    $mdDialog.hide($scope.user) // Away goes the dialog
  }

  /**
  * Cancel without saving
  */
  $scope.cancelClick = function () {
    $mdDialog.cancel()
  }

  /**
  * ID gen and validation
  */

  let ids = [] // To store all ids in use in the db

  socket.emit('request ids')
  socket.on('user ids', function (res) {
    ids = res // Load up the array with all those ids
  })

  let makeid = function () {
    let text = '' // Will contain the new id
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' // All possible chars

    for( let i = 0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length)) // Make a random 5 char long string - new id

    if (ids.indexOf(text) !== -1) // If it was aready in use
      return makeid() // Make another

    return text
  }
}

/**
* Fixes patient objects coming back from the db - makes attrs that have to be boolean boolean (they come as ints) and stuff
* @param {array} patients - Array of patients as it comes from the db
*/
let preparePatientList = function (patients) {
  for (let i = 0; i < patients.length; i++) { // Turning date strings into dates serverside actually leaves me with strings at the frontend... FUCK!!
    patients[i].birthdate = new Date(patients[i].birthdate)
    patients[i].first = new Date(patients[i].first)
    patients[i].date_of_death = patients[i].date_of_death !== null ? new Date(patients[i].date_of_death) : null
    patients[i].last_op_date = patients[i].last_op_date !== null ? new Date(patients[i].last_op_date) : null
    patients[i].age = datediff('yyyy', patients[i].birthdate, new Date())
  }
}

/**
* Fixes surgery objects coming back from the db - makes attrs that have to be boolean boolean (they come as ints) and stuff
* @param {array} surgeries - Array of surgeries as it comes from the db
* @param {array} patients - Fixed array of patients (nullable)
* @param {string} msg - Variable to store error messages at - Error messages are like when a surgery is scheduled to be performed on a corpse... (nullable)
*/
let prepareSurgeryList = function (surgeries, patients, msg) {
  try {
    // Checks whether the method already ran by identifying its effect already being done - mysteriously runs multiple times if this is not done
    if (typeof surgeries[0].preop_valid === 'boolean') return
  } catch (e) {
  }

  for (let i = 0; i < surgeries.length; i++) {
    surgeries[i].scheduled = surgeries[i].scheduled !== null ? new Date(surgeries[i].scheduled) : null

    try {
      surgeries[i].meds_to_drop = surgeries[i].meds_to_drop.split(',')
    } catch (err) {
      surgeries[i].meds_to_drop = []
    }

    if (surgeries[i].scheduled !== null)
      surgeries[i].done = datediff('h', surgeries[i].scheduled, new Date()) > 0 ? true : false
    else
      surgeries[i].done = false

    if (surgeries[i].preop_valid !== null)
      surgeries[i].preop_valid = surgeries[i].preop_valid === 1 ? true : false

    try {
      for (let j = 0; j < patients.length; j++) {
        if (patients[j].id === surgeries[i].patient_id) {
          surgeries[i].patient = patients[j]
          if (surgeries[i].scheduled !== null && patients[j].date_of_death !== null) {
            if (datediff('d', surgeries[i].scheduled, patients[j].date_of_death) < 0) {
              msg += 'Se eliminaron cirugias a ' + patients[j].last + ', ' + patients[j].name + ' que estaban agendadas para luego de su muerte\n'
              socket.emit('remove surgery', surgeries[i])
              surgeries.splice(i, 1)
            }
          }
        }
      }
    } catch (e) {

    }
  }
}

/**
* Generates a fully independent copy of the inputted object
* @param {object} item - Surgery to copy
*/
let copySurgery = function (item) {
  let retVal =  {
    id: item.id,
    scheduled: item.scheduled,
    type: item.type,
    pathology: item.pathology,
    preop_valid: item.preop_valid,
    meds_to_drop: [],
    gos: item.gos,
    cod: item.cod,
    patient_id: item.patient_id,
    surgeon_id: item.surgeon_id,
    anesthetist_id: item.anesthetist_id,
    anesthetist: item.anesthetist,
    surgeon: item.surgeon,
    patient: item.patient,
    done: item.done
  }

  angular.forEach(item.meds_to_drop, function (med) {
    retVal.meds_to_drop.push(med)
  })

  return retVal
}

/**
* Generates a fully independent copy of the inputted object
* @param {object} item - Patient to copy
*/
let copyPatient = function (item) {
   return {
    id: item.id,
    name: item.name,
    last: item.last,
    birthdate: item.birthdate,
    first: item.first,
    background: item.background,
    surgeon_id: item.surgeon_id
  }
}
