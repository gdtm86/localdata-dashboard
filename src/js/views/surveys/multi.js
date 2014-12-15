/*jslint nomen: true */
/*globals define: true */

define(function(require, exports, module) {
  'use strict';

  // Libs
  var $ = require('jquery');
  var _ = require('lib/lodash');
  var Backbone = require('backbone');
  var util = require('util');

  var api = require('api');

  // Views
  var MapView = require('views/maps/multi-map');
  var SurveyView = require('views/surveys/survey');
  var SurveyLayer = require('views/projects/datalayers/survey');
  var CartoDBLayer = require('views/maps/cartodb-layer');

  // Templates
  var embeddedSurveyTemplate = require('text!templates/responses/embed-multi.html');


  // TODO: Fetch the project configuration data from the API via a Project
  // model, which should reference Survey models, which should potentially
  // allow for pre-filtering.
  var projects = {
    gtech: {
      description: '<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>',
      location: 'Pittsburgh, PA',
      surveys: [{
        surveyId: 'ac5c3b60-10dd-11e4-ad2d-2fff103144af'
//        filter: {
//          question: 'Is-the-property-maintained',
//          answer: 'Yes',
//          legend: 'Maintained properties',
//          color: '#f15a24'
//        }
//      }, {
//        surveyId: '44f94b00-4005-11e4-b627-69499f28b4e5',
//        filter: {
//          question: 'Is-there-dumping-on-the-property',
//          answer: 'No',
//          legend: 'No dumping',
//          color: '#a743c3'
//        }
      }],
      foreignInteractive: [{
        type: 'cartodb',
        dataQuery: 'select usedesc, property_2, propertyow, ST_AsGeoJSON(ST_Centroid(the_geom)) AS centroid from (select * from allegheny_assessed_parcels) as _cartodbjs_alias where cartodb_id = <%= cartodb_id %>',
        humanReadableField: 'property_2',
        fieldNames: {
          usedesc: 'Use',
          propertyow: 'Property Owner'
        },
        config: {
          version: '1.0.1',
          stat_tag:'c8c949c0-7ce7-11e4-a232-0e853d047bba',
          layers:[{
            type:'cartodb',
            options:{
              sql: 'select * from allegheny_assessed_parcels',
              cartocss: '/** category visualization */ #allegheny_assessed_parcels { polygon-opacity: 0.3; line-color: #FFF; line-width: 1; line-opacity: 0.7; }\n #allegheny_assessed_parcels[usecode!=100] { polygon-fill: #dddddd; }\n #allegheny_assessed_parcels[usecode=100] { polygon-fill: #101010; polygon-opacity: 0.6; }\n #allegheny_assessed_parcels { polygon-fill: #DDDDDD; }',
              cartocss_version: '2.1.1',
              interactivity: ['cartodb_id']
            }
          }]
        },
        layerId: 'b7860d2e2bc29ae2702f611e2044284a:1418115328687.24'
      }]
    },
    walkscope: {
      description: '<p>WALKscope is a mobile tool developed by WalkDenver and PlaceMatters for collecting data related to sidewalks, intersections, and pedestrian counts in the Denver metro area. This information will help create an inventory of pedestrian infrastructure, identify gaps, and build the case for improvements.  Click on the map or one of the categories below to explore the data collected to date.</p>',
      surveys: [{
        layerName: 'Sidewalk Quality Reports',
        layerId: 'ec7984d0-2719-11e4-b45c-5d65d83b39b6',
        filter: {
          question: 'What-would-you-like-to-record',
          answer: 'Sidewalk-Quality',
          legend: 'Sidewalk Quality Reports',
          color: '#a743c3'
        }
      }, {
        layerName: 'Intersection Quality Reports',
        layerId: 'ec7984d0-2719-11e4-b45c-5d65d83b39b6',
        filter: {
          question: 'What-would-you-like-to-record',
          answer: 'Intersection-Quality',
          legend: 'Intersection Quality Reports',
          color: '#f15a24'
        }
      }]
    }
  };
  /*
   * Multi-survey, embedded view.
   *
   * CONFIGURATION:
   *   - The list of surveys controls what gets displayed
   *     If there is no filter property, all responses will be shown.
   */
  var MultiSurveyView = Backbone.View.extend({
    activeLayers: {},
    activeTileLayers: {},
    activeGridLayers: {},
    mapView: null,


    // overview vs deep-dive
    mode: 'overview',

    template: _.template(embeddedSurveyTemplate),
    el: '#container',

    events: {
      'click .action-show-filters': 'toggleFilters',
      'click .address-search-button': 'search'
    },

    initialize: function(options) {
      // XXX TODO
      // Pull from survey options?
      // Load the right layers for each survey.
      this.slug = options.slug;
      if (this.slug === 'walkscope') {
        this.project = projects.walkscope;
      } else {
        this.project = projects.gtech;
      }

      this.mode = options.mode;

      _.bind(this.search, this);

      this.render();
    },

    // Get a total count of responses so far
    // XXX TODO
    // This should ask the view for a count, not address the view's model
    // directly.
    totalUp: function() {
      if (this.activeLayers.length === 1) {
        this.$('.response-count').hide();
        return;
      } else {
        this.$('.response-count').show();
      }

      var totaled = [];
      var total = 0;
      _.each(this.activeLayers, function(surveyView) {
        var id = surveyView.survey.get('id');

        // Don't double-count surveys
        if (_.contains(totaled, id)) {
          return;
        }

        total = total + surveyView.survey.get('responseCount') || 0;
        totaled.push(id);
      });

      this.$el.find('.response-count .count').html(util.numberWithCommas(total));
    },

    removeLayer: function(layer) {
      this.mapView.removeTileLayer(layer);
    },

    addTileLayer: function(layer) {
      console.log("Multi: got tile layer", this.mapView);
      this.mapView.addTileLayer(layer);
    },

    addGridLayer: function(layer) {
      console.log("Multi: got grid layer");
      this.mapView.addGridLayer(layer);
    },

    fitBounds: function(bounds) {
      console.log("Fit bounds", bounds);
      this.mapView.fitBounds(bounds);
    },

    append: function ($el) {
      this.$el.find('.layers').append($el);
    },

    appendSettings: function($el) {
      // XXX TODO
      // Set up a container for each datasource + id so we know exactly
      // where to put the element?
      $el.hide();
      this.$el.find('.settings-container').append($el);
      console.log("Got settings to append", $el);
    },

    render: function () {
      var context = {
        description: this.project.description
      };
      this.$el.html(this.template(context));

      // Set up the map view, now that the root exists.
      if (this.mapView === null) {
        this.mapView = new MapView({
          el: '#map-view-container',
          config: {
            center: [40.715678,-74.213848],
            zoom: 15
          }
        });
        this.listenTo(this.mapView, 'click', this.mapClickHandler);
      }

      // Render the map
      this.mapView.render();

      // Render foreign data layers
      var mapView = this.mapView;
      if (this.project.foreignInteractive) {
        this.foreignLayers = _.map(this.project.foreignInteractive, function (layer) {
          if (layer.type === 'cartodb') {
            return new CartoDBLayer({
              mapView: mapView,
              layer: layer,
              el: '#responses-list'
            });
          }
        });
      }

      // Render survey layers
      _.each(this.project.surveys, function (survey) {
        var surveyLayer = new SurveyLayer(survey);

        this.activeLayers[survey.layerId] = surveyLayer;

        // Add the survey to the list
        // Will automatically update as we get data
        // XXX REMOVE this.$el.find('.layers').append(surveyLayer.render());

        this.listenTo(surveyLayer, 'rendered', this.append);
        this.listenTo(surveyLayer, 'renderedSettings', this.appendSettings);
        this.listenTo(surveyLayer, 'newBounds', this.fitBounds);
        this.listenTo(surveyLayer, 'removeLayer', this.removeLayer);
        this.listenTo(surveyLayer, 'tileLayerReady', this.addTileLayer);
        this.listenTo(surveyLayer, 'gridLayerReady', this.addGridLayer);

        // surveyLayer.on('settingsReady', function($el) {
        //   console.log("Settings are ready");
        //   // XXX TODO
        //   // Filters
        //   // Append the el at the right point.
        // });

        // XXX TODO do we still need to total up?
        // Should be handled by survey's layerControl
        // this.listenTo(surveyLayer.survey, 'change', this.totalUp);

        // Save it to activeLayers for future reference.
        // this.activeLayers.push(surveyLayer);


        // XXX Old material
        // var $filterEl;
        // if (i === 0) {
        //   $filterEl = this.$('#filter-view-container');
        // }
        // // Create a model
        // var surveyLayer = new SurveyView({
        //   $el: this.$el.find('.layers'),
        //   mapView: this.mapView,
        //   layerId: survey.surveyId,
        //   infoEl: '#responses-list',
        //   filterEl: $filterEl,
        //   filter: survey.filter
        // });

      }.bind(this));

      if (this.mode === 'deep-dive') {
        this.showDeepDive();
      } else {
        this.showOverview();
      }
    },

    showDeepDive: function() {
      this.mode = 'deep-dive';
      // Show the deep dive controls.
      $('.control-pane').show();
      $('#filter-view-container').show();

      // Hide the overview controls and expand the map.
      $('#overview-container').hide();
      $('#map-view-container').removeClass('b');

      this.mapView.map.invalidateSize();
    },

    showOverview: function() {
      this.mode = 'overview';

      // Hide the deep dive controls.
      $('.control-pane').hide();
      $('#filter-view-container').hide();
      if (this.selectedItemListView) {
        this.selectedItemListView.remove();
        this.selectedItemListView = null;
      }

      // Show the overview controls and restrict the map to the right-hand column.sldfjlsdkjfldkf sfdlkj slfdj
      $('#overview-container').show();
      $('#map-view-container').addClass('b');

      this.mapView.map.invalidateSize();
    },


    mapClickHandler: function (event) {
      if (this.mode === 'overview') {
        this.showDeepDive();
      }

      if (!event.data || !event.data.object_id) {
        return;
      }

      return;
    },

    toggleFilters: function () {
      // Render the filter
      this.$('.filters').toggle();
      //this.$('.settings-container').toggle();
    },

    /**
     * Search for an address
     */
    search: function(event) {
      event.preventDefault();
      var address = this.$('#address-search').val();
      var location = this.project.location;
      var $error = this.$('#map-tools .error');
      var mapView = this.mapView;
      api.codeAddress(address, location, function (error, results) {
        if (error) {
          $error.html(error.message);
        } else {
          $error.html('');
        }

        mapView.goToLatLng(results.coords);
      });
    }
  });

  return MultiSurveyView;

});
