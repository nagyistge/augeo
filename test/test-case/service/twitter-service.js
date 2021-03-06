
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
  /* Description: Unit test cases for service/twitter-service                */
  /***************************************************************************/

  // Required libraries
  var Assert = require('assert');
  var Should = require('should');

  // Required local modules
  var AugeoDB = require('../../../src/model/database');
  var AugeoUtility = require('../../../src/utility/augeo-utility');
  var Common = require('../../data/common');
  var TwitterData = require('../../data/twitter-data');
  var TwitterInterfaceService = require('../../../src/interface-service/twitter-interface-service');
  var TwitterService = require('../../../src/service/twitter-service');
  var TwitterUtility = require('../../../src/utility/twitter-utility');

  // Global variables
  var Activity = AugeoDB.model('ACTIVITY');
  var Tweet = AugeoDB.model('TWITTER_TWEET');
  var User = AugeoDB.model('AUGEO_USER');
  var TwitterUser = AugeoDB.model('TWITTER_USER');

  // addUserSecretToken
  it("should add user's secret token to database -- addUserSecretToken()", function(done) {
    this.timeout(Common.TIMEOUT);

    // Generate sample secretToken
    TwitterInterfaceService.getOAuthRequestToken(Common.logData, function(token, secretToken) {

      // Function should rollback due to invalid user ID
      TwitterService.addUserSecretToken('', secretToken, Common.logData, function(){}, function() {

        // Get user's _id from database
        User.getUserWithUsername(Common.USER.username, Common.logData, function(user) {

          // Should add user's secret token to database successfully
          TwitterService.addUserSecretToken(user._id, secretToken, Common.logData, function() {

            // Verify user's secret token was updated
            TwitterUser.getTokens(user._id, Common.logData, function(tokens) {
              Assert.strictEqual(tokens.secretToken, secretToken);
              done();
            });
          }, function(){});
        });
      });
    }, function(){});
  });

  // updateTwitterInfo
  it("should add Test Tester's Twitter information to database entry -- updateTwitterInfo()", function(done) {
    this.timeout(Common.TIMEOUT);

    // Get Test Tester's user id from database
    User.getUserWithUsername(Common.USER.username, Common.logData, function(user) {
      Assert.ok(user._id);

      // Get Test Tester's twitter information from database
      var twitterMessenger = '';
      TwitterInterfaceService.getTwitterUser(twitterMessenger, TwitterData.USER_TWITTER.screenName, Common.logData, function(userData) {

        Assert.ok(userData.twitterId);
        Assert.strictEqual(userData.name, Common.USER.fullName);

        userData.accessToken = TwitterData.USER_TWITTER.accessToken;
        userData.secretAccessToken = TwitterData.USER_TWITTER.secretAccessToken;

        TwitterService.updateTwitterInfo(user._id, Common.USER, userData, Common.logData, function() {

          // Retrieve Test Tester again from database to verify information was updated
          User.getUserWithUsername(Common.USER.username, Common.logData, function(userAfterUpdate) {

            Assert.strictEqual(userAfterUpdate.firstName, Common.USER.firstName);
            Assert.strictEqual(userAfterUpdate.lastName, Common.USER.lastName);
            Assert.strictEqual(userAfterUpdate.twitter.twitterId, TwitterData.USER_TWITTER.twitterId);
            Assert.strictEqual(userAfterUpdate.twitter.name, Common.USER.fullName);
            Assert.strictEqual(userAfterUpdate.twitter.screenName, TwitterData.USER_TWITTER.screenName);
            Assert.strictEqual(userAfterUpdate.skill.imageSrc, Common.USER.skill.imageSrc);
            userAfterUpdate.skill.level.should.be.aboveOrEqual(1);
            userAfterUpdate.skill.experience.should.be.aboveOrEqual(0);

            var subSkills = userAfterUpdate.subSkills;
            for(var i = 0; i < subSkills.length; i++) {
              subSkills[i].level.should.be.aboveOrEqual(1);
              subSkills[i].experience.should.be.aboveOrEqual(0);
            }
            done();
          });
        }, function(){});
      }, function(){});
    });
  });

  // addAction
  it("should update TWEET/MENTION/USER collections for Test Tester's actions -- addAction()", function(done) {
    this.timeout(Common.TIMEOUT);

    // Standard Tweet from Test Tester
    var action0 = TwitterInterfaceService.extractAction(TwitterData.rawStandardTweet, Common.logData);
    var tweet0 = TwitterInterfaceService.extractTweet(TwitterData.rawStandardTweet, false, Common.logData);

    var experience = 0;
    // Determine initial skill experience
    User.getUserWithUsername(Common.USER.username, Common.logData, function(user0) {
      experience = user0.skill.experience;

      TwitterService.addAction(action0, tweet0, Common.logData, function(classification0) {

        // Verify activity was added
        Tweet.getTweet(tweet0.tweetId, Common.logData, function(returnedTweet0) {
          Activity.getActivity(user0.id, returnedTweet0._id, Common.logData, function(returnedActivity0) {
            Assert.strictEqual(returnedActivity0.experience, TwitterUtility.TWEET_EXPERIENCE + TwitterUtility.RETWEET_EXPERIENCE);
            experience += returnedActivity0.experience;

            // Verify experience was added to twitter skill
            User.getUserWithUsername(Common.USER.username, Common.logData, function(user1) {
              Assert.strictEqual(user1.skill.experience, experience);

              // A tweet with Test Tester mentioned
              var action1 = TwitterInterfaceService.extractAction(TwitterData.rawMentionOfTestUser, Common.logData);
              var tweet1 = TwitterInterfaceService.extractTweet(TwitterData.rawMentionOfTestUser, false, Common.logData);

              TwitterService.addAction(action1, tweet1, Common.logData, function(classification1) {

                // Verify tweet was added for user doing the mentioning
                Tweet.getTweet(tweet1.tweetId, Common.logData, function(returnedTweet1) {
                  Activity.getActivity(user0._id, returnedTweet1._id, Common.logData, function(returnedActivity1) {

                    Assert.strictEqual(returnedTweet1.screenName, TwitterData.ACTIONEE_TWITTER.screenName);
                    returnedTweet1.mentions.indexOf(TwitterData.USER_TWITTER.screenName).should.be.above(-1);
                    Assert.strictEqual(returnedActivity1.experience, TwitterUtility.TWEET_EXPERIENCE);
                    experience += returnedActivity1.experience;

                    // Verify experience was added to twitter skill
                    User.getUserWithUsername(Common.USER.username, Common.logData, function(user2) {
                      Assert.strictEqual(user2.skill.experience, experience);

                      // User retweets Test Tester's post
                      var action2 = TwitterInterfaceService.extractAction(TwitterData.rawRetweetOfUser, Common.logData);
                      var tweet2 = TwitterInterfaceService.extractTweet(TwitterData.rawRetweetOfUser, false, Common.logData);

                      // Get original experience and retweet count of tweet to be retweeted
                      Tweet.getTweet(action2.retweetId, Common.logData, function(returnedTweet2) {
                        Activity.getActivity(user0._id, returnedTweet2._id, Common.logData, function(returnedActivity2) {
                          var originalTweetExperience = returnedActivity2.experience;
                          var originalRetweetCount = returnedTweet2.retweetCount;

                          TwitterService.addAction(action2, tweet2, Common.logData, function(classification2) {

                            // Verify tweet was added for user doing retweeting
                            User.getUserWithUsername(Common.ACTIONEE.username, Common.logData, function(user3) {
                              Tweet.getTweet(tweet2.tweetId, Common.logData, function(returnedTweet3) {
                                Activity.getActivity(user3._id, returnedTweet3._id, Common.logData, function(returnedActivity3) {
                                  Assert.strictEqual(returnedTweet3.screenName, TwitterData.ACTIONEE_TWITTER.screenName);
                                  Assert.strictEqual(returnedActivity3.experience, TwitterUtility.TWEET_EXPERIENCE);
                                  experience += TwitterUtility.RETWEET_EXPERIENCE;

                                  // Verify original tweet's experience and retweet count increased
                                  Tweet.getTweet(action2.retweetId, Common.logData, function(returnedTweet4) {
                                    Activity.getActivity(user0._id, returnedTweet4._id, Common.logData, function(returnedActivity4) {
                                      Assert.strictEqual(returnedActivity4.experience, originalTweetExperience + TwitterUtility.RETWEET_EXPERIENCE);
                                      Assert.strictEqual(returnedTweet4.retweetCount, originalRetweetCount + 1);

                                      // Verify user's skill experience
                                      User.getUserWithUsername(Common.USER.username, Common.logData, function(user3) {
                                        Assert.strictEqual(user3.skill.experience, experience);
                                        done();
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  // addMentions
  it('should add mentions from raw mention collection -- addMentions()', function(done) {
    this.timeout(Common.TIMEOUT);

    var twitterMessenger = {};
    TwitterInterfaceService.getMentions(twitterMessenger, Common.logData, function(error, mentionTweets) {

      var tweetIDs = new Array();
      for(var i = 0; i < mentionTweets.length; i++) {
        // Add tweet ids to array to check if they exist in DB
        tweetIDs.push(mentionTweets[i].tweetId)

        // Change user of tweet to Actionee so DB is easier to clean up
        mentionTweets[i].twitterId = TwitterData.ACTIONEE_TWITTER.twitterId;
        mentionTweets[i].screenName = TwitterData.ACTIONEE_TWITTER.screenName;
        mentionTweets[i].name = Common.ACTIONEE.fullName;
      }

      TwitterUser.getUserWithScreenName(TwitterData.USER_TWITTER.screenName, Common.logData, function(userBefore) {
        var initialExperience = userBefore.skill.experience;
        TwitterService.addTweets(userBefore._id, TwitterData.USER_TWITTER.screenName, mentionTweets, true, Common.logData, function() {
          TwitterUser.getUserWithScreenName(TwitterData.USER_TWITTER.screenName, Common.logData, function(userAfter) {
            Assert.strictEqual(userAfter.skill.experience, initialExperience + tweetIDs.length * TwitterUtility.MENTION_EXPERIENCE);

            // Asynchronous method calls in loop - Using Recursion
            // Verify tweets are in database
            (function checkTweets(i) {
              Tweet.getTweet(tweetIDs[i], Common.logData, function(returnedTweet) {
                Assert.ok(returnedTweet);
                returnedTweet._id.should.be.ok();
                i++;
                if(i < tweetIDs.length) {
                  checkTweets(i);
                } else {
                  done();
                }
              });
            })(0); // Pass i as 0
          });
        });
      });
    });
  });

  // addTweets
  it('should add tweets from raw tweets collection -- addTweets()', function(done) {
    this.timeout(Common.TIMEOUT);

    twitterMessenger = {};
    TwitterInterfaceService.getTweets(twitterMessenger, Common.logData, function(error, tweets) {

      // Add up experiences from each tweet
      var addedExperience = 0;
      var tweetIDs = new Array();
      var tweetClassifications = new Array();
      var subSkillExperiences = [0,0,0,0,0,0,0,0,0];
      for(var i = 0; i < tweets.length; i++) {
        addedExperience += tweets[i].experience;
        tweetIDs.push(tweets[i].tweetId);
        var classification = tweets[i].classification;
        tweetClassifications.push(classification);
        subSkillExperiences[AugeoUtility.getSkillIndex(classification, Common.logData)] += tweets[i].experience;
      };

      User.getUserWithUsername(Common.USER.username, Common.logData, function(userBefore) {
        var initialExperience = userBefore.skill.experience;

        var initialSubSkillExperiences = [0,0,0,0,0,0,0,0,0];
        for(var i = 0; i < initialSubSkillExperiences.length; i++) {
          initialSubSkillExperiences[i] = userBefore.subSkills[i].experience;
        }

        TwitterService.addTweets(userBefore._id, TwitterData.USER_TWITTER.screenName, tweets, false, Common.logData, function() {
          User.getUserWithUsername(Common.USER.username, Common.logData, function(userAfter) {

            // Verify Twitter experience is updated
            Assert.strictEqual(userAfter.skill.experience, initialExperience + addedExperience);

            // Verify Twitter subskills are updated
            for(var i = 0; i < subSkillExperiences.length; i++) {
              if(subSkillExperiences[i] > 0) {
                Assert.strictEqual(userAfter.subSkills[i].experience, initialSubSkillExperiences[i] + subSkillExperiences[i]);
              }
            }

            // Verify tweets are in database
            (function checkTweets(i) {
              Tweet.getTweet(tweetIDs[i], Common.logData, function(returnedTweet) {
                Assert.ok(returnedTweet);
                returnedTweet._id.should.be.ok();
                i++;
                if(i < tweetIDs.length) {
                  checkTweets(i);
                } else {
                  done();
                }
              });
            })(0); // Pass i as 0
          });
        });
      });
    });
  });

  // checkExistingAccessToken
  it('should return true if access token exists and false otherwise -- checkExistingAccessToken()', function(done) {
    this.timeout(Common.TIMEOUT);

    // Generate test token
    TwitterInterfaceService.getOAuthRequestToken(Common.logData, function(token, secretToken) {

      TwitterService.checkExistingAccessToken(token, Common.logData, function(doesExist0) {
        Assert.strictEqual(doesExist0, false);

        // Get user's access token
        User.getUserWithUsername(Common.USER.username, Common.logData, function(user) {
          TwitterUser.getTokens(user._id, Common.logData, function(tokens) {
            TwitterService.checkExistingAccessToken(tokens.accessToken, Common.logData, function(doesExist1) {
              Assert.strictEqual(doesExist1, true);
              done();
            });
          });
        });
      });
    }, function(){});
  });

  // getUsers
  it('should return all users twitter IDs from Augeo DB -- getUsers()', function(done) {
    this.timeout(Common.TIMEOUT);

    TwitterService.getUsers(Common.logData, function(users) {
      users.length.should.be.above(0);
      for(var i = 0; i < users.length; i++) {
        Assert.ok(users[i].twitterId);
        users[i].twitterId.length.should.be.above(0);
      };
    });

    done();
  });

  // getUserSecretToken
  it('should return users secret token -- getUserSecretToken()', function(done) {
    this.timeout(Common.TIMEOUT);

    // Invalid session - missing user._id
    TwitterService.getUserSecretToken(null, Common.logData, function(){}, function() {

      // Valid session- user ID doesn't exists
      TwitterService.getUserSecretToken('0', Common.logData, function(){}, function() {

        // Valid session
        User.getUserWithUsername(Common.USER.username, Common.logData, function(user) {

          var userID = user._id.toString();

          TwitterService.getUserSecretToken(userID, Common.logData, function(secretToken) {
            Assert.strictEqual(secretToken.length, 32);
            done();
          }, function(){});
        });
      });
    });
  });

  it('should remove all invalid Twitter users that dont have screen names -- removeInvalid()', function(done) {

    // Get user from database
    User.getUserWithUsername(Common.USER.username, Common.logData, function(user) {

      TwitterUser.add(user._id, Common.USER.secretToken, Common.logData, function (isSuccessful0) {
        Assert.strictEqual(isSuccessful0, true);

        // Get user from database
        User.getUserWithUsername(Common.ACTIONEE.username, Common.logData, function (actionee) {

          TwitterUser.add(actionee._id, Common.ACTIONEE.secretToken, Common.logData, function (isSuccessful1) {
            Assert.strictEqual(isSuccessful1, true);

            TwitterUser.getUsers(Common.logData, function(initialUsers) {
              initialUsers.length.should.be.aboveOrEqual(2);

              TwitterUser.removeInvalid(Common.logData, function() {

                TwitterUser.getUsers(Common.logData, function(afterUsers) {
                  afterUsers.length.should.be.belowOrEqual(initialUsers.length-2)
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('should remove tweet and update users experience -- removeTweet()', function(done) {
    this.timeout(Common.TIMEOUT);

    // Determine initial skill experience
    var experience = 0;
    User.getUserWithUsername(Common.USER.username, Common.logData, function(user0) {
      experience = user0.skill.experience;

      // Verify tweet exists
      Tweet.getTweet(TwitterData.rawStandardTweet.id_str, Common.logData, function(returnedTweet0) {
        Activity.getActivity(user0._id, returnedTweet0._id, Common.logData, function(returnedActivity0) {
          Assert.strictEqual(returnedTweet0.tweetId, TwitterData.rawStandardTweet.id_str);
          experience -= returnedActivity0.experience;

          // Remove tweet
          TwitterService.removeTweet(TwitterData.rawStandardTweet.id_str, Common.logData, function(classification0) {

            // Verify tweet was removed
            Tweet.getTweet(TwitterData.rawStandardTweet.id_str, Common.logData, function(returnedTweet1) {
              Should.not.exist(returnedTweet1);

              Activity.getActivity(user0._id, returnedTweet0._id, Common.logData, function(returnedActivity2) {
                Should.not.exist(returnedActivity2);

                // Verify experience was removed from twitter skill
                User.getUserWithUsername(Common.USER.username, Common.logData, function(user1) {
                  Assert.strictEqual(user1.skill.experience, experience);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  // removeUser
  it('should remove user Test Tester from TWITTER_USER -- removeUser()', function(done) {

    // Get user from database
    User.getUserWithUsername(Common.ACTIONEE.username, Common.logData, function(user) {

      TwitterUser.add(user._id, Common.ACTIONEE.secretToken, Common.logData, function(isSuccessful) {
        Assert.strictEqual(isSuccessful, true);

        // Verify Twitter user is in database
        TwitterUser.getUserWithScreenName(TwitterData.ACTIONEE_TWITTER.screenName, Common.logData, function(retrievedUser0) {
          Assert.strictEqual(retrievedUser0.screenName, Common.ACTIONEE.screenName);

          TwitterService.removeUser(user._id, Common.logData, function(removedUser) {
            Assert.strictEqual(removedUser.screenName, TwitterData.ACTIONEE_TWITTER.screenName);

            // Verify Twitter user is not in database
            TwitterUser.getUserWithScreenName(TwitterData.ACTIONEE_TWITTER.screenName, Common.logData, function(retrievedUser1) {
              Should.not.exist(retrievedUser1);
              done();
            });
          }, function(){});
        });
      });
    });
  });