
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
  /* Description: Handles logic related to interfacing with Github           */
  /***************************************************************************/

  var githubInterfaceUrl = process.env.TEST === 'true' ? '../../test/test-interface/github-test-interface' : '../interface/github-interface';

  // Required local modules
  var Commit = require('../public/javascript/common/commit');
  var GithubInterface = require(githubInterfaceUrl);
  var Logger = require('../module/logger');

  // Constants
  var SERVICE = 'github-interface_service';

  // Global variables
  var log = new Logger();

  exports.getAccessToken = function(code, logData, callback) {
    log.functionCall(SERVICE, 'getAccessToken', logData.parentProcess, logData.username, {'code':(code)?'valid':'invalid'});

    GithubInterface.getAccessToken(code, logData, function(data) {

      var accessToken = '';
      if(data) {
        accessToken = JSON.parse(data).access_token;
      }

      callback(accessToken);
    });
  };

  exports.getCommits = function(user, accessToken, path, eTag, lastEventId, logData, callback) {
    log.functionCall(SERVICE, 'getCommits', logData.parentProcess, logData.username, {'userId':(user)?user._id:'invalid', 'accessToken':(accessToken)?'valid':'invalid', 'path': path,
      'eTag':eTag, 'lastEventId':lastEventId});

    GithubInterface.getPushEvents(accessToken, path, eTag, logData, function(data, headers) {
      var status = headers['status'];

      var commits = new Array();
      var result = {
        commits: commits,
        eTag: (headers['etag'])?headers['etag']:eTag,
        poll: (headers['x-poll-interval'])?headers['x-poll-interval']*1000:60000,
        wait: calculateNextRequestWaitTime(headers)
      };

      if(status.indexOf('200') > -1) { // If there are results..

        result.path = extractNextRequestPath(headers['link']);

        var events = JSON.parse(data);
        for (var i = 0; i < events.length; i++) {

          // Add commits until last eventId is found
          if(!lastEventId || parseInt(events[i].id) > parseInt(lastEventId)) {
            commits = commits.concat(extractPushCommits(user, events[i]));
          } else {
            // Set path to null if last eventId is found
            result.path = null;
            break;
          }
        }

        if(commits.length > 0) {
          var updatedCommits = new Array();

          // Retrieve detailed commit data
          (function myClojure(i) {
            var commit = commits[i];

            GithubInterface.getCommit(accessToken, commit, logData, function (detailedCommit) {
              detailedCommit = JSON.parse(detailedCommit);

              if (detailedCommit && detailedCommit.stats) {
                commit.additions = detailedCommit.stats.additions;
                commit.deletions = detailedCommit.stats.deletions;
                commit.experience = (commit.additions > 0)?commit.additions:1;

                updatedCommits.push(commit);
              }

              i++;
              if (i < commits.length) {
                myClojure(i);
              } else {
                result.commits = updatedCommits;
                callback(result);
              }
            });
          })(0); // Pass i as 0 and myArray to myClojure
        } else {
          callback(result);
        }
      } else if (status.indexOf('304') > -1) { // No changes
        log.functionCall(SERVICE, 'getCommits', logData.parentProcess, logData.username, {}, '304 - Not Modified');
        callback(result);
      }
    });
  };

  exports.getUserData = function(accessToken, logData, callback) {
    log.functionCall(SERVICE, 'getUserData', logData.parentProcess, logData.username, {'accessToken': (accessToken)?'valid':'invalid'});

    GithubInterface.getUserData(accessToken, logData, function(userData) {

      var user = {};
      if(userData) {
        var json = JSON.parse(userData);
        user = {
          accessToken:accessToken,
          githubId: json.id,
          name: json.name,
          profileImageUrl: json.avatar_url,
          screenName: json.login
        };
      }
      callback(user);
    });
  };

  /***************************************************************************/
  /* Private functions                                                       */
  /***************************************************************************/

  var calculateNextRequestWaitTime = function(headers) {

    var wait = 600000; // 10 min
    if(headers['x-ratelimit-reset'] && headers['x-ratelimit-remaining']) {
      var resetTime = headers['x-ratelimit-reset'] * 1000;
      var currentTime = (new Date).getTime();
      var remainingTime = resetTime - currentTime;

      var remainingRequests = headers['x-ratelimit-remaining'];
      if (remainingTime >= 0) {
        wait = (remainingTime / remainingRequests) + 100;
      } else {
        wait = 1000;
      }
    }

    return wait;
  };

  var extractNextRequestPath = function(linkHeader) {
    var path = null;
    if(linkHeader) {
      var links = linkHeader.split(',');
      for (var i = 0; i < links.length; i++) {
        if (links[i].indexOf('rel="next"') > -1) {
          path = links[i].substring(links[i].indexOf('.com') + 4, links[i].indexOf('>'))
        }
      }
    }
    return path;
  };

  var extractPushCommits = function(user, event) {

    var commits = new Array;
    var commitJson = {
      classification: 'Technology',
      classificationGlyphicon: 'glyphicon-phone',
      kind: 'GITHUB_COMMIT',
      user: user._id
    };
    if(event.type == 'PushEvent' && event.public == true) {

      commitJson.timestamp = event.created_at;
      commitJson.eventId = event.id;

      if(event.actor) {
        var actor = event.actor;
        commitJson.avatarImageSrc = actor.avatar_url;
        commitJson.githubId = actor.id;
        commitJson.screenName = actor.display_login;
      }

      if(event.repo) {
        commitJson.repo = event.repo.name;
      }

      if(event.payload) {
        if(event.payload.commits) {
          var rawCommits = event.payload.commits;
          for(var j = 0; j < rawCommits.length; j++) {
            var rawCommit = rawCommits[j];
            if(rawCommit.distinct == true) {
              if (rawCommit.author) {
                var authorName = rawCommit.author.name;
                var authorEmail = rawCommit.author.email;
                if((authorName.indexOf(user.firstName) > -1 && authorName.indexOf(user.lastName) > -1) || authorEmail.indexOf(user.email) > -1) {
                  commitJson.name = rawCommit.author.name
                }
              }
              commitJson.text = rawCommit.message;
              commitJson.sha = rawCommit.sha;

              if(commitJson.name) {
                commits.push(new Commit(commitJson));
              }
            }
          }
        }
      }
    }
    return commits;
  };
