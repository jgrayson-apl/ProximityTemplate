define([
  "dojo/_base/declare",
  "dojo/Evented",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/dom",
  "dojo/dom-geometry",
  "dijit/registry",
  "dijit/Tooltip",
  "dojo/mouse",
  "dojo/on",
  "dojo/aspect",
  "dojox/gfx"
], function (declare, Evented, lang, array, Color, colors, number, dom, domGeom,
             registry, Tooltip, mouse, on, aspect, gfx) {

  /**
   *
   */
  var ProximityChart = declare([Evented], {

    // CLASS NAME //
    declaredClass: "ProximityChart",

    // TITLE //
    title: "Proximity Chart",
    titleBoxHeight: 30,
    legendBoxHeight: 20,

    // ATTRIBUTE FIELDS //
    //azimuthFieldName: "AZIMUTH",
    //distanceFieldName: "NEAR_DIST",
    azimuthFieldName: "FWD_AZIMUTH",
    distanceFieldName: "DISTANCE",

    // AZIMUTH LABELS //
    azimuthLabels: {
      0: "N", 30: "NNE", 45: "NE", 60: "ENE",
      90: "E", 120: "ESE", 135: "SE", 150: "SSE",
      180: "S", 210: "SSW", 225: "SW", 240: "WSW",
      270: "W", 300: "WNW", 315: "NW", 330: "NNW"
    },

    // CHART DEFAULTS //
    azimuthStep: 45.0,
    outerRadius: 100.0,
    innerRadius: 30.0,
    radiusSteps: 5,
    radiusStep: 10,

    // AZIMUTH AND DISTANCE GROUPS //
    slices: [],

    // DEFAULT STROKES //
    //minorStroke: { color: "#ccc", style: "solid", width: 1 },
    //majorStroke: { color: "#333", style: "solid", width: 2 },
    minorStroke: { color: "#efefef", style: "solid", width: 1 },
    majorStroke: { color: "#ccc", style: "solid", width: 2 },
    animateStroke: { color: Color.named.orange, style: "solid", width: 6 },

    // DEFAULT FONTS //
    smallFont: { family: "Helvetica", style: "bold", size: "7pt" },
    minorFont: { family: "Helvetica", style: "bold", size: "9pt" },
    majorFont: { family: "Helvetica", style: "bold", size: "14pt" },
    busyFont: { family: "Helvetica", style: "italic", size: "12pt" },

    // DEFAULT COLOR VALUES //
    textColor: "#333",
    fromFillColor: "#ffe4ea",
    toFillColor: Color.named.red,
    fromStrokeColor: Color.named.salmon,
    toStrokeColor: Color.named.darkred,
    highlightStrokeColor: Color.named.yellow,
    centerFillColor: Color.named.white,
    centerHighlightColor: Color.named.lime,
    busyFillColor: Color.named.yellow,
    errorFillColor: Color.named.red,

    /**
     *
     * @param options
     * @param srcNodeRef
     */
    constructor: function (options, srcNodeRef) {
      lang.mixin(this, options);

      // DOM NODE //
      this.domNode = (srcNodeRef.hasOwnProperty("id")) ? srcNodeRef : dom.byId(srcNodeRef);

      // INIT/RESIZE //
      this._resizeChart();

      // RESIZE EVENT //
      aspect.after(registry.getEnclosingWidget(this.domNode), 'resize', lang.hitch(this, this._resizeChart), true);
    },

    /**
     *
     * @private
     */
    _resizeChart: function () {

      // NODE BOX //
      this.nodeBox = domGeom.getContentBox(this.domNode);
      // CENTER //
      this.nodeCenter = {
        x: this.nodeBox.w * 0.5,
        y: (this.nodeBox.h + this.titleBoxHeight - this.legendBoxHeight) * 0.5
      };
      // ADJUSTED OUTER RADIUS //
      this.outerRadius = (this.nodeBox.h - this.titleBoxHeight - this.legendBoxHeight) * 0.4;

      // SURFACE //
      if(!this.surface) {
        this.surface = gfx.createSurface(this.domNode, this.nodeBox.w, this.nodeBox.h);
      } else {
        this.surface.setDimensions(this.nodeBox.w, this.nodeBox.h);
      }

      // LEGEND //
      this.legendSize = {
        x: this.nodeCenter.x * 1.1,
        y: this.nodeBox.h - (this.legendBoxHeight * 1.2),
        w: this.nodeCenter.x * 0.8,
        h: this.legendBoxHeight
      };

      // RE-DRAW //
      if(this.nearTable && this.distanceMeters) {
        this.update(this.nearTable, this.distanceMeters);
      } else {
        this.clear();
      }
    },

    /**
     *
     */
    clear: function () {
      this.surface.clear();
      this._drawCircles();
    },

    /**
     *
     * @param degrees
     * @returns {number}
     * @private
     */
    _degToRad: function (degrees) {
      return degrees * (Math.PI / 180.0);
    },

    /**
     *
     * @param radians
     * @returns {number}
     * @private
     */
    _radToDeg: function (radians) {
      return radians * (180.0 / Math.PI);
    },

    /**
     *
     * @param azimuth
     * @returns {number}
     * @private
     */
    _aziToDeg: function (azimuth) {
      return (-azimuth + 90.0);
    },

    /**
     *
     * @param azimuth
     * @returns {number}
     */
    _aziToRadians: function (azimuth) {
      return this._degToRad(this._aziToDeg(azimuth));
    },

    /**
     *
     * @param p
     * @param dist
     * @param azimuth
     * @returns {{x: number, y: number}}
     */
    _pointTo: function (p, dist, azimuth) {
      var radians = this._aziToRadians(azimuth);
      return {
        x: p.x + Math.cos(radians) * dist,
        y: p.y - Math.sin(radians) * dist
      };
    },

    /**
     *
     * @param azimuth
     * @returns {string}
     * @private
     */
    _azimuthToLabel: function (azimuth) {
      return this.azimuthLabels[azimuth] || String(azimuth);
    },

    /**
     *
     * @private
     */
    _drawCircles: function () {

      // TITLE //
      this.surface.createText({
        x: this.nodeCenter.x,
        y: (this.titleBoxHeight * 0.5),
        align: "middle",
        text: this.title
      }).setFont(this.majorFont).setFill(this.textColor);

      // STEP CIRCLE //
      this.radiusStep = Math.round((this.outerRadius - this.innerRadius) / this.radiusSteps);
      for (var radius = (this.innerRadius + this.radiusStep); radius < this.outerRadius; radius += this.radiusStep) {
        //console.log(radius, this.radiusStep, this.outerRadius);
        this.surface.createCircle({
          cx: this.nodeCenter.x,
          cy: this.nodeCenter.y,
          r: radius
        }).setStroke(this.minorStroke);
      }

      // SLICES //
      //  - GROUPS OF AZIMUTHS AND DISTANCES //
      this.slices = [];

      // AZIMUTH LINES //
      for (var azi = 0.0; azi < 360.0; azi += this.azimuthStep) {
        this._createAzimuthLine(azi);
        this.slices[azi] = [];
      }

      // OUTER CIRCLE //
      this.surface.createCircle({
        cx: this.nodeCenter.x,
        cy: this.nodeCenter.y,
        r: this.outerRadius
      }).setStroke(this.majorStroke);

      // INNER CIRCLE //
      this.innerCircle = this.surface.createCircle({
        cx: this.nodeCenter.x,
        cy: this.nodeCenter.y,
        r: this.innerRadius
      }).setStroke(this.majorStroke).setFill(new Color(this.centerFillColor));
      // INNER CIRCLE MOUSE ENTER/LEAVE //
      this.innerCircle.on(mouse.enter, lang.hitch(this, function (evt) {
        this.innerCircle.moveToFront();
        this.innerCircle.setFill(new Color(this.centerHighlightColor));
        on.once(evt.target, mouse.leave, lang.hitch(this, function () {
          this.innerCircle.moveToBack();
          this.innerCircle.setFill(new Color(this.centerFillColor));
        }));
      }));
      // EMIT INNER CIRCLE CLICK //
      this.innerCircle.on("click", lang.hitch(this, this.emit, "inner-circle-click", {}));

      // CENTER TEXT //
      this.updateCenterText(" ");
      /*this.centerText = this.surface.createText({
       x: this.nodeCenter.x,
       y: this.nodeCenter.y + 7,
       align: "middle",
       text: ""
       }).setFont(this.majorFont).setFill(this.majorStroke.color);*/

      // LEGEND TEST //
      //this._displayLegend(200, 30000, 1500);
    },

    /**
     *
     * @param text
     * @param textFont
     * @param textFill
     */
    updateCenterText: function (text, textFont, textFill) {
      if(this.centerText) {
        this.surface.remove(this.centerText);
      }
      if(text) {
        this.centerText = this.surface.createText({
          x: this.nodeCenter.x,
          y: this.nodeCenter.y + 7,
          align: "middle",
          text: text
        }).setFont(textFont || this.majorFont).setFill(textFill || this.textColor);
      }
    },

    /**
     *
     * @param maxFrequency
     * @param maxDistance
     * @param featureCount
     * @private
     */
    _displayLegend: function (maxFrequency, maxDistance, featureCount) {

      // LEGEND //
      this.surface.createRect({
        x: this.legendSize.x,
        y: this.legendSize.y,
        width: this.legendSize.w,
        height: this.legendSize.h * 0.5
      }).setFill({
        type: "linear",
        x1: this.legendSize.x,
        y1: this.legendSize.y,
        x2: this.legendSize.x + this.legendSize.w,
        y2: this.legendSize.y - (this.legendSize.h * 0.5),
        colors: [
          { offset: 0.0, color: this.fromFillColor },
          { offset: 1.0, color: this.toFillColor }
        ]
      });

      // LABEL //
      this.surface.createText({
        x: this.legendSize.x + (this.legendSize.w * 0.5),
        y: this.legendSize.y - (this.legendSize.h * 0.5) + 3,
        align: "middle",
        text: "Frequency"
      }).setFont(this.minorFont).setFill(this.textColor);

      // MIN VALUE //
      this.surface.createText({
        x: this.legendSize.x,
        y: this.legendSize.y + this.legendSize.h + 3,
        align: "start",
        text: "0"
      }).setFont(this.minorFont).setFill(this.textColor);

      // MAX VALUE //
      this.surface.createText({
        x: this.legendSize.x + this.legendSize.w,
        y: this.legendSize.y + this.legendSize.h + 3,
        align: "end",
        text: number.format(maxFrequency, { places: 0 }) || "???"
      }).setFont(this.minorFont).setFill(this.textColor);

      // MAX DISTANCE //
      this.surface.createText({
        x: 2,
        y: this.nodeBox.h - 2,
        align: "start",
        text: "Distance: " + number.format(maxDistance, { places: 0 }) + " m"
      }).setFont(this.minorFont).setFill(this.textColor);

      // FEATURE COUNT //
      this.surface.createText({
        x: 2,
        y: this.nodeBox.h - 17,
        align: "start",
        text: "Count: " + number.format(featureCount, { places: 0 })
      }).setFont(this.minorFont).setFill(this.textColor);

      /*// DISTANCE LABELS //
       for (var radius = (this.innerRadius + this.radiusStep); radius < this.outerRadius; radius += this.radiusStep) {
       var labelPnt = this._pointTo(this.nodeCenter, radius, 180.0);
       var radiusFactor = (radius / this.outerRadius);
       var distance = number.format(radiusFactor * maxDistance, {places: 0});
       this.surface.createText({
       x: labelPnt.x - 5,
       y: labelPnt.y,
       align: "end",
       text: distance
       }).setFont(this.smallFont).setFill(this.distanceColor);
       }*/

    },

    /**
     *
     * @param azimuth
     * @private
     */
    _createAzimuthLine: function (azimuth) {

      // LINE END POINTS //
      var innerPnt = this._pointTo(this.nodeCenter, this.innerRadius, azimuth);
      var outerPnt = this._pointTo(this.nodeCenter, this.outerRadius, azimuth);

      // LINE //
      var azimuthLine = this.surface.createLine({
        x1: innerPnt.x,
        y1: innerPnt.y,
        x2: outerPnt.x,
        y2: outerPnt.y
      }).setStroke(this.majorStroke);

      // TEXT //
      var isMajorLine = (azimuth % 90.0 === 0.0);
      var labelPnt = this._pointTo(this.nodeCenter, this.outerRadius + 15, azimuth);
      this.surface.createText({
        x: labelPnt.x,
        y: labelPnt.y + 4,
        align: "middle",
        text: this._azimuthToLabel(azimuth)
      }).setFont(isMajorLine ? this.majorFont : this.minorFont).setFill(this.textColor);

      return azimuthLine;
    },

    /**
     *
     * @param fromAzimuth
     * @param toAzimuth
     * @param fromLength
     * @param toLength
     * @param stroke
     * @param fill
     * @param frequency
     * @returns {*}
     */
    drawSlice: function (fromAzimuth, toAzimuth, fromLength, toLength, stroke, fill, frequency) {
      //console.log("-azi: ", fromAzimuth, " to ", toAzimuth, "-dist: ", fromLength, " to ", toLength, " -freq: ", frequency);

      var corner1 = this._pointTo(this.nodeCenter, fromLength, fromAzimuth);
      var corner2 = this._pointTo(this.nodeCenter, toLength, fromAzimuth);
      var corner3 = this._pointTo(this.nodeCenter, toLength, toAzimuth);
      var corner4 = this._pointTo(this.nodeCenter, fromLength, toAzimuth);

      var slice = this.surface.createPath()
          .moveTo(corner1)
          .lineTo(corner2)
          .arcTo(toLength, toLength, this._aziToRadians(fromAzimuth), false, true, corner3)
          .lineTo(corner4)
          .arcTo(fromLength, fromLength, this._aziToRadians(toAzimuth), false, false, corner1)
          .closePath()
          .setFill(fill || this.minorStroke.color);
          //.setStroke(stroke || this.minorStroke);

      slice.on(mouse.enter, lang.hitch(this, function (evt) {

        slice.setStroke(lang.mixin({}, stroke, { color: new Color(this.highlightStrokeColor), width: 2.5 })).moveToFront();
        this.updateCenterText(number.format(frequency, { places: 0 }));

        on.once(evt.target, mouse.leave, lang.hitch(this, function () {
          //slice.setStroke(stroke);
          slice.setStroke();
          this.updateCenterText();
        }));

      }));

      return slice;
    },

    /**
     *
     * @param nearTable
     * @param distanceMeters
     */
    update: function (nearTable, distanceMeters) {

      this.clear();

      this.nearTable = nearTable;
      this.distanceMeters = distanceMeters;

      // GROUPS //
      var maxFrequency = 0;
      var distanceStep = Math.round(this.distanceMeters / this.radiusSteps);
      array.forEach(this.nearTable, lang.hitch(this, function (nearData) {
        // NEAR VALUES //
        var azimuth = +nearData[this.azimuthFieldName] || +nearData.attributes[this.azimuthFieldName];
        var distance = +nearData[this.distanceFieldName] || +nearData.attributes[this.distanceFieldName];
        if(azimuth && distance) {
          // GROUP //
          var azimuthGroup = azimuth - (azimuth % this.azimuthStep);
          var distanceGroup = distance - (distance % distanceStep);

          // UPDATE FREQUENCY //
          this.slices[azimuthGroup][distanceGroup] = this.slices[azimuthGroup][distanceGroup] + 1 || 1;

          // MAX FREQUENCY //
          maxFrequency = Math.max(maxFrequency, this.slices[azimuthGroup][distanceGroup]);
        }
      }));


      // DRAW SLICE FOR EACH AZIMUTH AND DISTANCE GROUP //
      for (var azi in this.slices) {
        if(this.slices.hasOwnProperty(azi)) {
          for (var dist in this.slices[azi]) {
            if(this.slices[azi].hasOwnProperty(dist)) {

              // FREQUENCY //
              var frequency = this.slices[azi][dist];

              // AZIMUTH AND DISTANCE //
              var azimuth = +azi;
              var distance = +dist;

              // FREQUENCY FACTOR //
              var frequencyFactor = (frequency / maxFrequency);
              // FILL //
              var sliceFill = Color.blendColors(new Color(this.fromFillColor), new Color(this.toFillColor), frequencyFactor);
              // STROKE //
              var sliceStroke = lang.mixin({}, this.minorStroke, {
                color: Color.blendColors(new Color(this.fromStrokeColor), new Color(this.toStrokeColor), frequencyFactor)
              });

              // FROM DISTANCE //
              var fromDistance = this.innerRadius + ((distance / this.distanceMeters) * (this.outerRadius - this.innerRadius));

              // SLICE //
              this.drawSlice(azimuth, (azimuth + this.azimuthStep), fromDistance, (fromDistance + this.radiusStep), sliceStroke, sliceFill, frequency);
            }
          }
        }
      }

      // DISPLAY LEGEND //
      this._displayLegend(maxFrequency, this.distanceMeters, nearTable.length);

      // SET BUSY //
      this.setBusy(false);
    },

    /**
     *
     * @param isBusy
     */
    setBusy: function (isBusy) {
      if(isBusy) {
        this.innerCircle.moveToFront();
        this.innerCircle.setFill(this.busyFillColor);
        this.updateCenterText("busy", this.busyFont);
      } else {
        this.updateCenterText();
        this.innerCircle.moveToBack();
        this.innerCircle.setFill(new Color(this.centerFillColor));
      }
    },

    /**
     *
     */
    setError: function () {
      this.innerCircle.moveToFront();
      this.innerCircle.setFill(this.errorFillColor);
      this.updateCenterText("error", this.busyFont);
    }

  });

  /**
   *
   * @type {string}
   */
  ProximityChart.verion = "0.10.2";

  /**
   *
   */
  return ProximityChart;
});
