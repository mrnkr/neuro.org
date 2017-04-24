'use strict'

const electron = require('electron')
const path = require('path')
const fs = require('fs')

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain
const dialog = electron.dialog

let loginWindow = null
let mainWindow = null
let printWindow = null

require('../nodejs/server.js')

let prepareEnvironment = function() {
  loginWindow = new BrowserWindow({
      height: 425,
      width: 550,
      show: false,
      resizable: false,
      frame: false
  })

  loginWindow.on('closed', function () {
    if (process.platform !== 'darwin')
      app.quit()
  })

  mainWindow = new BrowserWindow({
      height: 720,
      width: 1024,
      show: false,
      resizable: true,
      frame: false
  })

  mainWindow.on('closed', function () {
    if (process.platform !== 'darwin')
      app.quit()
  })

  printWindow = new BrowserWindow({
    height: 720,
    width: 1024,
    show: false
  })

  // Mac gets its icon from the electron-packager - windows does too but needs this icon as well - linux needs only this one
  switch (process.platform) {
    case 'win32':
      loginWindow.setIcon(__dirname + '/../img/logo.ico')
      mainWindow.setIcon(__dirname + '/../img/logo.ico')
      break
    case 'linux':
      loginWindow.setIcon(__dirname + '/../img/logo.png')
      mainWindow.setIcon(__dirname + '/../img/logo.png')
      break
  }

  mainWindow.openDevTools()

  loginWindow.loadURL('file://' + __dirname + '/../login/login.html')

  loginWindow.once('ready-to-show', function () {
    loginWindow.show()
  })

  printWindow.loadURL('file://' + __dirname + '/../print.html')

  require('./menu.js')
}

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }

})

app.on('ready', prepareEnvironment)

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (process.platform === 'darwin') {
    try {
      if (!mainWindow.isVisible() && !loginWindow.isVisible())
        prepareEnvironment()
    } catch (e) {
      prepareEnvironment()
    }
  }
})

/**
* Graphical login response
*/

ipcMain.on('login', function (event) {
  mainWindow.loadURL('file://' + __dirname + '/../index.html')

  // Uisng ready-to-show here leads to errors
  setTimeout(function () {
    mainWindow.show()
    loginWindow.hide()
  }, 1000)
})

ipcMain.on('logout', function (event) {
  loginWindow.loadURL('file://' + __dirname + '/../login/login.html')

  // Using ready-to-show here leads to errors
  setTimeout(function () {
    mainWindow.hide()
    loginWindow.show()
  }, 1000)
})

/**
* End graphical login response
*/

/**
* Modal windows
*/

let modals = []

// Types
const patient = 0
const surgery = 1
const user = 2
const usermod = 3

ipcMain.on('open-modal', function (event, type, content) {
  // If there already are open modals
  if (modals.length > 0)
    modals[modals.length - 1].hide() // Hide the one visible

  // Create a new modal
  modals.push(new BrowserWindow({
    parent: mainWindow,
    modal: true,
    show: false
  }))

  // Load the right dialog
  switch (type) {
    case patient:
      modals[modals.length - 1].loadURL('file://' + __dirname + '/../dialogs/patient.html')
      break
    case surgery:
      modals[modals.length - 1].loadURL('file://' + __dirname + '/../dialogs/surgery.html')
      break
    case user:
      modals[modals.length - 1].loadURL('file://' + __dirname + '/../dialogs/user.html')
      break
    case usermod:
      modals[modals.length - 1].loadURL('file://' + __dirname + '/../dialogs/user-edit.html')
  }

  // Show the new modal gracefully after passing the necessary data to it
  modals[modals.length - 1].once('ready-to-show', () => {
    modals[modals.length - 1].webContents.send('data-to-show', content)
    modals[modals.length - 1].show()
  })
})

ipcMain.on('deliver-data-to-papa', function (event, object) {
  if (modals.length > 1) { // If more than one modals exist
    modals[modals.length - 2].webContents.send('send-data-to-daddy', object) // Send the object to the parent modal
  } else {
    mainWindow.webContents.send('send-data-to-daddy', object) // If not send it to the mainWindow
  }
})

ipcMain.on('close-modal', function (event) {
  // Close the last modal on the list
  modals[modals.length - 1].close()
  modals.splice(modals.length - 1, 1)

  // If there is another one show it
  if (modals.length > 0)
    modals[modals.length - 1].show()
})

/**
* End modals
*/

/**
* Print service events
*/

ipcMain.on('print', function (event, content) {
  printWindow.webContents.send('print', content)
})

ipcMain.on('readyToPrint', (event) => {
  printWindow.webContents.printToPDF({marginsType: 0, // marginsType = 0 means default margins
                                      pageSize: 'A4',
                                      printBackground: true,
                                      landscape: false}, function (error, data) {
                                        if (error) return

                                        dialog.showSaveDialog({title: 'Imprimir a PDF',
                                                               buttonLabel: 'Imprimir',
                                                               filters: [{name: 'PDF File', extensions: ['pdf']}]}, function (path) { // filters restricts file extensions to only pdf
                                                                 if (path === undefined) return

                                                                 fs.writeFile(path, data, function (e) { // If path is not undefined then save the file :)
                                                                   if (e) console.log('error writig file')
                                                                 })
                                                               })
                                      })
})

/**
* End print service
*/
