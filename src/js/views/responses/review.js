/*jslint nomen: true */
/*globals define: true */

define(function(require, exports, module) {
  'use strict';

  // Libs
  var $ = require('jquery');
  var _ = require('lib/lodash');
  var Backbone = require('backbone');

  // App
  var settings = require('settings');
  var api = require('api');

  // Models
  var Responses = require('models/responses');

  // Views
  var ResponseListView = require('views/responses/list');

  // Templates
  var template = require('text!templates/responses/review.html');

  var ReviewView = Backbone.View.extend({

    template: _.template(template),

    el: '#review-view-container',

    events: {
      'click .refresh': 'getNew'
    },

    initialize: function(options) {
      _.bindAll(this,
        'render',
        'getNew'
      );

      this.survey = options.survey;
      this.forms = options.forms;

      // Set the response collection
      this.collection = new Responses.Collection({
        surveyId: this.survey.get('id'),
        limit: 1,
        filters: {
          reviewed: 'undefined'
        }
      });
      this.collection.on('reset', this.render);
      this.collection.on('remove', this.getNew);
      this.collection.on('change:responses', function() {
        this.collection.reset(); // clear the collection
        this.getNew();
      }.bind(this));

      this.getNew(0);
    },

    render: function() {
      this.$el.html(this.template({}));

      var responseView = new ResponseListView({
        el: '.response-container',
        collection: this.collection,
        labels: this.forms.getQuestions(),
        showReviewTools: true
      });
      responseView.render();
    },

    getNew: function(wait) {
      if (!wait) {
        wait = 250;
      }

      // We need to wait until the model is synced.
      // Unfortunately, it doesn't look like there's a clear way to do this
      // except by waiting a little bit.
      setTimeout(function(){
          this.collection.fetch({ reset: true });
      }.bind(this), wait);
    }
  });

  return ReviewView;
});

