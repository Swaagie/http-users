
exports.resource = function (app) {
  //
  // Grab the `User` resource from the `app`.
  //
  var User = app.resources.User;
  
  //
  // Setup the filter for finding users by inviteCode.
  //
  User.filter('byInviteCode', { include_docs: true }, {
    map: function (doc) {
      if (doc.resource === 'User' && doc.inviteCode) {
        emit(doc.inviteCode, {_id: doc._id });
      }
    }
  });
  
  //
  // ### function confirm (username, creds, callback)
  // #### @username {string} Username to confirm status of.
  // #### @creds {Object} Properties to use when checking the inviteCode.
  // #### @callback {function} Continuation to respond to.
  //
  // Sets the status of the `username` specified if the user making the 
  // request has appropriate permissions or if the appropriate inviteCode 
  // is supplied in `creds`.
  //
  User.prototype.confirm = function (username, creds, callback) {
    if (!callback && typeof creds === 'function') {
      callback = creds;
      creds = username;
      username = null;
    }
    
    function updateStatus(target, state) {
      target.status = state || 'pending';
      User.update(username, target, function (err, res) {
        if (err) {
          return callback(err);
        }

        if (target.status === 'pending') {
          userMailer.sendConfirm(target, function (err) {
            return err ? callback(err) : callback(null, target);
          });
        }
        else {
          return err ? callback(err) : callback(null, target);
        }
      });
    }
    
    if (!username && !creds.inviteCode) {
      //
      // An invite code was not provided and the user is 
      // attempting to confirm themselves.
      //
      return callback(new Error('Invalid Invite Code'));
    }
    else if ((!username || username === this.username)
      && creds.inviteCode) {
      User.byInviteCode(creds.inviteCode, function (err, users) {
        if (err) {
          return callback(err);
        }

        if (users.length > 0) {
          //
          // We found a user who matched the invite code, so we will set them to
          // 'active' in the database.
          //
          updateStatus(users[0], 'active');
        }
        else {
          //
          // We did not find any users who matched that invite code, consider it invalid
          //
          return callback(new Error('Invalid Invite Code'));
        }
      });
    }
    else {
      //
      // Confirmation by the superuser results in a status of 'pending', and
      // sends the user an email with further instructions.
      //
      updateStatus(current, 'pending');
    }
  };
};

exports.routes = function (app) {
  app.unauthorized.path(/\/users/, function () {
    //
    // Activate user account: Shortcut method for confirming new accounts
    //
    this.post(/\/([\w\-\.]+)\/confirm/, function (id) {
      //
      // Attempt to authenticate with the user provided
      // Remark (indexzero): Is passing null for `body` bad here?
      //
      var req = this.req,
          res = this.res,
          data = req.body;

      app.basicAuth.call({ req: req }, function (err) {
        req.user.confirm(id, data, function (err, user) {
          if (err) {
            return res.json(400, { error: err.message });
          }

          //
          // If the user does not have a password set, send them
          // one now.
          //
          if (typeof user.password === 'undefined') {
            controllers.user.forgot(id, { sendEmail: false }, function (err, user) {
              res.json(200, {
                message: 'Your ninja status has been confirmed!',
                shake: user.shake,
                hasPassword: false
              });
            });
          } 
          else {
            //
            // User has already set a password for their account
            //
            res.json(200, {
              message: 'Your ninja status has been confirmed!',
              hasPassword: true
            });
          }
        });
      });
    });
  });
};