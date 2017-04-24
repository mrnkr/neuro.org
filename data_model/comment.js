let Comment = class Comment extends Base {
  static extractUser (item) {
    return new User({
      id: item.user_id,
      name: item.user_name,
      last: item.user_last,
      email: item.user_email,
      type: item.user_type,
      admin: item.user_admin,
      active: item.user_active
    })
  }

  /**
  * Fixes comment objects coming from the database in order for them to adapt to the data model
  * @param {array} comments - Comment array as it came from the database
  * @return {array} - List of instances of the Comment class
  */
  static prepareCommentList (comments) {
    let ret_val = []

    for (let i = 0; i < comments.length; i++) {
      let comment = new Comment(comments[i])
      comment.user = Comment.extractUser(comments[i])

      ret_val.push(comment)
    }

    return ret_val
  }

  constructor (item) {
    super()

    if (item == null) {
      this.id = ''
      this.moment = new Date()
      this.content = ''
      this.surgery_id = ''
    } else {
      this.id = item.id
      this.moment = new Date(item.moment)
      this.content = item.content
      this.surgery_id = item.surgery_id
    }

    this.user = null
  }

  get jsonForDatabase () {
    return {
      id: this.id,
      moment: this.moment.getFullYear() + '-' + (this.moment.getMonth() + 1) + '-' + this.moment.getDate(),
      content: this.content,
      user_id: this.user.id,
      surgery_id: this.surgery_id
    }
  }
}
