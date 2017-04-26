let myApp = angular.module('myApp', ['ngMaterial', 'ngMessages', 'ngAnimate', 'chart.js', 'ngAvatar', 'ngCookies'])

/**
* Controller for the body of index.html
*/
myApp.controller('myCtrl', function ($scope, $mdSidenav, $mdDialog, $window, fabService, socket, windowCtrl) {
  $scope.section = '' // ng-switch controller variable

  /**
  * Window control
  */

  $scope.minimizeClick = function () {
    windowCtrl.minimize()
  }

  $scope.maximizeClick = function () {
    windowCtrl.maximize()
  }

  $scope.closeClick = function () {
    windowCtrl.close()
  }

  // FAB Control

  /**
  * When the visibiliti state is changed in the service it gets reflected in the site's content symulaneously
  */
  $scope.$watch(function () {
    return fabService.getVisible()
  }, function () {
    $scope.showFab = fabService.getVisible()
  })

  /**
  * To be executed when the FAB's onClick is triggered
  * @param {event} ev - The event object
  * @param {boolean} newSignal - Whether the dialog should contain data or shoud allow for the creation of new content from scratch
  */
  $scope.onFabClick = function (ev, newSignal) {
    fabService.runOnClickListener(ev, newSignal)
  }

  /**
  * Section control
  * @param {string} section - Name of the section to go to in lowercase
  */
  $scope.changeSection = function (section) {
    $mdSidenav('left').close().then(function () {
      if ($scope.section !== section) {
        fabService.setVisible(false)
        $scope.section = section
      }
    })
  }

  /**
  * NAV control - Opens the sidenav
  */
  $scope.toggleNav = function () {
    $mdSidenav('left').toggle()
  }

  /**
  * Watch dog taking care of the server state
  * If the database does not respond to the nodejs portion of teh app it will trigger this event
  */
  socket.on('server is dead', function () {
    console.log('server is dead')

    $mdDialog.show(
      $mdDialog.alert()
        .clickOutsideToClose(false)
        .title('Se ha perdido la conexión')
        .textContent('Se cerrará sesión para evitar la pérdida de datos')
        .ariaLabel('Connection lost dlg')
        .ok('OK')
    ).then(function () {
      windowCtrl.logout()
    })
  })
})

myApp.directive('myEnter', function () {
  /**
  * Directive to handle onButtonClick event only if the button that was clicked is enter
  */

  return function (scope, element, attrs) {
    element.bind("keydown keypress", function (event) {
      if(event.which === 13) {
        scope.$apply(function (){
          scope.$eval(attrs.myEnter)
        })

        event.preventDefault()
      }
    })
  }
})

myApp.directive('compareTo', function () {
  /**
  * If used on an input field it throws an error when the value of it is different from the one it is being compared to
  */

  return {
    require: 'ngModel',
    scope: {
      otherModelValue: '=compareTo'
    },
    link: function (scope, element, attributes, ngModel) {

      ngModel.$validators.compareTo = function (modelValue) {
        return modelValue === scope.otherModelValue
      }

      scope.$watch('otherModelValue', function () {
        ngModel.$validate()
      })

    }
  }
})

myApp.service('fabService', function () {
  /**
  * Allows the secondary controllers (those of the different sections) to have full control over the FAB's behavior
  * @param {boolean} visible - Visibility state of the FAB
  * @param {function} onClick - Callback containing the function to be run onFabClick
  */

  let visible = false
  let onClick

  return {
    setVisible: function (state) {
      visible = state
    },
    getVisible: function () {
      return visible
    },
    setOnClickListener: function (callback) {
      onClick = callback
    },
    runOnClickListener: function (ev, newSignal) {
      onClick(ev, newSignal)
    }
  }
})

myApp.service('forge', function () {
  /**
  * Allows to quickly encrypt passwords using hmac
  * @constructor
  * @param {string} pass - Decrypted pass
  * @param {string} salt - Random string of chars to be used as salt by the hmac algo
  */

  return {
    hmac: function (pass, salt) {
      let hmac = forge.hmac.create()
      hmac.start('sha512', salt)
      hmac.update(pass)
      return hmac.digest().toHex()
    }
  }
})

myApp.service('windowCtrl', function () {
  /**
  * Returns an object that allows the interaction with window controls such as closing them, minimizing and maximizing
  * @constructor
  */

  const remote = require('electron').remote
  const ipcRenderer = require('electron').ipcRenderer

  return {
    login: function () {
      ipcRenderer.send('login')
    },
    logout: function () {
      ipcRenderer.send('logout')
    },
    maximize: function () {
      let window = remote.getCurrentWindow()
      if (!window.isMaximized()) {
        window.maximize()
      } else {
        window.unmaximize()
      }
    },
    minimize: function () {
      let window = remote.getCurrentWindow()
      window.minimize()
    },
    close: function () {
      let windows = remote.BrowserWindow.getAllWindows()

      angular.forEach(windows, function (window) {
        window.close()
      })
    }
  }
})

