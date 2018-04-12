import declare from 'dojo/_base/declare';
import BaseWidget from 'jimu/BaseWidget';
import _WidgetsInTemplateMixin from 'dijit/_WidgetsInTemplateMixin';
import i18n from 'dojo/i18n!./nls/strings';
import 'dijit/form/Form';
import 'dijit/form/Select';
import 'dijit/form/NumberTextBox';
import 'dijit/form/Button';
import 'dijit/form/CheckBox';
import 'dijit/ProgressBar';
import 'dijit/form/DropDownButton';
import 'dijit/TooltipDialog';
import 'dijit/form/RadioButton';
import 'dijit/form/SimpleTextarea';
import 'dijit/form/DateTextBox';
import TextBox from 'dijit/form/TextBox';
import 'dijit/form/Textarea';
import Select from 'dijit/form/Select';
import 'jimu/dijit/CheckBox';
import Deferred from 'dojo/Deferred';
import Message from 'jimu/dijit/Message';
import GenerateReports from './GenerateReports';
import Query from 'esri/tasks/query';
import FeatureLayer from 'esri/layers/FeatureLayer';
import graphicsUntils from 'esri/graphicsUtils';
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol';
import PrintTask from 'esri/tasks/PrintTask';
import PrintParameters from 'esri/tasks/PrintParameters';
import PrintTemplate from 'esri/tasks/PrintTemplate';
import DrawBox from 'jimu/dijit/DrawBox';
import on from 'dojo/on';
import lang from 'dojo/_base/lang';
import domClass from 'dojo/dom-class';
import array from 'dojo/_base/array';
import domConstruct from 'dojo/dom-construct';

