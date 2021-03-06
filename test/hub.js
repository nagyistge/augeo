
  /***************************************************************************/
  /* Augeo.io is a web application that uses Natural Language Processing to  */
  /* classify a user's internet activity into different 'skills'.            */
  /* Copyright (C) 2016 Brian Redd                                           */
  /*                                                                         */
  /* This program is free software: you can redistribute it and/or modify    */
  /* it under the terms of the GNU General Public License as published by    */
  /* the Free Software Foundation, either version 3 of the License, or       */
  /* (at your option) any later version.                                     */
  /*                                                                         */
  /* This program is distributed in the hope that it will be useful,         */
  /* but WITHOUT ANY WARRANTY; without even the implied warranty of          */
  /* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           */
  /* GNU General Public License for more details.                            */
  /*                                                                         */
  /* You should have received a copy of the GNU General Public License       */
  /* along with this program.  If not, see <http://www.gnu.org/licenses/>.   */
  /***************************************************************************/

  /***************************************************************************/
  /* Description: File that is ran to execute test cases. Houses all test    */
  /*              cases.                                                     */
  /***************************************************************************/

  // Schemas
  require('../src/model/schema/augeo/activity');
  require('../src/model/schema/augeo/user');
  require('../src/model/schema/github/user');
  require('../src/model/schema/twitter/tweet');
  require('../src/model/schema/twitter/user');

  // Required local modules
  var App = require('../src/server');
  var Helper = require('./helper/db-helper');
  var Common = require('./data/common');

  function importTests(name, path, app) {
    describe(name, function () {
      if(app) {
        require(path)(app);
      } else {
        require(path);
      }
    });
  };

  describe('Common', function() {
    importTests('activity', './test-case/common/activity');
    importTests('commit', './test-case/common/commit');
    importTests('tweet', './test-case/common/tweet');
  });

  describe('Module', function() {
    importTests('logger', './test-case/module/logger');
  });

  describe('Validator', function() {
    importTests('Augeo Validator', './test-case/validator/augeo-validator');
    importTests('Twitter Validator', './test-case/validator/twitter-validator');
  });

  describe('Utility', function() {
    importTests('augeoUtility', './test-case/utility/augeo-utility');
    importTests('twitterUtility', './test-case/utility/twitter-utility');
  });

  describe('Test Interface', function() {
    importTests('githubTestInterface', './test-case/test-interface/github-test-interface');
    importTests('twitterTestInterface', './test-case/test-interface/twitter-test-interface');
  });

  describe('Interface Service', function() {
    importTests('twitterInterfaceService', './test-case/interface-service/twitter-interface-service');
    importTests('githubInterfaceService', './test-case/interface-service/github-interface-service');
  });

  describe('Service', function() {
    importTests('userService', './test-case/service/user-service.js');
    importTests('githubService', './test-case/service/github-service.js');
    importTests('twitterService', './test-case/service/twitter-service.js');
    importTests('userServiceDependent', './test-case/service/user-service-dependent.js');

    after(function(done) {
      this.timeout(Common.TIMEOUT);
      Helper.cleanAugeoDB(function() {
        done();
      });
    });
  });

  describe('Queue Task', function() {

    before(function(done) {
      this.timeout(Common.TIMEOUT);
      Helper.addTestUsers(function() {
        done();
      });
    });

    importTests('githubEventTask', './test-case/queue-task/github/github-event-task.js');
    importTests('twitterAddActivityTask', './test-case/queue-task/twitter/stream/twitter-add-activity-task.js');
    importTests('twitterConnectTask', './test-case/queue-task/twitter/stream/twitter-connect-task.js', App);
    importTests('twitterEventTask', './test-case/queue-task/twitter/event/twitter-event-task.js');
    importTests('twitterMentionTask', './test-case/queue-task/twitter/event/twitter-mention-task.js');
    importTests('twitterRemoveActivityTask', './test-case/queue-task/twitter/stream/twitter-remove-activity-task.js');
    importTests('twitterTweetTask', './test-case/queue-task/twitter/event/twitter-tweet-task.js');

    // Clean database
    after(function(done) {
      this.timeout(Common.TIMEOUT);
      Helper.cleanAugeoDB(function(){
        done();
      });
    });
  });

  describe('Queue', function() {

    // Add Twitter users to database
    beforeEach(function(done) {
      this.timeout(Common.TIMEOUT);
      Helper.addTestUsers(function() {
        done();
      });
    });

    importTests('githubEventQueue', './test-case/queue/github-event-queue');
    importTests('twitterEventQueue', './test-case/queue/twitter-event-queue');
    importTests('twitterStreamQueue', './test-case/queue/twitter-stream-queue');
    importTests('twitterConnectQueue', './test-case/queue/twitter-connect-queue');
    importTests('baseEventQueue', './test-case/queue/base-queue');

    // Clean database
    afterEach(function(done) {
      this.timeout(Common.TIMEOUT);
      Helper.cleanAugeoDB(function(){
        done();
      });
    });
  });

  describe('User API', function() {
    importTests('Add User', './test-case/api/user-api/add-user');
    importTests('getActivityDisplayData', './test-case/api/user-api/get-activity-display-data', App);
    importTests('getCompetitors', './test-case/api/user-api/get-competitors', App);
    importTests('getDashboardDisplayData', './test-case/api/user-api/get-dashboard-display-data', App);
    importTests('getLeaderboardDisplayData', './test-case/api/user-api/get-leaderboard-display-data', App);
    importTests('Login', './test-case/api/user-api/login');
    importTests('Session', './test-case/api/user-api/session');
    importTests('Remove User', './test-case/api/user-api/remove-user', App);
    importTests('Save Profile Data', './test-case/api/user-api/save-profile-data', App);
  });

  describe('Admin API', function() {
    importTests('Set Log Level', './test-case/api/admin-api/set-log-level', App);
  });

  describe('Github API', function() {
    importTests('callback', './test-case/api/github-api/callback', App);
    importTests('getAuthenticationData', './test-case/api/github-api/get-authentication-data', App);
    importTests('getQueueWaitTimes', './test-case/api/github-api/get-queue-wait-times', App);
  });

  describe('Twitter API', function() {
    importTests('getAuthenticationData', './test-case/api/twitter-api/get-authentication-data', App);
    importTests('callback', './test-case/api/twitter-api/callback', App);
    importTests('getQueueWaitTimes', './test-case/api/twitter-api/get-queue-wait-times', App);
  });

   describe('Twitter Dependent User API', function() {
     importTests('getSkillActivity', './test-case/api/user-api/get-skill-activity', App);
     importTests('Set Profile Image', './test-case/api/user-api/set-profile-image', App);
   });

  describe('Interface', function() {
    importTests('Twitter', './test-case/interface/twitter');
    importTests('Github', './test-case/interface/github');
  });