myApp.factory('ipcRenderer', function ($rootScope) {
  const ipcRenderer = require('electron').ipcRenderer

  return {
    on: function (eventName, callback) {
      ipcRenderer.once(eventName, function () {
        let args = arguments
        $rootScope.$apply(function () {
          callback.apply(ipcRenderer, args)
        })
      })
    },
    emit: function (eventName, ...data) {
      ipcRenderer.send(eventName, ...data)
    }
  }
})

myApp.factory('socket', function ($rootScope) {
  /**
  * Returns an object that can be used to interact with the nodejs portion of the app
  * @constructor
  */

  const socket = io('http://localhost:3000')
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {
        let args = arguments
        $rootScope.$apply(function () {
            callback.apply(socket, args)
        })
      })
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        let args = arguments
        $rootScope.$apply(function () {
          if (callback) {
              callback.apply(socket, args)
          }
        })
      })
    },
    removeAllListeners: function () {
      socket.removeAllListeners()
    }
  }
})

myApp.factory('toastCtrl', function ($mdToast) {
  $mdToast.active = 0

  return {
    /**
    * Shows a toast with a message and receives an action as a param
    * @param {string} msg - Message to show
    * @param {callback} callback - Action to perform onToastGone
    */
    show: function (msg, callback) {
      let toast = $mdToast.simple()
        .textContent(msg)
        .action('DESHACER')
        .highlightAction(true)
        .position('bottom right')

      $mdToast.hide()
      $mdToast.active += 1

      $mdToast.show(toast).then(function(response) {
        callback(response)

        $mdToast.active -= 1
      })
    },
    /**
    * Hides open toasts
    */
    hide: function () {
      $mdToast.hide()
    },
    /**
    * Checks whether a toast is open
    * @return {boolean} - Whether there are open toasts
    */
    active: function () {
      return $mdToast.active > 0 ? true : false
    }
  }
})

myApp.factory('notification', function () {
  const {ipcRenderer} = require('electron')

  return function (title, msg) {
      let n = new Notification(title, {
      body: msg
    })

    // Tell the notification to show the menubar popup window on click
    n.onclick = () => { ipcRenderer.send('show-window') }
  }
})

myApp.filter('myFilter', function () {
  /**
  * Works in the patient list and the surgery list
  * @param {array} items - Items to apply the filter to
  * @param {string} filter - Criteria to use, string codes are: 'operatedOrNot' which separates patients depending on whether their last registered surgery
    already took place, 'mineOrNot' which separates patients or surgeries according to whether they are the logged in user's patient or not,
    'doneOrNot' which separates surgeries whether they were already done or not
  * @param {boolean} which - Inverts filtering if false
  * @param {object} me - User that is logged in
  */

  return function (items, filter, which, me) {
    let filtered = []
    angular.forEach(items, function (item) {
      switch (filter) {
        case 'operatedOrNot':
          if (which) {
            if (!item.last_op_done) filtered.push(item)
          } else {
            if (item.last_op_done) filtered.push(item)
          }
          break
        case 'mineOrNot':
          if (which && me.type === 'surgeon') {
            if (item.surgeon.id === me.id) filtered.push(item)
          } else if (me.type === 'surgeon') {
            if (item.surgeon.id !== me.id) filtered.push(item)
          }
          break
        case 'doneOrNot':
          if (which) {
            if (!item.done) filtered.push(item)
          } else {
            if (item.done) filtered.push(item)
          }
      }
    })
    return filtered
  }
})

myApp.filter('mineOrValid', function () {
  /**
  * Will remove surgeries that are not the logged user's and/or are not yet valid if so the user desires
  * Filter wont work if logged user is an anesthetist
  * @param {array} items - Items to apply the filter to
  * @param {boolean} mineOnly - Filter and show only your surgeries
  * @param {boolean} validOnly - Filter and show only valid surgeries
  * @param {object} me - Logged user
  */

  return function (items, mineOnly, validOnly, me) {
    let filtered = []
    angular.forEach(items, function (item) {
      if (mineOnly && validOnly && me.type === 'surgeon') {
        if (item.surgeon.id === me.id && item.preop_valid !== null && item.anesthetist !== null) {
          filtered.push(item)
        }
      } else if (mineOnly && me.type === 'surgeon') {
        if (item.surgeon.id === me.id) {
          filtered.push(item)
        }
      } else if (validOnly && me.type === 'surgeon') {
        if (item.preop_valid !== null && item.anesthetist !== null) {
          filtered.push(item)
        }
      } else {
        filtered.push(item)
      }
    })
    return filtered
  }
})

myApp.filter('deadlyFilter', function () {
  /**
  * Determines whether to show dead patients or not
  * @param {array} items - List of items to which to apply the filter
  * @param {boolean} showDead - If false applies the filter, else shows everything
  */

  return function (items, showDead) {
    if (showDead) return items

    let filtered = []
    angular.forEach(items, function (item) {
      if (item.date_of_death === null)
        filtered.push(item)
    })

    return filtered
  }
})

