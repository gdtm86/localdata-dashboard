/*jslint nomen: true */
/*globals define: true */

define([
  'jquery',
  'lib/lodash',
  'backbone',
  'settings',
  'util',
  'api',

  // Templates
  'text!templates/export.html',
  'text!templates/export-embed.html'
],

function($, _, Backbone, settings, util, api, exportTemplate, embedTemplate) {
  'use strict';

  var exportTimeout = 2 * 60 * 1000; // 2 minutes

  var ExportView = Backbone.View.extend({
    template: _.template(exportTemplate),
    embedTemplate: _.template(embedTemplate),

    events: {
      'click .shapefile': 'getShapefile',
      'click .kml': 'getKML',
      'click .csv': 'getCSV',
      'click .csvLatest': 'getCSVLatest'
    },

    initialize: function(options) {
      _.bindAll(this, 'render', 'pingExport');

      if(options.isEmbed) {
        delete this.el;
        this.template = this.embedTemplate;
      }

      // Show a given survey
      this.survey = options.survey;
      this.survey.on('change', this.render);
    },

    render: function() {
      // Set the context & render the page
      var context = {
        surveyId: this.survey.get('id'),
        slug: this.survey.get('slug'),
        baseurl: api.getBaseURL(),
        loading: this.loading
      };

      this.$el.html(this.template(context));
      return this;
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

      // We may need to pass in some optional parameters
      var options = {};
      if(type === 'csvLatest') {
        options.latest = true;
      }
      if(this.survey.has('timezone')) {
        options.timezone = this.survey.get('timezone');
      }

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
          data: options,
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
      var url = settings.api.baseurl + '/surveys/' + this.survey.get('id') + '/responses.csv';
      this.pingExport('csv', url);
      util.track('survey.export.csv');
    },

    // Ask the API to generate a CSV export.
    getCSVLatest: function getCSVLatest() {
      var url = settings.api.baseurl + '/surveys/' + this.survey.get('id') + '/responses.csv';
      this.pingExport('csvLatest', url);
      util.track('survey.export.csv.latest');
    },

    // Ask the API to generate a KML export.
    getKML: function getKML() {
      var url = settings.api.baseurl + '/surveys/' + this.survey.get('id') + '/responses.kml';
      this.pingExport('kml', url);
      util.track('survey.export.kml');
    },

    // Ask the API to generate a shapefile export.
    getShapefile: function getShapefile() {
      var url = settings.api.baseurl + '/surveys/' + this.survey.get('id') + '/responses.zip';
      this.pingExport('shapefile', url);
      util.track('survey.export.shapefile');
    }
  });

  return ExportView;

});
