let Base = class Base {
  static copy () {
    return null
  }

  /**
  * Makes a random string to use as ID - checks that it wasnt used yet (verifies that it is not already in the ids array)
  * @param {array} ids - Previously used ids
  * @return {string} - The new id
  */
  static makeid (ids) {
    let text = '' // Will contain the new id
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' // Set of possible chars

    for( let i = 0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length)) // Make a 5 char long string - new id

    if (ids.indexOf(text) !== -1) // If it was already in use
      return makeid() // Repeat

    return text
  }

  constructor () {
    
  }

  get jsonForDatabase () {
    return {}
  }
}
