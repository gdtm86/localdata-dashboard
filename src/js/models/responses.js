/*jslint nomen: true */
/*globals define: true */

define([
  'jquery',
  'lib/lodash',
  'backbone',
  'moment',

  'settings',
  'api'
],

function($, _, Backbone, moment, settings, api) {
  'use strict';

  var Responses = {};

  Responses.Model = Backbone.Model.extend({
    defaults: {
      responses: {}
    },

    url: function() {
      return settings.api.baseurl + '/surveys/' + this.get('survey') + '/responses/' + this.get('id');
    },

    parse: function(data) {
      if (data && data.response) {
        return data.response; // when we fetch the response directly
      }
      return data; // when we fetch the response through a colleciton
    },

    toJSON: function() {
      // This is the backbone implementation, which does clone attributes.
      // We've added the date humanization.
      var json = _.clone(this.attributes);
      if (json.created) {
        json.createdHumanized = moment(json.created, "YYYY-MM-DDThh:mm:ss.SSSZ").format("MMM Do YYYY - h:mma");
      } else {
        json.createdHumanized = '';
      }
      return json;
    }
  });

  Responses.Collection = Backbone.Collection.extend({
    model: Responses.Model,
    filters: null,
    unfilteredModels: null,

    initialize: function(models, options) {
      // TODO: It seems like this is not very useful without certain options. If
      // we never expect options to be undefined, then we should probably throw
      // an error or something in that situation, rather than just silently
      // doing nothing.
      if (options !== undefined) {
        this.surveyId = options.surveyId;
        this.objectId = options.objectId;
        this.limit = options.limit;
        this.filters = options.filters;
        this.sortOrder = options.sort || 'none';
        
        // Define comparators to maintain the specified sort order.
        if (this.sortOrder === 'asc') {
          this.comparator = 'created';
        } else if (this.sortOrder === 'desc') {
          this.comparator = function sortBy(model) {
            return 0 - Date.parse(model.get('created'));
          };
        }

        this.fetch({
          // Optionally issue a reset event instead of potentially multiple add
          // events.
          reset: !!options.reset
        });
      }
    },

    url: function() {
      var url = settings.api.baseurl + '/surveys/' + this.surveyId + '/responses?';
      if (this.objectId) {
        return url + 'objectId=' + this.objectId + '&sort=' + this.sortOrder;
      }

      if (this.limit) {
        url = url + 'count=' + this.limit + '&startIndex=0';
      } else {
        url = url + 'count=20&startIndex=0';
      }

      url = url + '&sort=' + this.sortOrder;

      if (this.filters) {
        _.each(this.filters, function(value, key){
          url = url + '&responses[' + key + ']=' + value;
        });
      }

      return url;
    },

    parse: function(response) {
      return response.responses;
    },

    /**
     * Check regularly for new results
     */
    update: function() {
      this.updating = true;
      this.fetchChunks(this.models.length);
      this.lastUpdate = new Date();
      this.trigger('updated', this.lastUpdate);
    },

    /**
     * Returns a list of strings of all questions that have been recorded
     * so far.
     * @return {Array} Array of alphabetically sorted response keys.
     */
    getResponseKeys: function() {
      this.responseKeys = [];

      // Look at every submitted response
      _.each(this.models, function(response) {
        var responseJSON = response.toJSON();

        // Some responses don't have a responses key (legacy)
        if (_.has(responseJSON, 'responses')) {
          this.responseKeys = _.union(this.responseKeys, _.keys(responseJSON.responses));
        }
      }, this);

      return this.responseKeys.sort();
    },

    /**
     * Gets
     * @param  {String} question The key of the question
     * @return {Array}           A list of answers as strings
     */
    getUniqueAnswersForQuestion: function(question) {
      var answers = _.map(this.models, function(response){

        // Make sure the model has data (some don't)
        if(_.has(response.attributes, 'responses')) {

          // Check if it has a response for the given question
          if (_.has(response.attributes.responses, question)) {

            // Return that answer
            return response.attributes.responses[question];
          }
        }
      });

      // Count each answer
      var counts = _.countBy(answers);

      // Make sure we have unique answers
      var uniqueAnswers = _.unique(answers).sort();

      // Build the response object
      var breakdown = {};
      _.each(uniqueAnswers, function(answer, index) {
        var details = {
          name: answer,
          count: counts[answer],
          color: settings.colorRange[index + 1]
        };

        // Handle empty answers
        if(!answer) {
          details.name = 'no answer';
          details.color = settings.colorRange[0];
        }

        // Add the details for this answer to the breakdown
        breakdown[answer] = details;
      });

      // Replace `undefined` answers with a string for nice rendering
      //var idxOfUndefinedToReplace = _.indexOf(uniqueAnswers, undefined);
      //uniqueAnswers[idxOfUndefinedToReplace] = '[empty]';

      return breakdown;
    },

    // Filter the items in the collection
    setFilter: function (question, answer) {
      // Make a shallow clone of the unfiltered models array.
      //
      // TODO: if someone calls reset or update, we need to toss out the
      // unfilteredModels array. That should happen before anyone else gets the
      // reset, add, etc. events.
      if (this.unfilteredModels === null) {
        this.unfilteredModels = _.clone(this.models);
      }

      // Record the filter for future use
      this.filters = {
        question: question,
        answer: answer
      };

      if(answer === 'no response') {
        answer = undefined;
      }

      // Select the correct responses
      this.reset(this.filter(function (item) {
        var resps = item.get('responses');
        return resps !== undefined && (resps[question] === answer);
      }));
    },

    clearFilter: function (options) {
      this.filters = null;
      if (this.unfilteredModels !== null) {
        this.reset(this.unfilteredModels, options);
      }
    }

  });

  return Responses;

}); // End Responses module


