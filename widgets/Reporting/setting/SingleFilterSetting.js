///////////////////////////////////////////////////////////////////////////
// Copyright © 2018 - 2018 North Point Geographic Solutions
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/on',
    'dojo/query',
    'dojo/Evented',
    'dojo/_base/lang',
    'dojo/_base/html',
    'dojo/_base/declare',
    'dojo/_base/array',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/registry',
    'dojo/text!./SingleFilterSetting.html',
    'jimu/utils',
    'jimu/dijit/Message',
    'jimu/dijit/LayerChooserFromMapWithDropbox',
    'dijit/form/Select',
    './CustomFeaturelayerChooserFromMap',
    'dojo/dom-construct',
    'dijit/form/TextBox',
    'dijit/form/Button',
    'dojo/dom-style',
    'jimu/dijit/ImageChooser',
    'dijit/form/ValidationTextBox'
  ],
  function(on, query, Evented, lang, html, declare, array, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, registry, template,
    jimuUtils, Message, LayerChooserFromMapWithDropbox, Select, CustomFeaturelayerChooserFromMap,
    domConstruct, TextBox, Button) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'jimu-widget-singlelayer-setting',
      templateString: template,
      jimuNls: null,
      _defaultTaskIcon: null,

      //options
      map: null,
      nls: null,
      target: null,
      layerInfosObj: null,
      folderUrl: '',
      appConfig: null,
      fieldList: [],
      csvFieldList: [],
      layer: null,

      postMixInProperties: function() {
        this.inherited(arguments);
        this._defaultTaskIcon = this.folderUrl + "setting/css/images/default_task_icon.png";
        this.jimuNls = window.jimuNls;
      },

      postCreate: function() {
        this.inherited(arguments);

        this._recreateLayerChooserSelect(true);
        this.addFieldBtn.style.display = 'none';
        this._setDefaultTaskIcon();

        // hide csv fields until clicked
        this.addCsvFieldsDiv.style.display = 'none';
        this.csvFieldsTableEle.style.display = 'none';

        // clear the field list
        this.csvFieldList = [];
        this.fieldList = [];
      },

      _recreateLayerChooserSelect: function(bindEvent) {
        if (this.layerChooserSelect) {
          this.layerChooserSelect.destroy();
        }
        this.layerChooserSelect = null;
        var layerChooser = new CustomFeaturelayerChooserFromMap({
          showLayerFromFeatureSet: false,
          showTable: false,
          onlyShowVisible: false,
          createMapResponse: this.map.webMapResponse
        });
        this.layerChooserSelect = new LayerChooserFromMapWithDropbox({
          layerChooser: layerChooser
        });
        this.layerChooserSelect.placeAt(this.layerTd);
        if (bindEvent) {
          this._bindEventForLayerChooserSelect(this.layerChooserSelect);
        }
      },

      showLayerChooserPopup: function() {
        this.layerChooserSelect.showLayerChooser();
      },

      destroy: function() {
        this.target = null;
        this.emit('before-destroy');
        this.inherited(arguments);
      },

      //reset by config
      setConfig: function(_config) {
        var config = lang.clone(_config);
        this._showLoading();
        this.reset();

        this._setDropDownFields(config);

        //set layerChooser
        this._recreateLayerChooserSelect(false);
        var callback = lang.hitch(this, function() {
          if (!this.domNode) {
            return;
          }
          this._bindEventForLayerChooserSelect(this.layerChooserSelect);
          this._hideLoading();
        });
        var layerInfo = this.layerInfosObj.getLayerInfoById(config.layerId);
        layerInfo.getLayerObject().then(lang.hitch(this, function(layer) {
          if (!this.domNode) {
            return;
          }
          this.layerChooserSelect.setSelectedLayer(layer).then(lang.hitch(this, function(success) {
            if (!this.domNode) {
              return;
            }
            this._onLayerChanged();
            // set the drop down items
            this._setDropDownFields(config);
            if (config.pdfReportFields) {
              this._setTableFields(config.pdfReportFields);
            }
            if (config.csvReportFields) {
              if (!this._arraysEqual(config.pdfReportFields, config.csvReportFields)) {
                this._setCsvTableFields(config.csvReportFields);
                this.addCsvFieldsDiv.style.display = '';
                this.csvFieldsTableEle.style.display = '';
              }
            }
            this._hideLoading();
            if (!success) {
              return;
            }

            //set icon
            if (config.reportLogo) {
              this.imageChooser.setDefaultSelfSrc(jimuUtils.processUrlInWidgetConfig(config.reportLogo, this.folderUrl));
            } else {
              this._setDefaultTaskIcon();
            }

            //nameTextBox
            this._onNameChanged(layer.arcgisProps.title);

            //at last, bind event for layerChooserSelect
            this._bindEventForLayerChooserSelect(this.layerChooserSelect);
          }), lang.hitch(this, function(err) {
            console.error(err);
            callback();
          }));
        }), lang.hitch(this, function(err) {
          console.error(err);
          callback();
        }));
      },

      _setDropDownFields: function(config) {
        if (config.dateField) {
          this.dateField.attr('displayedValue', config.dateField);
        }
        if (config.addressAuthorityField) {
          this.aaField.attr('displayedValue', config.addressAuthorityField);
        }
        if (config.proposedField) {
          this.proposedField.attr('displayedValue', config.proposedField);
        }
        if (config.proposedQueryValue) {
          this.proposedQueryValue.attr('value', config.proposedQueryValue);
        }
      },

      _setTableFields: function(fields) {
        for (var z = 0; z < fields.length; z++) {
          var fieldName = fields[z].fieldName;
          var fieldType = fields[z].type;
          var colWidth = fields[z].width.replace('%', '');

          this.fieldList.push({
            name: fieldName,
            type: fieldType
          });
          this._addFieldToTable(fieldName, fields[z].header, colWidth);
        }
      },

      _setCsvTableFields: function(fields) {
        for (var z = 0; z < fields.length; z++) {
          var fieldName = fields[z].fieldName;
          var fieldType = fields[z].type;
          var colWidth = fields[z].width.replace('%', '');

          this.csvFieldList.push({
            name: fieldName,
            type: fieldType
          });
          this._addFieldToCsvTable(fieldName, fields[z].header, colWidth);
        }
      },

      getConfig: function() {
        var config = {
          layerId: null,
          pdfReportFields: null
        };

        // get the list of fields
        var fieldList = this._getFieldList('fieldList', '.headerName', '.colWidth');

        var item = this.layerChooserSelect.getSelectedItem();
        if (!item) {
          this._showMessage(this.nls.selectLayerTip);
          return false;
        }

        // make sure the widths add up to 100%
        var totalWidth = this._checkWidths('.colWidth');
        if (totalWidth !== 100) {
          this._showMessage(this.nls.widthTip);
          return false;
        }

        var layer = item.layerInfo.layerObject;
        config.layerId = layer.id;
        config.url = layer.url;
        config.pdfReportFields = fieldList;
        // get the date field
        config.dateField = this.dateField.attr('displayedValue');
        config.addressAuthorityField = this.aaField.attr('displayedValue');
        config.proposedField = this.proposedField.attr('displayedValue');
        config.proposedQueryValue = this.proposedQueryValue.attr('displayedValue');

        // check if the csv list has been filled out
        var csvList = query('.csvHeaderName');
        if (csvList.length > 0) {
          // get the list of fields
          var csvFieldList = this._getFieldList('csvFieldList', '.csvHeaderName'); //, '.csvColWidth'
          config.csvReportFields = csvFieldList;
        } else {
          config.csvReportFields = fieldList;
        }
        // icon
        var icon = this.imageChooser.getImageData();
        if (icon === this._defaultTaskIcon) {
          icon = '';
        }
        config.reportLogo = icon;

        this.target.singleConfig = config;
        return config;
      },

      _checkWidths: function(className) {
        let fullWidth = 0;
        query(className).forEach(function(node) {
          fullWidth = fullWidth + parseInt(registry.byNode(node).attr('displayedValue'));
        });
        return fullWidth;
      },

      _getFieldList: function(fieldsList, headerCol, colWidth) {
        let configFieldList = [];
        // loop through the field list
        for (var z = 0; z < this[fieldsList].length; z++) {
          configFieldList.push({
            fieldName: this[fieldsList][z].name,
            header: registry.byNode(query(headerCol)[z]).attr('displayedValue'),
            type: this[fieldsList][z].type,
            width: colWidth != null ? registry.byNode(query(colWidth)[z]).attr('displayedValue') + '%' : ''
          });
        }

        return configFieldList;
      },

      calculateExpsBoxMaxHeight: function() {
        setTimeout(lang.hitch(this, function() {
          if (this.domNode) {
            var allExpsBox = this.filter.allExpsBox;
            var box1 = html.position(this.domNode);
            var box2 = html.position(allExpsBox);
            var maxHeight = box1.h - (box2.y - box1.y);
            if (maxHeight > 0) {
              allExpsBox.style.maxHeight = maxHeight + "px";
            }
          }
        }), 100);
      },

      reset: function() {
        //reset UI without layerChooserSet
        if (this.fieldsSelect != null) {
          this.fieldsSelect.destroy();
        }
        if (this.csvFieldsSelect != null) {
          this.csvFieldsSelect.destroy();
        }

        // reset the field options
        this.dateField.removeOption(this.dateField.getOptions());
        this.aaField.removeOption(this.aaField.getOptions());
        this.proposedField.removeOption(this.proposedField.getOptions());

        //reset icon
        this._setDefaultTaskIcon();

        //reset name
        // this.nameTextBox.set('value', '');
        this._onNameChanged('');

        // clear the field list
        this.csvFieldList = [];
        this.fieldList = [];
      },

      _setDefaultTaskIcon: function() {
        this.imageChooser.setDefaultSelfSrc(this._defaultTaskIcon);
      },

      _onNameChanged: function(name) {
        var labelNode = query('.label', this.target)[0];
        // var name = this.nameTextBox.get('value');
        labelNode.innerHTML = name;
        labelNode.title = name;
      },

      _bindEventForLayerChooserSelect: function(layerChooserSelect) {
        if (!layerChooserSelect.isBindEvent) {
          this.own(on(layerChooserSelect, 'selection-change', lang.hitch(this, this._onLayerChanged)));
          layerChooserSelect.isBindEvent = true;
        }
      },

      _showMessage: function(msg) {
        new Message({
          message: msg
        });
      },

      _onCsvBtnClicked: function() {
        this.addCsvFieldsDiv.style.display = '';
        this.csvFieldsTableEle.style.display = '';
      },

      //reset by new layer
      _onLayerChanged: function() {
        this.reset();
        var item = this.layerChooserSelect.getSelectedItem();
        if (!item) {
          return;
        }
        //nameTextBox
        var layerInfo = item.layerInfo;
        this.layer = layerInfo.layerObject;
        const excludeFields = ['OBJECTID', 'GlobalID'];
        let selOptions = [];
        let dateOptions = [];
        for (var z = 0; z < this.layer.fields.length; z++) {
          if (excludeFields.indexOf(this.layer.fields[z].name) < 0) {
            selOptions.push({
              label: this.layer.fields[z].name,
              value: this.layer.fields[z].name
            });
            if (this.layer.fields[z].type === 'esriFieldTypeDate') {
              dateOptions.push({
                label: this.layer.fields[z].name,
                value: this.layer.fields[z].name
              });
            }
          }
        }
        // add the date field options to the date column picker
        this.dateField.addOption(dateOptions);

        // add the proposed field options
        this.proposedField.addOption(lang.clone(selOptions));

        // add the address authority field options
        this.aaField.addOption(lang.clone(selOptions));

        // show the add field button
        this.addFieldBtn.style.display = '';

        this.fieldsSelect = new Select({
          name: 'fieldsSelect',
          style: {
            'width': '100%'
          }
        }).placeAt(this.fieldsDiv);
        this.fieldsSelect.addOption(selOptions);

        // add the csv field options
        this.csvFieldsSelect = new Select({
          name: 'csvFieldsSelect',
          style: {
            'width': '100%'
          }
        }).placeAt(this.csvFieldsDiv);
        this.csvFieldsSelect.addOption(selOptions);

        this._onNameChanged(layerInfo.title);
      },

      _onBtnFieldClicked: function() {
        var fieldName = this.fieldsSelect.attr('displayedValue');
        // find the field type from the list
        var filterField = array.filter(this.layer.fields, function(item) {
          return item.name === fieldName;
        });
        let fieldType = '';
        if (filterField[0].type === 'esriFieldTypeDate') {
          fieldType = 'date';
        } else {
          fieldType = 'string';
        }

        this.fieldList.push({
          name: fieldName,
          type: fieldType
        });
        this._addFieldToTable(fieldName);
      },

      _onCsvBtnFieldClicked: function() {
        var fieldName = this.csvFieldsSelect.attr('displayedValue');
        // find the field type from the list
        var filterField = array.filter(this.layer.fields, function(item) {
          return item.name === fieldName;
        });
        let fieldType = '';
        if (filterField[0].type === 'esriFieldTypeDate') {
          fieldType = 'date';
        } else {
          fieldType = 'string';
        }

        this.csvFieldList.push({
          name: fieldName,
          type: fieldType
        });
        this._addFieldToCsvTable(fieldName);
      },

      _addFieldToCsvTable: function(fieldName, headerName) {
        var tr = domConstruct.create("tr", {}, this.csvFieldsTable),
          td1 = domConstruct.create("td", {}, tr);
        domConstruct.create("div", {
          innerHTML: fieldName
        }, td1, 'first');
        var td2 = domConstruct.create("td", {}, tr);
        new TextBox({
          class: 'csvHeaderName',
          style: {
            width: '95%'
          },
          value: headerName != null ? headerName : ''
        }).placeAt(td2, 'first');
      },

      _addFieldToTable: function(fieldName, headerName, colWidth) {
        var self = this;
        var tr = domConstruct.create("tr", {}, this.fieldsTable),
          td1 = domConstruct.create("td", {}, tr);
        domConstruct.create("div", {
          innerHTML: fieldName
        }, td1, 'first');
        var td2 = domConstruct.create("td", {}, tr);
        new TextBox({
          class: 'headerName',
          style: {
            width: '95%'
          },
          value: headerName != null ? headerName : ''
        }).placeAt(td2, 'first');
        var td3 = domConstruct.create("td", {}, tr);
        new TextBox({
          class: 'colWidth',
          style: {
            width: '100%'
          },
          value: colWidth != null ? colWidth : ''
        }).placeAt(td3, 'first');
        // create the delete button
        var td4 = domConstruct.create("td", {}, tr);
        new Button({
          iconClass: 'deleteIcon',
          onClick: function(evt) {
            self.deletePdfField(evt)
          }
        }).placeAt(td4, 'first');
      },

      deletePdfField: function(evt) {
        var theRow = evt.target.parentNode.parentNode.parentNode;
        var removeName = query('td', theRow)[0].innerText;
        for (var i = 0; i < this.fieldList.length; i++) {
          if (this.fieldList[i].name === removeName.trim()) {
            this.fieldList.splice(i, 1);
            break;
          }
        }
        domConstruct.destroy(theRow);
      },

      _getLayerDefinitionForFilterDijit: function(layer) {
        var layerDefinition = null;

        if (layer.declaredClass === 'esri.layers.FeatureLayer') {
          layerDefinition = jimuUtils.getFeatureLayerDefinition(layer);
        }

        if (!layerDefinition) {
          layerDefinition = {
            currentVersion: layer.currentVersion,
            fields: lang.clone(layer.fields)
          };
        }

        return layerDefinition;
      },

      _showLoading: function() {
        this.emit("loading");
      },

      _hideLoading: function() {
        this.emit("unloading");
      },

      _arraysEqual: function(arr1, arr2) {
        if (arr1.length !== arr2.length) {
          return false;
        }
        for (var i = arr1.length; i--;) {
          if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) {
            return false;
          }
        }

        return true;
      },

      _onImageChooserDivClicked: function(evt) {
        if (!this.imageChooser.mask) {
          return;
        }

        var target = evt.target || evt.srcElement;
        if (target !== this.imageChooser.mask && target !== this.imageChooser.fileInput) {
          jimuUtils.simulateClickEvent(this.imageChooser.mask);
        }
      }

    });
  });