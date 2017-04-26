myApp.controller('surgeryDialogCtrl', function ($scope, $mdDialog, $timeout, $cookies, toastCtrl, socket, ipcRenderer) {
  let preEditionSurgery = null // Used to store the surgery object before editing so as to be able to recover it if the edition gets undone

  ipcRenderer.on('data-to-show', function (ev, data) {
    if (data != null) {
      $scope.surgery = Surgery.copy(data)
      $scope.editing = false
    } else {
      $scope.surgery = new Surgery()
      $scope.editing = true
    }

    $scope.canGoBackToNotEditing = !$scope.editing
    prepare()
  })

  $scope.me = $cookies.getObject('logged user')
  $scope.answer = false // boolean - whether the dialog should return a value to the parent controller
  $scope.newComment = '' // comment input content stored here
  $scope.listKlasses = {
    comments: '',
    meds_to_drop: ''
  } // classes to apply to the lists inside the dialog

  /**
  * Request the necessary data to complete the interface
  */
  let prepare = function () {
    socket.emit('request surgeon list')
    socket.on('surgeon list', function (res) {
      /**
      * Gets a list of surgeons for the autocomplete field
      */

      $scope.surgeons = User.prepareUserList(res)

      // The surgeon in the patient object is not recognized as equal to the one in the combobox
      if ($scope.surgery.surgeon != null) {
        let index = $scope.surgeons.map(function(x) {return x.id}).indexOf($scope.surgery.surgeon.id)
        $scope.surgery.surgeon = $scope.surgeons[index]
      }
    })

    socket.emit('request patient list')
    socket.on('patient list', function (res) {
      /**
      * Gets a patient list to load up the autocomplete field
      */

      $scope.patients = Patient.preparePatientList(res)
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

    $scope.$watch('surgery.gos', function () {
      /**
      * Every time the user changes the gos value the program checks that cod is a possible value
      */

      if ($scope.surgery.gos > 1)
        $scope.surgery.cod = null
    })

    socket.emit('request comments', $scope.surgery)
    socket.on('comments', function (res) { // Recovers all comments corresponding to the surgery straginght from the db
      if (res.length > 0) {
        $scope.comments = Comment.prepareCommentList(res)
      }
    })
  }

  /**
  * Function used to validate the surgery from the surgeon's point of view
  */
  let surgeonOk = function () {
    if ($scope.surgery.preop_valid !== null) return

    // Save today's date as the one the studies were delivered
    $scope.surgery.preop_valid = new Date()

    toastCtrl.show('Has dado el visto bueno a una cirugía a ' + $scope.surgery.patient.last + ', ' + $scope.surgery.patient.name, function (response) {
      if ( response === 'ok' ) { // If the user decides it was all a mistake undo
        $scope.surgery.preop_valid = null
      } else { // update the surgery and add the data necessary for the system to know it has been approved
        socket.emit('update surgery', $scope.surgery.jsonForDatabase)
        $scope.answer = true // Tell the system it needs to update the object outside the dialog
      }
    })
  }

  /**
  * Function used to validate the surgery from the anesthetist's point of view
  */
  let anesthetistOk = function () {
    if ($scope.surgery.anesthetist_id !== null) return // It cannot be done twice

    // Add data about the current user, which has to be the anesthetist
    $scope.surgery.anesthetist = $cookies.getObject('logged user')

    toastCtrl.show('Has dado el visto bueno a una cirugía a ' + $scope.surgery.patient.last + ', ' + $scope.surgery.patient.name, function (response) {
      if ( response === 'ok' ) { // If the user decides it was all a mistake undo
        $scope.surgery.anesthetist = null
      } else { // update the surgery and add the data necessary for the system to know it has been approved
        socket.emit('update surgery', $scope.surgery.jsonForDatabase)
        $scope.answer = true // Tell the system it needs to update the object outside the dialog
      }
    })
  }

  /**
  * Just marks the surgery as done
  * @param {boolean} date - Whether the date has to be changed in order for the surgery to be marked as done
  */
  let markAsDone = function (date) {
    let prevDate = $scope.surgery.scheduled
    if (date != null) $scope.surgery.scheduled = date
    $scope.surgery.done = true

    toastCtrl.show('Has marcado como lista una cirugía a ' + $scope.surgery.patient.last + ', ' + $scope.surgery.patient.name, function (response) {
      if ( response === 'ok' ) { // Clicked UNDO button in toast
        if (date != null) $scope.surgery.scheduled = prevDate
        $scope.surgery.done = false
      } else { // toast went away and UNDO wasnt clicked
        socket.emit('update surgery', $scope.surgery.jsonForDatabase)
        $scope.answer = true
      }
    })
  }

  /**
  * Depending on what you are filtering it determines whether each element of the given array comply with the query
  * @param {string} query - Text to filter stuff
  * @param {string} what - String representing the data you are filtering
  */
  let createFilterFor = function (query, what) {
    let lowercaseQuery = angular.lowercase(query)

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

  /**
  * Checks that all mandatory fields have been completed
  */
  let isFormValid = function () {
    let valid = true
    try {
      if ($scope.surgery.patient == null)
        valid = false

      if ($scope.surgery.type.length === 0)
        valid = false

      if ($scope.surgery.pathology.length === 0)
        valid = false

      if ($scope.surgery.surgeon == null)
        valid = false
    } catch (e) {
      valid = false
    }
    return valid
  }

  /**
  * Validates the surgery - if me is a surgeon it will do so as such, if anesthetist it will carry out the anesthetist's duty
  */
  $scope.markAsReady = function () {
    if ($scope.me.type === 'anesthetist')
      anesthetistOk()
    else
      surgeonOk()
  }

  /**
  * Checks the surgery before marking it as done
  * Calls markAsDone() to actually carry out the operation
  */
  $scope.markAsDone = function () {
    // If there is no solution then kick the user out before its too late
    if ($scope.surgery.done) {
      $mdDialog.show(
        $mdDialog.alert()
          .clickOutsideToClose(false)
          .title('La cirugía ya se hizo')
          .textContent('Registra una nueva cirugía si se operó de nuevo')
          .ariaLabel('Done twice?')
          .ok('OK')
      )

      return
    }

    // There would be a slution here but... NAH
    if ($scope.surgery.preop_valid == null) {
      $mdDialog.show(
        $mdDialog.alert()
          .clickOutsideToClose(false)
          .title('Falta validar')
          .textContent('Por favor, valide la cirugía antes de hacerla')
          .ariaLabel('Validation missing')
          .ok('OK')
      )

      return
    }

    let error = $scope.surgery.error

    if (error.msg.length > 0) {
      let confirm = $mdDialog.confirm()
          .title('Error')
          .textContent(error.msg)
          .ariaLabel('Errors')
          .ok('Solucionar lo que se pueda y seguir')
          .cancel('Cancelar')

      $mdDialog.show(confirm).then(function() {
        if (error.date_needed)
          markAsDone(new Date())
        else
          markAsDone()
      })
    } else {
      markAsDone()
    }
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
  * Search functions for autocomplete fields in the dialog
  * @param {string} query - text to compare with the patient name
  */
  $scope.patientQuerySearch = function (query) {
    let results = query ? $scope.patients.filter( createFilterFor(query, 'patient') ) : $scope.patients
    return results
  }

  /**
  * Filters surgery types
  * @param {string} query - text to compare with the combo param1-param2-....-paramN - Algo explained in the filter logic
  */
  $scope.surgeryQuerySearch = function (query) {
    $scope.surgery.type = query

    let results = query ? $scope.surgeryTypes.filter( createFilterFor(query, 'surgery') ) : $scope.surgeryTypes
    return results
  }

  /**
  * Filters pathology suggestions
  * @param {string} query - Text to compare with the pathology
  */
  $scope.pathologyQuerySearch = function (query) {
    $scope.surgery.pathology = query

    let results = query ? $scope.pathologies.filter( createFilterFor(query, 'pathology') ) : $scope.pathologies
    return results
  }

  /**
  * Used to trigger a change of state in the dialog
  */
  $scope.editClick = function () {
    // Change the state - hides and shows elements belonging to the entering state via ng-if
    $scope.editing = !$scope.editing

    // If the entering state is editing then store the object as it was prior to having edited it
    if ($scope.editing)
      preEditionSurgery = Surgery.copy($scope.surgery)
  }

  /**
  * Save changes to the object after editing
  */
  $scope.saveClick = function () {
    if (!isFormValid()) return

    // If canGoBackToNotEditing is true then the surgery is being edited from an already existing one - not being generated
    if ($scope.canGoBackToNotEditing) {
      toastCtrl.show('Has editado una cirugía a ' + $scope.surgery.patient.last + ', ' + $scope.surgery.patient.name, function (response) {
        if ( response === 'ok' ) { // Clicked UNDO button in toast
          $scope.surgery = Surgery.copy(preEditionSurgery)
        } else { // toast went away and UNDO wasnt clicked
          socket.emit('update surgery', $scope.surgery.jsonForDatabase)

          $scope.answer = true
        }
      })
    } else { // The surgery is being created from scratch
      $scope.surgery.id = Surgery.makeid(ids)

      socket.emit('new surgery', $scope.surgery.jsonForDatabase)

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
        $scope.surgery = Surgery.copy(preEditionSurgery)

      $scope.editClick()
    } else { // If the dialog was open to create a new object and it has not been created yet
      ipcRenderer.emit('close-modal')
    }
  }

  /**
  * Close the dialog
  */
  $scope.closeClick = function () {
    let delay = toastCtrl.active() ? 800 : 0
    toastCtrl.hide()

    $timeout(function () {
      if ($scope.answer) // If the object has to be sent over to the main section
        ipcRenderer.emit('deliver-data-to-papa', $scope.surgery) // This sends the object

      ipcRenderer.emit('close-modal')
    }, delay)
  }

  // Comments

  /**
  * This is the function whose execution gets triggered by the comment button's onClick
  */
  $scope.commentClick = function () {
    if ($scope.newComment.length === 0) return

    // Send the to the server without id
    let comment = new Comment()
    comment.content = $scope.newComment
    comment.user = $scope.me
    comment.surgery_id = $scope.surgery.id

    socket.emit('new comment', comment.jsonForDatabase)
  }

  socket.on('new comment id', function (res) {
    $scope.listKlasses = {
      comments: 'comment',
      meds_to_drop: 'meds-to-drop'
    }

    // Get it back from the server with id
    if ($scope.newComment.length > 0) {
      let comment = new Comment()
      comment.id = res.insertId
      comment.content = $scope.newComment
      comment.user = $scope.me
      comment.surgery_id = $scope.surgery.id

      $scope.comments.push(comment)
    }

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

    toastCtrl.show('Has eliminado un comentario', function (response) {
      if (response === 'ok') { // If the UNDO button gets clicked
        $scope.comments.splice(index, 0, comment)
      } else { // If the toast disappears and the UNDO button never got clicked
        socket.emit('remove comment', comment.jsonForDatabase)
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
})
