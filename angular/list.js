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

let listCtrl =  function ($scope, $timeout, $cookies, toastCtrl, fabService, socket, ipcRenderer, notification) {
  let loading = true // If true, socket events can be run
  $scope.me = $cookies.getObject('logged user')

  /**
  * Prepares the controller according to the data to be shown
  */
  let prepare = function () {
    fabService.setVisible(false)
    $scope.listKlass = 'main-list-start' // Changes after the list is first loaded so that the animations wont be the same

    // Search field controller
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
        if ($scope.me.type === 'surgeon' && $cookies.getObject('patient list options') !== null) {
          $scope.options = $cookies.getObject('patient list options')
        } else {
          $scope.options = {
            divideBy: 'operatedOrNot', // Allow mineOrNot
            orderBy: 'last', // Allow by age and by last operation date
            showDead: true
          }
        }

        // Set up a watch to make titles the right ones according to the active filters
        $scope.$watch('options.divideBy', function () {
          if ($scope.options.divideBy === 'operatedOrNot') {
            $scope.header1 = 'A operar'
            $scope.header2 = 'Operados'
          } else {
            $scope.header1 = 'Mis pacientes'
            $scope.header2 = 'Demás pacientes'
          }
        })

        // Fab is to be shown to all surgeons
        if ($cookies.getObject('logged user').type === 'surgeon')
          fabService.setVisible(true)

        // Request data to server
        socket.emit('request patient list')
        socket.on('patient list', function (res) {
          recoverData('patient list', res)
        })
        break
      case 'Cirugías':
        //Titles don't change in this case
        $scope.header1 = 'A realizar'
        $scope.header2 = 'Realizadas'

        // Try to recover display options from cookies, else generate default object
        if ($scope.me.type === 'surgeon' && $cookies.getObject('surgery list options') !== null) {
          $scope.options = $cookies.getObject('surgery list options')
        } else {
          $scope.options = {
            divideBy: 'doneOrNot', // Dont allow change
            orderBy: '-scheduled', // Also allow pathology and type
            seeFrom: '6m', // First number is the period and the rest is the interval (for the datediff function) Allows empty string for beginning of time
            showUndone: true, // Allows to hide undone surgeries
            showDone: true, // Allows to hide past surgeries
            mineOnly: false, // Show only surgeries in charge of the logged user
            validOnly: false // Show only surgeries that have been validated
          }
        }

        /**
        * Triggers the execution of the print service by sending the contents to be printed to the main process
        */
        $scope.print = function () {
            ipcRenderer.emit('print', document.getElementById('print-content').innerHTML)
        }

        /**
        * Hides/Shows the unperformed surgery list
        */
        $scope.toggleUnperformedSurgeryList = function () {
          $scope.options.showUndone = !$scope.options.showUndone
        }

        /**
        * Hides/Shows the performed surgery list
        */
        $scope.togglePerformedSurgeryList = function () {
          $scope.options.showDone = !$scope.options.showDone
        }

        // Fab is to be shown to all surgeons
        if ($cookies.getObject('logged user').type === 'surgeon')
          fabService.setVisible(true)

        // Request data from the database
        socket.emit('request surgery list')
        socket.on('surgery list', function (res) {
          recoverData('surgery list', res)
        })
        break
      case 'Usuarios':
        // No divisions made to the list
        $scope.showHeaders = false

        //Fab is to be shown to admins only
        if ($scope.me.admin)
          fabService.setVisible(true)

        // Request data from the server
        socket.emit('request user list')
        socket.on('user list', function (res) {
          recoverData('user list', res)
        })
        break
    }
  }

  $timeout(function () {
    // Run prepare() when the time comes

    prepare()
  }, 200)

  /**
  * Code to be run when the server responds to database requests
  * @param {string} list - Name of the list that is being loaded
  * @param {array} database_data - The dataset returned from the database
  */
  let recoverData = function (list, database_data) {
    if (loading) {
      loading = false

      switch(list) {
        case 'patient list':
          database_data = Patient.preparePatientList(database_data)
          break
        case 'surgery list':
          let msg = {text: ''} // Has to be an object since objects are passed as ByRef, strigs go ByVal
          database_data = Surgery.prepareSurgeryList(database_data, msg, socket)
          if (msg.text.length > 0)
            notification('Zombies!', msg.text)
          break
        case 'user list':
          database_data = User.prepareUserList(database_data)
          break
      }

      $scope.ready = true
      $timeout(function () {
        $scope.items = database_data

        $timeout(function () {
          $scope.listKlass = 'main-list-ready'
        }, $scope.items.length * 150)
      }, 100)
    }
  }

  /**
  * Shows a modal window and lets the user use a runnable to run their custom code when it gets sent back
  * @param {int} type - Type of dialog as defined in the constants located at the datamodel
  * @param {object} item - The data to be passed over to the dialog
  * @param {callback} callback - Code to be run when the modal sends data back to the window
  */
  let showDialog = function (type, item, callback) {
    ipcRenderer.emit('open-modal', type, item)
    ipcRenderer.on('send-data-to-daddy', function (ev, data) {
      callback(data)
    })
  }

  /**
  * Calls the showDialog() function that is outside the scope
  * Shows dialogs corresponding to the input or to add new data altogether
  * @param {object} item - The data to show in the dialog in case it is not a new one
  */
  $scope.showDialog = function (item) {
    let index = -1
    let dialogType
    let klass

    switch($scope.ttl) {
      case 'Pacientes':
        dialogType = 0
        klass = Patient
        break
      case 'Cirugías':
        dialogType = 1
        klass = Surgery
        break
      case 'Usuarios':
        dialogType = 2
        klass = User
        break
    }

    if (item != null) index = $scope.items.indexOf(item)

    showDialog(dialogType, item, function (data) {
      if (data == null) return
      data = klass.copy(data)

      if (index != -1)
        $scope.items[index] = data
      else
        if ($scope.items.indexOf(data) === -1) $scope.items.push(data)

      notification('Éxito!', 'Operación completada con éxito')
    })
  }

  // Set the function accesible from the service to be the same as $scope.showDialog()
  fabService.setOnClickListener($scope.showDialog)

  /**
  * Deactivates a user - Disalows it to log in in the future
  * @param {object} item - User to deactivate
  */
  $scope.deactivateClick = function (item) {
    item.active = !item.active
    let msg = item.active ? 'activado' : 'desactivado'

    toastCtrl.show('Se ha ' + msg + ' a ' + item.last + ', ' + item.name, function (response) {
      if ( response === 'ok' ) {
        item.active = !item.active
      } else {
        if (item.active)
          socket.emit('reactivate user', item)
        else
          socket.emit('deactivate user', item)
      }
    })
  }

  /**
  * Deletes the element it gets as a param
  * @param {object} item - Object to delete from the database - can be a user, a surgery or a patient
  */
  $scope.deleteClick = function (item) {
    let index = $scope.items.indexOf(item)
    $scope.items.splice(index, 1)

    let msg = ''
    let evt = ''

    switch($scope.ttl) {
      case 'Pacientes':
      case 'Usuarios':
        msg = 'Se ha eliminado a ' + item.last + ', ' + item.name
        evt = $scope.ttl === 'Pacientes' ? 'remove patient' : 'remove user'
        break
      case 'Cirugías':
        msg = 'Se ha eliminado una cirugía a ' + item.patient.last + ', ' + item.patient.name
        evt = 'remove surgery'
        break
    }

    toastCtrl.show(msg, function (response) {
      if ( response === 'ok' ) {
        $scope.items.splice(index, 0, item)
      } else {
        socket.emit(evt, item.jsonForDatabase)
      }
    })
  }

  /**
  * Prepares the environment for closing
  */
  $scope.$on('$destroy', function () {
    let delay = toastCtrl.active() ? 800 : 0

    // Make sure toast goes away before the controller is changed
    toastCtrl.hide()

    $timeout(function () {
      // Save the cookies if surgeon
      if ($scope.me.type === 'surgeon' && $scope.ttl !== 'Usuarios') {
        let evt = $scope.ttl === 'Pacientes' ? 'patient list options' : 'surgery list options'
        $cookies.putObject(evt, $scope.options, null)
      }
    }, delay)
  })
}
