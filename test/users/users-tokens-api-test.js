/*
 * users-tokens-api-test.js: Tests for the RESTful users API tokens.
 *
 * (C) 2012, Nodejitsu Inc.
 *
 */

var assert  = require('assert'),
    apiEasy = require('api-easy'),
    app     = require('../fixtures/app/couchdb'),
    macros  = require('../macros'),
    base64  = require('flatiron').common.base64;

var port = 8080,
    postToken;

apiEasy.describe('http-users/user/api/tokens')
  .addBatch(macros.requireStart(app))
  .addBatch(macros.seedDb(app))
  .use('localhost', port)
  .setHeader('Content-Type', 'application/json')
  //
  // Charlie is an admin user
  //
  .setHeader('Authorization', 'Basic ' + base64.encode('charlie:1234'))
  .put('/users/charlie/tokens/test-token', {})
    .expect(201)
    .expect("should return the token that was created", function (err, r, b){
      var result = JSON.parse(b);
      assert.isObject(result);
      assert.isString(result["test-token"]);
    })
  .next()
  .post('/users/charlie/tokens', {})
    .expect(201)
    .expect("should return the token that was created", function (err, r, b){
      var result = JSON.parse(b);
      assert.isObject(result);
      for (var key in result) {
        postToken = key;
        break;
      }
      assert.isString(postToken);
    })
  .next()
  .del('/users/charlie/tokens/test-token')
    .expect(201)
    .expect("should delete the token", function (err, r, b){
      var result = JSON.parse(b);
      assert.isObject(result);
      assert.ok(result.ok);
      assert.equal(result.id, "test-token");
    })
  .next()
  .get('/users/charlie/tokens')
    .expect(200)
    .expect('should respond with all tokens for the user', function (err, res, body) {
      var result = JSON.parse(body); 
      assert.isObject(result);
      assert.isObject(result.apiTokens);
      assert.isString(result.apiTokens[postToken]);
      assert.isString(result.apiTokens.seeded);
      assert.isUndefined(result.apiTokens["test-token"]);
    })
  .next()
  //
  // Maciej is a non admin user
  //
  .setHeader('Authorization', 'Basic ' + base64.encode('maciej:1234'))
  .get('/users/maciej/tokens')
    .expect(200)
    .expect('should respond with all tokens for the user', function (err, res, body) {
      var result = JSON.parse(body); 
      assert.isObject(result);
      assert.isObject(result.apiTokens);
    })
  .next()
  .get('/users/elijah/tokens')
    .expect(403)
    .expect('should not have permissions to see other tokens', function (err, res, body) {
      assert.isNull(err);
      assert.equal(body.trim(), "Not authorized to modify users");
    })
["export"](module);
