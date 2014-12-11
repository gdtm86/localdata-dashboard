/*jslint nomen: true */
/*globals define */

define(function (require, exports, module) {
  'use strict';

  var $ = require('jquery');
  var _ = require('lib/lodash');
  var Backbone = require('backbone');
  var L = require('lib/leaflet/leaflet.tilejson');
  var Promise = require('lib/bluebird');
  
  var settings = require('settings');

  var infoTemplate = require('text!templates/cartodb-info.html');

  // The View
  // We don't make much use of the Backbone.View facilities, but we may need
  // later need to have this layer behave more like the survey layer, which
  // renders some summary data and reacts to models.
  module.exports = Backbone.View.extend({
    template: _.template(infoTemplate),

    events: {
      'click .close': 'remove'
    },
    
    initialize: function(options) {
      this.mapView = options.mapView;
      this.dataQuery = options.layer.dataQuery;
      this.layerOptions = options.layer;

      var self = this;
      
      Promise.resolve($.ajax({
        url: 'https://localdata.cartodb.com/api/v1/map',
        type: 'GET',
        dataType: 'jsonp',
        data: {
          stat_tag: options.layer.stat_tag,
          config: JSON.stringify(options.layer.config)
        }
      })).then(function (data) {
        // Add image tiles
        var url = 'https://' + data.cdn_url.https +
            '/localdata/api/v1/map/' + data.layergroupid +
            '/{z}/{x}/{y}.png';
        self.mapView.addTileLayer(L.tileLayer(url));

        // Add grid
        var gridUrl = 'https://' + data.cdn_url.https +
            '/localdata/api/v1/map/' + data.layergroupid + 
            '/0/{z}/{x}/{y}.grid.json?callback={cb}';
        var gridLayer = new L.UtfGrid(gridUrl, {
          resolution: 4
        });
        self.mapView.addGridLayer(gridLayer);
        gridLayer.on('click', self.handleGridClick.bind(self));
      }).catch(function (error) {
        console.log('Failed to fetch cartodb map config', error);
      });
    },

    render: function (data) {
      var context = {
        name: data[this.layerOptions.humanReadableField],
        centroid: JSON.parse(data.centroid),
        googleKey: settings.GoogleKey
      };
      
      var names = this.layerOptions.fieldNames;
      context.fields = _.map(_.keys(names), function (name) {
        return {
          name: names[name],
          value: data[name]
        };
      });
      this.$el.html(this.template(context));
      this.$el.show();
    },
    
    remove: function () {
      this.$el.hide();
      this.$el.empty();
    },
    
    handleGridClick: function (event) {
      if (!event.data) {
        return;
      }

      var self = this;

      Promise.resolve($.ajax({
        url: 'https://localdata.cartodb.com/api/v2/sql',
        type: 'GET',
        dataType: 'jsonp',
        data: {
          q: _.template(this.dataQuery, { cartodb_id: event.data.cartodb_id })
        }
      })).then(function (data) {
        if (data.rows && data.rows.length > 0) {
          self.render(data.rows[0]);
        }
      }).catch(function (error) {
        console.log('Error getting data from cartodb', error);
      });
    }
  });
});