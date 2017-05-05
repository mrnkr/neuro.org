myApp.directive('help', function () {
  return {
    restrict: 'E',
    scope: {},
    controller: helpCtrl,
    templateUrl: 'help.html'
  }
})

myApp.directive('about', function () {
  return {
    restrict: 'E',
    scope: {},
    controller: aboutCtrl,
    templateUrl: 'about.html'
  }
})

let helpCtrl = function ($scope, $mdDialog, toastCtrl) {
  $scope.showDemoToast = function () {
    /**
    * Shows a useless toast to show the user what a toast is
    */

    toastCtrl.show('Este es el cuadro', function (response) {
      if ( response === 'ok' ) {
        $mdDialog.show(
          $mdDialog.alert()
            .parent(angular.element(document.body))
            .clickOutsideToClose(true)
            .title('¡Bien hecho!')
            .textContent('Así se deshace algo')
            .ariaLabel('Dialog Demo')
            .ok('Genial!')
        )
      }
    })
  }

  $scope.$on('$destroy', function () {
    if (toastCtrl.active()) toastCtrl.hide()
  })
}

let aboutCtrl = function ($scope, openExternal) {
  $scope.takeToLink = function (link) {
    openExternal(link)
  }
}