myApp.filter('timeyFilter', function () {
  /**
  * Determines how old the oldest surgery on the list is
  * @param {array} items - List of items to paply the filter to
  * @param {string} time - String of the form 6d - equivalent to six days in the case of the example
  */

  return function (items, time) {
    if (time.length === 0) return items

    let filtered = []
    let period = Number(time.charAt(0))
    let interval = time.substring(1)

    angular.forEach(items, function (item) {
      if (item.scheduled === null) {
        filtered.push(item)
        return
      }

      if (datediff(interval, item.scheduled, new Date()) < period) filtered.push(item)
    })

    return filtered
  }
})

myApp.filter('search', function () {
  /**
  * Filter used for dynamic searches
  * @param {array} items - Array of items to filter
  * @param {string} query - Text to search for
  * @param {string} ttl - Title of the section the filter is being used at
  */

  return function (items, query, ttl) {
    if (query === undefined || query === null || query.length === 0) return items
    let filtered = []
    query = angular.lowercase(query)
    angular.forEach(items, function (item) {
      switch (ttl) { // Depending on the section it is working at it chooses the right algo
        case 'Pacientes':
        case 'Usuarios':
          let fullName = item.last + ', ' + item.name
          if (angular.lowercase(fullName).includes(query)) filtered.push(item)
          break
        case 'Cirugías':
          if (filterSurgery(item, query))
            filtered.push(item)
          break
      }
    })
    return filtered
  }
})

myApp.config(function($mdDateLocaleProvider) {
  /**
  * Change date format to show in date pickers
  */

  $mdDateLocaleProvider.formatDate = function(date) {
     return moment(date).format('D/M/YYYY')
  }
})

/**
* @param {object} item - Surgery object
* @param {string} query - Text to search for
*/
let filterSurgery = function (item, query) {
  // Begins by making an array with all the searched elements and trims them for extra safety
  let queries = query.split('-')
  for (let i = 0; i < queries.length; i++) {
    queries[i] = queries[i].trim()
  }

  let fullName = item.patient.last + ', ' + item.patient.name
  let scheduled = item.scheduled.getDate() + '/' + (item.scheduled.getMonth() + 1) + '/' + item.scheduled.getFullYear()

  // Innocent until proven otherwise
  let takeIt = true

  // Compare each inputted pattern with each possible pattern
  angular.forEach(queries, function (searching) {
    if (searching.length === 0) return

    if (!(scheduled.includes(searching) || angular.lowercase(fullName).includes(searching) || angular.lowercase(item.pathology).includes(searching) || angular.lowercase(item.type).includes(searching))) {
      takeIt = false
      return
    }
  })

  return takeIt
}

let datediff = function (p_Interval, p_Date1, p_Date2, p_FirstDayOfWeek) {
  if (p_Date1 === null) return -1

  p_FirstDayOfWeek = (isNaN(p_FirstDayOfWeek) || p_FirstDayOfWeek==0) ? 0 : parseInt(p_FirstDayOfWeek);

  //correct Daylight Savings Ttime (DST)-affected intervals ("d" & bigger)
  if("h,n,s,ms".indexOf(p_Interval.toLowerCase())==-1){
    if(p_Date1.toString().indexOf(":") ==-1){ p_Date1.setUTCHours(0,0,0,0) };	// no time, assume 12am
    if(p_Date2.toString().indexOf(":") ==-1){ p_Date2.setUTCHours(0,0,0,0) };	// no time, assume 12am
  }


  // get ms between UTC dates and make into "difference" date
  var iDiffMS = p_Date2.valueOf() - p_Date1.valueOf();
  var dtDiff = new Date(iDiffMS);

  // calc various diffs
  var nYears  = p_Date2.getUTCFullYear() - p_Date1.getUTCFullYear();
  var nMonths = p_Date2.getUTCMonth() - p_Date1.getUTCMonth() + (nYears!=0 ? nYears*12 : 0);
  var nQuarters = parseInt(nMonths / 3);

  var nMilliseconds = iDiffMS;
  var nSeconds = parseInt(iDiffMS / 1000);
  var nMinutes = parseInt(nSeconds / 60);
  var nHours = parseInt(nMinutes / 60);
  var nDays  = parseInt(nHours / 24);	//now fixed for DST switch days
  var nWeeks = parseInt(nDays / 7);

  if(p_Interval.toLowerCase()=='ww'){
      // set dates to 1st & last FirstDayOfWeek
      var offset = Date.DatePart("w", p_Date1, p_FirstDayOfWeek)-1;
      if(offset){	p_Date1.setDate(p_Date1.getDate() +7 -offset);	}
      var offset = Date.DatePart("w", p_Date2, p_FirstDayOfWeek)-1;
      if(offset){	p_Date2.setDate(p_Date2.getDate() -offset);	}
      // recurse to "w" with adjusted dates
      var nCalWeeks = Date.DateDiff("w", p_Date1, p_Date2) + 1;
  }

  // return difference
  switch(p_Interval.toLowerCase()){
    case "yyyy": return nYears;
    case "q": return nQuarters;
    case "m": return nMonths;
    case "y": // day of year
    case "d": return nDays;
    case "w": return nWeeks;
    case "ww":return nCalWeeks; // week of year
    case "h": return nHours;
    case "n": return nMinutes;
    case "s": return nSeconds;
    case "ms":return nMilliseconds;
    default : return "invalid interval: '" + p_Interval + "'";
  }
}
