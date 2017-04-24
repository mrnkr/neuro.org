myApp.controller('navCtrl', function ($scope, $mdDialog, $mdToast, $cookies, socket, windowCtrl, ipcRenderer) {
  $scope.user = $cookies.getObject('logged user')
  $scope.userMenu         =   'arrow_drop_down' // Icon name - determines whether the arrow to show next to user name points up or down

  /**
  * Change nav state - toggle between user menu and regular nav
  */
  $scope.toggleUserMenu   =   function () {
    $scope.userMenu = $scope.userMenu === 'arrow_drop_up' ? 'arrow_drop_down' : 'arrow_drop_up'
  }

  /**
  * Depending on the mail var it shows dialogs for users to change their mails or passwords
  * @param {boolean} mail - If true the user is changing their mail - else they change their pass
  */
  $scope.editUser = function (mail) {
    if (mail) {
      ipcRenderer.emit('open-modal', 3, true)

      ipcRenderer.on('send-data-to-daddy', function (ev, data) {
        if (data != null) {
          let toast = $mdToast.simple()
            .textContent('Has cambiado tu email a ' + data)
            .action('DESHACER')
            .highlightAction(true)
            .position('bottom right')

          $mdToast.show(toast).then(function(response) {
            if ( response !== 'ok' ) {
              $scope.user.email = data
              $cookies.putObject('logged user', $scope.user, null)

              socket.emit('change user email', {id: $cookies.getObject('logged user').id, email: data})
            }
          })
        }
      })
    } else {
      ipcRenderer.emit('open-modal', 3, false)

      ipcRenderer.on('send-data-to-daddy', function (ev, data) {
        if (data != null) {
          let toast = $mdToast.simple()
            .textContent('Has cambiado tu contraseña')
            .action('DESHACER')
            .highlightAction(true)
            .position('bottom right')

          $mdToast.show(toast).then(function(response) {
            if ( response !== 'ok' ) {
              socket.emit('change user pass', data)
            }
          })
        }
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
