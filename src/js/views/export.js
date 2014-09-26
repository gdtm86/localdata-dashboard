/*jslint nomen: true */
/*globals define: true */

define([
  'jquery',
  'lib/lodash',
  'backbone',
  'settings',
  'api',

  // Templates
  'text!templates/export.html'
],

function($, _, Backbone, settings, api, exportTemplate) {
  'use strict';

  var exportTimeout = 2 * 60 * 1000; // 2 minutes

  var ExportView = Backbone.View.extend({
    el: '#export-view-container',

    template: _.template(exportTemplate),

    events: {
      'click .shapefile': 'getShapefile',
      'click .kml': 'getKML',
      'click .csv': 'getCSV'
    },

    initialize: function(options) {
      _.bindAll(this, 'render', 'pingExport');

      // Show a given survey
      this.surveyId = options.surveyId;
    },

    render: function() {
      // Set the context & render the page
      var context = {
        surveyId: this.surveyId,
        baseurl: settings.api.baseurl,
        loading: this.loading
      };

      this.$el.html(this.template(context));
    },

    loading: {},

    // When we're done with the shapefile export process, we should reset our
    // in-progress indication.
    exportDone: function exportDone(error) {
      this.render(false);
      if (error) {
        console.log(error);
        this.$('.error').show();
      }
    },

    // Ping the API to see if an export is ready. When it's ready, download it.
    pingExport: function pingExport(type, url) {
      var expiration = Date.now() + exportTimeout;

      var self = this;

      this.loading[type] = true;
      this.render();

      var ping;

      function pingRaw() {
        if (Date.now() > expiration) {
          self.loading[type] = false;
          self.exportDone(new Error(type + 'export timed out.'));
          return;
        }

        // See if the ping cycle has been stopped.
        if (!self.loading[type]) {
          return;
        }

        $.ajax({
          url: url,
          cache: false
        }).done(function (data, textStatus, jqXHR) {
          if (jqXHR.status === 202 && self.loading[type]) {
            ping();
            return;
          }
          self.loading[type] = false;
          self.render();
          window.location = data.href;
        }).fail(function () {
          self.exportDone(new Error(type + ' export failed.'));
        });
      }

      ping = _.throttle(pingRaw, 500, { trailing: true });
      ping();
    },

    // Ask the API to generate a CSV export.
    getCSV: function getCSV() {
      var url = settings.api.baseurl + '/surveys/' + this.surveyId + '/responses.csv';
      this.pingExport('csv', url);
    },

    // Ask the API to generate a KML export.
    getKML: function getKML() {
      var url = settings.api.baseurl + '/surveys/' + this.surveyId + '/responses.kml';
      this.pingExport('kml', url);
    },

    // Ask the API to generate a shapefile export.
    getShapefile: function getShapefile() {
      var url = settings.api.baseurl + '/surveys/' + this.surveyId + '/responses.zip';
      this.pingExport('shapefile', url);
    }
  });

  return ExportView;

});
