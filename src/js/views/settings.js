/*jslint nomen: true */
/*globals define: true */

define([
  'jquery',
  'lib/lodash',
  'backbone',

  // LocalData
  'settings',
  'api',

  // Templates
  'text!templates/surveys/settings.html',
],

function($, _, Backbone, settings, api, template) {
  'use strict';

  var SettingsView = Backbone.View.extend({
    el: '#settings-view-container',
    template: _.template(template),

    events: {
      'click .save': 'save'
    },

    initialize: function(options) {
      _.bindAll(this, 'render', 'save', 'success', 'error');

      this.survey = options.survey;

      this.survey.on('change', this.render);
    },

    error: function(model, xhr, options) {
      $(".error").fadeIn().css("display","inline-block").delay(2000).fadeOut();
    },

    success: function() {
      $(".saved").fadeIn().css("display","inline-block").delay(2000).fadeOut();
    },

    save: function(event) {
      event.preventDefault();

      // Get the fields from the form
      var form = $(event.target).parent().serializeArray();

      // Convert the fields into a format that can be saved
      var fields = _.reduce(form, function(memo, field) {
        memo[field.name] = field.value;
        return memo;
      }, {});

      this.survey.set(fields);
      this.survey.save({}, {
        success: this.success,
        error: this.error
      });
    },

    render: function() {
      var context = {
        survey: this.survey.toJSON(),
      };

      this.$el.html(this.template(context));
    }
  });

  return SettingsView;
});
