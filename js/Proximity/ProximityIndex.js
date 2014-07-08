define([
  "dojo/Evented",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/Deferred",
  "dojo/promise/all",
  "esri/geometry/Extent",
  "esri/layers/FeatureLayer",
  "esri/geometry/webMercatorUtils",
  "esri/workers/WorkerClient"
], function (Evented, declare, lang, array, Deferred, all, Extent, FeatureLayer, webMercatorUtils, WorkerClient) {

  /**
   *
   */
  var ProximityIndex = declare([Evented], {

    _source: null,
    _targets: null,
    _targetIDs: [],
    _searchExtent: null,
    _maxDistanceMeters: null,
    _maxItemCount: 1000,
    _queue: [],

    /**
     *
     * @param options
     */
    constructor: function (options) {
      declare.safeMixin(this, options);
    },

    /**
     *
     */
    clear: function () {
      this._source = null;
      this._targets = null;
      this._targetIDs = [];
      this._searchExtent = null;
      this._maxDistanceMeters = null;
      this._targetHasUpdates = false;
    },

    /**
     *
     * @param source
     */
    setSource: function (source) {
      this._source = null;

      if(source.hasOwnProperty("spatialReference") && this._isValidSpatialReference(source.spatialReference)) {
        if(source.declaredClass === "esri.Map") {
          this._source = this._getGeographicGeometry(source.extent.getCenter());
          source.on("extent-change", lang.hitch(this, function (evt) {
            this._source = this._getGeographicGeometry(evt.extent.getCenter());
            if(!this._targetHasUpdates) {
              this._updateProximity();
            }
          }));
        } else {
          if(source.declaredClass === "esri.geometry.Point") {
            this._source = this._getGeographicGeometry(source);
          } else {
            throw new Error("'source' parameter is not a point geometry")
          }
        }
        this._updateProximity();
      } else {
        throw new Error("'source' parameter SpatialReference is not WGS84 or WebMercator")
      }

    },

    /**
     *
     * @param targets
     */
    setTargets: function (targets) {
      this._targets = null;
      this._targetHasUpdates = false;

      if(targets && targets.hasOwnProperty("geometryType") && (targets.geometryType === "esriGeometryPoint")) {
        if(targets.hasOwnProperty("spatialReference") && this._isValidSpatialReference(targets.spatialReference)) {
          console.log("targets.declaredClass: ", targets.declaredClass);

          this._targets = [];

          if(targets.declaredClass === "esri.layers.FeatureLayer") {
            // FEATURE LAYER //
            this.addTargets(targets.graphics, targets.objectIdField);

            if(targets.mode !== FeatureLayer.MODE_SNAPSHOT) {
              targets.on("update-end", lang.hitch(this, function (evt) {
                this.addTargets(targets.graphics, targets.objectIdField);
              }));
              this._targetHasUpdates = true;
            }
          } else {
            // FEATURE SET //
            this.addTargets(targets.features);
          }

        } else {
          throw new Error("'targets' parameter SpatialReference is not WGS84 or WebMercator")
        }
      } else {
        throw new Error("'targets' parameter is not a point geometries")
      }

    },

    /**
     *
     * @param features
     * @param objectIdField
     */
    addTargets: function (features, objectIdField) {

      var oidFld = objectIdField || "OBJECTID";
      array.forEach(features, lang.hitch(this, function (feature) {
        //if(!this._targetIDs.hasOwnProperty(feature.attributes[oidFld])) {
        if(!this._targetIDs[feature.attributes[oidFld]]) {
          this._targetIDs[feature.attributes[oidFld]] = feature.attributes[oidFld];
          this._targets.push(this._getGeographicGeometry(feature.geometry));
          this._updateSearchExtent(feature.geometry);
        }
      }));

      this._updateProximity();
    },


    /**
     *
     * @param pointGeom
     * @private
     */
    _updateSearchExtent: function (pointGeom) {

      if(!this._searchExtent) {
        // CREATE SEARCH EXTENT //
        this._searchExtent = new Extent(pointGeom.x, pointGeom.y, pointGeom.x, pointGeom.y, pointGeom.spatialReference);
      } else {
        // UPDATE SEARCH EXTENT //
        this._searchExtent.update(Math.min(this._searchExtent.xmin, pointGeom.x), Math.min(this._searchExtent.ymin, pointGeom.y), Math.max(this._searchExtent.xmax, pointGeom.x), Math.max(this._searchExtent.ymax, pointGeom.y), pointGeom.spatialReference);
      }

      // UPDATE MAX DISTANCE //
      this._maxDistanceMeters = Math.max(this._searchExtent.getWidth(), this._searchExtent.getHeight());
    },

    /**
     *
     * @private
     */
    _updateProximity: function () {

      if(this._calculatingProximityDeferred && (!this._calculatingProximityDeferred.isFulfilled())) {
        console.log("Cancelling pending proximity calculation...");
        this.emit("update-cancel", {});
        this._calculatingProximityDeferred.cancel("Another calculation has been requested...");
        this._calculatingProximityDeferred = null;
      }

      this.emit("update-start", {});
      this._calculatingProximityDeferred = this._calculateProximity().then(lang.hitch(this, function (proximityResults) {
        this.emit("update-end", proximityResults);
      }), lang.hitch(this, function (error) {
        this.emit("update-error", error);
      }));

    },

    /**
     *
     * @returns {Deferred}
     */
    _calculateProximity: function () {

      // WORKER PROCESSES //
      var processes = [];

      // DEFERRED //
      var deferred = new Deferred(lang.hitch(this, function (reason) {
        this._clearWorkerQueue();
        deferred.reject("Workers cancelled: " + reason);
      }));

      if(this._source && this._targets && this._maxDistanceMeters) {

        // START TIME //
        var startTime = (new Date()).valueOf();

        // CREATE WORKER PROCESSES //
        for (var targetIndex = 0; targetIndex < this._targets.length; targetIndex += this._maxItemCount) {
          processes.push(this._processData(targetIndex, targetIndex + this._maxItemCount));
        }

        // ALL PROCESSING IS FINISHED //
        all(processes).then(lang.hitch(this, function (responses) {
          // ELAPSED TIME //
          var elapsedTime = ((new Date()).valueOf() - startTime);

          // FILTER AND AGGREGATE RESULTS //
          var allNearResults = [];
          array.forEach(responses, lang.hitch(this, function (response) {
            if(response.success) {
              allNearResults = allNearResults.concat(response.results);
            }
          }));
          console.log(processes.length, " workers processed ", allNearResults.length, " geometries in ", elapsedTime, "ms ");

          // PROXIMITY RESULTS //
          deferred.resolve({
            source: this._source,
            nearTable: allNearResults,
            searchExtent: this._searchExtent,
            maxDistanceMeters: this._maxDistanceMeters,
            elapsedTimeMs: elapsedTime
          });

        }), lang.hitch(this, function (error) {
          //console.warn(error);
          deferred.reject(error);
        }));

      } else {
        deferred.reject(new Error("Invalid or missing 'source' or 'targets'..."));
      }

      return deferred;
    },


    /**
     *
     * @private
     */
    _clearWorkerQueue: function () {
      for (var startIndex in this._queue) {
        if(this._queue.hasOwnProperty(startIndex)) {
          this._queue[startIndex].terminate();
        }
      }
      this._queue = [];
    },

    /**
     *
     * @param startIndex
     * @param endIndex
     * @returns {Deferred.promise}
     * @private
     */
    _processData: function (startIndex, endIndex) {

      // WORKER //
      var workerClient = this._queue[startIndex];
      if(!workerClient) {
        workerClient = this._queue[startIndex] = new WorkerClient("application/Proximity/ProximityWorker", true);
      }

      // INPUTS //
      var inputs = {
        maxDistanceMeters: this._maxDistanceMeters,
        source: this._source,
        targets: this._targets.slice(startIndex, endIndex)
      };

      // POST MESSAGE //
      return workerClient.postMessage(inputs);
    },

    /**
     *
     * @param spatialReference
     * @returns {boolean}
     * @private
     */
    _isValidSpatialReference: function (spatialReference) {
      return ((spatialReference.wkid == 4326) || (spatialReference.isWebMercator()));
    },

    /**
     *
     * @param pointGeometry
     * @returns {*}
     * @private
     */
    _getGeographicGeometry: function (pointGeometry) {
      if(pointGeometry.spatialReference.wkid == 4326) {
        return pointGeometry;
      } else {
        if(pointGeometry.spatialReference.isWebMercator()) {
          return webMercatorUtils.webMercatorToGeographic(pointGeometry);
        } else {
          console.log("SpatialReference is not WGS84 or WebMercator", pointGeometry);
          return null;
        }
      }
    },

    /**
     *
     * @param featuresArray
     * @returns {Array}
     * @private
     */
    _getGeographicGeometries: function (featuresArray) {
      return array.map(featuresArray, lang.hitch(this, function (feature) {
        return this._getGeographicGeometry(feature.geometry);
      }));
    }

  });

  /**
   *
   * @type {string}
   */
  ProximityIndex.verion = "0.10.2";

  /**
   *
   */
  return ProximityIndex;
});
  


