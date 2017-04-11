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
    templateUrl: 'about.html'
  }
})

let helpCtrl = function ($scope, $mdToast, $mdDialog) {
  $scope.showDemoToast = function () {
    /**
    * Shows a useless toast to show the user what a toast is
    */

    let toast = $mdToast.simple()
      .textContent('Este es el cuadro')
      .action('DESHACER')
      .highlightAction(true)
      .position('bottom right')

    $mdToast.show(toast).then(function(response) {
      // If the user clicks on the toast's button a dialog gets shown
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
    $mdToast.hide()
  })
}
