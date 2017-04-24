myApp.directive('start', function () {
  return {
    restrict: 'E',
    scope: {},
    controller: mainCtrl,
    templateUrl: 'main.html'
  }
})

let mainCtrl =  function ($scope, $mdDialog, socket) {
  /**
  * The section can only be shown when completely ready - fully loaded
  * individualReady contains boolean variables that will only be true when each corresponding element is ready to be shown
  * When all those vars are true, ready turns to true - So the whole section can be shown
  */
  $scope.individualReady = {
    pathology: false,
    workload: false,
    success: false
  }
  $scope.ready = false

  $scope.$watch('individualReady', function () {
    if ($scope.individualReady.pathology && $scope.individualReady.workload && $scope.individualReady.success) $scope.ready = true
  }, true)

  /**
  * Chart datasets
  */

  //Pathologies Chart
  socket.emit('request pathology data')

  socket.on('pathology data', function (res) {
    $scope.pathologiesData = []
    $scope.pathologiesLabels = []

    angular.forEach(res, function (item) {
      $scope.pathologiesLabels.push(item.pathology)
      $scope.pathologiesData.push(item.qty)
    })

    $scope.individualReady.pathology = true
  })

  $scope.pathologiesOptions = {
    responsive: true,
    maintainAspectRatio: true,
    legend: {
      display: false
    },
    title: {
      display: true,
      position: 'bottom',
      text: 'Patologías'
    },
    tooltips: {
      enabled: true,
      displayColors: false
    }
  }

  //Success rate Chart
  socket.emit('request success rate')
  socket.on('success rate', function (res) {
    $scope.successData = []
    $scope.successLabels = []

    angular.forEach(res, function (item) {
      $scope.successData.push(item.qty)
      $scope.successLabels.push(item.title)
    })

    $scope.individualReady.success = true
  })

  $scope.successOptions = {
    responsive: true,
    maintainAspectRatio: true,
    legend: {
      display: false
    },
    title: {
      display: true,
      position: 'bottom',
      text: 'Tasa de éxito'
    },
    tooltips: {
      enabled: true,
      displayColors: false
    }
  }

  $scope.pieColors = [
    '#ff6384',
    '#ffce56',
    '#36a2eb'
  ]

  //Workload Chart
  socket.emit('request workload data')
  let months = getMonths()
  $scope.workloadLabels = []

  angular.forEach(months, function (month) {
    $scope.workloadLabels.push(month.value)
  })

  socket.on('workload data', function (res) {
    $scope.workloadData = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ]

    angular.forEach(res[0], function (item) {
      angular.forEach(months, function (month, index) {
        if ((month.index + 1) === item.month) {
          $scope.workloadData[0][index] = item.workload
        }
      })
    })

    angular.forEach(res[1], function (item) {
      angular.forEach(months, function (month, index) {
        if ((month.index + 1) === item.month) {
          $scope.workloadData[1][index] = item.workload
        }
      })
    })

    $scope.individualReady.workload = true
  })

  $scope.workloadSeries = ['Este año', 'El año pasado']
  $scope.datasetOverride = [{ yAxisID: 'y-axis-1' }]

  $scope.lineOptions = {
    scales: {
      yAxes: [
        {
          id: 'y-axis-1',
          type: 'linear',
          display: true,
          position: 'left'
        }
      ]
    },
    legend: {
      display: false
    },
    title: {
      display: false
    },
    tooltips: {
      display: true,
      displayColors: false
    }
  }

  $scope.$on('$destroy', function () {
    socket.removeAllListeners()
    delete $scope
  })
}

/**
* Used to have the six right months to show in the worload chart
*/
let getMonths = function () {
  let curMonth = new Date().getMonth()
  let months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
  let retVal = []

  for (let i = 0; i < 6; i++) {
    retVal.push({index: curMonth, value: months[curMonth]})
    curMonth > 0 ? curMonth-- : curMonth = 11
  }

  return retVal.reverse()
}
