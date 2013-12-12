/*jslint nomen: true */
/*globals define: true */

define([
  'jquery',
  'lib/lodash',
  'backbone',
  'lib/tinypubsub',

  // LocalData
  'settings',
  'api',

  // Models
  'models/responses',

  // Templates
  'text!templates/responses/item.html'
],

function($, _, Backbone, events, settings, api, Responses, template) {
  'use strict';

  var ResponseView = Backbone.View.extend({
    className: 'response',

    template: _.template(template),

    events: {
      'click .confirm': 'confirm',
      'click .delete': 'destroy',
      'click .cancel': 'cancel'
    },

    initialize: function() {
      this.listenTo(this.model, "change", this.render);
      this.listenTo(this.model, "destroy", this.remove);
    },

    render: function() {
      var $el = $(this.el);
      console.log(this.model);
      $el.html(this.template({r: this.model.toJSON() }));
      return this;
    },

    confirm: function(event) {
      event.preventDefault();
      this.$('.confirm').hide();
      this.$('.confirm-delete').show();
    },

    cancel: function(event) {
      event.preventDefault();
      this.$('.confirm-delete').hide();
      this.$('.confirm').show();
    },

    destroy: function(event) {
      event.preventDefault();

      function success(model, repsonse) {
        // No-op for now.
        // TODO: We might want to show a success message.
      }

      function error(model, xhr, options) {
        console.log("Error destroying", xhr, options);
        $('.error').show();
      }

      this.model.destroy({
        success: success,
        error: error
      });
    }

  });

  return ResponseView;
});
