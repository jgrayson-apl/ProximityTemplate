define([
  "dojo/ready",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/on",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-geometry",
  "dojo/keys",
  "dojo/_base/Color",
  "dojo/colors",
  "dojox/gfx",
  "dijit/registry",
  "dijit/Dialog",
  "dojo/query",
  "put-selector/put",
  "esri/config",
  "esri/arcgis/utils",
  "esri/dijit/OverviewMap",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/graphic",
  "esri/geometry/Point",
  "esri/geometry/Circle",
  "esri/geometry/webMercatorUtils",
  "esri/tasks/LinearUnit",
  "esri/units",
  "dojo/i18n!esri/nls/jsapi",
  "application/Proximity/ProximityChart",
  "application/Proximity/ProximityIndex",
  "widgets/PanRoam"
], function (ready, declare, lang, array, on, dom, domClass, domGeom, keys, Color, colors, gfx,
             registry, Dialog, query, put, esriConfig, arcgisUtils, OverviewMap,
             SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Graphic, Point, Circle, webMercatorUtils, LinearUnit, Units,
             esriBundle, ProximityChart, ProximityIndex, PanRoam) {

  return declare(null, {

    targetLayerName: "Brussels_Points of interest",

    /**
     *
     * @param config
     */
    constructor: function (config) {
      declare.safeMixin(this, config);

      ready(lang.hitch(this, function () {

        var itemInfoOrWebmapId = (this.itemInfo || this.webmap);
        arcgisUtils.createMap(itemInfoOrWebmapId, "mapPane", {
          ignorePopups: true,
          mapOptions: {
            //zoom: 16,
            sliderOrientation: "horizontal"
          },
          bingMapsKey: this.bingmapskey
        }).then(lang.hitch(this, function (response) {
          //console.log(this.config, response);

          // MAP, ITEM, AND WEBMAP //
          this.map = response.map;
          this.item = response.itemInfo.item;
          this.webmap = response.itemInfo.itemData;

          //this.map.on("update-start", lang.hitch(this.map, this.map.setMapCursor, "wait"));
          //this.map.on("update-end", lang.hitch(this.map, this.map.setMapCursor, "default"));

          // PAN ROAM BUTTON //
          var panRoamBtn = new PanRoam({ map: this.map }, "pan-button-node");
          panRoamBtn.startup();

          // TITLE //
          dom.byId('titleNode').innerHTML = this.item.title || "[No Title]";

          // DEFAULT SYMBOLS //
          //this.pointSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CROSS, 24, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(Color.named.red), 3), new Color(dojo.Color.named.green));
          //this.lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color(Color.named.darkred), 3);
          this.polySymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(Color.named.red), 5), new Color(Color.named.yellow.concat(0.0)));
          this.centerSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CROSS, 24, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(Color.named.red), 3), new Color(dojo.Color.named.green));

          // OVERVIEW MAP //
          this.overviewMap = new OverviewMap({
            map: this.map,
            visible: true,
            color: "red",
            opacity: 0.1,
            attachTo: "bottom-left"
          });
          this.overviewMap.startup();


          // MAP HAS FINISHED DRAWING LAYERS //
          on.once(this.map, "update-end", lang.hitch(this, function () {

            // TARGET LAYER //
            var targetLayer = this.getMapLayer(this.webmap, this.targetLayerName);


            // PROXIMITY CHART //
            this.proximityChart = new ProximityChart({}, "proximityChartNode");

            // PROXIMITY INDEX //
            this.proximityIndex = new ProximityIndex();
            this.proximityIndex.setSource(this.map);
            this.proximityIndex.setTargets(targetLayer);

            this.proximityIndex.on("update-start", lang.hitch(this, function (evt) {
              this.proximityChart.setBusy(true);
            }));

            this.proximityIndex.on("update-error", lang.hitch(this, function (error) {
              this.proximityChart.setError();
            }));

            this.proximityIndex.on("update-end", lang.hitch(this, function (evt) {

              // CENTER //
              if(!this.centerGraphic) {
                this.centerGraphic = new Graphic(evt.source, this.centerSymbol);
                this.map.graphics.add(this.centerGraphic);
              } else {
                this.centerGraphic.setGeometry(evt.source);
              }

              // CIRCLE //
              /*var searchCircle = new Circle(evt.source, {
               radius: (evt.maxDistanceMeters * 0.5),
               geodesic: true
               });*/
              /*if(!this.searchCircleGraphic) {
               this.searchCircleGraphic = new Graphic(searchCircle, this.polySymbol);
               this.overviewMap.overviewMap.graphics.add(this.searchCircleGraphic);
               } else {
               this.searchCircleGraphic.setGeometry(searchCircle);
               }*/

              // EXTENT //
              /*if(!this.searchExtentGraphic) {
               this.searchExtentGraphic = new Graphic(evt.searchExtent, this.polySymbol);
               this.overviewMap.overviewMap.graphics.add(this.searchExtentGraphic);
               } else {
               this.searchExtentGraphic.setGeometry(evt.searchExtent);
               }*/

              // DISPLAY PROXIMITY CHART //
              this.proximityChart.update(evt.nearTable, evt.maxDistanceMeters);

              // debug: display elapsed time in ms...
              var elapsedTimeSeconds = (evt.elapsedTimeMs / 1000).toFixed(2);
              this.proximityChart.updateCenterText(elapsedTimeSeconds, null, "red");

            }));

            // USE PAN/ROAM BUTTON UPDATE LOCATION AS SOURCE OF PROXIMITY ANALYSIS //
            if(panRoamBtn) {
              panRoamBtn.on("update", lang.hitch(this, function (evt) {
                this.proximityIndex.setSource(evt.mapPoint);
              }));
              panRoamBtn.on("change", lang.hitch(this, function (evt) {
                this.proximityIndex.setSource(this.map);
              }));
            }

          }));

        }), lang.hitch(this, function (error) {
          if(this.i18n) {
            alert(this.i18n.map.error + ": " + error.message);
          } else {
            alert("Unable to create map: " + error.message);
          }
        }));
      }));
    },

    /**
     *
     * @param webmap
     * @param layerName
     * @returns {*}
     */
    getMapLayer: function (webmap, layerName) {
      var operationalLayer = this.getOperationalLayer(webmap, layerName);
      if(operationalLayer) {
        return operationalLayer.layerObject;
      } else {
        return null;
      }
    },


    /**
     *
     * @param webmap
     * @param layerName
     * @returns {*}
     */
    getOperationalLayer: function (webmap, layerName) {
      var candidateLayers = array.filter(webmap.operationalLayers, function (operationalLayer) {
        return (operationalLayer.title === layerName);
      });
      if(candidateLayers.length > 0) {
        return candidateLayers[0];
      } else {
        return null;
      }
    },

    /**
     *
     * @param infoMessage
     * @param actionMessage
     * @returns {Dialog}
     */
    displayMessage: function (infoMessage, actionMessage) {

      var contentPane = put("div.dijitDialogPaneContentArea");
      put(contentPane, "div.message-info", { innerHTML: infoMessage || "" });

      var actionBar = put(contentPane, "div.dijitDialogPaneActionBar");
      if(actionMessage) {
        put(actionBar, "div.message-action", { innerHTML: actionMessage });
      }

      var messageDlg = new Dialog({
        title: "Message",
        content: contentPane
      });
      messageDlg.show();

      return messageDlg;
    }

  });
});


