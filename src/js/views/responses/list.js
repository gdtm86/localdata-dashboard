/*jslint nomen: true */
/*globals define: true */

define(function (require) {
  'use strict';
  var _ = require('lib/lodash');
  var $ = require('jquery');
  var Backbone = require('backbone');

  // LocalData
  var settings = require('settings');

  // Views
  var ResponseView = require('views/responses/item');

  // Templates
  var template = require('text!templates/responses/list.html');
  var commentTemplate = require('text!templates/responses/comments.html');

  /**
   * Intended for shorter lists of responses (arbitrarily <25)
   * Doesn't include pagination, which isn't relevant in this case.
   * See responses/responses/ListView for a heavyweight implementation.
   */
  var ResponseListView = Backbone.View.extend({
    template: _.template(template),
    commentTemplate: _.template(commentTemplate),

    events: {
      'click .close': 'remove'
    },

    initialize: function(options) {
      this.listenTo(this.collection, 'add', this.render);
      this.labels = options.labels;
      this.forms = options.forms;
      this.survey = options.survey;
      this.surveyOptions = options.surveyOptions;
      this.surveyId = options.surveyId;
      this.objectId = options.objectId;

      this.exploration = options.exploration;
    },

    remove: function() {
      this.$el.hide();
      this.$('#disqus_thread').detach().appendTo($('#disqus_hide'));
      this.$el.empty();
      this.trigger('remove');
      this.stopListening();
      return this;
    },

    render: function() {
      var first = this.collection.at(0);
      var name;

      if(!first) {
        return;
      }

      if(first.get('geo_info') !== undefined) {
        name = first.get('geo_info').humanReadableName;
      }else {
        name = first.get('parcel_id');
      }

      this.$el.html(this.template({
        name: name,
        responses: this.collection.toJSON(),
        surveyOptions: this.surveyOptions,
        googleKey: settings.GoogleKey
      }));

      this.collection.each(function(response) {
        var item = new ResponseView({
          model: response,
          labels: this.labels,
          forms: this.forms,
          surveyOptions: this.surveyOptions,
          exploration: this.exploration
        });
        this.$el.append(item.render().el);
      }.bind(this));

      // TODO: clean up the disqus commenting stuff
      if (this.surveyOptions.comments) {
        var d = $('#disqus_thread');
        if (d.length === 0) {
          this.$el.append(this.commentTemplate({
            thread: true
          }));
        } else {
          this.$el.append(this.commentTemplate({
            thread: false
          }));
          d.detach();
          d.appendTo($('#disqus_target'));
        }

        try {
          window.DISQUS_reset(
            this.survey.id + '/' + this.collection.objectId,
            'https://app.localdata.com/#!surveys/' + this.survey.get('slug') + '/dive/' + this.collection.objectId,
            name,
            'en'
          );
        } catch (e) {
          console.log(e);
        }
      }

      this.$el.show();
      return this;
    }
  });

  return ResponseListView;

});