// To create a widget, you need to derive from BaseWidget.
export default declare([BaseWidget, _WidgetsInTemplateMixin], {

  // Custom widget code goes here
  baseClass: 'reporting',
  i18n: i18n,
  reportFeatures: null,
  reportType: 'PDF',
  queryType: 'date',
  statusSelect: null,
  // add additional properties here

  // methods to communication with app container:
  postCreate() {
    this.inherited(arguments);
    this.reportTypeDijit.addOption([{
      label: 'Report by Date',
      value: 'Report by Date'
    }, {
      label: 'Report by Selected Features',
      value: 'Report by Selected Features'
    }, {
      label: 'Report by Status',
      value: 'Report by Status'
    }]);

    this.reportFormatDijit.addOption(
      [{
        label: 'PDF',
        value: 'PDF'
      }, {
        label: 'CSV',
        value: 'CSV'
      }]
    );
  },

  startup() {
    this.inherited(arguments);
    this.drawRow.style.display = 'none';
    this.generateButtonDiv.style.display = 'none';
    this.generateReportTable.style.display = 'none';
    this.clearButtonDiv.style.display = 'none';
    this.statusRow.style.display = 'none';
    this._initDrawBox();
    this._initStatsField();
    this._initAaField();
  },

  selectReportType(evt) {
    const self = this;
    if (evt === 'Report by Selected Features') {
      self.startDateRow.style.display = 'none';
      self.endDateRow.style.display = 'none';
      this.drawRow.style.display = '';
      this.statusRow.style.display = 'none';
      this.queryType = 'select';
      self.aaRow.style.display = 'none';
    } else if (evt === 'Report by Status') {
      self.startDateRow.style.display = '';
      self.endDateRow.style.display = '';
      this.statusRow.style.display = '';
      this.drawRow.style.display = 'none';
      self.aaRow.style.display = '';
      this.queryType = 'proposed';
    } else {
      self.aaRow.style.display = '';
      self.startDateRow.style.display = '';
      self.endDateRow.style.display = '';
      this.statusRow.style.display = 'none';
      this.drawRow.style.display = 'none';
      this.queryType = 'date';
    }
  },

  _initDrawBox() {
    const self = this;
    var enabledButtons = [];
    if (this.config.graphicalsearchoptions.enableextentselect) {
      enabledButtons.push('EXTENT');
    }
    if (this.config.graphicalsearchoptions.enablecircleselect) {
      enabledButtons.push('CIRCLE');
    }
    if (this.config.graphicalsearchoptions.enableellipseselect) {
      enabledButtons.push('ELLIPSE');
    }
    if (this.config.graphicalsearchoptions.enablepolyselect) {
      enabledButtons.push('POLYGON');
    }
    if (this.config.graphicalsearchoptions.enablefreehandpolyselect) {
      enabledButtons.push('FREEHAND_POLYGON');
    }
    this.drawBox = new DrawBox({
      map: this.map,
      geoTypes: enabledButtons
    });

    this.drawBox.placeAt(this.drawDiv);
    this.drawBox.setMap(this.map);

    this.own(on(this.drawBox, 'DrawEnd', lang.hitch(this, function(graphic) {
      self.drawBox.clear();
      self._selectFeatures('draw', null, null, graphic.geometry);
    })));
  },

  _initStatsField: function() {
    const self = this;
    const addressPtsLayer = this.map.getLayer(this.config.layerId);
    const statusField = array.filter(addressPtsLayer.fields, function(item) {
      return item.name === self.config.proposedField;
    });
    if (statusField.length > 0) {
      // setup the status field drop down values
      if (statusField[0].domain !== null) {
        self._setStatusValues(statusField[0].domain.codedValues);
      } else {
        self._setStaticSearchValue();
      }
    } else {
      new Message({
        titleLabel: 'Error getting status field information',
        message: i18n.statusFieldError
      });
    }
  },

  _initAaField: function() {
    const self = this;
    const addressPtsLayer = this.map.getLayer(this.config.layerId);
    const aaField = array.filter(addressPtsLayer.fields, function(item) {
      return item.name === self.config.addressAuthorityField;
    });

    if (aaField.length > 0) {
      // setup the status field drop down values
      if (aaField[0].domain != null) { // jshint ignore:line
        self._setUpAaUI(aaField[0].domain.codedValues);
      } else {
        self._setUpAaUI();
      }
    } else {
      new Message({
        titleLabel: 'Error getting status field information',
        message: i18n.aaFieldError
      });
    }
  },

  _setStatusValues: function(codedValues) {
    let selOptions = [];
    for (var z = 0; z < codedValues.length; z++) {
      selOptions.push({
        label: codedValues[z].name,
        value: codedValues[z].code
      });
    }

    this.statusSelect = new Select({
      name: 'proposedSelect',
      style: {
        width: '75%'
      }
    }).placeAt(this.statusDiv);

    this.statusSelect.addOption(selOptions);
  },

  _setUpAaUI: function(codedValues) {
    if (codedValues != null) { // jshint ignore:line
      // domain exists on the field so setup a drop down select with the domain values
      let selOptions = [];
      for (var z = 0; z < codedValues.length; z++) {
        selOptions.push({
          label: codedValues[z].name,
          value: codedValues[z].code
        });
      }

      this.aaSelect = new Select({
        name: 'aaSelect',
        style: {
          width: '75%'
        }
      }).placeAt(this.aaDiv);

      this.aaSelect.addOption(selOptions);
    } else {
      // domain does not exit so setup a textbox for user entry
      this.aaSelect = new TextBox({
        name: 'aaTextBox',
        style: {
          width: '75%'
        }
      }).placeAt(this.aaDiv);
    }
  },

  _setStaticSearchValue: function() {
    const valNode = domConstruct.toDom('<div>' + this.config.proposedQueryValue + '</div>');
    domConstruct.place(valNode, this.statusDiv);
  },

  selectReportFormat(evt) {
    this.reportType = evt;
    if (evt === 'PDF') {
      this.includeMapCheckBoxRow.style.display = '';
      this.commentsDiv.style.display = '';
    } else if (evt === 'CSV') {
      this.includeMapCheckBoxRow.style.display = 'none';
      this.commentsDiv.style.display = 'none';
    }
  },

  _printMap() {
    const deferred = new Deferred();
    const printer = new PrintTask(this.config.printService);
    const template = new PrintTemplate();
    template.exportOptions = {
      width: 1200,
      height: 800,
      dpi: 150
    };
    template.format = 'jpg';
    template.layout = 'MAP_ONLY';
    template.showAttribution = false;
    template.preserveScale = false;
    const params = new PrintParameters();
    params.template = template;
    params.map = this.map;

    printer.execute(params, function(result) {
      deferred.resolve(result.url);
    }, function(error) {
      new Message({
        titleLabel: 'Printing Error',
        message: error.toString()
      });
    });
    return deferred.promise;
  },

  generateReport() {
    const self = this;
    if (this.reportName.attr('displayedValue') !== '') {
      const generateReports = new GenerateReports({
        config: this.config
      });
      // print the map
      if (this.reportType === 'PDF') {
        domClass.add(this.generateButton, 'disabled');
        this.generateButton.innerHTML = i18n.busyReportText;
        if (this.includeMapCheckBox.checked === true) {
          this._printMap().then(function(printUrl) {
            generateReports.convertImage(printUrl).then(mapPrint => {
              generateReports.convertImage(self.config.reportLogo).then(base64Img => {
                generateReports.generateReport(self.reportFeatures, base64Img, self.comments.value, mapPrint, self.reportName.attr('displayedValue')).then(() => {
                  domClass.remove(self.generateButton, 'disabled');
                  self.generateButton.innerHTML = i18n.genReport;
                });
              });
            });
          });
        } else {
          generateReports.convertImage(self.config.reportLogo).then(base64Img => {
            generateReports.generateReport(self.reportFeatures, base64Img, self.comments.value, null, self.reportName.attr('displayedValue')).then(() => {
              domClass.remove(self.generateButton, 'disabled');
              self.generateButton.innerHTML = i18n.genReport;
            });
          });
        }
      } else if (this.reportType === 'CSV') {
        self._exportCsv(self.reportFeatures);
      }
    } else {
      new Message({
        titleLabel: i18n.noNameMessgeTitle,
        message: i18n.noNameMessge
      });
    }
  },

  getFeatures() {
    this.generateButtonDiv.style.display = 'none';
    this.generateReportTable.style.display = 'none';
    this.clearButtonDiv.style.display = 'none';
    this.messageNode.innerHTML = '';
    if (this.startDate.displayedValue !== '') {
      this._queryAddressPoints(this.queryType, this.startDate.displayedValue, this.endDate.displayedValue);
    } else {
      new Message({
        titleLabel: i18n.errorMessage,
        message: 'Please select a start date to select address points.'
      });
    }
  },

  clearSelectedFeatures() {
    const addressPtsLayer = this.map.getLayer(this.config.layerId);
    addressPtsLayer.clearSelection();
    this.generateButtonDiv.style.display = 'none';
    this.generateReportTable.style.display = 'none';
    this.clearButtonDiv.style.display = 'none';
    this.queryButtonDiv.style.display = 'block';
    this.messageNode.innerHTML = '';
  },

  _queryAddressPoints(type, startDate, endDate) {
    this._selectFeatures(type, startDate, endDate);
  },

  _selectFeatures(type, startDate, endDate, geometry) {
    const self = this;
    // define the selection symbol
    const symbol = new SimpleMarkerSymbol(this.config.selectionSymbol);
    const addressPtsLayer = this.map.getLayer(this.config.layerId);
    addressPtsLayer.setSelectionSymbol(symbol);
    const query = new Query();
    if (!geometry) {
      let aaQuery = '';
      // if the address authority is available then add it to the query.  Otherwise, if it's blank ignore it
      if (this.aaSelect.attr('displayedValue') !== '') {
        aaQuery = " AND " + this.config.addressAuthorityField + ' = \'' + this.aaSelect.attr('displayedValue') + '\'';
      }
      if (type === 'date') {
        query.where = this.config.dateField + " >= '" + startDate + "' AND " + this.config.dateField + " <= '" + endDate + "'";
      } else if (type === 'proposed') {
        if (this.statusSelect === null) {
          query.where = this.config.proposedField + ' = \'' + this.config.proposedQueryValue + '\' AND (' + this.config.dateField + " >= '" + startDate + "' AND " + this.config.dateField + " <= '" + endDate + "')";
        } else {
          query.where = this.config.proposedField + ' = \'' + this.statusSelect.attr('displayedValue') + '\' AND (' + this.config.dateField + " >= '" + startDate + "' AND " + this.config.dateField + " <= '" + endDate + "')";
        }
      }
      // add on the address authority query parameters
      query.where = query.where + aaQuery;
    } else {
      query.geometry = geometry;
    }

    query.outFields = ['*'];
    addressPtsLayer.selectFeatures(query, FeatureLayer.SELECTION_NEW, results => {
      if (results.length > 0) {
        self._zoomAndSelectFeatures(results);
        self.reportFeatures = results;
        self.messageNode.innerHTML = '';
        self.messageNode.appendChild(document.createTextNode('Number of selected features: ' + results.length));
        self.generateButtonDiv.style.display = 'block';
        self.generateReportTable.style.display = 'block';
        self.clearButtonDiv.style.display = 'block';
        self.queryButtonDiv.style.display = 'none';
      } else {
        new Message({
          titleLabel: i18n.noMatchingMessge,
          message: i18n.noAddressPointsFound
        });
      }
    }, error => {
      console.error('ERROR: ', error);
    });
  },

  _exportCsv(features) {
    const self = this;
    let csvData = [];
    // add the field headers to the array first
    let headerFields = [];
    array.forEach(this.config.csvReportFields, function(fieldInfo) {
      headerFields.push(fieldInfo.header);
    }, this);
    csvData.push(headerFields);

    // next add the data from the selection to the array, one row as a time
    for (var z = 0; z < this.config.csvReportFields.length; z++) {
      if (z === 0) {
        for (var i = 0; i < features.length; i++) {
          let index = i + 1;
          csvData[index] = [];
          csvData[index].push(features[i].attributes[this.config.csvReportFields[z].fieldName]);
        }
      } else {
        for (var q = 0; q < features.length; q++) {
          let index = q + 1;
          if (this.config.csvReportFields[z].type !== 'date') {
            csvData[index].push(features[q].attributes[this.config.csvReportFields[z].fieldName]);
          } else {
            csvData[index].push(self._formatDate(features[q].attributes[this.config.csvReportFields[z].fieldName]));
          }
        }
      }
    }

    // Building the CSV from the Data two-dimensional array
    // Each column is separated by ";" and new line "\n" for next row
    var csvContent = '';
    csvData.forEach(function(infoArray, index) {
      var dataString = infoArray.join(',');
      csvContent += index < csvData.length ? dataString + '\n' : dataString;
    });

    this._downloadCsv(csvContent, this.reportName.attr('displayedValue') + '.csv');
  },

  _downloadCsv(content, fileName, mimeType) {
    // The download function takes a CSV string, the filename and mimeType as parameters
    // Scroll/look down at the bottom of this snippet to see how download is called
    var a = document.createElement('a');
    mimeType = mimeType || 'application/octet-stream';

    if (navigator.msSaveBlob) { // IE10
      navigator.msSaveBlob(new Blob([content], {
        type: mimeType
      }), fileName);
    } else if (URL && 'download' in a) { //html5 A[download]
      a.href = URL.createObjectURL(new Blob([content], {
        type: mimeType
      }));
      a.setAttribute('download', fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      location.href = 'data:application/octet-stream,' + encodeURIComponent(content); // only this mime type is supported
    }
  },

  _formatDate(dateNum) {
    let theDate = new Date(dateNum);
    let adjustedDate = new Date(theDate.getTime() + theDate.getTimezoneOffset() * 60000);
    return (adjustedDate.getMonth() + 1) + '/' + adjustedDate.getDate() + '/' + adjustedDate.getFullYear();
  },

  _zoomAndSelectFeatures(features) {
    this.map.setExtent(graphicsUntils.graphicsExtent(features), true);
  }
});