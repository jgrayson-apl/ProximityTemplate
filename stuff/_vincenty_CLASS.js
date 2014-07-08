define([
  "dojo/Evented",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array"
], function (Evented, declare, lang, array) {

  Number.prototype.toRad = function () {
    return this * Math.PI / 180;
  };

  Number.prototype.toDeg = function () {
    return this * 180 / Math.PI;
  };

  return declare([Evented], {

    constructor: function (options) {
      declare.safeMixin(this, options);

    },

    /**
     *
     * @param evt
     */
    onmessage: function (options) {
      console.log("onmessage- ", options);

      var nearResult = array.map(options.features, lang.hitch(this, function (feature) {
        return this._distVincenty(options.targetGeometry.y, options.targetGeometry.x, feature.geometry.y, feature.geometry.x);
      }));

      return {
        msgId: options.msgId,
        results: nearResult
      };


    },

    /**
     *
     * @param options
     * @returns {{msgId: *, results: Array}}
     */
    main: function (options) {
      console.log("main- ", options);

      var nearResult = array.map(options.features, lang.hitch(this, function (feature) {
        return this._distVincenty(options.targetGeometry.y, options.targetGeometry.x, feature.geometry.y, feature.geometry.x);
      }));

      return {
        msgId: options.msgId,
        results: nearResult
      };

    },

    /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
    /* Vincenty Inverse Solution of Geodesics on the Ellipsoid (c) Chris Veness 2002-2012             */
    /*                                                                                                */
    /* from: Vincenty inverse formula - T Vincenty, "Direct and Inverse Solutions of Geodesics on the */
    /*       Ellipsoid with application of nested equations", Survey Review, vol XXII no 176, 1975    */
    /*       http://www.ngs.noaa.gov/PUBS_LIB/inverse.pdf                                             */
    /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

    /**
     * Calculates geodetic distance between two points specified by latitude/longitude using
     * Vincenty inverse formula for ellipsoids
     *
     * @param   {Number} lat1, lon1: first point in decimal degrees
     * @param   {Number} lat2, lon2: second point in decimal degrees
     * @returns (Number} distance in metres between points
     */
    _distVincenty: function (lat1, lon1, lat2, lon2) {
      var a = 6378137, b = 6356752.314245, f = 1 / 298.257223563;  // WGS-84 ellipsoid params
      var L = (lon2 - lon1).toRad();
      var U1 = Math.atan((1 - f) * Math.tan(lat1.toRad()));
      var U2 = Math.atan((1 - f) * Math.tan(lat2.toRad()));
      var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
      var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

      var lambda = L, lambdaP, iterLimit = 100;
      do {
        var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
        var sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
            (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
        if(sinSigma == 0) return 0;  // co-incident points
        var cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
        var sigma = Math.atan2(sinSigma, cosSigma);
        var sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
        var cosSqAlpha = 1 - sinAlpha * sinAlpha;
        var cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
        if(isNaN(cos2SigmaM)) cos2SigmaM = 0;  // equatorial line: cosSqAlpha=0 (§6)
        var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
        lambdaP = lambda;
        lambda = L + (1 - C) * f * sinAlpha *
            (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
      } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

      if(iterLimit == 0) return NaN  // formula failed to converge

      var uSq = cosSqAlpha * (a * a - b * b) / (b * b);
      var A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
      var B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
      var deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
      var s = b * A * (sigma - deltaSigma);

      s = s.toFixed(3); // round to 1mm precision
      //return s;

      // note: to return initial/final bearings in addition to distance, use something like:
      var fwdAz = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
      var revAz = Math.atan2(cosU1 * sinLambda, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda);
      return { distance: s, initialBearing: fwdAz.toDeg(), finalBearing: revAz.toDeg() };
    }
    /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

  });
});



/*
 *//* jshint worker: true *//*
 *//* global self: true, postMessage: true *//*
 (function (context) {
 var self = context;

 function actionHandler(evt) {
 var msg = evt.data;
 var error, success;
 if(msg.action) {
 switch (msg.action) {
 case 'import-script':
 try {
 if(!Array.isArray(msg.url)) {
 msg.url = [msg.url];
 }
 self.importScripts.apply(self, msg.url);
 success = true;
 } catch (err) {
 error = err;
 postMessage({msgId: msg.msgId, urls: msg.url, status: 'debug', message: 'import failed - ' + err.message});
 }
 break;
 case 'add-callback':
 try {
 self.importScripts(msg.url);
 var cb = self[msg.cbName || 'main'];
 if(!cb) {
 error = {
 message: (msg.cbName || 'main') + ' was not found in ' + msg.url
 };
 break;
 }
 self.postMessage = (function (origPostMessage) {
 return function (msg, transfers) {
 if(cb(msg) !== false) {
 *//*stupid IE can't handle undefined/null transfers argument*//*
 if(transfers) {
 origPostMessage(msg, transfers);
 } else {
 origPostMessage(msg);
 }
 }
 };
 })(self.postMessage);
 success = true;
 } catch (err) {
 error = err;
 }
 break;
 }
 if(success) {
 var pbMsg = {
 msgId: msg.msgId,
 success: true,
 action: msg.action,
 actionUrl: msg.url
 };
 if(msg.action == 'add-callback') {
 pbMsg.cbName = (msg.cbName || 'main');
 }
 postMessage(pbMsg);
 } else if(error) {
 postMessage({
 status: 'error',
 msgId: msg.msgId,
 message: error.message,
 action: msg.action
 });
 }
 }
 }

 if(!self.__mutable) {
 self.addEventListener('message', actionHandler, false);
 }

 self.__mutable = true;

 })(self);
 */

/*

 define(
 "esri/workers/WorkerClient",
 "dojo/Evented dojo/_base/declare dojo/Deferred dojo/_base/lang dojo/dom-construct esri/sniff esri/kernel esri/urlUtils require".split(" "),
 function (f, p, h, e, r, k, q, l, g) {
 var m = window.Blob || window.webkitBlob || window.mozBlob, n = window.URL || window.webkitURL || window.mozURL;
 f = p([f], {
 declaredClass: "esri.workers.WorkerClient",
 worker: null,
 returnDeferreds: !1,
 _queue: null,

 constructor: function (a, c) {
 this._isIE = k("ie");
 this.returnDeferreds = !!c;
 this._queue = {};
 this._acceptMessage = e.hitch(this, this._acceptMessage);
 this._errorMessage = e.hitch(this, this._errorMessage);
 a && (this.worker = this.setWorker(a))
 },

 setWorker: function (a) {
 if(a instanceof Array) {
 var c = a;
 a = c.shift()
 }
 a = this._getUrl(a);
 var b = g.isXdUrl(a), d;
 if(!1 === a)return console.log("Can not resolve worker path"), !1;
 this.worker && (d = this.worker, d.removeEventListener("message", this._acceptMessage, !1), d.removeEventListener("error", this._errorMessage, !1), d.terminate(), d = null);
 if(b) {
 var e = this._getUrl("esri/workers/mutableWorker", !0);
 try {
 var f =
 g.getText(e, !0);
 d = new Worker(n.createObjectURL(new m([f], {type: "text/javascript"})))
 } catch (h) {
 try {
 e = l.getProxyUrl(e).path + "?" + encodeURI(e), d = new Worker(e), this._useProxy = !0
 } catch (k) {
 return console.log("Can not create worker"), !1
 }
 }
 } else d = new Worker(a);
 d.addEventListener("message", this._acceptMessage, !1);
 d.addEventListener("error", this._errorMessage, !1);
 this.worker = d;
 b && this.importScripts(a);
 c && this.importScripts(c);
 return d
 },

 postMessage: function (a, c) {
 if(a instanceof Array || "object" != typeof a)a = {data: a};
 var b = Math.floor(64E9 * Math.random()).toString(36);
 a.msgId = b;
 b = this._queue[b] = new h;
 this.worker ? (c ? this.worker.postMessage(a, c) : this.worker.postMessage(a), this.emit("start-message", {target: this, message: a})) : b.reject({message: "No worker was set."});
 return this.returnDeferreds ? b : b.promise || b
 },

 terminate: function () {
 var a = Object.keys(this._queue);
 this.worker && this.worker.terminate();
 for (var c = a.length - 1; 0 <= c; c--)this._queue[a[c]].cancel("terminated"), delete this._queue[a[c]]
 },

 addWorkerCallback: function (a, c) {
 var b;
 b = this._getUrl(a, !0);
 !1 === b ? (b = new h, b.reject({message: "Could not load text from " + a})) : (b = this.postMessage({action: "add-callback", url: b, cbName: c || "main"}), b.then(e.hitch(this, function (a) {
 a.target = this;
 this.emit("callback-added", a)
 })));
 return b
 },

 importScripts: function (a) {
 Array.isArray(a) || (a = [a]);
 a = a.map(function (a) {
 a = this._getUrl(a, !0);
 this._useProxy && g.isXdUrl(a) && (a = l.getProxyUrl(a).path + "?" + encodeURI(a));
 return a
 }, this);
 a = this.postMessage({action: "import-script", url: a});
 a.then(e.hitch(this,
 function (a) {
 a.target = this;
 this.emit("scripts-imported", a)
 }));
 return a
 },

 _acceptMessage: function (a) {
 var c = a.data, b = c.msgId;
 if(c.status && "debug" == c.status)console[c.showAs || "debug"](c); else if(b && b in this._queue) {
 var d = this._queue[b];
 "progress" == c.status ? d.progress(a.data) : ("error" == c.status ? d.reject(a.data) : d.resolve(a.data), delete this._queue[b])
 }
 this.emit("message", {message: a.data, event: a, target: this})
 },

 _errorMessage: function (a) {
 this.onerror || this.onError ? this.onerror ? this.onerror(a) : this.onError(a) :
 console.log("Worker Error: " + a.message + "\nIn " + a.filename + " on " + a.lineno)
 },

 _getUrl: function (a, c) {
 var b = g.toUrl(a);
 if(b)b.match(/\.js$/) || (b += ".js"); else return console.error("can not resolve path:", a), !1;
 return c ? l.getAbsoluteUrl(b) : b
 },

 _startBlobWorker: function () {
 var a = this._xdSource;
 a || (a = this._getUrl("esri/workers/mutableWorker"), a = new m(["if(!self._mutable){importScripts('" + a + "');}"], {type: "text/javascript"}), a = this._xdSource = n.createObjectURL(a));
 try {
 return new Worker(a)
 } catch (c) {
 return console.log(c.message),
 !1
 }
 }});

 k("extend-esri") && e.setObject("workers.WorkerClient", f, q);

 return f
 });

 */

/*
 define(
 "esri/process/SpatialIndex",
 "esri/sniff esri/kernel dojo/_base/declare dojo/Deferred dojo/_base/lang dojo/_base/array esri/process/Processor esri/workers/RequestClient esri/workers/WorkerClient esri/layers/FeatureLayer".split(" "),

 function (s, t, n, l, p, u, q, v, m, r) {

 return n([q], {

 declaredClass: "esri.process.SpatialIndex",
 index: null,
 indexType: "rtree",
 workerCallback: ["esri/workers/scripts/helpers", "esri/workers/scripts/indexInterface", "esri/workers/indexWorker"],
 autostart: !1,

 constructor: function (a) {
 a = a || {};
 var b = !1 !== a.autostart;
 p.mixin(this, a);
 if(!this.fetchWithWorker) {
 var c = this;
 this.workerClient = new m("esri/workers/mutableWorker", !0);
 this.workerCallback.push("esri/workers/libs/" + this.indexType);
 this.workerClient.importScripts(this.workerCallback).then(function () {
 c._attachedSystem = !0;
 b && c.start()
 })
 }
 this._featCache = {}
 },

 addLayer: function (a, b) {
 if(a.graphics && a.graphics.length || b || a.isInstanceOf(r))if(this._attachedSystem)this.inherited(arguments, [a]); else {
 var c = this.workerClient, f = this;
 this.inherited(arguments,
 [a, !0]);
 c.importScripts("esri/workers/libs/" + this.indexType).then(function () {
 f.runProcess(a.grahics, a.id);
 f._attachedSystem = !0
 })
 }
 },

 unsetMap: function () {
 this.stop();
 this.workerClient.terminate();
 this.fetchWithWorker || (this.workerClient = new m(this.workerCallback, !0));
 this.inherited(arguments);
 this.start()
 },

 removeLayer: function (a) {
 this.inherited(arguments)
 },

 runProcess: function (a, b) {
 if(a && a.length) {
 var c = this, f = this.workerClient, d = a[0]._graphicsLayer;
 !b && 0 !== b && (b = d ? d.id : "rawFeatures_" + Object.keys(this._featCache).length);
 this._featCache[b] || (this._featCache[b] = {});
 for (var e, g, h = [], k = a.length, l = d && d.objectIdField; k--;)if(g = a[k], e = g.attributes[l], null == e || !this._featCache[b][e])this._featCache[b][e] = 1, g.declaredClass ? h.push({geometry: g.geometry, attributes: g.attributes}) : h.push(g);
 f.postMessage({insert: h, system: this.indexType, options: this.indexOptions, idField: d && d.objectIdField, layerId: b}).then(function (a) {
 d.emit("process-end", {processor: c, results: {insert: a.insert}})
 });
 d.emit("process-start", {processor: this})
 }
 },

 _sendFeaturesFromLayer: function (a, b) {
 var c = b.graphic, f = this.workerClient, d = this, e = c.attributes[a.objectIdField];
 this._featCache[a.id] || (this._featCache[a.id] = {});
 this._featCache[a.id][e] || (this._featCache[a.id][e] = 1, f.postMessage({insert: [
 {attributes: c.attributes, geometry: c.geometry}
 ], system: this.indexType, options: this.indexOptions, idField: a.objectIdField, layerId: a.id}).then(function (b) {
 a.emit("process-end", {processor: d, results: {insert: b.insert}})
 }), a.emit("process-start", {processor: d}))
 },

 _notifyProcessStart: function (a, b) {
 },

 _sendFeaturesFromTask: function (a, b) {
 var c = b.featureSet.features, f = [], d = this.workerClient, e = this, g = c.length, h, k;
 for (this._featCache[a.id] || (this._featCache[a.id] = {}); g--;)k = c[g], h = k.attributes[a.objectIdField], this._featCache[a.id][h] || (this._featCache[a.id][h] = 1, f.push(k));
 d.postMessage({insert: f, system: this.indexType, options: this.indexOptions, idField: a.objectIdField, layerId: a.id}).then(function (b) {
 a.emit("process-end", {processor: e, results: {insert: b.insert}})
 });
 a.emit("process-start", {processor: e})
 },

 get: function () {
 },

 intersects: function (a, b, c) {
 return"rtree" != this.indexType ? (console.error("Index.intersects only works with rtree indexes"), a = new l, a.reject({message: "Index.intersects only works with rtree indexes"}), a.promise) : a = this.workerClient.postMessage({search: a, layerId: b, returnNode: c})
 },

 within: function (a, b, c) {
 if("rtree" != this.indexType)return console.error("Index.within only works with rtree indexes"), a = new l, a.reject({message: "Index.within only works with rtree indexes"}), a.promise
 },

 nearest: function (a) {
 return"kdtree" != this.indexType ?
 (console.error("Index.nearest only works with kdtree indexes"), a = new l, a.reject({message: "Index.nearest only works with kdtree indexes"}), a.promise) : a = this.workerClient.postMessage({search: a})
 }})
 });

 */




/* jshint worker: true */
/* global self: true, postMessage: true */

/* REQUIRES esri/workers/scripts/indexInterface */

/* global Indexer: false, geomToBbox: false, merge: false */

/*
 (function(context) {
 var self = context;
 var index;
 var system;

 function createIndex(msg) {
 try {
 index = new Indexer(msg);
 system = index.system;
 postMessage({
 msgId: msg.msgId,
 insert: msg.data && msg.data.length
 });
 } catch (err) {
 postMessage({
 msgId: msg.msgId,
 status: 'error',
 message: err.message
 });
 }
 }

 function updateIndex(msg) {
 if (msg.insert || msg.update) {
 if (!index) { //no indexer instance got created yet
 createIndex({
 'data': msg.insert || msg.update,
 'system': msg.system, //if this is null or undefined, Indexer will use default
 'indexOptions': msg.options,
 'idField': msg.idField,
 'layerId': msg.layerId
 });
 } else if (!index.index) { //indexer instance but no index created yet
 index.create(msg.insert || msg.update, merge({
 layerId: msg.layerId
 }, msg.options));
 } else { //we have an indexer with an active index
 if(msg.insert){
 var len = msg.insert.length;
 while (len--) {
 index.insert(msg.insert[len], null, msg.layerId);
 }
 } //TODO Support Update
 //  else {
 //   var len = msg.insert.length;
 //    while (len--) {
 //        index.search()
 //    }
 //}
 }
 postMessage({
 msgId: msg.msgId,
 insert: msg.insert.length
 });
 } else if (msg.remove) {
 if (!index || !index.index) {
 postMessage({
 msgId: msg.msgId,
 status: 'error',
 message: 'no active index to remove from'
 });
 } else {
 msg.remove.forEach(index.remove, index);
 }
 postMessage({
 msgId: msg.msgId,
 remove: msg.remove.length
 });
 }
 }

 function search(msg) {
 if (!index || !index.index) {
 postMessage({
 msgId: msg.msgId,
 status: 'error',
 message: 'no active index to search'
 });
 } else {
 var layer = msg.layerId;
 var results = index.search(msg.search, msg.returnNode);
 var found=[], len=results.length, item;
 if(!layer){
 found = results;
 } else {
 while(len--){
 item = results[len];
 if(item.layerId === layer){
 found.push(item);
 }
 }
 }
 postMessage({
 msgId: msg.msgId,
 'results': found
 });
 }
 }

 function getIndex(msg) {
 if (!index || !index.index) {
 postMessage({
 msgId: msg.msgId,
 status: 'error',
 message: 'no active index to serialize'
 });
 } else {
 var indexJson = index.serialize();
 postMessage({
 msgId: msg.msgId,
 index: indexJson
 });
 }
 }

 function loadIndex(msg) {
 index = new Indexer({
 system: msg.system
 });
 try {
 index.load(msg.index);
 postMessage({
 msgId: msg.msgId
 });
 } catch (err) {
 postMessage({
 msgId: msg.msgId,
 status: 'error',
 message: err.message
 });
 }
 }

 function messageHandler(evt) {
 var msg = evt.data || {};
 if (msg.index) {
 loadIndex(msg);
 } else if (msg.insert || msg.remove || msg.update) {
 updateIndex(msg);
 } else if ((msg.data && Array.isArray(msg.data)) || msg.system) {
 createIndex(msg);
 } else if (msg.search) {
 search(msg);
 } else if (msg.action && msg.action == 'getIndex') {
 getIndex(msg);
 }
 }

 self.addEventListener('message', messageHandler, false);

 self.searchIndex = function(criteria, returnNodes){
 return index.search(criteria, returnNodes);
 };

 self.main = function(msg) {
 var response = msg.response;
 var inserts;
 if (response && response.features) {
 var features = response.features;
 if (!features[0].geometry) {
 //returned without geometry, can't do anything
 return true;
 }
 //if points then don't need to modify
 //otherwise convert geoms to bbox
 if (!features[0].geometry.x && !features[0].geometry.y) {
 inserts = features.map(function(feat) {
 var item = geomToBbox(feat.geometry);
 item.id = feat.attributes[response.objectIdFieldName];
 return item;
 });
 } else {
 inserts = features.map(function(feat) {
 feat.geometry.id = feat.attributes[response.objectIdFieldName];
 return feat.geometry;
 });
 }
 updateIndex({
 'inserts': inserts
 });
 }
 };
 })(self);
 */




